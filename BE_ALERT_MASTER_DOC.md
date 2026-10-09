# Be Alert — Master Document

> **Your neighbourhood, live.** Everything happening within 1–50 km of you — urgent alerts, blood requests, outages, traffic, jobs, rentals, deals, trusted local services and community — in one app.

*Last updated: 10 October 2026 · App version 2.8 · Formerly named “Smart Radar”*

---

## 1. What Be Alert is

**Be Alert** is a hyperlocal community platform for Pakistan (and works anywhere). It replaces noisy, unverified WhatsApp and Facebook groups with one structured place where neighbours post what is happening **right now**, and everyone sees only what is within the radius they choose around **their current location**.

It ships as three connected products:

| Product | What it is | Where |
|---|---|---|
| **Android app** | Installable app for Google Play (Capacitor), package `com.bealert.app` | `BeAlert-PlayStore.aab` / `BeAlert.apk` |
| **Web app** | The same app in any browser (not installable — a normal web app) | https://razachaudhary5512-a11y.github.io/smart-radar/ |
| **Website** | Marketing site that explains Be Alert and links to both | `D:\Projects\Be Alert\be-alert-website` (hosting to be chosen) |

The Android app and web app share **one account system and one live database**: anything done on one appears on the other automatically.

**Academic context:** Final Year Project, BS Computer Science, University of Agriculture (PARS Campus), by M Raza Abbas, supervised by Mr Ahmad Adnan.

---

## 2. Key principles

- **Current-location first** — the app and map always open on the device’s live GPS position. There is no built-in default city. If location is off, users see a “Turn on location” screen or can choose an area themselves.
- **Radius you control** — any radius from **1 to 50 km** (presets 1, 3, 5, 10, 25, 50 km).
- **Passwordless email sign-in** — Gmail or any email; a one-time link (or 6-digit code). No phone/SMS login, no passwords.
- **Trust & safety** — verified badges (CNIC), trust scores, reporting, auto-hide of reported posts, moderators, audit log.
- **Free, no ads** — no payment gateways in the current version (JazzCash/EasyPaisa were removed).

---

## 3. Features (current)

### 3.1 Post categories (14)

| Category | Purpose |
|---|---|
| Emergency Blood Need | Blood group, hospital & ward, bags needed, attendant contact |
| Power & Utility Outage | Electricity, gas or water outages; neighbours confirm “still happening” / “resolved” |
| Traffic & Road Updates | Blockades, diversions, accidents, heavy jams |
| Community Post | Updates, questions, recommendations, lost & found |
| Community Poll | Single-question local polls with live results |
| Events & Meetups | Date, time, venue, RSVP (“going” / “interested”) |
| Jobs & Internships | Full-time, part-time, internships, gigs |
| Home Services & Skills | Electricians, plumbers, AC repair, painters, mechanics |
| Tutors & Coaching | Home tuition, language and academic coaching |
| Domestic Help & Staff | Maids, cooks, drivers, babysitters, caretakers |
| Flats & Rentals | Flats, portions, rooms, houses, shops |
| Buy & Sell | Used phones, electronics, furniture, appliances |
| Deals & Discounts | Restaurant, grocery and store offers |
| Carpool & Rideshare | Daily commutes, shared rides, women-only option |

Every category has its own auto-expiry rule, so old posts disappear automatically.

### 3.2 For everyone
- **Feed** — live count of what’s nearby, urgent alerts first, sort by latest / nearest / top, category filters.
- **Live map** — every post as a coloured pin (Leaflet + OpenStreetMap), radius circle, “my location” button.
- **Explore / search** — by keyword, category and distance (1–50 km).
- **Post details** — photos, map, directions, call / WhatsApp buttons, comments, up/down votes, “still happening” confirmations, report.
- **Emergency screen** — one-tap Rescue 1122, Police 15, Edhi 115, Fire 16, Chhipa 1020, Motorway 130; trusted contacts; share live GPS location by WhatsApp/SMS (only the real GPS position is ever shared).
- **Verified local businesses** — CNIC-checked providers with call/WhatsApp buttons.
- **Profile & settings** — name, photo, radius, city/country, watched areas, muted/pinned categories, blocked users, light/dark theme.
- **Privacy** — download my data (JSON), **delete my account** (removes profile, posts, comments, photos, listings).
- **City / country picker** — Pakistan (26 cities), UAE, Saudi Arabia, Qatar, Oman, UK, USA, Canada, Australia, plus place search.
- **Auto-sync** — open screens refresh when the app returns to the foreground and every minute.

### 3.3 Owner Console (management)

Roles: **Owner** (full control) > **Admin** (moderation) > **User**. Open via the gold crown in the app/web app or `/admin/dashboard`.

| Tab | What it does |
|---|---|
| Overview | Totals, items needing review, posts-per-day chart |
| Live activity | New posts and sign-ups from all users, marked **App** or **Web**, refreshes every 15 s |
| Moderation | Reported / hidden / all posts — approve, hide, feature, delete |
| Users | Every account with its sign-in email — suspend/restore, trust score, revoke verification, make/remove admin (owner) |
| Verification | Approve or reject CNIC verification requests |
| Listings | Approve or reject business listings |
| Emergency | Manage the emergency numbers shown to everyone |
| Audit log | Every moderator action, permanently recorded |
| Team & roles | Owner manages the admin team |
| App settings | Announcement banner, pause posting, disable or verified-only categories, default radius |

