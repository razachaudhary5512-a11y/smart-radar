import { Bookmark, FileText, LayoutGrid, Map, Radar, Search, Siren, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  auth?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Radar Feed', icon: Radar, end: true },
  { to: '/map', label: 'Live Map', icon: Map },
  { to: '/search', label: 'Explore', icon: Search },
  { to: '/emergency', label: 'Emergency', icon: Siren },
];

export const PERSONAL_NAV: NavItem[] = [
  { to: '/my-posts', label: 'My Posts', icon: FileText, auth: true },
  { to: '/saved', label: 'Saved', icon: Bookmark, auth: true },
  { to: '/profile', label: 'Profile & Settings', icon: UserRound, auth: true },
];

export const MOBILE_NAV = [
  { to: '/', label: 'Feed', icon: Radar, end: true },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/create', label: 'Post', icon: null, action: true },
  { to: '/my-posts', label: 'My Posts', icon: FileText },
  { to: '#more', label: 'More', icon: LayoutGrid, more: true },
] as const;
