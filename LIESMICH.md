# Chronos — kurz erklärt

Eine Zeiterfassung mit Stoppuhr. Läuft auf Windows, macOS, Linux, Android und im Browser.

Kein Konto, kein Server, keine Cloud: Alles, was du erfasst, bleibt auf dem Gerät, auf dem du
es erfasst hast.

Dieses Dokument ist für Leute, die Chronos **benutzen** wollen. Wer wissen will, wie es gebaut ist,
findet das in [README.md](README.md) — auf Englisch, für Entwickler.

## Welche Datei brauche ich?

In jeder Veröffentlichung liegen ein gutes Dutzend Dateien. Gebraucht wird genau eine davon:

| Dein Gerät                       | Datei                                      |
| -------------------------------- | ------------------------------------------ |
| **Windows**                      | `Chronos.Desktop_<Version>_x64-setup.exe`  |
| **Android**                      | `Chronos-<Version>.apk`                    |
| **macOS**                        | `Chronos.Desktop_<Version>_universal.dmg`  |
| **Linux**, egal welches          | `Chronos.Desktop_<Version>_amd64.AppImage` |
| Linux mit Debian oder Ubuntu     | `…_amd64.deb`                              |
| Linux mit Fedora, RHEL, openSUSE | `…-1.x86_64.rpm`                           |

Alles Weitere ist Maschinenkram und braucht dich nicht zu interessieren:

- `.sig` — Signaturen, mit denen die App prüft, dass ein Update echt ist
- `latest.json`, `latest-android.json` — woran die App merkt, dass es etwas Neueres gibt
- `Chronos.Desktop.app.tar.gz` — dasselbe für macOS, aber nur für den Update-Vorgang
- `.msi` — eine zweite Windows-Fassung für Firmen, die Software zentral verteilen

`SHA256SUMS.txt` ist für dich, aber nur wenn du magst — siehe unten.

## Installieren

**Windows.** Die `.exe` doppelklicken. Es werden keine Administratorrechte gebraucht; Chronos
installiert sich nur für dich.

Windows wird beim ersten Mal warnen: _„Der Computer wurde durch Windows geschützt"_. Der Grund ist,
dass der Installer nicht mit einem kostenpflichtigen Zertifikat signiert ist — nicht, dass etwas
damit nicht stimmt. Über **Weitere Informationen → Trotzdem ausführen** geht es weiter. Wer das
nicht auf Zuruf glauben mag, kann vorher die Prüfsumme vergleichen (siehe unten).

**Android.** Die `.apk` auf dem Telefon öffnen. Android fragt einmal, ob es dieser Quelle vertrauen
darf — das ist normal bei Apps, die nicht aus dem Play Store kommen.

**macOS.** Das `.dmg` öffnen und Chronos in den Programme-Ordner ziehen. Beim ersten Start
Rechtsklick → Öffnen, weil auch hier keine Signatur eines bezahlten Entwicklerkontos vorliegt.

**Linux.** Die `.AppImage` ausführbar machen (`chmod +x`) und starten. `.deb` und `.rpm` gehen
alternativ über die Paketverwaltung.

## Chronos hält sich selbst aktuell

Ab Version 1.1.0 sieht Chronos beim Start nach, ob es etwas Neueres gibt — ab 1.2.0 zusätzlich alle
sechs Stunden und immer, wenn du nach längerer Zeit ins Fenster zurückkehrst. Gibt es ein Update,
erscheint oben eine Leiste mit den wichtigsten Änderungen und einem Knopf.

- **Auf dem Rechner** lädt Chronos die neue Fassung, installiert sie und startet sich neu.
- **Auf dem Handy** lädt Chronos sie herunter und übergibt sie an Androids eigenen
  Installationsdialog. Den letzten Schritt musst du dort antippen — das lässt Android keine App
  allein entscheiden, und das ist auch gut so.

Der Hinweis lässt sich wegklicken; er gilt dann für diese eine Version als erledigt und kommt bei
der nächsten wieder.

**Einmal von Hand:** Eine Fassung vor 1.1.0 kennt diesen Mechanismus noch nicht und kann sich
deshalb nicht selbst ablösen. Wer noch älter unterwegs ist, installiert einmal von Hand — ab dann
läuft es allein.

