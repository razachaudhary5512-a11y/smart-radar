# 📡 Smart Radar — Master Project Document (v2)

> **Tagline:** _"Your Neighborhood, One App"_
> Everything happening within 1–5 km of you — alerts, deals, services, transport, and community. All in one place.

_v2 (2026-09-30): full UI rebuild, backend-agnostic data layer with demo mode, and a security-hardening migration. v1 is preserved in git (`3a8f921 Baseline`)._

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Quick Start](#2-quick-start)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Routes & Screens](#5-routes--screens)
6. [UI Shell & Design System](#6-ui-shell--design-system)
7. [Post Categories](#7-post-categories)
8. [Data Layer (Demo & Live)](#8-data-layer-demo--live)
9. [Authentication](#9-authentication)
10. [Database Schema](#10-database-schema)
11. [Security Model](#11-security-model)
12. [Admin System](#12-admin-system)
13. [Services & Integrations](#13-services--integrations)
14. [Environment Variables](#14-environment-variables)
15. [Going Live Checklist](#15-going-live-checklist)
16. [Changelog v1 → v2](#16-changelog-v1--v2)

---

## 1. Project Overview

**Smart Radar** is a hyperlocal community web app (PWA-ready, mobile-first, full desktop dashboard) that connects residents within a configurable 1–5 km radius. Users can:

- Browse a live feed of nearby posts filtered by GPS / chosen area and radius, sorted by Latest, Nearest or Top
- Post across **14 categories** — blood requests, power/utility outages, traffic, community posts & polls, events, jobs, home services, tutors, domestic help, rentals, buy & sell, deals, carpools
- Vote, comment, bookmark, share, report, confirm / resolve alerts, vote in polls and RSVP to events
- See everything on a clustered live map with an emergency-services layer
- Use an **Emergency hub** — one-tap Rescue 1122 / Police 15 / Edhi 115 / Fire 16, share location, trusted contacts via call/WhatsApp
- Manage a profile: CNIC verification, business listings, saved places, watched areas, pinned/muted categories, daily digest, theme, data export
- Moderate via an **Admin Console** with KPIs, charts, moderation, verification, listings, emergency contacts and an immutable audit log

**Target market:** urban Pakistan — PKR pricing, +92 phone auth, CNIC verification, local emergency numbers.

---

## 2. Quick Start

```bash
npm install
cp .env.example .env      # optional — without Supabase the app runs in demo mode
npm run dev               # http://localhost:5173
```

**Demo mode** starts automatically when Supabase isn't configured or can't be reached:

| What | How |
|---|---|
| Sign in | any Pakistani mobile number **or email**, code **123456** |
| Owner console | `/admin/login` → **Owner** (`owner@smartradar.demo` / `demo-owner`) — full control |
| Admin console | `/admin/login` → **Admin** (`admin@smartradar.demo` / `demo-admin`) — moderation only |
| Live website | https://razachaudhary5512-a11y.github.io/smart-radar/ (`npm run deploy:pages`) |
| Android APK | `npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk` |
| Data | stored in the browser (`localStorage`); Profile → Privacy → *Reset demo data* |

Demo content is generated around the viewer's real location and its timestamps stay fresh, so the app always looks alive.

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript 5 (strict) |
| Build | Vite 5 (route-level code splitting, vendor chunks) |
| Router | React Router 6 (lazy routes) |
| Styling | Tailwind CSS 3 with semantic CSS-variable tokens (light/dark/system) |
| Font / icons | Plus Jakarta Sans · Lucide |
| Backend | Supabase (Postgres + Auth + Storage + RPC) — optional thanks to demo mode |
| Maps | Leaflet + React-Leaflet + OpenStreetMap; Nominatim geocoding |
| Push | Firebase Cloud Messaging (optional) |

---

## 4. Project Structure

```
Smart Radar/
├── index.html                  # SEO/PWA meta, theme pre-paint script, fonts
├── public/                     # favicon.svg (radar mark), manifest.webmanifest
├── vite.config.ts              # alias @/, chunks, build-time secret-leak guard
├── tailwind.config.js          # tokens (bg/surface/line/ink), brand, animations
├── supabase/migrations/
│   ├── 20260822205833_create_smart_radar_schema.sql
│   ├── 20260925_security_hardening.sql
│   ├── 20260930000000_rebuild_hardening.sql   # ← v2 fixes (see §11)
│   └── 20261001000000_admin_user_management.sql # ← suspensions, user directory
└── src/
    ├── main.tsx · App.tsx      # providers + lazy routes
    ├── index.css               # design tokens, components (.card .btn .chip …)
    ├── config/                 # env.ts (single source of truth), validate-env.ts
    ├── data/
    │   ├── api.ts              # DataApi / AuthApi / AdminApi contracts
    │   ├── index.tsx           # BackendProvider — picks demo or live at startup
    │   ├── live.ts             # Supabase implementation
    │   ├── demo/index.ts       # localStorage implementation
    │   ├── demo/seed.ts        # demo users, posts, polls, RSVPs, listings, audit
    │   ├── feed.ts             # distance, radius, expiry, scheduling, sorting
    │   ├── images.ts           # client-side image compression
    │   └── events.ts           # change bus → screens refresh after writes
    ├── lib/
    │   ├── auth.tsx            # AuthProvider + requireAuth() sign-in prompt
    │   ├── theme.tsx           # light / dark / system
    │   ├── location-context.tsx# useRadar(): GPS, area switcher, radius
    │   ├── categories.ts       # 14 category configs, fields, safety tips
    │   ├── types.ts · format.ts · hooks.ts · location.ts · supabase.ts
    ├── components/
    │   ├── ui/                 # Sheet, ConfirmDialog, Toast, Avatar, Badge, Segmented, Switch, SmartImage, TrustRing…
    │   ├── layout/             # AppShell (sidebar + bottom nav + More sheet), Page, Logo
    │   ├── post/               # PostCard, usePostActions (optimistic)
    │   ├── map/                # MiniMap, pins
    │   ├── radar/AreaSheet.tsx # area switcher + radius sheet
    │   ├── RadarScope.tsx      # animated radar with real-bearing blips
    │   └── AuthSheet.tsx       # phone → OTP → name
    ├── screens/                # HomeFeed, MapView, CreatePost, PostDetail, SearchScreen,
    │   │                       # MyPosts, Saved, Profile, Emergency, Onboarding, NotFound
    │   └── admin/              # AdminLogin, AdminRoute, AdminDashboard, charts
    └── services/               # firebase.ts, maps.ts (geocoding), sms.ts, payments.ts
```

---

## 5. Routes & Screens

| Route | Screen | Sign-in | Notes |
|---|---|---|---|
| `/` | Radar Feed | No | Dashboard: hero stats, urgent strip, chips, sort, right-rail radar/analytics/emergency/trending |
| `/map` | Live Map | No | Clustered pins, radius circle, list panel (desktop) / preview card (mobile), emergency layer |
| `/search` | Explore | No | Search + radius + sort, recent & popular searches, category directory |
| `/create` | Create post | Yes | 3 steps: category → details → location & publish; live preview; `?category=`, `?repost=` |
| `/edit/:id` | Edit post | Owner | Same composer, prefilled |
| `/post/:id` | Post detail | No | Gallery, details grid, poll, RSVP, confirm/resolve, comments, author trust, contact, map, safety |
| `/my-posts` | My posts | Yes | Active / Scheduled / Closed, stats, edit/resolve/reopen/repost/delete |
| `/saved` | Saved | Yes | Bookmarks |
| `/profile` | Profile & settings | Yes | Account, CNIC verification, business listings, places, feed prefs, digest, theme, privacy |
| `/emergency` | Emergency | No | SOS, directory, urgent alerts, trusted contacts |
| `/onboarding` | Onboarding | No | 3-step first run (shown once, only when landing on `/`) |
| `/admin/login` | Admin login | No | Email + password |
| `/admin/dashboard` | Admin console | Admin | Guarded by `AdminRoute` (UX) + RLS/RPC checks (real) |

Browsing never requires an account; any write action opens the sign-in sheet and continues after sign-in.

---

## 6. UI Shell & Design System

- **Desktop (≥1024px):** fixed left sidebar (nav, New post, quick-post grid, account, theme, demo badge); screens use a content column + contextual right rail.
- **Mobile:** sticky headers, bottom nav — Feed · Map · **Post** (raised) · My Posts · More. The *More* sheet has quick posts (blood, outage, job, rental, service, ride), Explore, Emergency, Saved, Profile, Admin, theme, sign-out.
- **Tokens:** `bg`, `surface`, `surface-2`, `line`, `ink`, `ink-2`, `ink-3` are CSS variables swapped for dark mode; brand `primary` (blue) + `radar` (teal). Theme is applied before first paint (no flash).
- **Patterns:** bottom sheets on mobile / dialogs on desktop (focus-trapped, Esc to close), toasts, skeletons, empty & error states, optimistic interactions with rollback, `prefers-reduced-motion` respected, safe-area insets, 44px touch targets.

---

## 7. Post Categories

Defined in `src/lib/categories.ts` (fields, safety tips, expiry, colors).

| Slug | Label | Group | Auto-expires | Confirm | High-risk |
|---|---|---|---|---|---|
| `urgent_blood` | Emergency Blood Need | emergency | 6 h | ✅ | — |
| `utility_outage` | Power & Utility Outage *(new)* | emergency | 6 h | ✅ | — |
| `community_feed` | Community Post | community | never | — | — |
| `community_poll` | Community Poll | community | 3 days | — | — |
| `local_event` | Events & Meetups | community | 7 days | — | — |
| `jobs_internships` | Jobs & Internships | jobs | 30 days | — | ✅ |
| `home_services` | Home Services & Skills | services | never | — | ✅ |
| `tuition` | Tutors & Coaching | services | never | — | — |
| `domestic_help` | Domestic Help & Staff | services | never | — | ✅ |
| `property_rent` | Flats & Rentals | rentals | never | — | ✅ |
| `second_hand` | Buy & Sell (photo required) | marketplace | never | — | ✅ |
| `local_deals` | Deals & Discounts | marketplace | 7 days | — | — |
| `ride_share` | Carpool & Rideshare (women-only option) | transport | 1 day | — | ✅ |
| `traffic_alert` | Traffic & Road Updates | transport | 3 h | ✅ | — |

High-risk categories show safety tips and require acknowledgement before publishing. Field types: `text · textarea · number · select · toggle · price · blood_type · date · time · phone · poll_options`. Phone fields power one-tap **Call / WhatsApp** on the post.

---

## 8. Data Layer (Demo & Live)

All screens talk to one interface, `DataApi` (`src/data/api.ts`), via `useApi()`.

`BackendProvider` decides once at startup:

| `VITE_DATA_MODE` | Behaviour |
|---|---|
| `auto` *(default)* | Supabase if configured **and** `/auth/v1/health` responds within 4.5 s; otherwise demo |
| `demo` | Always demo |
| `live` | Always Supabase |

- **Live** (`live.ts`): bounding-box query on `posts`, embeds `poll_options(*)` and `comments(count)`, joins authors via `public_profiles`, and loads the viewer's votes/bookmarks/confirmations/poll votes/RSVPs in parallel. Images are compressed client-side and uploaded to the `post-images` bucket.
- **Demo** (`demo/index.ts`): a complete localStorage implementation (same rules: 3 reports hide a post, 5 "resolved" close an alert, one poll vote per user, owners only edit their own posts).
- **Feed pipeline** (`feed.ts`): distance → radius → hide `hidden` → hide future `scheduled_for` → hide expired/resolved → category → search → sort (featured posts float up for 24 h under *Latest*; *Top* = votes + confirmations + replies with time decay).
- The feed fetches the 5 km set once; radius, category and sort changes are instant on the client.

---

## 9. Authentication

**Users — phone OTP:** `+92` number → `request_otp_slot()` (5 per number per hour) → Supabase `signInWithOtp` → 6-digit code → first-time users choose a display name. A DB trigger creates the `profiles` row on sign-up.

**Admins — email + password** at `/admin/login`. After sign-in, `profiles.is_admin` is checked; non-admins are signed out. `isAdmin` in the client is derived only from the server profile. `AdminRoute` is a UX guard — every admin operation is re-checked in Postgres.

`useAuth().requireAuth(reason)` opens the sign-in sheet from anywhere and resolves once the user is signed in, so actions continue seamlessly.

---

## 10. Database Schema

Tables: `profiles`, `posts`, `votes`, `comments`, `bookmarks`, `reports`, `confirmations`, `poll_options`, `poll_votes`, `event_rsvps` *(new)*, `emergency_contacts`, `trusted_contacts`, `provider_listings`, `admin_audit_log`, `otp_rate_limit`. View: `public_profiles` *(new)*. Bucket: `post-images` *(new)*.

**v2 additions:** `profiles.watched_areas / digest_* / verification_date / verification_expiry / verification_history / verification_requested_at / fcm_token`; `posts.scheduled_for / reposted_from_id`; `poll_votes.post_id` (one vote per poll); check constraints on status, lengths, coordinates, radius, trust, theme.

**Triggers:** `on_auth_user_created` (profile), `votes_sync`, `confirmations_sync` (auto-resolve at 5), `reports_sync` (auto-hide at 3), `poll_votes_set_post` + `poll_votes_sync`, `posts_guard` (owners can't hide/unhide), `posts_updated_at`, `provider_listings_updated_at`.

**RPCs:** `request_otp_slot`, `submit_verification`, `admin_overview`, `admin_moderate_post`, `admin_verification_queue`, `admin_review_verification`, `admin_review_listing`, helpers `auth_is_admin`, `assert_admin`.

---

## 11. Security Model

`20260930000000_rebuild_hardening.sql` fixes issues found in the v1 schema. Each one was reproduced against v1 and then verified fixed by **50 automated checks** run on PostgreSQL 15 with a Supabase-compatible `auth`/`storage` stub:

| # | v1 problem (reproduced) | v2 fix |
|---|---|---|
| 1 | `REVOKE SELECT (cnic_number)` had no effect — **CNICs were readable via the API** | Table privileges revoked; explicit column-level `GRANT SELECT` (no `cnic_number`) |
| 2 | **Users could self-approve verification and set trust_score = 100** | Column-level `GRANT UPDATE` limited to preference fields; verification only via `submit_verification` / admin RPC |
| 3 | No profile row on sign-up; phone `NOT NULL` blocked email admins | `handle_new_user` trigger + backfill; phone nullable |
| 4 | App read profile columns that didn't exist → every profile fetch failed | Columns added |
| 5 | **Anonymous visitors could read/modify `otp_rate_limit` (phone numbers)** | Table locked; `request_otp_slot()` SECURITY DEFINER RPC |
| 6 | Vote/confirm/report/poll counters never changed (only owners may update posts) | SECURITY DEFINER counter triggers |
| 7 | Owners could set `is_featured` (paid boost), counters, un-hide moderated posts | Column grants + `posts_guard` trigger |
| 8 | Author names unreadable (profiles owner-only) | `public_profiles` view with 7 safe columns |
| 9 | Poll voters could vote for every option | `UNIQUE (post_id, user_id)` on `poll_votes` |
| 10 | Admin actions + audit were separate client calls | Atomic admin RPCs that re-check `auth_is_admin()` and write the audit log |

Also: scheduled posts hidden from the public until due; storage uploads restricted to `<uid>/…`; audit log immutable; the Vite build **refuses to build** if a secret (Twilio token, JazzCash password, service-role key) is set with a `VITE_` prefix; the Supabase client is only created in live mode.

> Also set **Supabase → Auth → Rate Limits → SMS per hour**. `request_otp_slot` is an app-level limit; the Auth limit is enforced server-side.

---

## 12. Owner & Admin System

**Roles:** Owner › Admin › User. The **owner** (you) can do everything an admin can, plus two owner-only areas:

- **Team & roles** — appoint or remove admins (owners can't be demoted or suspended; every change is audited).
- **App settings** — announcement banner (info / warning / good-news) shown to every user; pause all new posts; switch categories off; require CNIC verification to post in chosen categories; default radar radius for new visitors. All rules are enforced by the database (`can_post_category()` in the posts INSERT policy), admins are exempt so they can post official notices.

Make yourself owner once (live mode), after signing up: `UPDATE profiles SET is_owner = true, is_admin = true WHERE id = '<your-user-id>';`

**Architecture — one codebase, separate panel.** The admin console lives in the same project but is a completely separate area: its own URL (`/admin`), its own layout (dark sidebar, no user navigation), and its own code chunk that regular users never download. Access is enforced by the database (`auth_is_admin()` in RLS and every admin RPC), not by hiding the page — so a separate deployment isn't needed for security. If you later want `admin.yourdomain.com`, deploy the same build a second time and point that domain at `/admin`.

Console tabs:
- **Overview** — to-do header (reports / CNIC / listings awaiting review), KPIs, posts-per-day chart with week-over-week change, posts by category, needs-attention list, recent admin activity
- **Moderation** — reported / hidden / all, search; *why?* expands each report's reason; restore, hide with reason, feature, delete
- **Users** *(new)* — directory with search and filters (verified, business, suspended, admins), trust bar, post and report counts; per-user sheet to adjust trust score, revoke verification, **suspend / restore** (suspended users can browse but not post, comment, vote, report or RSVP, and their posts leave the public feed)
- **Verification** — CNIC masked by default with reveal, expiry date, notes, approve/reject
- **Listings** — pending/approved/rejected with notes; approved listings appear in the public **Verified local businesses** directory (feed + Explore)
- **Emergency** — add/edit/delete numbers, optional map pin
- **Audit log** — every admin action, immutable

**Create an admin (live):** create the user in Supabase Dashboard → Authentication (email + password) → Table Editor → `profiles` → set `is_admin = true`.

---

## 13. Services & Integrations

| Service | File | Status |
|---|---|---|
| Supabase | `lib/supabase.ts`, `data/live.ts` | Ready — needs a project + migrations |
| OpenStreetMap tiles + Nominatim geocoding | `services/maps.ts` | Active (cached, throttled to 1 req/s) |
| Firebase push | `services/firebase.ts`, `public/firebase-messaging-sw.js` | Client side ready (permission, token saved to `profiles.fcm_token`, background notifications). Needs `VITE_FIREBASE_VAPID_KEY` + a server-side sender (Edge Function) |
| Custom SMS (Twilio) | `services/sms.ts` | Via `send-sms` Edge Function; secrets server-side only |
| Payments (JazzCash / EasyPaisa) | `services/payments.ts` | Stubbed with activation checklist |

---

## 14. Environment Variables

See `.env.example`. **Every `VITE_` value is public.**

| Variable | Required | Notes |
|---|---|---|
| `VITE_DATA_MODE` | No | `auto` / `demo` / `live` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Live mode | Project Settings → API |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Leaflet/OSM used by default |
| `VITE_FIREBASE_*` (6) + `VITE_FIREBASE_VAPID_KEY` | No | Push notifications |
| `VITE_ENABLE_CUSTOM_SMS` | No | `true` after deploying `send-sms` |
| `VITE_ENABLE_PAYMENTS` | No | `true` after deploying `process-payment` |

Removed in v2: `VITE_TWILIO_*`, `VITE_JAZZCASH_*` — these must be Edge Function secrets.

---

## 15. Going Live Checklist

1. Create a new Supabase project (the v1 project `zmwmbb…` no longer exists).
2. Run the five migrations in order (SQL editor or `supabase db push`). All are idempotent; 86 automated security checks pass against them.
3. Enable **Phone** auth (Twilio/MessageBird provider) and set the SMS rate limit.
4. Put the new URL + anon key in `.env`; set `VITE_DATA_MODE=live` (or leave `auto`).
5. Create your admin user (§12).
6. In `.env.pages` and `.env.android` change `VITE_DATA_MODE=demo` to `auto`, then `npm run deploy:pages` (website) and `npm run apk` (Android).
7. Supabase → Authentication → Email templates → "Magic Link": include `{{ .Token }}` so users receive the 6-digit email code.

**Deployment:** the website is hosted on GitHub Pages from the `gh-pages` branch of `razachaudhary5512-a11y/smart-radar` (`npm run deploy:pages` builds with base `/smart-radar/`, adds `404.html` SPA fallback). The Android app is a Capacitor wrapper of the same build (`com.smartradar.app`); `npm run apk` produces a debug-signed APK for sideloading. For the Play Store, create a release keystore and run `gradlew bundleRelease`.

---

## 16. Changelog v1 → v2

- **Redesign:** new design system, desktop dashboard + mobile app shell, dark mode, radar visualisation, onboarding, skeletons, toasts, sheets.
- **New:** Emergency hub, Saved screen, Power & Utility Outage category, area switcher (GPS / saved / watched / search), live composer preview, scheduled posts, repost, crowd-resolution, clustered map, admin charts, data export.
- **Fixed:** broken quick links (`blood_request` → `urgent_blood`; `utility_outage` now exists), the app was permanently "signed in" as a fake local profile, admin status could be spoofed from `localStorage`, RSVPs/watched areas were browser-only, plus the security issues in §11.
- **Performance:** lazy routes, vendor chunking, client-side image compression, fetch-once feed filtering; dev server no longer serves all 1,500 icons individually.
