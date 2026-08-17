//! Two devices on the same network, exchanging their records directly.
//!
//! The shared folder needs something else to keep it in step — OneDrive,
//! Syncthing, a network drive. This is the case where that is one program too
//! many: both devices are on the same WiFi and awake, so they can simply talk.
//!
//! Deliberately not HTTP, not mDNS, not a single new crate. We own both ends,
//! so the wire format is four lines and a body, and finding the other device is
//! a matter of reading an address off its screen. A discovery library would
//! have cost a second implementation on Android — where multicast needs its own
//! lock and its own API — to save typing twelve characters.
//!
//! What it is not: a way in from outside. The listener runs only while the
//! dialog is open, answers only on the local network, and only to someone who
//! read the six-digit code off the other screen.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;

use crate::StorageError;

/// First line of every message. A version in the greeting costs eight bytes and
/// means a later change can be refused politely rather than misread.
const PROTOCOL: &str = "CHRONOS1";

/// Big enough for a lifetime of recorded time, small enough that a stranger
/// cannot make us allocate our way out of memory.
const MAX_BODY: usize = 8 * 1024 * 1024;

/// Nothing here should take longer. A phone that went to sleep mid-exchange
/// must not leave a thread waiting for it.
const TIMEOUT: Duration = Duration::from_secs(5);

/// How many wrong codes the listener answers before it gives up entirely.
///
/// Six digits is a million possibilities, which sounds like a lot and is not:
/// connections are answered one after another with no pause between them, so a
/// machine on the same network could work through the space in well under an
/// hour — and a guessed code is not only a way in, it is a copy of every hour
/// the user has recorded, because the answer carries the whole payload.
///
/// Ten is far above mistyping and far below a search. Once it is reached the
/// listener stops, so each further guess costs the attacker a person walking
/// over and reopening the dialog. That is what turns the code from a delay into
/// a barrier — not its length.
const MAX_REFUSALS: u32 = 10;

/// What the listener knows: what to hand out, who may ask, and when to stop.
struct Serving {
    code: String,
    payload: String,
    /// Set by the last device that talked to us, for the front end to collect.
    received: Mutex<Option<String>>,
    /// Wrong codes so far. See [`MAX_REFUSALS`].
    refused: AtomicU32,
    /// Set when the listener gave up rather than being closed by the user, so
    /// the dialog can say which of the two happened.
    exhausted: AtomicBool,
    stop: AtomicBool,
}

/// Compares two secrets without letting the time taken say how far they matched.
///
/// A network round trip buries a few nanoseconds of difference, so this is
/// defence in depth rather than a fix for something measurable — but it costs
/// four lines and no dependency, and the alternative is `==` on a secret, which
/// is the habit worth not having. The length is allowed to leak: everyone knows
/// the code is six digits.
fn same_secret(given: &str, expected: &str) -> bool {
    let (given, expected) = (given.as_bytes(), expected.as_bytes());
    if given.len() != expected.len() {
        return false;
    }

    given
        .iter()
        .zip(expected)
        .fold(0u8, |differing, (a, b)| differing | (a ^ b))
        == 0
}

#[derive(Default)]
pub struct LanState(Mutex<Option<Arc<Serving>>>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listening {
    /// What to read out: `192.168.178.43`.
    pub address: String,
    pub port: u16,
}

fn locked<'a>(
    state: &'a tauri::State<'_, LanState>,
) -> Result<std::sync::MutexGuard<'a, Option<Arc<Serving>>>, StorageError> {
    state.0.lock().map_err(|_| {
        StorageError::rejected("Der Netz-Abgleich ist in keinem brauchbaren Zustand.".into())
    })
}

/// This machine's address on the local network.
///
/// Asking a UDP socket where it would send from is the portable way to find it:
/// no packet is sent, the kernel just picks the interface it would use, and it
/// works the same on Windows, macOS, Linux and Android. Enumerating interfaces
/// would mean a crate per platform to answer one question.
fn local_address() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.168.1.1:80").ok()?;
    match socket.local_addr().ok()? {
        SocketAddr::V4(v4) => Some(v4.ip().to_string()),
        SocketAddr::V6(_) => None,
    }
}

/// Reads one line without letting a peer feed us an endless one.
fn read_line(reader: &mut BufReader<&TcpStream>) -> std::io::Result<String> {
    let mut line = String::new();
    reader.take(256).read_line(&mut line)?;
    Ok(line.trim_end().to_string())
}

