# Mobile companion

Installable, offline, dependency-free PWA for `job_search_tracker.csv`.

## Features
- Pipeline with filters, search, deadline-first sorting
- Deadlines tab: 7-day and passed deadlines, 10+ day quiet follow-ups, drafted-not-sent
- Stats: submitted, interview rate, rejection rate (drafted rows excluded), status and sector bars
- Add, edit, delete, log follow-up (`followed up YYYY-MM-DD` note marker)
- CSV import/export with the 14-column tracker schema, legacy status spellings accepted, formula-injection guarded
- Bulk add: paste a list (`Company | Role | Link`, or links alone) from Claude or ChatGPT
- Apply queue: one `/apply <link>` command per drafted job, copy one or all
- CV and portfolio files stored on the phone (IndexedDB), never uploaded
- Copy-to-clipboard CSV export, dark mode, safe-area insets, 44px+ touch targets

## Run
```
cd mobile
python3 -m http.server 8080
```
Open `http://<your-lan-ip>:8080` on the phone, then Add to Home Screen. Service workers need HTTPS or localhost; any static host (GitHub Pages, Netlify) works.

## Sync
Data lives in the device's localStorage. Move it with CSV: AirDrop or share `job_search_tracker.csv` to the phone, Import. Export and send back to the repo root.

## Test
```
node mobile/core.test.js
```
