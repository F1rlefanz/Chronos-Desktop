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
use std::sync::atomic::{AtomicBool, Ordering};
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

/// What the listener knows: what to hand out, who may ask, and when to stop.
struct Serving {
    code: String,
    payload: String,
    /// Set by the last device that talked to us, for the front end to collect.
    received: Mutex<Option<String>>,
    stop: AtomicBool,
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
    // they mistyped. Six digits over a local network, only while this dialog is
    // open — brute force would have to be quick, loud and in the same room.
    if read_line(&mut reader)? != serving.code {
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

/// Hands over what a peer sent, once. The front end asks every second while the
/// dialog is open; an event would need a listener that outlives the dialog.
#[tauri::command]
pub fn lan_received(state: tauri::State<LanState>) -> Result<Option<String>, StorageError> {
    let guard = locked(&state)?;
    let Some(serving) = guard.as_ref() else {
        return Ok(None);
    };

    let mut received = serving
        .received
        .lock()
        .map_err(|_| StorageError::rejected("Das Empfangene ist nicht lesbar.".into()))?;

    Ok(received.take())
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