fn read_body(reader: &mut BufReader<&TcpStream>, length: usize) -> std::io::Result<String> {
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body)?;
    String::from_utf8(body)
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "not UTF-8"))
}

fn write_message(stream: &mut TcpStream, header: &str, body: &str) -> std::io::Result<()> {
    write!(stream, "{PROTOCOL}\n{header}\n{}\n", body.len())?;
    stream.write_all(body.as_bytes())?;
    stream.flush()
}

/// Answers one device: checks the code, keeps what it sent, hands ours back.
fn answer(stream: TcpStream, serving: &Serving) -> std::io::Result<()> {
    stream.set_read_timeout(Some(TIMEOUT))?;
    stream.set_write_timeout(Some(TIMEOUT))?;

    let mut reader = BufReader::new(&stream);
    let mut out = stream.try_clone()?;

    if read_line(&mut reader)? != PROTOCOL {
        return write_message(&mut out, "ERR", "Das ist kein Chronos.");
    }

    // A wrong code is answered, not ignored: the person typing it needs to know
    // they mistyped. But answering forever is what makes a six-digit code
    // guessable, so the tenth wrong one closes the listener — see MAX_REFUSALS.
    if !same_secret(&read_line(&mut reader)?, &serving.code) {
        let wrong = serving.refused.fetch_add(1, Ordering::Relaxed) + 1;

        if wrong >= MAX_REFUSALS {
            serving.exhausted.store(true, Ordering::Relaxed);
            serving.stop.store(true, Ordering::Relaxed);
            return write_message(
                &mut out,
                "ERR",
                "Zu viele Fehlversuche — der Abgleich wurde beendet.",
            );
        }

        return write_message(&mut out, "ERR", "Der Code stimmt nicht.");
    }

    let length: usize = read_line(&mut reader)?.parse().unwrap_or(usize::MAX);
    if length > MAX_BODY {
        return write_message(&mut out, "ERR", "Die Daten sind zu groß.");
    }

    let body = read_body(&mut reader, length)?;
    if let Ok(mut received) = serving.received.lock() {
        *received = Some(body);
    }

    write_message(&mut out, "OK", &serving.payload)
}

/// Accepts until told to stop.
///
/// Non-blocking with a short sleep rather than a blocking accept: stopping is
/// then a flag rather than a second socket connecting to ourselves to break the
/// wait, and a hundred milliseconds of latency on a button press is nothing.
fn accept_loop(listener: TcpListener, serving: Arc<Serving>) {
    let _ = listener.set_nonblocking(true);

    while !serving.stop.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = answer(stream, &serving);
            }
            Err(ref error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    }
}

/// The port we ask for first, so the other device only has to be told an
/// address. Not required: a second instance on the same machine takes whatever
/// is free instead, and then the screen shows the port as well.
const PREFERRED_PORT: u16 = 45888;

/// Starts listening and says where.
#[tauri::command]
pub fn lan_start(
    state: tauri::State<LanState>,
    code: String,
    payload: String,
) -> Result<Listening, StorageError> {
    lan_stop(state.clone())?;

    let listener = TcpListener::bind(("0.0.0.0", PREFERRED_PORT))
        .or_else(|_| TcpListener::bind("0.0.0.0:0"))
        .map_err(|error| StorageError::rejected(format!("Kein Netzwerk-Zugang: {error}.")))?;

    let port = listener
        .local_addr()
        .map_err(|error| StorageError::rejected(format!("Kein Netzwerk-Zugang: {error}.")))?
        .port();

    let address = local_address().ok_or_else(|| {
        StorageError::rejected("Dieses Gerät hat keine Adresse im lokalen Netz.".into())
    })?;

    let serving = Arc::new(Serving {
        code,
        payload,
        received: Mutex::new(None),
        refused: AtomicU32::new(0),
        exhausted: AtomicBool::new(false),
        stop: AtomicBool::new(false),
    });

    let worker = Arc::clone(&serving);
    thread::spawn(move || accept_loop(listener, worker));

    *locked(&state)? = Some(serving);
    Ok(Listening { address, port })
}

