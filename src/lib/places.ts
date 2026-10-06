/**
 * Countries and major cities users can pick as their radar area.
 * Coordinates are city centres. Any other town can be found with search
 * (OpenStreetMap), limited to the chosen country.
 */
import type { Coords } from './types';

export interface City extends Coords {
  name: string;
  region?: string;
}

export interface Country {
  code: string; // ISO 3166-1 alpha-2, lower-case (used for search)
  name: string;
  flag: string;
  cities: City[];
}

export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;
export const RADIUS_PRESETS = [1, 3, 5, 10, 25, 50];

export function clampRadius(km: number): number {
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.round(km)));
}

export const COUNTRIES: Country[] = [
  {
    code: 'pk',
    name: 'Pakistan',
    flag: '🇵🇰',
    cities: [
      { name: 'Karachi', region: 'Sindh', lat: 24.8607, lng: 67.0011 },
      { name: 'Lahore', region: 'Punjab', lat: 31.5204, lng: 74.3587 },
      { name: 'Islamabad', region: 'Capital Territory', lat: 33.6844, lng: 73.0479 },
      { name: 'Rawalpindi', region: 'Punjab', lat: 33.5651, lng: 73.0169 },
      { name: 'Faisalabad', region: 'Punjab', lat: 31.4504, lng: 73.135 },
      { name: 'Multan', region: 'Punjab', lat: 30.1575, lng: 71.5249 },
      { name: 'Peshawar', region: 'Khyber Pakhtunkhwa', lat: 34.0151, lng: 71.5249 },
      { name: 'Quetta', region: 'Balochistan', lat: 30.1798, lng: 66.975 },
      { name: 'Hyderabad', region: 'Sindh', lat: 25.396, lng: 68.3578 },
      { name: 'Gujranwala', region: 'Punjab', lat: 32.1877, lng: 74.1945 },
      { name: 'Sialkot', region: 'Punjab', lat: 32.4945, lng: 74.5229 },
      { name: 'Bahawalpur', region: 'Punjab', lat: 29.3544, lng: 71.6911 },
      { name: 'Sargodha', region: 'Punjab', lat: 32.074, lng: 72.6861 },
      { name: 'Sukkur', region: 'Sindh', lat: 27.7052, lng: 68.8574 },
      { name: 'Larkana', region: 'Sindh', lat: 27.557, lng: 68.2264 },
      { name: 'Abbottabad', region: 'Khyber Pakhtunkhwa', lat: 34.1688, lng: 73.2215 },
      { name: 'Mardan', region: 'Khyber Pakhtunkhwa', lat: 34.1986, lng: 72.0404 },
      { name: 'Gujrat', region: 'Punjab', lat: 32.5731, lng: 74.0789 },
      { name: 'Rahim Yar Khan', region: 'Punjab', lat: 28.4202, lng: 70.2952 },
      { name: 'Sahiwal', region: 'Punjab', lat: 30.6682, lng: 73.1114 },
      { name: 'Dera Ghazi Khan', region: 'Punjab', lat: 30.0459, lng: 70.6403 },
      { name: 'Nawabshah', region: 'Sindh', lat: 26.2442, lng: 68.41 },
      { name: 'Mingora (Swat)', region: 'Khyber Pakhtunkhwa', lat: 34.7717, lng: 72.36 },
      { name: 'Muzaffarabad', region: 'Azad Kashmir', lat: 34.37, lng: 73.4711 },
      { name: 'Mirpur', region: 'Azad Kashmir', lat: 33.1478, lng: 73.7517 },
      { name: 'Gilgit', region: 'Gilgit-Baltistan', lat: 35.9208, lng: 74.3089 },
    ],
  },
  {
    code: 'ae',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    cities: [
      { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
      { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 },
      { name: 'Sharjah', lat: 25.3463, lng: 55.4209 },
      { name: 'Ajman', lat: 25.4052, lng: 55.5136 },
      { name: 'Al Ain', lat: 24.2075, lng: 55.7447 },
    ],
  },
  {
    code: 'sa',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    cities: [
      { name: 'Riyadh', lat: 24.7136, lng: 46.6753 },
      { name: 'Jeddah', lat: 21.4858, lng: 39.1925 },
      { name: 'Makkah', lat: 21.3891, lng: 39.8579 },
      { name: 'Madinah', lat: 24.5247, lng: 39.5692 },
      { name: 'Dammam', lat: 26.4207, lng: 50.0888 },
    ],
  },
  {
    code: 'qa',
    name: 'Qatar',
    flag: '🇶🇦',
    cities: [{ name: 'Doha', lat: 25.2854, lng: 51.531 }],
  },
  {
    code: 'om',
    name: 'Oman',
    flag: '🇴🇲',
    cities: [
      { name: 'Muscat', lat: 23.588, lng: 58.3829 },
      { name: 'Salalah', lat: 17.0151, lng: 54.0924 },
    ],
  },
  {
    code: 'gb',
    name: 'United Kingdom',
    flag: '🇬🇧',
    cities: [
      { name: 'London', lat: 51.5074, lng: -0.1278 },
      { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
      { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
      { name: 'Bradford', lat: 53.795, lng: -1.7594 },
      { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
    ],
  },
  {
    code: 'us',
    name: 'United States',
    flag: '🇺🇸',
    cities: [
      { name: 'New York', lat: 40.7128, lng: -74.006 },
      { name: 'Houston', lat: 29.7604, lng: -95.3698 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Dallas', lat: 32.7767, lng: -96.797 },
    ],
  },
  {
    code: 'ca',
    name: 'Canada',
    flag: '🇨🇦',
    cities: [
      { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
      { name: 'Mississauga', lat: 43.589, lng: -79.6441 },
      { name: 'Calgary', lat: 51.0447, lng: -114.0719 },
      { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
      { name: 'Montreal', lat: 45.5017, lng: -73.5673 },
    ],
  },
  {
    code: 'au',
    name: 'Australia',
    flag: '🇦🇺',
    cities: [
      { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
      { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
    ],
  },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountry(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code?.toLowerCase());
}

/** Rough map zoom that fits a circle of `radiusKm`. */
export function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 1) return 15;
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 4) return 13;
  if (radiusKm <= 8) return 12;
  if (radiusKm <= 16) return 11;
  if (radiusKm <= 32) return 10;
  return 9;
}
