# Emergent Airways

**F-16C Fighting Falcon Flight Simulator**

A browser-based 3D flight simulator built with Three.js and Google Photorealistic 3D Tiles. Fly an F-16 over real-world terrain with full weapons systems, realistic flight physics, and a fly-by-wire control system.

## Play Now

[https://jmcclure120.github.io/Flightsim/](https://jmcclure120.github.io/Flightsim/)

## Features

- **Photorealistic terrain** — Google 3D Tiles stream real-world photogrammetry with 3D buildings, terrain, and satellite imagery
- **F-16C Fighting Falcon** — detailed low-poly model with animated control surfaces and afterburner effects
- **Fly-by-wire flight model** — realistic lift, drag, thrust, and gravity with auto-stabilization and trim system
- **Weapons systems** — M61A1 Vulcan 20mm cannon, AIM-9 Sidewinder missiles, and Mk-82 500lb bombs with particle-based explosions
- **HUD** — authentic F-16 head-up display with pitch ladder, airspeed, altitude, heading, G-meter, and weapon status
- **Multiple locations** — preset locations in Alaska, Illinois, Washington, and Pennsylvania with search for anywhere on Earth
- **Gamepad support** — keyboard controls with Gamepad API support for joysticks

## Controls

| Control | Action |
|---------|--------|
| ↑ / ↓ | Pitch down / up |
| ← / → | Roll left / right |
| Q / E | Yaw left / right |
| Shift / Ctrl | Throttle up / down |
| Space | Fire selected weapon |
| 1 / 2 / 3 | Select Guns / Missiles / Bombs |
| G | Landing gear |
| F | Flaps |
| B | Airbrake |
| T | Auto-trim |
| C | Cycle camera |
| ESC | Pause menu |

## Tech Stack

- **Three.js** — 3D rendering
- **3d-tiles-renderer** (NASA-AMMOS) — Google Photorealistic 3D Tiles streaming
- **Web Audio API** — synthesized engine, weapon, and explosion sounds
- **Vite** — build tooling
- **Mapbox Geocoding API** — location search

## Setup

To run locally:
```bash
git clone https://github.com/jmcclure120/Flightsim.git
cd Flightsim
npm install
npm run dev
```

You will need your own API keys:
- Google Maps Platform (Map Tiles API enabled)
- Mapbox (for geocoding/location search)

## Credits

Built with Claude Code. Terrain data © Google Maps Platform. Geocoding © Mapbox.