#[tauri::command]
pub fn lan_stop(state: tauri::State<LanState>) -> Result<(), StorageError> {
    if let Some(serving) = locked(&state)?.take() {
        serving.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

/// What the last second brought, if anything.
///
/// `exhausted` is separate from "nothing arrived" on purpose: a listener that
/// gave up looks exactly like a quiet one from the front end, and a dialog that
/// goes on displaying an address nobody answers on is worse than one that says
/// what happened.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Incoming {
    pub payload: Option<String>,
    pub exhausted: bool,
}

/// Hands over what a peer sent, once. The front end asks every second while the
/// dialog is open; an event would need a listener that outlives the dialog.
#[tauri::command]
pub fn lan_received(state: tauri::State<LanState>) -> Result<Incoming, StorageError> {
    let guard = locked(&state)?;
    let Some(serving) = guard.as_ref() else {
        return Ok(Incoming::default());
    };

    let mut received = serving
        .received
        .lock()
        .map_err(|_| StorageError::rejected("Das Empfangene ist nicht lesbar.".into()))?;

    Ok(Incoming {
        payload: received.take(),
        exhausted: serving.exhausted.load(Ordering::Relaxed),
    })
}

/// The other half: connect, send ours, take theirs.
#[tauri::command]
pub fn lan_exchange(
    address: String,
    port: u16,
    code: String,
    payload: String,
) -> Result<String, StorageError> {
    let target: SocketAddr = format!("{address}:{port}")
        .parse()
        .map_err(|_| StorageError::rejected(format!("\"{address}\" ist keine Adresse.")))?;

    let mut stream = TcpStream::connect_timeout(&target, TIMEOUT).map_err(|error| {
        StorageError::rejected(format!(
            "Keine Verbindung zu {address}: {error}. Sind beide Geräte im selben WLAN und die App dort offen?"
        ))
    })?;

    let mut exchange = || -> std::io::Result<Result<String, String>> {
        stream.set_read_timeout(Some(TIMEOUT))?;
        stream.set_write_timeout(Some(TIMEOUT))?;
        write_message(&mut stream, &code, &payload)?;

        let peer = stream.try_clone()?;
        let mut reader = BufReader::new(&peer);

        if read_line(&mut reader)? != PROTOCOL {
            return Ok(Err("Am anderen Ende antwortet kein Chronos.".into()));
        }

        let header = read_line(&mut reader)?;
        let length: usize = read_line(&mut reader)?.parse().unwrap_or(usize::MAX);
        if length > MAX_BODY {
            return Ok(Err("Die Antwort ist zu groß.".into()));
        }

        let body = read_body(&mut reader, length)?;
        Ok(if header == "OK" { Ok(body) } else { Err(body) })
    };

    match exchange() {
        Ok(Ok(body)) => Ok(body),
        Ok(Err(message)) => Err(StorageError::rejected(message)),
        Err(error) => Err(StorageError::rejected(format!(
            "Der Austausch ist abgebrochen: {error}."
        ))),
    }
}

/// The whole exchange, against a listener on this machine.
///
/// `lan_start` and `lan_stop` need Tauri's state to reach the listener, but
/// everything that decides whether two devices can talk — the greeting, the
/// code, the framing — lives below that in `answer` and `lan_exchange`, and
/// both are reachable from here. The alternative was two devices, a WiFi and a
/// person, for every change to a line of framing.
#[cfg(test)]
mod tests {
    use super::*;

    /// Starts a listener on a free port and returns where it is.
    fn serve(code: &str, payload: &str) -> (u16, Arc<Serving>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().expect("addr").port();

        let serving = Arc::new(Serving {
            code: code.to_string(),
            payload: payload.to_string(),
            received: Mutex::new(None),
            refused: AtomicU32::new(0),
            exhausted: AtomicBool::new(false),
            stop: AtomicBool::new(false),
        });

        let worker = Arc::clone(&serving);
        thread::spawn(move || accept_loop(listener, worker));

        (port, serving)
    }

    #[test]
    fn both_sides_end_up_holding_the_other_one() {
        let (port, serving) = serve("123456", "{\"device\":\"b\"}");

        let theirs = lan_exchange(
            "127.0.0.1".into(),
            port,
            "123456".into(),
            "{\"device\":\"a\"}".into(),
        )
        .expect("exchange");

        assert_eq!(theirs, "{\"device\":\"b\"}");
        assert_eq!(
            serving.received.lock().unwrap().as_deref(),
            Some("{\"device\":\"a\"}")
        );

        serving.stop.store(true, Ordering::Relaxed);
    }

    /// A wrong code must fail *and* leave nothing behind: the point of the code
    /// is that a stranger on the same WiFi cannot push their hours into the app,
    /// which is only true if a refused exchange is also not collected.
    #[test]
    fn a_wrong_code_is_refused_and_nothing_is_kept() {
        let (port, serving) = serve("123456", "mine");

        let error = lan_exchange("127.0.0.1".into(), port, "000000".into(), "theirs".into())
            .expect_err("should be refused");

        assert!(error.message.contains("Code"), "{}", error.message);
        assert!(serving.received.lock().unwrap().is_none());

        serving.stop.store(true, Ordering::Relaxed);
    }

    /// The length prefix is what stops a peer from making us allocate our way
    /// out of memory, so a claim past the limit has to be refused before the
    /// body is read rather than after.
    #[test]
    fn an_oversized_body_is_refused_before_it_is_read() {
        let (port, serving) = serve("123456", "mine");

        let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect");
        write!(stream, "{PROTOCOL}\n123456\n{}\n", MAX_BODY + 1).expect("write");
        stream.flush().expect("flush");

        let peer = stream.try_clone().expect("clone");
        let mut reader = BufReader::new(&peer);
        assert_eq!(read_line(&mut reader).expect("greeting"), PROTOCOL);
        assert_eq!(read_line(&mut reader).expect("header"), "ERR");

        assert!(serving.received.lock().unwrap().is_none());
        serving.stop.store(true, Ordering::Relaxed);
    }

    #[test]
    fn something_that_is_not_chronos_gets_a_polite_no() {
        let (port, serving) = serve("123456", "mine");

        let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect");
        write!(stream, "GET / HTTP/1.1\n\n").expect("write");
        stream.flush().expect("flush");

        let peer = stream.try_clone().expect("clone");
        let mut reader = BufReader::new(&peer);
        assert_eq!(read_line(&mut reader).expect("greeting"), PROTOCOL);
        assert_eq!(read_line(&mut reader).expect("header"), "ERR");

        serving.stop.store(true, Ordering::Relaxed);
    }

    #[test]
    fn a_secret_is_compared_by_value_not_by_prefix() {
        assert!(same_secret("123456", "123456"));
        assert!(!same_secret("123457", "123456"));
        // The first digit differing must be no different from the last.
        assert!(!same_secret("923456", "123456"));
        assert!(!same_secret("12345", "123456"));
        assert!(!same_secret("", "123456"));
    }

    /// The whole point of the limit: a million codes cannot be walked through,
    /// because the listener stops answering long before the walk gets anywhere.
    #[test]
    fn guessing_is_over_after_the_tenth_wrong_code() {
        let (port, serving) = serve("123456", "geheim");

        for attempt in 1..MAX_REFUSALS {
            let error = lan_exchange("127.0.0.1".into(), port, "000000".into(), "x".into())
                .expect_err("wrong code");
            assert!(error.message.contains("Code"), "attempt {attempt}");
            assert!(
                !serving.exhausted.load(Ordering::Relaxed),
                "attempt {attempt}"
            );
        }

        // The tenth is answered, and is the last thing this listener ever says.
        let last = lan_exchange("127.0.0.1".into(), port, "000000".into(), "x".into())
            .expect_err("wrong code");
        assert!(last.message.contains("Fehlversuche"), "{}", last.message);
        assert!(serving.exhausted.load(Ordering::Relaxed));

        thread::sleep(Duration::from_millis(250));

        // And the correct code no longer helps — which is what makes the limit
        // worth anything: an attacker cannot simply carry on where they were.
        assert!(
            lan_exchange("127.0.0.1".into(), port, "123456".into(), "x".into()).is_err(),
            "the listener kept serving after giving up"
        );
    }

    /// Mistyping a few times must not cost the user their exchange.
    #[test]
    fn nine_wrong_codes_still_leave_the_right_one_working() {
        let (port, serving) = serve("123456", "geheim");

        for _ in 1..MAX_REFUSALS {
            let _ = lan_exchange("127.0.0.1".into(), port, "000000".into(), "x".into());
        }

        let theirs = lan_exchange("127.0.0.1".into(), port, "123456".into(), "meins".into())
            .expect("the right code after nine wrong ones");

        assert_eq!(theirs, "geheim");
        assert_eq!(serving.received.lock().unwrap().as_deref(), Some("meins"));

        serving.stop.store(true, Ordering::Relaxed);
    }

    #[test]
    fn a_listener_that_stopped_does_not_answer() {
        let (port, serving) = serve("123456", "mine");
        serving.stop.store(true, Ordering::Relaxed);

        // The loop wakes at most every 100ms; give it two of those to notice.
        thread::sleep(Duration::from_millis(250));

        assert!(lan_exchange("127.0.0.1".into(), port, "123456".into(), "theirs".into()).is_err());
    }
}
