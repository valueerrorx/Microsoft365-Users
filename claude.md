# Claude Arbeitsanweisung (dieses Repo)

## Pflicht: Erst lesen, dann arbeiten
- **Bevor du irgendetwas tust (Analyse, Suche, Codeänderung, Tests):** lies vollständig `project.md`.
- **Nutze `project.md` als Single Source of Truth** für Architektur, Zuständigkeiten, Dateien, IPC, PowerShell-Skripte und Datenfluss.

## Arbeitsweise
- **Keine Re-Analyse des gesamten Repos**: Wenn dir Kontext fehlt, suche gezielt innerhalb der in `project.md` genannten Dateien.
- **Wenn du neue Dateien/Flows einführst oder Verantwortlichkeiten änderst:** aktualisiere zuerst `project.md`, damit zukünftige Sessions keine Tokens für erneute Gesamterkundung verschwenden.
- **Wenn du unsicher bist, wo etwas implementiert ist:** starte bei den „zentralen Dateien“ aus `project.md` (Renderer Stores/Views ↔ `index.js` IPC ↔ `scripts/*.ps1`).

## Output/Kommunikation
- **Antwortsprache**: Deutsch.
- **Keine Änderungen in `node_modules/`.**