---

## 4. Technology

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, React Router 7 |
| Maps | Leaflet + react-leaflet with OpenStreetMap tiles; Nominatim for place search (no Google Maps key needed) |
| Backend | Supabase — PostgreSQL with Row Level Security, Auth (email), Storage (post images) |
| Android | Capacitor 8 (geolocation, share, status bar, splash, app/deep links), signed release AAB/APK |
| Web app hosting | GitHub Pages (`/smart-radar/`), service worker for fast loading and offline app shell |
| Push (ready, not yet switched on) | Firebase Cloud Messaging |
| Website | Separate Vite + React + Tailwind project |

Supabase project: `jccsjbwbwhuywmbvlpnm`. Code repository: https://github.com/razachaudhary5512-a11y/smart-radar

### 4.1 Project structure (app)

```
src/
  App.tsx                 routes (feed, map, search, create, post, my-posts, saved, profile,
                          emergency, privacy, terms, onboarding, admin/login, admin/dashboard)
  components/             AuthSheet (email sign-in), layout (AppShell, Logo), radar
                          (AreaSheet, Pickers, LocationGate), post, map, ui
  config/env.ts           single source of environment settings
  data/                   DataApi interface, live (Supabase) and demo backends, sync events
  lib/                    auth, location-context, places, settings, theme, native, pwa, hooks
  screens/                HomeFeed, MapView, SearchScreen, CreatePost, PostDetail, MyPosts,
                          Saved, Profile, Emergency, Legal, Onboarding, admin/*
supabase/
  migrations/             schema history (security hardening, owner & settings, radius 50 km,
                          delete account, security audit fixes, email-only sign-in)
  setup_all.sql           everything in one file for a new Supabase project
  RUN_THIS_IN_SUPABASE.sql  latest pending update for the live project
android/                  Capacitor Android project (com.bealert.app)
```

### 4.2 Database

**Tables:** `profiles`, `posts`, `votes`, `comments`, `bookmarks`, `reports`, `confirmations`, `poll_options`, `poll_votes`, `event_rsvps`, `emergency_contacts`, `trusted_contacts`, `provider_listings`, `admin_audit_log`, `app_settings`.

**Server functions (RPCs):** `admin_overview`, `admin_list_users`, `admin_update_user`, `admin_moderate_post`, `admin_verification_queue`, `admin_review_verification`, `admin_review_listing`, `owner_set_admin`, `owner_update_settings`, `submit_verification`, `delete_my_account`, plus helper/trigger functions (`auth_is_admin`, `auth_is_owner`, `can_post_category`, rate limits, counters).

---

## 5. Security

- Row Level Security on every table; anonymous visitors can only read public posts, listings, emergency numbers and settings.
- Column-level permissions — users cannot change their own role, trust score, verification or ban status.
- Owner/admin powers run only in server functions that check the caller’s role.
- Passwordless email sign-in with PKCE; sign-in links only work on the device that requested them.
- Images must come from the app’s own storage; size limits on all text; per-user anti-spam limits (e.g. 10 posts/hour).
- Report auto-hide (3 reports) counts only accounts older than one day.
- Web app: strict Content-Security-Policy. Android: HTTPS only, backups off, release-signed, minimal permissions (internet, location, network state).
- Secrets (service-role key, SMTP passwords) never ship in the app; the build refuses to run if one is set.
- 113 automated database tests cover permissions, roles, moderation and deletion.

---

## 6. Building and releasing

| Task | Command (in the app folder) |
|---|---|
| Develop | `npm run dev` |
| Web app → GitHub Pages | `npm run deploy:pages` |
| Android release (AAB + APK) | `npm run release` |
| Type check / lint | `npm run typecheck`, `npm run lint` |

Release signing key: `D:\Projects\Be Alert\signing\bealert-release.jks` (+ `keystore.properties`). **Keep two backups — without it the Play Store app can never be updated.**

### Environment settings (`.env`, `.env.pages`, `.env.android`)

| Variable | Purpose |
|---|---|
| `VITE_DATA_MODE` | `live` for real builds (`demo` = sample data for testing) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase project (public values) |
| `VITE_PUBLIC_URL` | Web app address used in shared links |
| `VITE_ANDROID_APP_URL` | “Get the Android app” link on the web app |
| `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY` | Push notifications (optional) |
| `VITE_TURNSTILE_SITE_KEY` | CAPTCHA on sign-in (optional, after a custom domain) |

---

## 7. Status and next steps

**Done:** Android + web app, Owner Console, email sign-in, 1–50 km radius, current-location first, city/country picker, delete account, privacy & terms pages, security audit, marketing website, promotional reel.

**Next:**
1. Run `supabase/RUN_THIS_IN_SUPABASE.sql` on the live project (latest security update).
2. Custom email sending (SMTP, e.g. Resend) so login emails are not rate-limited.
3. Publish the Android app on Google Play, then point the “Get the app” links to the Play listing.
4. Host the marketing website (custom domain recommended, e.g. getbealert.com).
5. Optional: push notifications, CAPTCHA, iOS app.

**Future monetisation:** featured listings for rentals and deals, only after the app has real user density in a target area. No ads.
