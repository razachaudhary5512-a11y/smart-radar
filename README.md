# 📡 Smart Radar — Your Neighbourhood, One App

Everything happening within 1–5 km of you — blood requests, outages, traffic, jobs, rentals, services, deals, carpools, events and community polls. Built for urban Pakistan.

**Live demo:** https://razachaudhary5512-a11y.github.io/smart-radar/

> The live demo runs in **demo mode**: sample data, saved only in your browser. Sign in with any number or email using code **123456**. Owner console: `/admin/login` → *Owner*.

## Features

- Live radar feed with radius (1–5 km), area switcher, Latest / Nearest / Top sorting
- 14 categories with tailored forms, safety tips and auto-expiry
- Clustered live map, emergency hub (1122 / 15 / 115 / 16, trusted contacts, share location)
- Votes, comments, bookmarks, polls, event RSVPs, crowd “still happening / resolved”
- CNIC verification, verified business directory, trust scores
- **Owner console** — team & roles, app settings (announcements, pause posting, category controls)
- **Admin console** — moderation, users & suspensions, verification, listings, emergency numbers, audit log
- Light / dark / system theme, mobile-first + full desktop dashboard, Android app (Capacitor)

## Run locally

```bash
npm install
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run deploy:pages` | Build and publish to GitHub Pages |
| `npm run apk` | Build the Android debug APK |

## Going live with real data

1. Create a Supabase project and run the migrations in `supabase/migrations/` in order.
2. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (see `.env.example`).
3. Set `VITE_DATA_MODE=auto` in `.env.pages` / `.env.android` and redeploy.
4. Make yourself owner: `UPDATE profiles SET is_owner = true, is_admin = true WHERE id = '<your-user-id>';`

Full documentation: [`SMART_RADAR_MASTER_DOC.md`](SMART_RADAR_MASTER_DOC.md).

Stack: React 18 · TypeScript · Vite · Tailwind CSS · Supabase · Leaflet/OpenStreetMap · Capacitor.
