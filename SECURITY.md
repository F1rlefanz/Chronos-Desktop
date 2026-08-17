# Sicherheit

Chronos ist ein Hobbyprojekt einer einzelnen Person. Es gibt keine Firma dahinter, keine
Bereitschaft und keine zugesagte Reaktionszeit — aber Meldungen werden gelesen und ernst genommen.

## Etwas gefunden?

Bitte **kein öffentliches Issue**. Der Meldeweg ist ein privates Security Advisory:

> Security → Advisories → **Report a vulnerability**
> <https://github.com/F1rlefanz/Chronos-Desktop/security/advisories/new>

Damit steht die Sache in einem Kanal, den nur Melder und Betreuer sehen, solange sie offen ist.

Hilfreich ist alles, was das Nachstellen abkürzt: Version (steht oben rechts in der App),
Betriebssystem, was du getan hast und was passiert ist. Ein Proof of Concept ist willkommen, aber
keine Bedingung.

Eine Rückmeldung kommt, sobald jemand Zeit hat — realistisch innerhalb einiger Tage. Bleibt sie
länger als zwei Wochen aus, ist das eher ein übersehenes Postfach als Desinteresse; ein Anstoß im
Advisory ist dann willkommen.

## Was im Umfang liegt

Die App selbst und der Weg, auf dem sie sich aktualisiert:

- der Abgleich im lokalen Netz (`lan.rs`) und über einen geteilten Ordner,
- die Kommandos an der Grenze zwischen Oberfläche und System (`src-tauri/`),
- das Einlesen fremder Daten — importierte JSON-Dateien, Dateien anderer Geräte,
- der Selbst-Update-Weg: Manifest, Signaturprüfung, das, was der Installer bekommt,
- alles, wodurch Daten das Gerät verlassen könnten.

Nicht im Umfang: GitHub selbst, die Speicherorte deines Betriebssystems, und ein Angreifer, der
ohnehin schon auf deinem entsperrten Rechner sitzt — gegen den schützt eine App nicht, die deine
Dateien im Klartext dort ablegt, wo du sie finden sollst.

## Was Chronos ohnehin nicht tut

Es gibt kein Konto, keinen Server und keine Telemetrie. Was du erfasst, liegt auf deinen Geräten.
Ins Internet geht genau eine Sache: die Frage, ob eine neuere Version vorliegt — und dabei werden
keine Daten mitgeschickt.

## Behebung

Ein Fehler mit Sicherheitsbezug wird in der nächsten Version behoben und in `CHANGELOG.md` unter
`### Security` benannt — in verständlicher Sprache, damit erkennbar ist, ob man betroffen war.
Updates kommen über den eingebauten Update-Weg; Wer melden möchte, dass eine Nennung mit Namen
erwünscht ist, sagt das bitte im Advisory.
