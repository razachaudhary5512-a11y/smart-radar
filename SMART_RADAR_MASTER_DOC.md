# 📡 Smart Radar — Master Project Document

> **Tagline:** _"Your Neighborhood, One App"_
> Everything happening within 1–5 km of you — alerts, deals, services, transport, and community. All in one place.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Application Routing & Screens](#4-application-routing--screens)
5. [Navigation & UI Shell](#5-navigation--ui-shell)
6. [Post Categories](#6-post-categories)
7. [Authentication System](#7-authentication-system)
8. [Database Schema](#8-database-schema)
9. [Row Level Security (RLS)](#9-row-level-security-rls)
10. [Admin System](#10-admin-system)
11. [Services & Integrations](#11-services--integrations)
12. [Environment Variables](#12-environment-variables)
13. [Data Types & Interfaces](#13-data-types--interfaces)
14. [Security Hardening](#14-security-hardening)
15. [Feature Flags & Roadmap](#15-feature-flags--roadmap)
16. [Development Guide](#16-development-guide)

---

## 1. Project Overview

**Smart Radar** is a hyperlocal community web application (PWA-ready) that connects residents within a configurable 1–5 km radius. Users can:

- Browse a real-time feed of local posts filtered by their GPS location and chosen radius
- Post across 14+ categories: community news, job listings, marketplace items, home services, blood donation alerts, carpool rides, traffic updates, and more
- Interact with posts via upvotes/downvotes, comments, bookmarks, confirmations, and polls
- Manage a personal profile with saved locations, pinned categories, muted topics, and a daily digest
- View all local posts on an interactive map
- Access an admin dashboard for content moderation and user verification

**Target Market:** Urban Pakistan — with PKR-denominated pricing, local categories (CNIC verification, JazzCash/EasyPaisa payments), and pre-seeded emergency contacts (Rescue 1122, Police 15, Edhi Foundation 115, Fire Brigade 16).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript 5.5 |
| **Build Tool** | Vite 5.4 |
| **Router** | React Router DOM v6 |
| **Styling** | Tailwind CSS 3.4 |
| **Icons** | Lucide React 0.446 |
| **Backend / DB** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **Maps** | Leaflet 1.9 + React-Leaflet 4.2 (OpenStreetMap by default) |
| **Push Notifications** | Firebase Cloud Messaging (optional) |
| **SMS / OTP** | Supabase Phone Auth (primary) + Twilio (optional custom) |
| **Payments** | JazzCash / EasyPaisa (stubbed — not yet activated) |
| **Linting** | ESLint 9 + typescript-eslint |

### Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.57.4",
  "firebase": "^12.19.0",
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  "react-router-dom": "^6.26.2",
  "lucide-react": "^0.446.0"
}
```

---

## 3. Project Structure

```
Smart Radar/
├── index.html                     # App entry point — SEO meta, viewport, theme-color
├── vite.config.ts                 # Vite build config
├── tailwind.config.js             # Tailwind theme + custom tokens
├── tsconfig.app.json              # TypeScript config
├── .env                           # Real secrets (gitignored)
├── .env.example                   # Template — safe to commit
│
├── src/
│   ├── main.tsx                   # React root render
│   ├── App.tsx                    # Router, providers, NavigationBar, AppLayout
│   ├── index.css                  # Global styles
│   ├── vite-env.d.ts              # Vite type declarations
│   │
│   ├── config/
│   │   ├── env.ts                 # Single source of truth for all env vars
│   │   └── validate-env.ts        # Runtime env validation + warnings
│   │
│   ├── lib/
│   │   ├── auth.tsx               # AuthContext — OTP sign-in, admin login, profile
│   │   ├── supabase.ts            # Supabase client singleton
│   │   ├── types.ts               # All TypeScript interfaces (Post, Profile, etc.)
│   │   ├── categories.ts          # Category configs — slugs, icons, fields, expiry
│   │   ├── location.ts            # Haversine distance util + Coords type
│   │   ├── location-context.tsx   # LocationProvider — GPS coords + radius state
│   │   ├── theme.tsx              # ThemeProvider — light/dark mode
│   │   └── dummy-data.ts          # localStorage helpers + demo seed data
│   │
│   ├── components/
│   │   ├── AdminRoute.tsx         # Route guard for /admin/* pages
│   │   ├── PostCard.tsx           # Main post card — vote, comment, bookmark, share
│   │   ├── QuickPostWidget.tsx    # Floating "quick post" bottom sheet
│   │   └── ui.tsx                 # Shared UI: Modal, Toast, Spinner, EmptyState
│   │
│   ├── screens/
│   │   ├── HomeFeed.tsx           # Main feed — category filter, radius, area switcher
│   │   ├── MapView.tsx            # Leaflet map — clustered post pins
│   │   ├── CreatePost.tsx         # Create / edit post — all category fields
│   │   ├── PostDetail.tsx         # Full post — comments, RSVP, poll, actions
│   │   ├── SearchScreen.tsx       # Full-text + category search
│   │   ├── MyPosts.tsx            # User's own posts with edit/delete
│   │   ├── Profile.tsx            # Full profile — settings, saved locations, etc.
│   │   ├── Onboarding.tsx         # 3-step first-run wizard
│   │   ├── AdminLogin.tsx         # Admin email + password login
│   │   └── AdminDashboard.tsx     # Admin moderation, user verification, listings
│   │
│   └── services/
│       ├── firebase.ts            # Firebase init + FCM push notifications
│       ├── sms.ts                 # OTP send/verify + Twilio custom SMS stub
│       ├── payments.ts            # JazzCash / EasyPaisa stubs (not yet live)
│       └── maps.ts                # Map helpers + geocoding utils
│
└── supabase/
    └── migrations/
        ├── 20260822205833_create_smart_radar_schema.sql   # Core schema
        └── 20260925_security_hardening.sql                # Security hardening
```

---

## 4. Application Routing & Screens

All routes are defined in `src/App.tsx` inside `<AppLayout>`.

| Route | Screen | Auth Required | Notes |
|---|---|---|---|
| `/` | `HomeFeed` | No | Default route + wildcard fallback |
| `/map` | `MapView` | No | Interactive Leaflet map |
| `/create` | `CreatePost` | Yes | Supports `?category=<slug>` param |
| `/edit/:id` | `CreatePost` | Yes | Reuses CreatePost in edit mode |
| `/post/:id` | `PostDetail` | No | Full post + comments |
| `/search` | `SearchScreen` | No | Full-text + category search |
| `/my-posts` | `MyPosts` | Yes | User's own post management |
| `/profile` | `Profile` | Yes | Profile + settings |
| `/onboarding` | `Onboarding` | No | Hides NavigationBar |
| `/admin/login` | `AdminLogin` | No | Email + password |
| `/admin/dashboard` | `AdminDashboard` | **Admin only** | Protected by `AdminRoute` |
| `/admin` | `AdminLogin` | No | Redirect alias |

### Screen Summaries

#### HomeFeed (`/`)
- Loads posts from Supabase filtered by GPS coords + chosen radius (1–5 km)
- Category tab bar with pinned categories at the top
- Watched Areas switcher to view other pre-saved areas
- Floating QuickPost widget for fast posting
- Radius adjustment modal
- Live "active users nearby" counter (demo mode: 38)

#### MapView (`/map`)
- Leaflet + OpenStreetMap interactive map
- Post pins clustered by category with colored markers
- Bottom sheet for selected post preview

#### CreatePost (`/create`, `/edit/:id`)
- Multi-step form adapted to each category's `fields` config
- Photo upload (multi-image), location picker, expiry toggle
- Women-only flag for ride-share posts
- Scheduling support (`scheduled_for` field)
- Safety tips shown for high-risk categories
- Poll options builder for `community_poll` posts

#### PostDetail (`/post/:id`)
- Full post view with image carousel
- Upvote / downvote, confirm / resolve actions
- Comments section with author avatars
- RSVP (Going / Interested) for `local_event` posts
- Poll voting for `community_poll` posts
- Bookmark, report, share actions

#### Profile (`/profile`)
- Display name, avatar, phone, CNIC verification status
- Saved locations management
- Watched areas management
- Pinned / muted categories
- Daily digest settings (categories + delivery time)
- Trust score display
- Theme toggle (light/dark)
- Blocked users list

#### AdminDashboard (`/admin/dashboard`)
- Post moderation (approve, hide, delete with audit log)
- User CNIC verification queue (approve / reject)
- Provider listing review queue
- Emergency contacts management
- Audit log viewer

---

## 5. Navigation & UI Shell

The bottom navigation bar is rendered by `NavigationBar` inside `App.tsx` and is hidden on `/onboarding` and all `/admin/*` routes.

### Nav Items

| Icon | Label | Route |
|---|---|---|
| Radar | Feed | `/` |
| Map | Map | `/map` |
| Search | Search | `/search` |
| Plus *(raised)* | Post | `/create` |
| FileText | My Posts | `/my-posts` |
| Grid | More | *(bottom sheet)* |
| User | Profile | `/profile` |

### "More" Bottom Sheet

Tapping **More** opens a bottom drawer with 8 quick shortcuts:

| Shortcut | Destination |
|---|---|
| Search & Explore | `/search` |
| Jobs & Internships | `/create?category=jobs_internships` |
| Safety & Blood Alert | `/create?category=blood_request` |
| Rentals & Property | `/create?category=property_rent` |
| Home Services | `/create?category=home_services` |
| Carpool & Transport | `/create?category=ride_share` |
| Saved Bookmarks | `/profile` |
| Radar Settings & Radius | `/profile` |

---

## 6. Post Categories

Defined in `src/lib/categories.ts`. Each `CategoryConfig` controls icons, colors, default radius, auto-expiry, required fields, safety tips, and more.

### Category Groups

| Group Key | Label |
|---|---|
| `community` | Community & Feed |
| `jobs` | Jobs & Internships |
| `services` | Services & Skills |
| `rentals` | Properties & Rentals |
| `marketplace` | Marketplace & Deals |
| `transport` | Transport & Carpool |
| `emergency` | Urgent & Emergency |

### All Categories

| Slug | Label | Group | Auto-Expires | High Risk |
|---|---|---|---|---|
| `community_feed` | Community Post | community | Never | — |
| `community_poll` | Community Poll | community | 3 days | — |
| `local_event` | Events & Meetups | community | 7 days | — |
| `jobs_internships` | Jobs & Internships | jobs | 30 days | ✅ |
| `home_services` | Home Services & Skills | services | Never | ✅ |
| `tuition` | Tutors & Coaching | services | Never | — |
| `domestic_help` | Domestic Help & Staff | services | Never | ✅ |
| `property_rent` | Flats & Rentals | rentals | Never | ✅ |
| `second_hand` | Buy & Sell Marketplace | marketplace | Never | ✅ |
| `local_deals` | Deals & Discounts | marketplace | 7 days | — |
| `ride_share` | Carpool & Rideshare | transport | 1 day | ✅ |
| `traffic_alert` | Traffic & Road Updates | transport | 3 hours | — |
| `urgent_blood` | Emergency Blood Need | emergency | 6 hours | — |

### CategoryConfig Shape

```typescript
interface CategoryConfig {
  slug: string;
  label: string;
  group: CategoryGroup;
  icon: LucideIcon;
  color: string;            // hex color
  bgColor: string;          // Tailwind bg class
  textColor: string;        // Tailwind text class
  defaultRadiusKm: number;  // 3–5 km
  autoExpireMinutes: number | null;
  requiresPhoto: boolean;
  requiresLocation: boolean;
  supportsConfirm: boolean; // "Still happening?" button
  supportsFeatured: boolean;
  isHighRisk?: boolean;
  safetyTips?: string[];
  description: string;
  fields: CategoryField[];
}
```

### CategoryField Types

`text` | `textarea` | `number` | `select` | `toggle` | `price` | `blood_type` | `urgency` | `date` | `time` | `poll_options`

---

## 7. Authentication System

Defined in `src/lib/auth.tsx`.

### Auth Flow — Regular Users

1. User enters phone number (E.164 format)
2. App checks OTP rate limit via `otp_rate_limit` table (max 5 per hour)
3. Supabase sends OTP via SMS
4. User enters 6-digit OTP
5. `supabase.auth.verifyOtp()` creates/resumes session
6. `refreshProfile()` fetches full profile from `profiles` table
7. Profile cached in `localStorage` (key: `smart_radar_user_profile_v4`)

### Auth Flow — Admin Users

1. Admin navigates to `/admin/login`
2. Signs in with email + password via `supabase.auth.signInWithPassword()`
3. App immediately queries `profiles.is_admin` to verify flag
4. If not admin → signs user out and rejects access
5. If admin → session continues, `isAdmin = true`

### OTP Rate Limiting

- **Max:** 5 OTP requests per phone per 60-minute window
- Tracked in `otp_rate_limit` Supabase table
- Fails open on DB error (does not lock out users)

### AuthContext API

```typescript
interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithPhone(phone: string): Promise<{ error: string | null }>;
  verifyOtp(phone: string, token: string): Promise<{ error: string | null }>;
  signInAdminWithEmail(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  refreshProfile(userId?: string): Promise<void>;
  updateProfile(updates: Partial<Profile>): Promise<void>;
}
```

### Security Notes

- `is_admin` is **never written from client code** — stripped in `updateProfile()`
- `cnic_number` is **never returned** in regular profile fetches — stripped at query level
- Profile is fetched without `cnic_number` column (omitted from SELECT)

---

## 8. Database Schema

Migrations in `supabase/migrations/`.

### Tables Overview

| Table | Purpose |
|---|---|
| `profiles` | Extended user data (linked to `auth.users`) |
| `posts` | All posts across every category |
| `votes` | Upvote / downvote records |
| `comments` | Post comments / in-app chat |
| `bookmarks` | Saved posts per user |
| `reports` | Content reports for admin review |
| `confirmations` | "Still happening" / "Resolved" on alert posts |
| `poll_options` | Options for community poll posts |
| `poll_votes` | Individual poll votes |
| `emergency_contacts` | Admin-managed emergency numbers directory |
| `trusted_contacts` | User's personal emergency contacts (panic button) |
| `provider_listings` | Business/service provider listing submissions |
| `admin_audit_log` | Immutable log of admin actions |
| `otp_rate_limit` | SMS OTP spam protection per phone |

### `profiles` Table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | FK → `auth.users` |
| `phone` | text (UNIQUE NOT NULL) | — |
| `display_name` | text | Default `''` |
| `avatar_url` | text | — |
| `is_business` | boolean | Default `false` |
| `is_admin` | boolean | Default `false` (security migration) |
| `cnic_number` | text | Column-level REVOKE on anon/authenticated |
| `verification_status` | text | `pending` / `approved` / `rejected` / null |
| `verification_date` | timestamptz | — |
| `verification_expiry` | timestamptz | — |
| `verification_history` | jsonb | Audit trail of past verifications |
| `trust_score` | int | Default 50, range 0–100 |
| `radius_km` | int | Default 3 |
| `saved_locations` | jsonb | Array of `{ label, lat, lng }` |
| `watched_areas` | jsonb | Array of WatchedArea objects |
| `pinned_categories` | text[] | Top categories in feed |
| `muted_categories` | text[] | No notifications |
| `digest_categories` | text[] | Daily email digest topics |
| `digest_enabled` | boolean | — |
| `digest_time` | text | HH:MM |
| `blocked_users` | uuid[] | Blocked user IDs |
| `theme` | text | `light` / `dark` |
| `created_at` | timestamptz | — |

### `posts` Table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users`, default `auth.uid()` |
| `category` | text (NOT NULL) | Category slug |
| `title` | text (NOT NULL) | — |
| `description` | text | — |
| `metadata` | jsonb | Category-specific fields (price, blood_type, etc.) |
| `image_urls` | text[] | Uploaded image URLs |
| `lat` | double precision | GPS latitude |
| `lng` | double precision | GPS longitude |
| `location_label` | text | Human-readable location string |
| `status` | text | `active` / `resolved` / `expired` |
| `is_featured` | boolean | Paid boost flag |
| `women_only` | boolean | For ride-share posts |
| `expires_at` | timestamptz | Auto-expiry (null = never) |
| `scheduled_for` | timestamptz | Future publish time |
| `reposted_from_id` | uuid | Source post for reposts |
| `confirm_count` | int | "Still happening" count |
| `resolve_count` | int | "Resolved" count |
| `report_count` | int | Auto-hides at 3 |
| `upvotes` | int | — |
| `downvotes` | int | — |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | Auto-updated via trigger |

### Database Indexes

```sql
idx_posts_category          ON posts(category)
idx_posts_status            ON posts(status)
idx_posts_created_at        ON posts(created_at DESC)
idx_posts_user_id           ON posts(user_id)
idx_posts_lat_lng           ON posts(lat, lng)
idx_votes_post_id           ON votes(post_id)
idx_comments_post_id        ON comments(post_id)
idx_bookmarks_user_id       ON bookmarks(user_id)
idx_confirmations_post_id   ON confirmations(post_id)
idx_poll_options_post_id    ON poll_options(post_id)
idx_poll_votes_option_id    ON poll_votes(option_id)
idx_trusted_contacts_user_id ON trusted_contacts(user_id)
idx_provider_listings_status ON provider_listings(status)
idx_provider_listings_user_id ON provider_listings(user_id)
idx_audit_log_admin_id      ON admin_audit_log(admin_id)
idx_audit_log_created_at    ON admin_audit_log(created_at DESC)
idx_audit_log_target_id     ON admin_audit_log(target_id)
idx_otp_rate_limit_phone    ON otp_rate_limit(phone)
idx_otp_rate_limit_window   ON otp_rate_limit(window_start)
```

### Database Triggers

- `posts_updated_at` — BEFORE UPDATE on `posts`, sets `updated_at = now()`
- `provider_listings_updated_at` — BEFORE UPDATE on `provider_listings`

### Seeded Data

```sql
-- Emergency contacts seeded on migration
('Rescue 1122', '1122', 'rescue')
('Police Emergency', '15', 'police')
('Edhi Foundation', '115', 'rescue')
('Fire Brigade', '16', 'fire')
```

---

## 9. Row Level Security (RLS)

RLS is enabled on **every table**. Key policies:

### Public Access
- `posts` SELECT — anyone (anon + authenticated) can read `active` / `resolved` posts
- `votes`, `comments`, `confirmations`, `poll_options`, `poll_votes` SELECT — open to all
- `emergency_contacts` SELECT — open to all
- `provider_listings` SELECT — only `approved` listings for public; all for admin/owner

### Authenticated Users
- **profiles** — owner reads/updates own; admin reads/updates any
- **posts** — owner INSERT/UPDATE/DELETE own; admin can INSERT/UPDATE/DELETE any
- **bookmarks** — owner CRUD own (unique per post per user)
- **reports** — owner INSERT own (unique per post per user)
- **trusted_contacts** — owner full CRUD
- **provider_listings** — owner can submit/edit pending; admin approves/rejects

### Admin Only
- `emergency_contacts` — INSERT/UPDATE/DELETE
- `admin_audit_log` — read and insert (no updates/deletes — immutable)
- `otp_rate_limit` — service_role full access; anon can INSERT + SELECT + UPDATE

### Admin Helper Function

```sql
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;
```

---

## 10. Admin System

### Admin Login (`/admin/login`)
- Email + password (not phone OTP)
- Uses `supabase.auth.signInWithPassword()`
- Verifies `profiles.is_admin = true` after login
- If not admin → signs out + shows error

### AdminRoute Guard (`src/components/AdminRoute.tsx`)
- Wraps all `/admin/*` routes except login
- Redirects unauthenticated or non-admin users to `/admin/login`
- Shows loading spinner while auth resolves
- Backend RLS is the real security layer; this is a UX guard

### AdminDashboard (`/admin/dashboard`)

Capabilities:
- **Post Moderation** — view reported posts, hide/approve/delete with reason
- **User Verification** — CNIC verification queue (approve/reject with notes, expiry date)
- **Provider Listings** — review pending listings, approve or reject with notes
- **Emergency Contacts** — add/edit/delete emergency numbers and map pins
- **Audit Log** — view all admin actions with timestamps

### Audit Log Schema (`admin_audit_log`)

```typescript
interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: 'post' | 'listing' | 'profile' | 'report';
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
```

---

## 11. Services & Integrations

### Supabase (`src/lib/supabase.ts`)
- Single client instance using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Used throughout the app for all DB reads/writes and auth

### Firebase — Push Notifications (`src/services/firebase.ts`)
- **Optional** — app continues normally if not configured
- Initializes Firebase app singleton if all 6 `VITE_FIREBASE_*` keys are present
- Key functions:
  - `initFirebase()` — singleton init
  - `requestNotificationPermission(vapidKey?)` — gets FCM token
  - `onForegroundMessage(handler)` — foreground push listener
- FCM token should be stored on the user's profile for targeted pushes

### SMS / OTP (`src/services/sms.ts`)
- **Primary:** Supabase built-in phone auth — `sendOtp()`, `verifyOtp()`
- **Secondary (optional):** Twilio via Supabase Edge Function `send-sms`
  - Activated when `VITE_TWILIO_*` keys are set
  - Twilio secrets **never** go to the browser — proxied server-side
  - `sendCustomSms(to, message)` calls the Edge Function

### Maps (`src/services/maps.ts`)
- Leaflet + OpenStreetMap is the **default** (no API key required)
- Google Maps is optional (`VITE_GOOGLE_MAPS_API_KEY`)
- Haversine distance utility in `src/lib/location.ts`

### Payments (`src/services/payments.ts`)
- **Not yet activated** — all functions throw a clear error
- Stubbed: JazzCash + EasyPaisa
- Activation checklist documented in the file:
  1. Add `VITE_JAZZCASH_MERCHANT_ID` + `VITE_JAZZCASH_PASSWORD` to `.env`
  2. Create Supabase Edge Function `process-payment` (server-side)
  3. Replace `throw NOT_IMPLEMENTED` stubs with real logic
  4. Add webhook handling for async payment status callbacks

---

## 12. Environment Variables

Template: `.env.example`  
Typed config: `src/config/env.ts`

| Variable | Required | Service | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase | Project API URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase | Public anon key |
| `VITE_GOOGLE_MAPS_API_KEY` | ❌ | Maps | App uses Leaflet/OSM by default |
| `VITE_FIREBASE_API_KEY` | ❌ | Firebase | All 6 Firebase vars needed together |
| `VITE_FIREBASE_AUTH_DOMAIN` | ❌ | Firebase | — |
| `VITE_FIREBASE_PROJECT_ID` | ❌ | Firebase | — |
| `VITE_FIREBASE_STORAGE_BUCKET` | ❌ | Firebase | — |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ❌ | Firebase | — |
| `VITE_FIREBASE_APP_ID` | ❌ | Firebase | — |
| `VITE_TWILIO_ACCOUNT_SID` | ❌ | Twilio | For custom SMS only |
| `VITE_TWILIO_AUTH_TOKEN` | ❌ | Twilio | Proxied server-side |
| `VITE_TWILIO_PHONE_NUMBER` | ❌ | Twilio | Sender number |
| `VITE_JAZZCASH_MERCHANT_ID` | ❌ | Payments | Not activated yet |
| `VITE_JAZZCASH_PASSWORD` | ❌ | Payments | Not activated yet |

> **Security:** The `ENV` object in `src/config/env.ts` is the single source of truth. **Never** read `import.meta.env` directly anywhere else in the app.

---

## 13. Data Types & Interfaces

All types defined in `src/lib/types.ts`.

### Core Interfaces

```typescript
interface Profile {
  id: string;
  phone: string;
  display_name: string;
  avatar_url: string | null;
  is_business: boolean;
  is_admin?: boolean;        // Server-side only — never writable from client
  cnic_number: string | null;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  trust_score: number;
  radius_km: number;
  saved_locations: SavedLocation[];
  watched_areas?: WatchedArea[];
  pinned_categories: string[];
  muted_categories: string[];
  digest_categories?: string[];
  digest_enabled?: boolean;
  digest_time?: string;
  blocked_users: string[];
  theme: 'light' | 'dark';
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  image_urls: string[];
  lat: number;
  lng: number;
  location_label: string | null;
  status: 'active' | 'resolved' | 'expired';
  is_featured: boolean;
  women_only: boolean;
  expires_at: string | null;
  scheduled_for?: string | null;
  reposted_from_id?: string | null;
  confirm_count: number;
  resolve_count: number;
  report_count: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

interface PostWithRelations extends Post {
  author_name?: string;
  author_avatar?: string | null;
  author_is_verified?: boolean;
  author_verification_status?: 'valid' | 'due_soon' | 'expired';
  is_bookmarked?: boolean;
  user_vote?: 'up' | 'down' | null;
  poll_options?: PollOption[];
  user_poll_vote?: string | null;
  rsvp_count?: { going: number; interested: number };
  user_rsvp?: 'going' | 'interested' | null;
}
```

### Supporting Interfaces

| Interface | Purpose |
|---|---|
| `SavedLocation` | `{ label, lat, lng }` |
| `WatchedArea` | Named area with radius + notify flag |
| `Vote` | Single upvote/downvote record |
| `Comment` | Post comment with author attribution |
| `Bookmark` | Saved post reference |
| `Report` | Content report with reason |
| `Confirmation` | "confirm" or "resolve" action on a post |
| `PollOption` | Single poll choice with vote count |
| `PollVote` | User's vote on a poll option |
| `EmergencyContact` | Admin-managed emergency number with location |
| `TrustedContact` | User's personal emergency contact |
| `EventRsvp` | RSVP for `local_event` posts |
| `ProviderListing` | Business listing submission |
| `AdminAuditLog` | Immutable admin action record |
| `OtpRateLimit` | Per-phone OTP attempt tracker |
| `VerificationAuditItem` | Historical CNIC verification record |

---

## 14. Security Hardening

Applied in `supabase/migrations/20260925_security_hardening.sql`.

### Measures Implemented

1. **`is_admin` column** — added to `profiles` with `SECURITY DEFINER` helper function so RLS can check it without recursive loops

2. **CNIC column protection** — column-level REVOKE:
   ```sql
   REVOKE SELECT (cnic_number) ON profiles FROM anon;
   REVOKE SELECT (cnic_number) ON profiles FROM authenticated;
   ```
   Only `service_role` (admin backend) can read CNICs.

3. **Admin-only writes on emergency contacts** — INSERT/UPDATE/DELETE restricted to `auth_is_admin()` users

4. **Provider listings approval gate** — public only sees `status = 'approved'`; pending/rejected hidden

5. **Immutable audit log** — no UPDATE or DELETE policies on `admin_audit_log`

6. **OTP rate limiting** — app-level check before calling Supabase phone auth; 5 attempts / 60-minute window per phone number

7. **Admin privilege escalation prevention** — `updateProfile()` strips `is_admin` and `cnic_number` from client-side updates before sending to Supabase

8. **Frontend admin guard** — `AdminRoute` component + DB-verified `is_admin` flag (backend RLS is the real enforcement)

---

## 15. Feature Flags & Roadmap

### Currently Active ✅
- Phone OTP authentication (Supabase)
- All 13 post categories
- Hyperlocal feed with radius filter
- Post interactions (vote, comment, bookmark, confirm/resolve, report)
- Interactive map view
- Community polls with live vote counts
- Event RSVP
- Women-only carpool flag
- Watched areas (multi-area monitoring)
- Daily digest preferences
- User verification (CNIC) — admin workflow
- Provider listings — approval workflow
- Admin dashboard + audit log
- Light/dark theme
- OTP rate limiting

### Stubbed / Planned 🚧

| Feature | Status | Notes |
|---|---|---|
| Firebase Push Notifications | Stubbed | Add `VITE_FIREBASE_*` keys to activate |
| Twilio Custom SMS | Stubbed | Add `VITE_TWILIO_*` + deploy Edge Function |
| JazzCash Payments | Stubbed | For featured posts, premium listings |
| EasyPaisa Payments | Stubbed | Alternative payment gateway |
| Google Maps | Optional | Add `VITE_GOOGLE_MAPS_API_KEY` |
| Supabase Edge Function: `send-sms` | Not deployed | For Twilio proxy |
| Supabase Edge Function: `process-payment` | Not deployed | For payment proxy |
| VAPID Push Notifications | Stubbed | Add VAPID key when ready |

---

## 16. Development Guide

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account + project

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at minimum

# 3. Run Supabase migrations (in order)
# Via Supabase Dashboard SQL editor, or Supabase CLI:
supabase db push

# 4. Start dev server
npm run dev
```

### Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start local dev server |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build |
| `lint` | `eslint .` | Run ESLint |
| `typecheck` | `tsc --noEmit -p tsconfig.app.json` | TypeScript type checking |

### Running Migrations

Migrations must be applied in filename order:
1. `20260822205833_create_smart_radar_schema.sql` — Core schema
2. `20260925_security_hardening.sql` — Security hardening

### Creating an Admin User

1. Sign up the user with phone OTP normally (or create via Supabase Dashboard)
2. In Supabase Dashboard → Table Editor → `profiles`
3. Set `is_admin = true` for the target user's row
4. The user can now log in at `/admin/login` with email + password

### Path Aliases

The `@/` alias maps to `src/`. Examples:
- `@/lib/auth` → `src/lib/auth.tsx`
- `@/components/PostCard` → `src/components/PostCard.tsx`
- `@/services/firebase` → `src/services/firebase.ts`

### Theme System

`ThemeProvider` reads the user's `profile.theme` preference (`light` | `dark`) and applies the appropriate class to the `<html>` element. Tailwind's `dark:` variant is used throughout.

### Location System

`LocationProvider` in `src/lib/location-context.tsx`:
- Requests browser GPS via `navigator.geolocation`
- Stores coords + radius in context
- Falls back to Karachi center coords (`lat: 24.8607, lng: 67.0011`) if GPS unavailable
- `haversineKm(a, b)` in `src/lib/location.ts` is used for distance filtering

---

*Generated: 2026-09-29 | Smart Radar Project Master Documentation*