## Wo liegen meine Daten?

| System      | Ort                                                         |
| ----------- | ----------------------------------------------------------- |
| **Windows** | `%LOCALAPPDATA%\Chronos\`                                   |
| **macOS**   | `~/Library/Application Support/Chronos/`                    |
| **Linux**   | `~/.local/share/Chronos/`                                   |
| **Android** | im App-Speicher, oder in einem Ordner, den du selbst wählst |
| **Browser** | im Speicher des Browsers                                    |

Darin liegen `data/` (deine Einträge), `backups/` (automatische Sicherungen), `exports/` und
`logs/`.

**Die Daten liegen absichtlich getrennt von den Programmdateien.** Ein Update findet sie deshalb
wieder, und eine Deinstallation entfernt nur das Programm — deine erfassten Zeiten zu löschen soll
etwas sein, das du bewusst tust.

## Sicherungen

Chronos sichert von sich aus: einmal täglich beim Start, beim Schließen des Fensters, und immer
unmittelbar bevor etwas Größeres passiert — bevor die Historie gelöscht wird und bevor eine Datei
importiert wird. Die letzten zwanzig bleiben erhalten, ältere räumt Chronos selbst weg.

Über die Einstellungen lässt sich der Sicherungsordner öffnen.

## Zwei Geräte auf einem Stand

Es gibt zwei Wege, beide ohne Konto und ohne fremden Server:

1. **Über einen geteilten Ordner.** Du wählst in den Einstellungen einen Ordner, den ohnehin schon
   etwas synchron hält — OneDrive, Syncthing, ein Netzlaufwerk. Chronos legt dort eine kleine Datei
   je Gerät ab. Der geduldige Weg: funktioniert auch, wenn die Geräte nie gleichzeitig an sind.
2. **Direkt im selben WLAN.** Ein Gerät wartet und zeigt eine Adresse und einen sechsstelligen Code,
   am anderen tippst du beides ein. Ein Knopfdruck, danach haben beide denselben Stand. Dafür müssen
   beide gleichzeitig an und im selben Netz sein.

Bearbeitest du denselben Eintrag auf zwei Geräten, gewinnt die neuere Fassung. Eine laufende
Messung bleibt auf ihrem Gerät — geteilt wird, was fertig ist.

## Prüfsumme vergleichen (freiwillig)

`SHA256SUMS.txt` in der Veröffentlichung enthält für jede Datei einen Prüfwert. Damit lässt sich
feststellen, ob die heruntergeladene Datei unverändert ist.

```
# Windows
certutil -hashfile Chronos.Desktop_<Version>_x64-setup.exe SHA256

# macOS und Linux
sha256sum -c SHA256SUMS.txt
```

Der Wert unter Windows muss mit der Zeile zu dieser Datei übereinstimmen. Groß- und Kleinschreibung
spielt keine Rolle.

## Wenn etwas nicht stimmt

1. Chronos ganz schließen und neu starten.
2. Nachsehen, welche Version läuft — sie steht unten im Fenster.
3. Meldet Chronos oben, dass etwas nicht gespeichert oder nicht gelesen werden konnte, **erst
   sichern** (Einstellungen → Sicherungsordner), bevor du weitermachst. Eine solche Meldung heißt,
   dass das, was auf dem Bildschirm steht, nicht sicher dem entspricht, was gespeichert ist.
4. Fehler und Vorschläge gehören zu
   [den Issues](https://github.com/F1rlefanz/Chronos-Desktop/issues).

## Was Chronos nicht kann

- **iOS.** Nicht gebaut — dafür bräuchte es einen Mac und ein bezahltes Apple-Entwicklerkonto.
- **Signierte Installer.** Kosten Geld pro Jahr, deshalb warnen Windows und macOS beim ersten Start.
  Die Prüfsumme oben ist der Ersatz, den man ohne Zertifikat anbieten kann.
- **Automatische Installation auf Android.** Den letzten Tipp macht Android absichtlich selbst.
- **Sicherungen im Browser.** Dort ist zu wenig Platz für eine zweite Kopie; die App-Fassungen
  sichern, die Browser-Fassung nicht.
