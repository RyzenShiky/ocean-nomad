# Raft Survival: Ocean Nomad

Survival rakit di laut terbuka — browser (Three.js + WebGL2).

Sebelumnya dikenal sebagai prototipe Driftbound.

## Menjalankan

```bash
# tanpa build
python -m http.server 8080
# buka http://localhost:8080

# atau dengan Vite
npm install
npm run dev
```

## Build & deploy

```bash
npm run build
# hasil di dist/ → GitHub Pages / Vercel / static host
# GH Pages: VITE_BASE=/ocean-nomad/ npm run build
```

## Kontrol

| Input | Aksi |
|-------|------|
| WASD | Gerak |
| Mouse | Lihat (pointer lock) |
| E | Interaksi / station / chest |
| Tab | Craft |
| RMB + hammer | Menu bangun |
| LMB + hammer/axe/spear | Pasang / bongkar / serang |
| F3 | Overlay debug |
| V | Kamera orang ketiga |
| Esc | Jeda |

## Multiplayer

1. Buat **project Firebase baru** khusus Ocean Nomad.
2. Aktifkan **Anonymous Auth** + **Realtime Database**.
3. Publish `database.rules.json`.
4. Salin config ke `.env` (lihat `.env.example`).
5. Host: **Buat Room** → bagikan kode → **Mulai**. Client: **Gabung**.

Model: host-authoritative (dunia, bencana, raft); inventory lokal per pemain.

## Tes

```bash
npm test
```

## Lisensi

Proyek pribadi / prototipe.

## Deploy GitHub Pages

1. Repo → **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions** → buat secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Firebase → Authentication → Authorized domains → tambah `USERNAME.github.io`
4. Push ke `main` (workflow `Deploy Pages` memakai `npm install` + secrets di atas)
5. **Jangan commit `.env`** — hanya secrets CI

Lokal: `cp .env.example .env` → isi nilai → `npm install` → `npm run dev`
