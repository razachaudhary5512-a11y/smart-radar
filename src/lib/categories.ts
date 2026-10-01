import {
  MessageSquareText,
  Wrench,
  Home,
  Tag,
  Repeat2,
  CarFront,
  Droplet,
  Vote,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  TrafficCone,
  Briefcase,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type CategoryGroup = 'community' | 'jobs' | 'services' | 'rentals' | 'marketplace' | 'transport' | 'emergency';

export interface CategoryField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'price' | 'blood_type' | 'date' | 'time' | 'phone' | 'poll_options';
  required: boolean;
  placeholder?: string;
  options?: string[];
  helper?: string;
}

export interface CategoryConfig {
  slug: string;
  label: string;
  /** Compact label for chips and badges. */
  short: string;
  group: CategoryGroup;
  icon: LucideIcon;
  /** Brand hex color — used for pins, badges and tinted backgrounds. */
  color: string;
  defaultRadiusKm: number;
  autoExpireMinutes: number | null;
  requiresPhoto: boolean;
  requiresLocation: boolean;
  /** Shows "Still happening?" / "Resolved" crowd confirmation. */
  supportsConfirm: boolean;
  supportsFeatured: boolean;
  isHighRisk?: boolean;
  isUrgent?: boolean;
  safetyTips?: string[];
  description: string;
  titlePlaceholder: string;
  fields: CategoryField[];
}

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  emergency: 'Urgent & Emergency',
  community: 'Community',
  jobs: 'Jobs & Internships',
  services: 'Services & Skills',
  rentals: 'Properties & Rentals',
  marketplace: 'Marketplace & Deals',
  transport: 'Transport & Carpool',
};

export const GROUP_ORDER: CategoryGroup[] = ['emergency', 'community', 'jobs', 'services', 'rentals', 'marketplace', 'transport'];

