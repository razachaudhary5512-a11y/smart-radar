/**
 * Demo content. Posts are generated around the viewer's real location and
 * timestamps are relative to "now", so the demo always feels live.
 */
import { getExpiryDate } from '@/lib/categories';
import { jitter } from '@/lib/location';
import type {
  AdminAuditLog,
  Comment,
  Coords,
  EmergencyContact,
  EventRsvp,
  PollOption,
  Post,
  ProviderListing,
  PublicProfile,
} from '@/lib/types';

export interface DemoUser extends PublicProfile {
  phone: string | null;
  email?: string | null;
  cnic_number: string | null;
  is_admin: boolean;
  is_owner?: boolean;
  created_at: string;
  requested_at?: string;
  is_banned?: boolean;
  banned_reason?: string | null;
}

export interface DemoReport {
  id: string;
  post_id: string;
  user_id: string;
  reason: string;
  created_at: string;
}

export interface DemoSeed {
  reports: DemoReport[];
  users: DemoUser[];
  posts: (Post & { _seed?: boolean })[];
  comments: Comment[];
  pollOptions: PollOption[];
  rsvps: EventRsvp[];
  emergency: EmergencyContact[];
  listings: ProviderListing[];
  audit: AdminAuditLog[];
}

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&auto=format&fit=crop&q=70`;

function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEMO_ADMIN_ID = 'u-admin';
export const DEMO_ADMIN_EMAIL = 'admin@smartradar.demo';
export const DEMO_ADMIN_PASSWORD = 'demo-admin';
export const DEMO_OWNER_ID = 'u-owner';
export const DEMO_OWNER_EMAIL = 'owner@smartradar.demo';
export const DEMO_OWNER_PASSWORD = 'demo-owner';

function user(id: string, name: string, opts: Partial<DemoUser> = {}): DemoUser {
  return {
    id,
    display_name: name,
    avatar_url: null,
    is_business: false,
    verification_status: 'approved',
    verification_expiry: new Date(Date.now() + 200 * DAY).toISOString(),
    trust_score: 70,
    phone: null,
    cnic_number: null,
    is_admin: false,
    created_at: new Date(Date.now() - 120 * DAY).toISOString(),
    ...opts,
  };
}

export function ownerUser(): DemoUser {
  return user(DEMO_OWNER_ID, 'App Owner', { is_admin: true, is_owner: true, trust_score: 100, email: DEMO_OWNER_EMAIL });
}

export function buildSeed(center: Coords): DemoSeed {
  const rand = prng(20260930);
  const now = Date.now();

  const users: DemoUser[] = [
    user('u-ayesha', 'Ayesha Khan', { trust_score: 92 }),
    user('u-bilal', 'Bilal Tariq', { trust_score: 81 }),
    user('u-maria', 'Dr. Maria Siddiqui', { trust_score: 95 }),
    user('u-hamza', 'Hamza Qureshi', { trust_score: 64, verification_status: null, verification_expiry: null }),
    user('u-sana', 'Sana Mirza', { trust_score: 77 }),
    user('u-usman', 'Usman Electric Works', { is_business: true, trust_score: 88 }),
    user('u-fatima', 'Fatima Noor', { trust_score: 90 }),
    user('u-green', 'Neighbourhood Green Society', { is_business: true, trust_score: 97 }),
    user('u-estates', 'Al-Madina Estates', { is_business: true, trust_score: 74, verification_expiry: new Date(now + 12 * DAY).toISOString() }),
    user('u-grill', 'Daily Grill', { is_business: true, trust_score: 83 }),
    user('u-zain', 'Zain Ahmed', { trust_score: 58, verification_status: null, verification_expiry: null }),
    user('u-hira', 'Hira Baig', { trust_score: 86 }),
    user('u-imran', 'Imran Sheikh', { trust_score: 69, verification_status: null, verification_expiry: null }),
    user('u-nadia', 'Nadia Hussain', { trust_score: 91 }),
    user('u-techhub', 'Apex Tech Solutions', { is_business: true, trust_score: 85 }),
    // Pending CNIC verification — shows up in the admin queue
    user('u-kashif', 'Kashif Raza', {
      is_business: true, trust_score: 55, verification_status: 'pending', verification_expiry: null,
      phone: '+923001112233', cnic_number: '4210156239873', requested_at: new Date(now - 5 * HOUR).toISOString(),
    }),
    user('u-mehwish', 'Mehwish Tariq', {
      trust_score: 60, verification_status: 'pending', verification_expiry: null,
      phone: '+923214445566', cnic_number: '3520288451236', requested_at: new Date(now - 26 * HOUR).toISOString(),
    }),
    user('u-quickfix', 'QuickFix Solar & UPS', {
      is_business: true, trust_score: 52, verification_status: 'pending', verification_expiry: null,
      phone: '+923337778899', cnic_number: '6110122345679', requested_at: new Date(now - 2 * DAY).toISOString(),
    }),
    user(DEMO_ADMIN_ID, 'Radar Admin', { is_admin: true, trust_score: 100, email: DEMO_ADMIN_EMAIL }),
    ownerUser(),
    // Suspended account — shows up under Admin → Users → Suspended
    user('u-spam', 'Quick Cash Deals', {
      trust_score: 8, verification_status: null, verification_expiry: null, phone: '+923450001122',
      is_banned: true, banned_reason: 'Repeated advance-payment scam listings',
    }),
  ];

  type Draft = {
    u: string;
    c: string;
    t: string;
    d: string;
    m?: Record<string, unknown>;
    ago: number; // minutes ago
    km?: number; // max distance from center
    imgs?: string[];
    up?: number;
    down?: number;
    conf?: number;
    res?: number;
    feat?: boolean;
    women?: boolean;
    status?: Post['status'];
    reports?: number;
    loc: string;
  };

  const drafts: Draft[] = [
    // Urgent
    { u: 'u-nadia', c: 'urgent_blood', t: 'O− blood needed urgently for surgery', d: 'My father is in surgery at the cardiac ward. We need 2 bags of O-negative within the next few hours. Please call the attendant directly — any help is hugely appreciated. 🙏', m: { blood_type: 'O-', hospital: 'City Cardiac Hospital, Ward 4', contact_number: '+92 300 1234567', urgency: 'Immediate — surgery in progress', bags: 2 }, ago: 38, km: 3, up: 46, conf: 12, feat: true, loc: 'City Cardiac Hospital' },
    { u: 'u-bilal', c: 'urgent_blood', t: 'B+ donors needed for a thalassemia patient', d: 'A 9-year-old needs a B+ transfusion tonight. Hospital blood bank will screen donors on site.', m: { blood_type: 'B+', hospital: 'General Hospital, Thalassemia Unit', contact_number: '+92 321 7654321', urgency: 'Needed by tonight', bags: 1 }, ago: 150, km: 4, up: 31, conf: 7, loc: 'General Hospital' },
    { u: 'u-hira', c: 'utility_outage', t: 'No electricity in Block 4 since 2 PM', d: 'Transformer seems to have tripped after the rain. KE complaint has been lodged. Anyone else affected?', m: { utility: 'Electricity', since: '2:00 PM', complaint_no: 'KE-118-99210' }, ago: 55, km: 1.5, up: 24, conf: 18, res: 2, loc: 'Block 4, Street 12' },
    { u: 'u-imran', c: 'utility_outage', t: 'Low gas pressure across the sector this evening', d: 'Stoves barely working since 6 PM. SSGC helpline says maintenance work nearby.', m: { utility: 'Gas', since: '6:00 PM' }, ago: 95, km: 2.5, up: 15, conf: 9, loc: 'Sector 11-B' },
    { u: 'u-zain', c: 'traffic_alert', t: 'Main Boulevard jammed near the underpass', d: 'Water logging in the left lanes after the rain. Traffic crawling for ~1.5 km — take the service road.', m: { road_name: 'Main Boulevard underpass', cause: 'Water Logging' }, ago: 22, km: 2, up: 19, conf: 11, loc: 'Main Boulevard' },
    { u: 'u-sana', c: 'traffic_alert', t: 'Road closed for construction at the market chowk', d: 'Diversion in place towards the mosque road. Expect delays during evening rush.', m: { road_name: 'Market Chowk', cause: 'Road Construction' }, ago: 70, km: 1.2, up: 8, conf: 5, loc: 'Market Chowk' },

    // Community
    { u: 'u-maria', c: 'community_feed', t: 'Free medical camp this Sunday — BP, sugar & eye checkups', d: 'Our clinic is hosting a free camp for senior citizens from 10 AM to 2 PM. No registration needed, just bring your CNIC. Volunteers welcome!', m: { post_type: 'General Update' }, ago: 3 * 60, km: 2, up: 58, feat: true, loc: 'Community Health Clinic' },
    { u: 'u-ayesha', c: 'community_feed', t: 'Found: a set of car keys with a blue keychain', d: 'Found near the park gate this morning. DM me with the car make to claim them.', m: { post_type: 'Lost & Found' }, ago: 5 * 60, km: 1, up: 21, loc: 'Park main gate' },
    { u: 'u-hamza', c: 'community_feed', t: 'Any reliable pediatrician recommendations nearby?', d: 'Recently moved to the area with a 2-year-old. Looking for a pediatrician with evening timings. Thanks in advance!', m: { post_type: 'Question' }, ago: 8 * 60, km: 2.5, up: 12, loc: 'Near Tariq Road' },
    { u: 'u-green', c: 'community_feed', t: 'Tree plantation drive — 300 saplings planted! 🌳', d: 'Huge thanks to everyone who came out on Saturday. Next drive is planned for the green belt near the school.', m: { post_type: 'Appreciation' }, ago: 26 * 60, km: 3, up: 104, imgs: [img('1488459716781-31db52582fe9')], loc: 'Green belt, Sector 5' },
    { u: 'u-nadia', c: 'community_poll', t: 'Should we pool money for solar street lights on our lane?', d: 'Estimated Rs 4,500 per house for 8 lights. Vote so we know if it’s worth getting quotes.', ago: 10 * 60, km: 1.5, up: 33, loc: 'Lane 7' },
    { u: 'u-sana', c: 'community_poll', t: 'Best time for the weekly neighbourhood clean-up?', d: 'Trying to find a slot that works for most families.', ago: 30 * 60, km: 2, up: 17, loc: 'Block 2' },
    { u: 'u-green', c: 'local_event', t: 'Weekend farmers’ market & artisan fair', d: 'Fresh organic produce, handmade goods, live acoustic music and food stalls. Family-friendly and free for all neighbours!', m: { event_date: dateIn(now, 3), event_time: '10:00', venue: 'Community Central Park', entry_fee: 'Free' }, ago: 2 * 60, km: 3, up: 42, feat: true, imgs: [img('1533900298318-6b8da08a523e'), img('1488459716781-31db52582fe9')], loc: 'Central Park' },
    { u: 'u-zain', c: 'local_event', t: 'Night cricket tournament — 8 teams wanted', d: 'Tape-ball, 8 overs a side. Winning team takes home Rs 25,000. Register your team by Thursday.', m: { event_date: dateIn(now, 5), event_time: '21:00', venue: 'Sports Complex Ground B', entry_fee: 'Rs 2,000 per team' }, ago: 20 * 60, km: 4, up: 37, loc: 'Sports Complex' },
    { u: 'u-fatima', c: 'local_event', t: 'Free coding workshop for girls (ages 12–16)', d: 'Intro to Scratch and web basics. Laptops provided. Limited to 20 seats.', m: { event_date: dateIn(now, 8), event_time: '15:00', venue: 'Public Library Hall', entry_fee: 'Free' }, ago: 34 * 60, km: 3.5, up: 49, loc: 'Public Library' },

    // Jobs
    { u: 'u-techhub', c: 'jobs_internships', t: 'Hiring: Junior React Developer', d: 'Join a friendly product team building apps for local businesses. Hybrid (3 days onsite). Fresh grads with a strong portfolio are welcome.', m: { job_title: 'Junior React Developer', company_name: 'Apex Tech Solutions', job_type: 'Full-Time', salary: 90000, requirements: 'React, TypeScript, Git; 0–2 years', contact: '+92 300 5550101' }, ago: 6 * 60, km: 4, up: 29, feat: true, loc: 'IT Tower, 3rd floor' },
    { u: 'u-grill', c: 'jobs_internships', t: 'Cashier & delivery riders needed', d: 'Evening shifts, meals included. Riders must have their own bike and licence.', m: { job_title: 'Cashier / Delivery Rider', company_name: 'Daily Grill', job_type: 'Part-Time', salary: 38000, requirements: 'Matric, own bike for riders', contact: '+92 321 4443322' }, ago: 28 * 60, km: 2, up: 14, loc: 'Daily Grill, Main Market' },
    { u: 'u-maria', c: 'jobs_internships', t: 'Paid internship: clinic front-desk assistant', d: 'Great for students interested in healthcare admin. Flexible afternoon timings.', m: { job_title: 'Front-desk Intern', company_name: 'Siddiqui Family Clinic', job_type: 'Internship (Paid)', salary: 25000, requirements: 'Good English & Urdu, basic computer skills' }, ago: 3 * DAY / MIN, km: 2.5, up: 11, loc: 'Family Clinic' },
    { u: 'u-imran', c: 'jobs_internships', t: 'Accountant needed for a wholesale business', d: 'QuickBooks experience preferred. 9–6, Monday to Saturday.', m: { job_title: 'Accountant', company_name: 'Sheikh Traders', job_type: 'Full-Time', salary: 70000, requirements: 'B.Com / ACCA part-qualified' }, ago: 4 * DAY / MIN, km: 4.5, up: 7, loc: 'Wholesale Market' },

    // Services
    { u: 'u-usman', c: 'home_services', t: 'AC service & gas refill — same-day visits', d: 'Split & inverter AC servicing, gas refill, PCB repair. 10 years of experience, warranty on parts.', m: { service_type: 'AC Repair & Service', rate: 1500, experience: '10 years', phone: '+92 300 7788990' }, ago: 9 * 60, km: 2, up: 44, feat: true, loc: 'Serves within 5 km' },
    { u: 'u-quickfix', c: 'home_services', t: 'Solar panel & UPS installation', d: 'Complete solar solutions, inverter repair and battery replacement. Free site survey.', m: { service_type: 'Solar / UPS / Inverter', rate: 1000, experience: '6 years' }, ago: 2 * DAY / MIN, km: 4, up: 12, loc: 'Commercial Area' },
    { u: 'u-imran', c: 'home_services', t: 'Carpenter available for kitchen cabinets & repairs', d: 'Custom wardrobes, kitchen cabinets, door repairs. Pictures of previous work available.', m: { service_type: 'Carpenter', rate: 800, experience: '15 years' }, ago: 5 * DAY / MIN, km: 3, up: 9, loc: 'Near Jamia Masjid' },
    { u: 'u-fatima', c: 'tuition', t: 'O/A Level Physics & Maths tutor', d: 'Cambridge-certified teacher with 8 years of experience. Small groups or one-on-one. First demo class free.', m: { subject: 'Physics, Maths (O/A Level)', mode: 'Student Comes to Tutor', fee: 15000 }, ago: 12 * 60, km: 2, up: 26, imgs: [img('1503676260728-1c00da094a0b')], loc: 'Block 6' },
    { u: 'u-hira', c: 'tuition', t: 'Quran & Urdu classes for kids — online', d: 'Tajweed and Nazra for ages 5–14. Evening slots, female teacher.', m: { subject: 'Quran (Tajweed), Urdu', mode: 'Online Classes', fee: 5000 }, ago: 3 * DAY / MIN, km: 3, up: 18, loc: 'Online' },
    { u: 'u-sana', c: 'domestic_help', t: 'Looking for a part-time cook (lunch & dinner)', d: 'Family of 5. Pakistani cuisine. References required.', m: { role: 'Cook', timing: 'Part-Time (2–4 hrs)', salary: 22000 }, ago: 15 * 60, km: 1.5, up: 6, loc: 'Block 3' },
    { u: 'u-ayesha', c: 'domestic_help', t: 'Verified babysitter available — weekdays', d: 'Experienced nanny, CNIC verified, references from two families in the area.', m: { role: 'Babysitter / Nanny', timing: 'Full-Time (8–10 hrs)', salary: 35000 }, ago: 2 * DAY / MIN, km: 2.5, up: 13, loc: 'Near City School' },

    // Rentals
    { u: 'u-estates', c: 'property_rent', t: 'Modern 2-bed flat with lift, generator & parking', d: 'Spacious apartment with open kitchen, dedicated basement parking, 24/7 CCTV and standby generator. Families preferred.', m: { property_type: 'Apartment / Flat', bedrooms: '2 Bed', price: 95000, furnishing: 'Semi-Furnished' }, ago: 6 * 60, km: 3, up: 21, feat: true, imgs: [img('1522708323590-d24dbb6b0267'), img('1502672260266-1c1ef2d93688')], loc: 'Khayaban-e-Badar' },
    { u: 'u-hamza', c: 'property_rent', t: 'Room available for a working professional', d: 'Furnished room in a shared flat, attached bath, Wi-Fi and utilities included. Non-smoker please.', m: { property_type: 'Room / Flatmate', bedrooms: 'Studio / Room', price: 28000, furnishing: 'Fully Furnished' }, ago: 20 * 60, km: 2, up: 9, imgs: [img('1560448204-e02f11c3d0e2')], loc: 'Near Metro Station' },
    { u: 'u-estates', c: 'property_rent', t: 'Ground-floor shop on the main road', d: '250 sq ft shop, ideal for a pharmacy or bakery. Heavy foot traffic.', m: { property_type: 'Commercial Shop', bedrooms: 'Studio / Room', price: 120000, furnishing: 'Unfurnished' }, ago: 3 * DAY / MIN, km: 4, up: 5, loc: 'Main Road' },

    // Marketplace
    { u: 'u-zain', c: 'second_hand', t: 'iPhone 13 — 128GB, PTA approved, 89% battery', d: 'Excellent condition, always used with a cover. Box and charger included. Meet at a mall only.', m: { item_category: 'Phones & Laptops', price: 145000, condition: 'Like New (9/10)', negotiable: true }, ago: 4 * 60, km: 2.5, up: 16, imgs: [img('1511707171634-5f897ff02aa9')], loc: 'Near City Mall' },
    { u: 'u-bilal', c: 'second_hand', t: 'MacBook Air M1 — 8/256, like new', d: 'Barely used, 42 battery cycles. Selling because I switched to a work laptop.', m: { item_category: 'Phones & Laptops', price: 180000, condition: 'Like New (9/10)' }, ago: 18 * 60, km: 3.5, up: 22, imgs: [img('1496181133206-80ce9b88a853')], loc: 'Block 13' },
    { u: 'u-sana', c: 'second_hand', t: '3-seater sofa — green velvet', d: 'Moving out sale. Very comfortable, no stains. Buyer arranges pickup.', m: { item_category: 'Furniture & Decor', price: 42000, condition: 'Good (7–8/10)', negotiable: true }, ago: 2 * DAY / MIN, km: 1.5, up: 10, imgs: [img('1555041469-a586c61ea9bc')], loc: 'Block 2' },
    { u: 'u-hira', c: 'second_hand', t: 'Kids’ bicycle (ages 6–9)', d: 'Barely used, training wheels included.', m: { item_category: 'Bikes & Vehicles', price: 9500, condition: 'Like New (9/10)' }, ago: 3 * DAY / MIN, km: 2, up: 4, imgs: [img('1485965120184-e220f721d03e')], loc: 'Near park' },
    { u: 'u-grill', c: 'local_deals', t: 'Buy 1 Get 1 on all pizzas this weekend', d: 'Dine-in and takeaway. Show this Be Alert post at the counter.', m: { business_name: 'Daily Grill', offer_details: 'Buy 1 Get 1 Free', promo_code: 'RADAR-BOGO', valid_until: dateIn(now, 2) }, ago: 5 * 60, km: 2, up: 39, feat: true, imgs: [img('1513104890138-7c749659a591')], loc: 'Daily Grill, Main Market' },
    { u: 'u-green', c: 'local_deals', t: '40% off at the new organic bakery', d: 'Sourdough, gluten-free pastries and hand-roasted coffee. Opening-week discount on everything.', m: { business_name: 'Artisan Oven', offer_details: '40% off everything', promo_code: 'RADAR40', valid_until: dateIn(now, 4) }, ago: 10 * 60, km: 3, up: 35, imgs: [img('1509440159596-0249088772ff')], loc: 'Artisan Oven' },
    { u: 'u-imran', c: 'local_deals', t: 'Grocery mega sale — up to 25% off staples', d: 'Rice, flour, cooking oil and pulses. While stocks last.', m: { business_name: 'City Super Mart', offer_details: 'Up to 25% off staples', valid_until: dateIn(now, 1) }, ago: 26 * 60, km: 4, up: 20, loc: 'City Super Mart' },

    // Transport
    { u: 'u-ayesha', c: 'ride_share', t: 'Women-only carpool to I.I. Chundrigar Road', d: 'Leaving 8:15 AM on weekdays, back at 5:30 PM. 2 seats available in an AC car.', m: { departure_time: '8:15 AM, Mon–Fri', destination: 'I.I. Chundrigar Road', seats: 2, vehicle: 'Honda City (AC)', fare: 350 }, ago: 90, km: 2, up: 18, women: true, loc: 'Block 5 gate' },
    { u: 'u-bilal', c: 'ride_share', t: 'Daily ride to the university — 3 seats', d: 'Leaving 7:30 AM sharp. Fuel sharing only.', m: { departure_time: '7:30 AM, Mon–Sat', destination: 'University Road', seats: 3, vehicle: 'Suzuki Cultus', fare: 200 }, ago: 4 * 60, km: 3, up: 11, loc: 'Near petrol pump' },

    // Reported content for moderation demo
    { u: 'u-zain', c: 'second_hand', t: 'Brand new iPhone 16 Pro Max — only Rs 60,000!!!', d: 'Pay advance via EasyPaisa and I’ll courier it today. Limited stock, hurry!', m: { item_category: 'Phones & Laptops', price: 60000, condition: 'Brand New' }, ago: 3 * 60, km: 3, up: 1, down: 14, reports: 4, status: 'hidden', loc: 'Online only' },
    { u: 'u-imran', c: 'jobs_internships', t: 'Earn Rs 5,000 daily from home — registration fee Rs 2,000', d: 'No experience needed. Pay registration to get started immediately.', m: { job_title: 'Online Data Entry', company_name: 'Unknown', job_type: 'Remote / Flexible' }, ago: 7 * 60, km: 4, up: 0, down: 9, reports: 2, loc: 'Online' },
  ];

  const posts: DemoSeed['posts'] = drafts.map((d, i) => {
    const created = new Date(now - d.ago * MIN);
    const pos = jitter(center, d.km ?? 3, rand);
    return {
      id: `seed-${i + 1}`,
      user_id: d.u,
      category: d.c,
      title: d.t,
      description: d.d,
      metadata: d.m ?? {},
      image_urls: d.imgs ?? [],
      lat: pos.lat,
      lng: pos.lng,
      location_label: d.loc,
      status: d.status ?? 'active',
      is_featured: Boolean(d.feat),
      women_only: Boolean(d.women),
      expires_at: getExpiryDate(d.c, created),
      scheduled_for: null,
      reposted_from_id: null,
      confirm_count: d.conf ?? 0,
      resolve_count: d.res ?? 0,
      report_count: d.reports ?? 0,
      upvotes: d.up ?? 0,
      downvotes: d.down ?? 0,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
      _seed: true,
    };
  });

  const byTitle = (prefix: string) => posts.find((p) => p.title.startsWith(prefix))!.id;

  const pollOptions: PollOption[] = [
    ...['Yes — let’s do it', 'Yes, but cheaper lights', 'No, the council should pay', 'Need more info'].map((t, i) => ({
      id: `opt-a${i}`, post_id: byTitle('Should we pool'), option_text: t, vote_count: [18, 9, 6, 4][i],
    })),
    ...['Saturday 8 AM', 'Saturday 5 PM', 'Sunday 9 AM'].map((t, i) => ({
      id: `opt-b${i}`, post_id: byTitle('Best time for'), option_text: t, vote_count: [7, 4, 12][i],
    })),
  ];

  const c = (postPrefix: string, u: string, body: string, agoMin: number): Comment => ({
    id: `c-${Math.round(rand() * 1e9)}`, post_id: byTitle(postPrefix), user_id: u, body, created_at: new Date(now - agoMin * MIN).toISOString(),
  });
  const comments: Comment[] = [
    c('O− blood', 'u-bilal', 'Shared in our office group. Two colleagues are O− and heading there now.', 25),
    c('O− blood', 'u-maria', 'Please make sure donors eat something first. Praying for your father.', 18),
    c('No electricity', 'u-sana', 'Same here in Street 9. KE says a team is on the way.', 40),
    c('No electricity', 'u-imran', 'Power back in Street 14 as of now.', 10),
    c('Any reliable pediatrician', 'u-maria', 'Dr. Asma at the children’s clinic on the main road has evening OPD, 5–9 PM.', 7 * 60),
    c('Any reliable pediatrician', 'u-ayesha', '+1 for Dr. Asma. Very patient with kids.', 6 * 60),
    c('Weekend farmers', 'u-hira', 'Will there be parking near the park?', 90),
    c('Weekend farmers', 'u-green', 'Yes! The school ground next door will be open for parking.', 70),
    c('iPhone 13', 'u-hamza', 'Is the price negotiable? Can meet tomorrow evening.', 3 * 60),
    c('Modern 2-bed flat', 'u-sana', 'Is the maintenance fee included in the rent?', 5 * 60),
    c('AC service', 'u-nadia', 'Got my AC serviced by Usman bhai last week — quick and honest. Recommended.', 7 * 60),
    c('Should we pool', 'u-bilal', 'I’m in. Can we get 2–3 quotes first?', 8 * 60),
  ];

  const r = (postPrefix: string, u: string, status: EventRsvp['status'], agoMin: number): EventRsvp => ({
    id: `r-${Math.round(rand() * 1e9)}`, post_id: byTitle(postPrefix), user_id: u, status, created_at: new Date(now - agoMin * MIN).toISOString(),
  });
  const rsvps: EventRsvp[] = [
    r('Weekend farmers', 'u-ayesha', 'going', 60), r('Weekend farmers', 'u-bilal', 'going', 80),
    r('Weekend farmers', 'u-maria', 'interested', 100), r('Weekend farmers', 'u-hira', 'going', 110),
    r('Weekend farmers', 'u-sana', 'interested', 120), r('Night cricket', 'u-bilal', 'going', 300),
    r('Night cricket', 'u-hamza', 'going', 400), r('Night cricket', 'u-imran', 'interested', 500),
    r('Free coding workshop', 'u-nadia', 'going', 600), r('Free coding workshop', 'u-hira', 'interested', 700),
  ];

  const emergency: EmergencyContact[] = [
    ['Rescue 1122', '1122', 'rescue'],
    ['Police Emergency', '15', 'police'],
    ['Edhi Ambulance', '115', 'ambulance'],
    ['Fire Brigade', '16', 'fire'],
    ['Chhipa Ambulance', '1020', 'ambulance'],
    ['Motorway Police', '130', 'police'],
  ].map(([name, phone, type], i) => ({
    id: `em-${i}`, name, phone, type, lat: null, lng: null, created_at: new Date(now - 200 * DAY).toISOString(),
  }));

  const listing = (id: string, u: string, name: string, cat: string, desc: string, status: ProviderListing['status'], agoH: number): ProviderListing => ({
    id, user_id: u, business_name: name, category: cat, description: desc, phone: '+92 300 0000000',
    lat: null, lng: null, location_label: 'Within 5 km', status, reviewed_by: status === 'pending' ? null : DEMO_ADMIN_ID,
    reviewed_at: status === 'pending' ? null : new Date(now - (agoH - 1) * HOUR).toISOString(), admin_notes: null,
    created_at: new Date(now - agoH * HOUR).toISOString(), updated_at: new Date(now - agoH * HOUR).toISOString(),
  });
  const listings: ProviderListing[] = [
    listing('l-1', 'u-kashif', 'Kashif Cooling Services', 'home_services', 'AC installation, servicing and repair. 5 technicians, same-day visits.', 'pending', 4),
    listing('l-2', 'u-quickfix', 'QuickFix Solar & UPS', 'home_services', 'Solar installations and UPS repair. Free site survey.', 'pending', 30),
    listing('l-3', 'u-fatima', 'Noor Academy', 'tuition', 'O/A Level coaching in small groups.', 'pending', 50),
    listing('l-4', 'u-usman', 'Usman Electric Works', 'home_services', 'Licensed electricians — wiring, DB boxes, repairs.', 'approved', 300),
    listing('l-5', 'u-estates', 'Al-Madina Estates', 'property_rent', 'Verified rentals and property management for the neighbourhood.', 'approved', 500),
    listing('l-6', 'u-fatima', 'Fatima Noor Tuition', 'tuition', 'Cambridge O/A Level Physics & Maths — small groups.', 'approved', 700),
    listing('l-7', 'u-grill', 'Daily Grill Catering', 'local_deals', 'Event catering for 20–200 guests. Weekly neighbourhood offers.', 'approved', 900),
  ];

  const audit: AdminAuditLog[] = [
    { id: 'a-1', admin_id: DEMO_ADMIN_ID, action: 'hide_post', target_type: 'post', target_id: byTitle('Brand new iPhone 16'), details: { reason: 'Advance-payment scam pattern (4 reports)' }, created_at: new Date(now - 2 * HOUR).toISOString() },
    { id: 'a-2', admin_id: DEMO_ADMIN_ID, action: 'approve_listing', target_type: 'listing', target_id: 'l-4', details: { business: 'Usman Electric Works' }, created_at: new Date(now - 299 * HOUR).toISOString() },
    { id: 'a-3', admin_id: DEMO_ADMIN_ID, action: 'approve_verification', target_type: 'profile', target_id: 'u-usman', details: { valid_until: new Date(now + 200 * DAY).toISOString() }, created_at: new Date(now - 320 * HOUR).toISOString() },
  ];

  const rep = (postPrefix: string, u: string, reason: string, agoMin: number): DemoReport => ({
    id: `rep-${Math.round(rand() * 1e9)}`, post_id: byTitle(postPrefix), user_id: u, reason, created_at: new Date(now - agoMin * MIN).toISOString(),
  });
  const reports: DemoReport[] = [
    rep('Brand new iPhone 16', 'u-hamza', 'Scam or fraud: asks for advance payment via EasyPaisa', 170),
    rep('Brand new iPhone 16', 'u-sana', 'Scam or fraud', 160),
    rep('Brand new iPhone 16', 'u-bilal', 'Price is unrealistic — classic scam', 150),
    rep('Brand new iPhone 16', 'u-nadia', 'Spam or advertising', 140),
    rep('Earn Rs 5,000 daily', 'u-maria', 'Scam or fraud: charges a registration fee', 400),
    rep('Earn Rs 5,000 daily', 'u-hira', 'Misleading or outdated', 380),
  ];

  return { users, posts, comments, pollOptions, rsvps, emergency, listings, audit, reports };
}

function dateIn(now: number, days: number): string {
  return new Date(now + days * DAY).toISOString().slice(0, 10);
}
