# Emergent Airways - F-16 Flight Simulator

A browser-based 3D F-16 flight simulator built with Three.js and Mapbox satellite terrain.

## Mapbox Token

To deploy your own version, replace the `MAPBOX_TOKEN` constant with your own token from [mapbox.com](https://www.mapbox.com/). Restrict your token to your deployed domain in Mapbox account settings.

## Development

```bash
npm install
npm run dev
```

## Deployment (Cloudflare Pages)

```bash
npm run build
npm run deploy
```

Or connect the GitHub repo to Cloudflare Pages dashboard for auto-deploy with:
- Build command: `npm run build`
- Build output directory: `dist`