export const CATEGORIES: CategoryConfig[] = [
  // ── URGENT & EMERGENCY ──────────────────────────────────────────────────────
  {
    slug: 'urgent_blood',
    label: 'Emergency Blood Need',
    short: 'Blood Need',
    group: 'emergency',
    icon: Droplet,
    color: '#dc2626',
    defaultRadiusKm: 5,
    autoExpireMinutes: 360,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: true,
    supportsFeatured: true,
    isUrgent: true,
    safetyTips: [
      'Donate only at a hospital blood bank — never hand over money for “blood arrangement”.',
      'Call the attendant number to confirm the patient and ward before travelling.',
    ],
    description: 'Urgent blood donation request for a nearby hospital or clinic',
    titlePlaceholder: 'e.g., B+ blood needed urgently at City Hospital',
    fields: [
      { key: 'blood_type', label: 'Blood group required', type: 'blood_type', required: true, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
      { key: 'hospital', label: 'Hospital & ward', type: 'text', required: true, placeholder: 'e.g., City Hospital, ER Ward 2' },
      { key: 'contact_number', label: 'Attendant phone', type: 'phone', required: true, placeholder: '+92 300 1234567' },
      { key: 'urgency', label: 'Urgency', type: 'select', required: true, options: ['Immediate — surgery in progress', 'Within 2–4 hours', 'Needed by tonight'] },
      { key: 'bags', label: 'Bags needed', type: 'number', required: false, placeholder: 'e.g., 2' },
    ],
  },
  {
    slug: 'utility_outage',
    label: 'Power & Utility Outage',
    short: 'Outage',
    group: 'emergency',
    icon: Zap,
    color: '#f97316',
    defaultRadiusKm: 3,
    autoExpireMinutes: 360,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: true,
    supportsFeatured: false,
    isUrgent: true,
    description: 'Electricity, gas or water outage — let neighbours know what’s down',
    titlePlaceholder: 'e.g., No electricity in Block 4 since 2 PM',
    fields: [
      { key: 'utility', label: 'What’s out?', type: 'select', required: true, options: ['Electricity', 'Gas', 'Water', 'Internet'] },
      { key: 'since', label: 'Since when?', type: 'text', required: false, placeholder: 'e.g., 2:00 PM' },
      { key: 'complaint_no', label: 'Complaint number (if filed)', type: 'text', required: false, placeholder: 'e.g., KE-118-99210' },
    ],
  },

  // ── COMMUNITY ───────────────────────────────────────────────────────────────
  {
    slug: 'community_feed',
    label: 'Community Post',
    short: 'Community',
    group: 'community',
    icon: MessageSquareText,
    color: '#2549ea',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    description: 'Updates, questions, recommendations and news for your neighbourhood',
    titlePlaceholder: 'e.g., Any good pediatrician near Block 5?',
    fields: [
      { key: 'post_type', label: 'Topic', type: 'select', required: false, options: ['General Update', 'Recommendation', 'Question', 'Discussion', 'Appreciation', 'Lost & Found'] },
    ],
  },
  {
    slug: 'community_poll',
    label: 'Community Poll',
    short: 'Poll',
    group: 'community',
    icon: Vote,
    color: '#8b5cf6',
    defaultRadiusKm: 3,
    autoExpireMinutes: 4320,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    description: 'Ask neighbours a question and collect instant votes',
    titlePlaceholder: 'e.g., Should we pool money for street lights?',
    fields: [{ key: 'poll_options', label: 'Poll options', type: 'poll_options', required: true, helper: 'Add 2 to 6 options' }],
  },
  {
    slug: 'local_event',
    label: 'Events & Meetups',
    short: 'Event',
    group: 'community',
    icon: CalendarDays,
    color: '#0891b2',
    defaultRadiusKm: 5,
    autoExpireMinutes: 10080,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    description: 'Gatherings, sports tournaments, cafe meetups and community drives',
    titlePlaceholder: 'e.g., Night cricket tournament — teams wanted',
    fields: [
      { key: 'event_date', label: 'Date', type: 'date', required: true },
      { key: 'event_time', label: 'Time', type: 'time', required: false },
      { key: 'venue', label: 'Venue / meeting spot', type: 'text', required: true, placeholder: 'e.g., Community Park Ground' },
      { key: 'entry_fee', label: 'Entry / fee', type: 'text', required: false, placeholder: 'e.g., Free or Rs. 500' },
    ],
  },

  // ── JOBS ────────────────────────────────────────────────────────────────────
  {
    slug: 'jobs_internships',
    label: 'Jobs & Internships',
    short: 'Jobs',
    group: 'jobs',
    icon: Briefcase,
    color: '#4f46e5',
    defaultRadiusKm: 5,
    autoExpireMinutes: 43200,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Legitimate employers never charge application, registration or training fees.',
      'Verify the office address or company credentials before an in-person interview.',
      'Never share bank passwords, OTPs or card details.',
      'Keep early conversations in-app or on an official business number.',
    ],
    description: 'Full-time, part-time, internships and gigs near you',
    titlePlaceholder: 'e.g., Hiring: Frontend Developer (React)',
    fields: [
      { key: 'job_title', label: 'Role', type: 'text', required: true, placeholder: 'e.g., Accountant, Sales Intern' },
      { key: 'company_name', label: 'Company / business', type: 'text', required: true, placeholder: 'e.g., Apex Tech' },
      { key: 'job_type', label: 'Employment type', type: 'select', required: true, options: ['Full-Time', 'Part-Time', 'Internship (Paid)', 'Internship (Unpaid)', 'One-Time / Gig', 'Remote / Flexible'] },
      { key: 'salary', label: 'Salary / stipend (PKR / month)', type: 'price', required: false, placeholder: 'e.g., 60000' },
      { key: 'requirements', label: 'Key requirements', type: 'text', required: false, placeholder: 'e.g., 1 year experience, English fluency' },
      { key: 'contact', label: 'Apply via', type: 'phone', required: false, placeholder: 'WhatsApp / phone number' },
    ],
  },

  // ── SERVICES ────────────────────────────────────────────────────────────────
  {
    slug: 'home_services',
    label: 'Home Services & Skills',
    short: 'Services',
    group: 'services',
    icon: Wrench,
    color: '#d97706',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Agree the visit fee, scope and parts warranty before work starts.',
      'Make sure an adult family member is home during indoor visits.',
      'Check the technician’s identity and past reviews.',
      'Pay only after testing the repair.',
    ],
    description: 'Electricians, plumbers, AC repair, painters, carpenters, mechanics',
    titlePlaceholder: 'e.g., AC service & gas refill — same-day visits',
    fields: [
      { key: 'service_type', label: 'Service', type: 'select', required: true, options: ['Electrician', 'Plumber', 'AC Repair & Service', 'Solar / UPS / Inverter', 'Painter & Polish', 'Carpenter', 'Appliance Repair', 'Mechanic / Car Repair'] },
      { key: 'rate', label: 'Visit fee / rate (PKR)', type: 'price', required: false, placeholder: 'e.g., 500' },
      { key: 'experience', label: 'Experience', type: 'text', required: false, placeholder: 'e.g., 8 years' },
      { key: 'phone', label: 'Phone / WhatsApp', type: 'phone', required: false, placeholder: '+92 300 1234567' },
    ],
  },
  {
    slug: 'tuition',
    label: 'Tutors & Coaching',
    short: 'Tutors',
    group: 'services',
    icon: GraduationCap,
    color: '#059669',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    safetyTips: [
      'Check degrees and previous tutoring references.',
      'Hold the first demo class in a shared or open space.',
      'Agree the schedule and monthly fee in advance.',
    ],
    description: 'Home tutoring, language classes and academic coaching',
    titlePlaceholder: 'e.g., O/A Level Physics & Maths tutor available',
    fields: [
      { key: 'subject', label: 'Subjects', type: 'text', required: true, placeholder: 'e.g., Maths, Physics, O/A Levels' },
      { key: 'mode', label: 'Mode', type: 'select', required: true, options: ['Home Visits', 'Student Comes to Tutor', 'Online Classes'] },
      { key: 'fee', label: 'Monthly fee (PKR)', type: 'price', required: false, placeholder: 'e.g., 8000' },
    ],
  },
  {
    slug: 'domestic_help',
    label: 'Domestic Help & Staff',
    short: 'Domestic Help',
    group: 'services',
    icon: HeartHandshake,
    color: '#db2777',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    isHighRisk: true,
    safetyTips: [
      'Always check the original CNIC, verify it with NADRA and keep a photocopy.',
      'Call previous employers or neighbour references before hiring.',
      'Interview with another adult family member present.',
      'Keep cards, PINs and valuables locked away.',
    ],
    description: 'Maids, cooks, drivers, babysitters and elderly caretakers',
    titlePlaceholder: 'e.g., Experienced cook available — part time',
    fields: [
      { key: 'role', label: 'Role', type: 'select', required: true, options: ['Maid / Cleaning', 'Cook', 'Driver', 'Babysitter / Nanny', 'Elderly Care'] },
      { key: 'timing', label: 'Timing', type: 'select', required: true, options: ['Full-Time (8–10 hrs)', 'Part-Time (2–4 hrs)', 'Live-In', 'On-Demand'] },
      { key: 'salary', label: 'Expected salary (PKR / month)', type: 'price', required: false, placeholder: 'e.g., 25000' },
    ],
  },

  // ── RENTALS ─────────────────────────────────────────────────────────────────
  {
    slug: 'property_rent',
    label: 'Flats & Rentals',
    short: 'Rentals',
    group: 'rentals',
    icon: Home,
    color: '#16a34a',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Check ownership documents or an authorisation letter before paying token money.',
      'Never transfer rent or deposit without a signed tenancy agreement.',
      'Visit in daylight and check electricity, gas and water bill arrears.',
      'Clarify maintenance charges and parking up front.',
    ],
    description: 'Flats, portions, shared rooms, houses and shops for rent',
    titlePlaceholder: 'e.g., 2-bed flat with lift & parking — Block 13',
    fields: [
      { key: 'property_type', label: 'Type', type: 'select', required: true, options: ['Apartment / Flat', 'Upper Portion', 'Ground Portion', 'Room / Flatmate', 'House', 'Commercial Shop', 'Office Space'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', required: true, options: ['Studio / Room', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'] },
      { key: 'price', label: 'Monthly rent (PKR)', type: 'price', required: true, placeholder: 'e.g., 45000' },
      { key: 'furnishing', label: 'Furnishing', type: 'select', required: false, options: ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'] },
    ],
  },

  // ── MARKETPLACE ─────────────────────────────────────────────────────────────
  {
    slug: 'second_hand',
    label: 'Buy & Sell',
    short: 'Buy & Sell',
    group: 'marketplace',
    icon: Repeat2,
    color: '#0d9488',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: true,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Meet in a busy, well-lit public place like a mall or cafe.',
      'Never pay an advance before seeing the item.',
      'Test phones, laptops and appliances on the spot.',
      'Bring a friend along for high-value items.',
    ],
    description: 'Used electronics, phones, furniture, appliances and gear',
    titlePlaceholder: 'e.g., iPhone 13, 128GB, PTA approved',
    fields: [
      { key: 'item_category', label: 'Item category', type: 'select', required: true, options: ['Electronics & Gadgets', 'Phones & Laptops', 'Furniture & Decor', 'Home Appliances', 'Bikes & Vehicles', 'Books & Sports', 'Other'] },
      { key: 'price', label: 'Price (PKR)', type: 'price', required: true, placeholder: 'e.g., 25000' },
      { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Like New (9/10)', 'Good (7–8/10)', 'Used / Functional'] },
      { key: 'negotiable', label: 'Price negotiable', type: 'toggle', required: false },
    ],
  },
  {
    slug: 'local_deals',
    label: 'Deals & Discounts',
    short: 'Deals',
    group: 'marketplace',
    icon: Tag,
    color: '#e11d48',
    defaultRadiusKm: 4,
    autoExpireMinutes: 10080,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    description: 'Restaurant promos, grocery sales, bakery offers and store discounts',
    titlePlaceholder: 'e.g., Buy 1 Get 1 on all pizzas this weekend',
    fields: [
      { key: 'business_name', label: 'Store / restaurant', type: 'text', required: true, placeholder: 'e.g., Daily Grill' },
      { key: 'offer_details', label: 'Offer', type: 'text', required: true, placeholder: 'e.g., 30% off all burgers' },
      { key: 'promo_code', label: 'Promo code', type: 'text', required: false, placeholder: 'e.g., RADAR30' },
      { key: 'valid_until', label: 'Valid until', type: 'date', required: false },
    ],
  },

  // ── TRANSPORT ───────────────────────────────────────────────────────────────
  {
    slug: 'ride_share',
    label: 'Carpool & Rideshare',
    short: 'Carpool',
    group: 'transport',
    icon: CarFront,
    color: '#0284c7',
    defaultRadiusKm: 5,
    autoExpireMinutes: 1440,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    isHighRisk: true,
    safetyTips: [
      'Check the number plate, driver photo and car model before getting in.',
      'Share your live trip location with someone you trust.',
      'Use busy pickup and drop-off points on main roads.',
      'Women-only carpools are available for extra peace of mind.',
    ],
    description: 'Daily office commutes, shared rides and women-only options',
    titlePlaceholder: 'e.g., Daily ride to I.I. Chundrigar Road, 2 seats',
    fields: [
      { key: 'departure_time', label: 'Departure', type: 'text', required: true, placeholder: 'e.g., 8:15 AM, Mon–Fri' },
      { key: 'destination', label: 'Destination', type: 'text', required: true, placeholder: 'e.g., Clifton / Blue Area' },
      { key: 'seats', label: 'Seats available', type: 'number', required: false, placeholder: 'e.g., 2' },
      { key: 'vehicle', label: 'Vehicle', type: 'text', required: false, placeholder: 'e.g., Honda City (AC)' },
      { key: 'fare', label: 'Share per seat (PKR)', type: 'price', required: false, placeholder: 'e.g., 300' },
    ],
  },
  {
    slug: 'traffic_alert',
    label: 'Traffic & Road Updates',
    short: 'Traffic',
    group: 'transport',
    icon: TrafficCone,
    color: '#ca8a04',
    defaultRadiusKm: 3,
    autoExpireMinutes: 180,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: true,
    supportsFeatured: false,
    isUrgent: true,
    description: 'Blockades, diversions, accidents and heavy jams',
    titlePlaceholder: 'e.g., Shahrah-e-Faisal jammed near FTC',
    fields: [
      { key: 'road_name', label: 'Road / intersection', type: 'text', required: true, placeholder: 'e.g., Main Boulevard underpass' },
      { key: 'cause', label: 'Reason', type: 'select', required: true, options: ['Heavy Traffic', 'Road Construction', 'Accident', 'Water Logging', 'Protest / Blockade', 'VIP Movement'] },
    ],
  },
];

