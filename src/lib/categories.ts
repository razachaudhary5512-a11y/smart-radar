import {
  MessageSquarePlus,
  Wrench,
  Home,
  Tag,
  Repeat2,
  CarFront,
  Droplet,
  Vote,
  CalendarDays,
  GraduationCap,
  HeartPulse,
  Car,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

export type CategoryGroup = 'community' | 'jobs' | 'services' | 'rentals' | 'marketplace' | 'transport' | 'emergency';

export interface CategoryConfig {
  slug: string;
  label: string;
  group: CategoryGroup;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  textColor: string;
  defaultRadiusKm: number;
  autoExpireMinutes: number | null;
  requiresPhoto: boolean;
  requiresLocation: boolean;
  supportsConfirm: boolean;
  supportsFeatured: boolean;
  isHighRisk?: boolean;
  safetyTips?: string[];
  description: string;
  fields: CategoryField[];
}

export interface CategoryField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'price' | 'blood_type' | 'urgency' | 'date' | 'time' | 'poll_options';
  required: boolean;
  placeholder?: string;
  options?: string[];
  helper?: string;
}

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  community: 'Community & Feed',
  jobs: 'Jobs & Internships',
  services: 'Services & Skills',
  rentals: 'Properties & Rentals',
  marketplace: 'Marketplace & Deals',
  transport: 'Transport & Carpool',
  emergency: 'Urgent & Emergency',
};

