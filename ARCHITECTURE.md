# Raft Survival: Ocean Nomad — Arsitektur

## Boot
`index.html` → BootManager → DeviceCapability → RendererManager → QualityManager → Game

## Multiplayer
Host-authoritative via Firebase RTDB (`src/net/Net.js`). Config: env `VITE_FIREBASE_*`. Rules: `database.rules.json`.

## Modul inti
- `src/core/Game.js` — orkestrasi
- `src/core/InputBinder.js` — listener terlacak
- `src/core/SaveCoordinator.js` — save/emergency
- `src/sim/*` — logika murni
- `src/systems/*` — build, combat, disaster, story, weather
- `src/world/*` — ocean, debris, collision

## Catatan
Save key lokal masih memakai prefix `driftbound:` agar save lama tetap terbaca.