export const CATEGORY_MAP: Record<string, CategoryConfig> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

const FALLBACK: CategoryConfig = { ...CATEGORIES[2], slug: 'unknown', label: 'Post', short: 'Post' };

export function getCategory(slug: string): CategoryConfig {
  return CATEGORY_MAP[slug] ?? FALLBACK;
}

export function categoriesByGroup(): { group: CategoryGroup; label: string; items: CategoryConfig[] }[] {
  return GROUP_ORDER.map((g) => ({ group: g, label: GROUP_LABELS[g], items: CATEGORIES.filter((c) => c.group === g) }));
}

export function getExpiryDate(slug: string, from = new Date()): string | null {
  const cat = CATEGORY_MAP[slug];
  if (!cat || cat.autoExpireMinutes === null) return null;
  return new Date(from.getTime() + cat.autoExpireMinutes * 60_000).toISOString();
}

export function formatExpiryRule(minutes: number | null): string {
  if (minutes === null) return 'Stays up until you remove it';
  if (minutes < 60) return `Auto-expires in ${minutes} min`;
  if (minutes < 1440) return `Auto-expires in ${Math.round(minutes / 60)} hours`;
  return `Auto-expires in ${Math.round(minutes / 1440)} days`;
}

/** The single most useful "headline" value for a post (price, blood type…), if any. */
export function headlineValue(category: string, metadata: Record<string, unknown>): string | null {
  const m = metadata ?? {};
  switch (category) {
    case 'urgent_blood':
      return m.blood_type ? String(m.blood_type) : null;
    case 'property_rent':
    case 'second_hand':
      return m.price ? `Rs ${formatPKR(m.price)}` : null;
    case 'jobs_internships':
      return m.salary ? `Rs ${formatPKR(m.salary)}/mo` : null;
    case 'tuition':
      return m.fee ? `Rs ${formatPKR(m.fee)}/mo` : null;
    case 'ride_share':
      return m.fare ? `Rs ${formatPKR(m.fare)}/seat` : null;
    case 'local_deals':
      return m.offer_details ? String(m.offer_details) : null;
    case 'utility_outage':
      return m.utility ? String(m.utility) : null;
    default:
      return null;
  }
}

export function formatPKR(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n === 0) return String(v);
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(n);
}