export const CATEGORIES: CategoryConfig[] = [
  // === COMMUNITY & SOCIAL FEED ===
  {
    slug: 'community_feed',
    label: 'Community Post',
    group: 'community',
    icon: MessageSquarePlus,
    color: '#2563eb',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    description: 'Share updates, thoughts, questions, or news with your neighborhood',
    fields: [
      { key: 'post_type', label: 'Post Topic', type: 'select', required: false, options: ['General Update', 'Recommendation', 'Neighborhood Question', 'Local Discussion', 'Appreciation'] },
    ],
  },
  {
    slug: 'community_poll',
    label: 'Community Poll',
    group: 'community',
    icon: Vote,
    color: '#8b5cf6',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    defaultRadiusKm: 3,
    autoExpireMinutes: 4320, // 3 days
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    description: 'Ask neighbors a question and collect instant poll votes',
    fields: [
      { key: 'poll_options', label: 'Poll Options', type: 'poll_options', required: true, helper: 'Add at least 2 options' },
    ],
  },
  {
    slug: 'local_event',
    label: 'Events & Meetups',
    group: 'community',
    icon: CalendarDays,
    color: '#06b6d4',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: 10080,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    description: 'Post neighborhood gatherings, sports tournaments, or cafe meetups',
    fields: [
      { key: 'event_date', label: 'Event Date & Time', type: 'text', required: true, placeholder: 'e.g., Saturday at 6:00 PM' },
      { key: 'venue', label: 'Venue / Meeting Spot', type: 'text', required: true, placeholder: 'e.g., Community Park Ground' },
      { key: 'entry_fee', label: 'Entry / Fee', type: 'text', required: false, placeholder: 'e.g., Free or Rs. 500' },
    ],
  },

  // === JOBS & INTERNSHIPS ===
  {
    slug: 'jobs_internships',
    label: 'Jobs & Internships',
    group: 'jobs',
    icon: Briefcase,
    color: '#6366f1',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: 43200, // 30 days
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Legitimate employers never charge application, registration, or training fees upfront.',
      'Verify the physical office location or company credentials before attending in-person interviews.',
      'Never share sensitive banking passwords, OTPs, or credit card details.',
      'Conduct initial discussions through verified in-app chat or official business numbers.',
    ],
    description: 'Find or hire for full-time jobs, paid internships, part-time work & gigs',
    fields: [
      { key: 'job_title', label: 'Job / Role Title', type: 'text', required: true, placeholder: 'e.g., Frontend Developer, Accountant, Sales Intern' },
      { key: 'company_name', label: 'Company / Business / Store Name', type: 'text', required: true, placeholder: 'e.g., Apex Tech, City Mart, Studio 9' },
      { key: 'job_type', label: 'Employment Type', type: 'select', required: true, options: ['Full-Time', 'Part-Time', 'Internship (Paid)', 'Internship (Unpaid)', 'One-Time / Gig', 'Remote / Flexible'] },
      { key: 'salary', label: 'Salary / Stipend (PKR)', type: 'price', required: false, placeholder: 'e.g., 50,000 / month or Rs. 20,000 stipend' },
      { key: 'requirements', label: 'Key Requirements / Skills', type: 'text', required: false, placeholder: 'e.g., 1 year experience, students welcome, English fluency' },
      { key: 'contact_method', label: 'Contact / Application Method', type: 'select', required: false, options: ['In-App Chat / Quick Apply', 'WhatsApp / Phone Call', 'Email / Website'] },
    ],
  },

  // === HOME SERVICES & SKILLS ===
  {
    slug: 'home_services',
    label: 'Home Services & Skills',
    group: 'services',
    icon: Wrench,
    color: '#f59e0b',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Confirm the inspection fee, scope of work, and part warranty before work begins.',
      'Ensure an adult family member is present at home during indoor service visits.',
      'Inspect technician identity and previous customer reviews.',
      'Pay only after satisfactory inspection and testing of the repair work.',
    ],
    description: 'Electrician, Plumber, AC Repair, Painter, Carpenter, Mechanic services',
    fields: [
      { key: 'service_type', label: 'Service Category', type: 'select', required: true, options: ['Electrician', 'Plumber', 'AC Repair & Service', 'Solar / UPS Inverter', 'Painter & Polish', 'Carpenter', 'Appliance Repair', 'Mechanic / Car Repair'] },
      { key: 'experience', label: 'Experience / Rates', type: 'text', required: false, placeholder: 'e.g., 8 years experience, Visit fee Rs. 500' },
      { key: 'phone', label: 'Direct Phone / WhatsApp', type: 'text', required: false, placeholder: '+92 300 1234567' },
    ],
  },
  {
    slug: 'tuition',
    label: 'Tutors & Coaching',
    group: 'services',
    icon: GraduationCap,
    color: '#10b981',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    safetyTips: [
      'Check academic degrees and previous tutoring references.',
      'Conduct initial introductory demo sessions in open common study rooms.',
      'Agree on weekly class schedules and monthly payment terms in advance.',
    ],
    description: 'Find or offer home tutoring, language classes, or academic coaching',
    fields: [
      { key: 'subject', label: 'Subjects Taught', type: 'text', required: true, placeholder: 'e.g., Math, Physics, O/A Levels' },
      { key: 'mode', label: 'Teaching Mode', type: 'select', required: true, options: ['Home Visits', 'Student Comes to Tutor', 'Online Classes'] },
      { key: 'fee', label: 'Monthly Fee', type: 'price', required: false, placeholder: 'e.g., 8000' },
    ],
  },
  {
    slug: 'domestic_help',
    label: 'Domestic Help & Staff',
    group: 'services',
    icon: HeartPulse,
    color: '#ec4899',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    textColor: 'text-pink-700 dark:text-pink-300',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    isHighRisk: true,
    safetyTips: [
      'Always inspect original CNIC/ID card, verify NADRA validity, and keep a physical photocopy.',
      'Contact previous employers or neighbor references before hiring full-time staff.',
      'Conduct the initial interview in the presence of adult family members.',
      'Keep personal financial PINs, ATM cards, and valuable jewelry securely locked.',
    ],
    description: 'Verified maids, cooks, babysitters, caretakers, and private drivers',
    fields: [
      { key: 'role', label: 'Role', type: 'select', required: true, options: ['Maid / Cleaning', 'Cook', 'Driver', 'Babysitter / Nanny', 'Elderly Care'] },
      { key: 'timing', label: 'Timing', type: 'select', required: true, options: ['Full-Time (8-10 hrs)', 'Part-Time (2-4 hrs)', 'Live-In', 'On-Demand'] },
    ],
  },

  // === PROPERTIES & RENTALS ===
  {
    slug: 'property_rent',
    label: 'Flats & Rentals',
    group: 'rentals',
    icon: Home,
    color: '#059669',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: null,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Inspect property ownership documents or authorization letter before paying token money.',
      'Never transfer rent or security deposits without a signed, legally registered tenancy agreement.',
      'Visit the apartment during daylight hours and inspect electricity, gas, and water bill arrears.',
      'Clarify maintenance charges, building rules, and parking allocations upfront.',
    ],
    description: 'Flats, portions, shared rooms, houses, and commercial shops for rent',
    fields: [
      { key: 'property_type', label: 'Type', type: 'select', required: true, options: ['Apartment / Flat', 'Upper Portion', 'Ground Portion', 'Single Room / Flatmate', 'Commercial Shop', 'Office Space'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', required: true, options: ['Single Room', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'] },
      { key: 'price', label: 'Monthly Rent (PKR)', type: 'price', required: true, placeholder: 'e.g., 45000' },
      { key: 'furnishing', label: 'Furnishing', type: 'select', required: false, options: ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'] },
    ],
  },

  // === MARKETPLACE & DEALS ===
  {
    slug: 'second_hand',
    label: 'Buy & Sell Marketplace',
    group: 'marketplace',
    icon: Repeat2,
    color: '#0d9488',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    textColor: 'text-teal-700 dark:text-teal-300',
    defaultRadiusKm: 4,
    autoExpireMinutes: null,
    requiresPhoto: true,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    isHighRisk: true,
    safetyTips: [
      'Meet in a busy, well-lit public place (e.g., popular shopping mall or cafe).',
      'Never send advance wire transfers, deposits, or online payments before seeing the item.',
      'Thoroughly inspect and test smartphones, laptops, and appliances on the spot.',
      'For high-value items, bring a friend or companion along for the exchange.',
    ],
    description: 'Sell or buy used electronics, smartphones, furniture, appliances, and gear',
    fields: [
      { key: 'item_category', label: 'Item Category', type: 'select', required: true, options: ['Electronics & Gadgets', 'Smartphones & Laptops', 'Furniture & Decor', 'Home Appliances', 'Bikes & Vehicles', 'Books & Sports'] },
      { key: 'price', label: 'Price (PKR)', type: 'price', required: true, placeholder: 'e.g., 25000' },
      { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New / Box Packed', 'Like New (9/10)', 'Good (7-8/10)', 'Used / Functional'] },
    ],
  },
  {
    slug: 'local_deals',
    label: 'Deals & Discounts',
    group: 'marketplace',
    icon: Tag,
    color: '#e11d48',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    textColor: 'text-rose-700 dark:text-rose-300',
    defaultRadiusKm: 4,
    autoExpireMinutes: 10080,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: true,
    description: 'Restaurant promotions, grocery sales, bakery offers, and store discounts',
    fields: [
      { key: 'business_name', label: 'Store / Restaurant Name', type: 'text', required: true, placeholder: 'e.g., Daily Grill, Super Mart' },
      { key: 'offer_details', label: 'Offer Summary', type: 'text', required: true, placeholder: 'e.g., 30% Off all Burgers, Buy 1 Get 1' },
      { key: 'valid_until', label: 'Valid Until', type: 'date', required: false },
    ],
  },

  // === TRANSPORT & CARPOOL ===
  {
    slug: 'ride_share',
    label: 'Carpool & Rideshare',
    group: 'transport',
    icon: CarFront,
    color: '#0284c7',
    bgColor: 'bg-sky-100 dark:bg-sky-900/30',
    textColor: 'text-sky-700 dark:text-sky-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: 1440,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: false,
    supportsFeatured: false,
    isHighRisk: true,
    safetyTips: [
      'Verify vehicle number plate, driver photo, and car model before entering.',
      'Share your live trip location with a trusted friend or family member.',
      'Choose busy, designated pickup and drop-off spots on main roads.',
      'Women-only verified carpool options are available for added peace of mind.',
    ],
    description: 'Daily office commute carpooling, shared rides, and women-only options',
    fields: [
      { key: 'departure_time', label: 'Departure Time', type: 'text', required: true, placeholder: 'e.g., 8:15 AM Mon-Fri' },
      { key: 'destination', label: 'Destination / Dropoff', type: 'text', required: true, placeholder: 'e.g., Tech City / Blue Area / Clifton' },
      { key: 'vehicle', label: 'Vehicle Model', type: 'text', required: false, placeholder: 'e.g., Honda City (AC)' },
      { key: 'fare', label: 'Share per seat', type: 'text', required: false, placeholder: 'e.g., Rs. 300/day' },
      { key: 'women_only', label: 'Women Only Carpool', type: 'toggle', required: false },
    ],
  },
  {
    slug: 'traffic_alert',
    label: 'Traffic & Road Updates',
    group: 'transport',
    icon: Car,
    color: '#eab308',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    defaultRadiusKm: 3,
    autoExpireMinutes: 180,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: true,
    supportsFeatured: false,
    description: 'Report road blockades, construction diversions, or heavy traffic jams',
    fields: [
      { key: 'road_name', label: 'Road / Intersection', type: 'text', required: true, placeholder: 'e.g., Main Boulevard Underpass' },
      { key: 'cause', label: 'Reason', type: 'select', required: true, options: ['Heavy Traffic Jam', 'Road Construction', 'Accident', 'Water Logging', 'VIP Movement'] },
    ],
  },

  // === URGENT & EMERGENCY ===
  {
    slug: 'urgent_blood',
    label: 'Emergency Blood Need',
    group: 'emergency',
    icon: Droplet,
    color: '#dc2626',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    defaultRadiusKm: 5,
    autoExpireMinutes: 360,
    requiresPhoto: false,
    requiresLocation: true,
    supportsConfirm: true,
    supportsFeatured: true,
    description: 'Emergency blood donation request for nearby hospitals and clinics',
    fields: [
      { key: 'blood_type', label: 'Blood Group Required', type: 'blood_type', required: true, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
      { key: 'hospital', label: 'Hospital & Ward', type: 'text', required: true, placeholder: 'e.g., City Hospital ER Ward 2' },
      { key: 'contact_number', label: 'Attendant Phone Number', type: 'text', required: true, placeholder: '+92 300 9876543' },
      { key: 'urgency', label: 'Urgency Level', type: 'select', required: true, options: ['Immediate / Surgery in progress', 'Within 2-4 hours', 'Needed by tonight'] },
    ],
  },
];

export const CATEGORY_MAP: Record<string, CategoryConfig> = CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.slug] = cat;
    return acc;
  },
  {} as Record<string, CategoryConfig>
);

export function getCategory(slug: string): CategoryConfig | undefined {
  return CATEGORY_MAP[slug];
}

export function getExpiryDate(slug: string): string | null {
  const cat = CATEGORY_MAP[slug];
  if (!cat || cat.autoExpireMinutes === null) return null;
  const now = new Date();
  now.setMinutes(now.getMinutes() + cat.autoExpireMinutes);
  return now.toISOString();
}
