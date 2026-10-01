import L from 'leaflet';
import { getCategory } from '@/lib/categories';

const cache = new Map<string, L.DivIcon>();

/** Category pin: coloured teardrop with the category glyph initial. */
export function categoryPin(slug: string, opts: { selected?: boolean; urgent?: boolean } = {}): L.DivIcon {
  const key = `${slug}:${opts.selected ? 1 : 0}:${opts.urgent ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cat = getCategory(slug);
  const size = opts.selected ? 44 : 34;
  const pulse = opts.urgent
    ? `<span style="position:absolute;left:50%;top:${size / 2}px;width:${size}px;height:${size}px;margin-left:-${size / 2}px;margin-top:-${size / 2}px;border-radius:999px;background:${cat.color};opacity:.35;animation:pingSlow 2.4s cubic-bezier(0,0,.2,1) infinite"></span>`
    : '';
  const html = `
    <div style="position:relative;width:${size}px;height:${size + 8}px">
      ${pulse}
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:999px 999px 999px 4px;transform:rotate(-45deg);background:${cat.color};box-shadow:0 6px 14px -4px ${cat.color}aa;border:${opts.selected ? 3 : 2}px solid white;display:flex;align-items:center;justify-content:center">
        <span style="transform:rotate(45deg);color:white;font:800 ${opts.selected ? 15 : 12}px 'Plus Jakarta Sans',system-ui;letter-spacing:-.02em">${cat.short.slice(0, 1)}</span>
      </div>
    </div>`;
  const icon = L.divIcon({ html, className: 'sr-pin', iconSize: [size, size + 8], iconAnchor: [size / 2, size + 4], popupAnchor: [0, -size] });
  cache.set(key, icon);
  return icon;
}

export function clusterPin(count: number, color: string): L.DivIcon {
  const size = count < 10 ? 38 : count < 50 ? 46 : 54;
  return L.divIcon({
    className: 'sr-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:white;display:flex;align-items:center;justify-content:center;font:800 14px 'Plus Jakarta Sans',system-ui;border:3px solid white;box-shadow:0 0 0 6px ${color}33,0 8px 18px -6px ${color}">${count}</div>`,
  });
}

export const youAreHere = L.divIcon({
  className: 'sr-pin',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:0;border-radius:999px;background:#2549ea;opacity:.35;animation:pingSlow 2.4s cubic-bezier(0,0,.2,1) infinite"></span>
    <span style="position:absolute;inset:3px;border-radius:999px;background:#2549ea;border:3px solid white;box-shadow:0 2px 8px rgba(37,73,234,.6)"></span>
  </div>`,
});

export function emergencyPin(): L.DivIcon {
  return L.divIcon({
    className: 'sr-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:9px;background:#dc2626;color:white;display:flex;align-items:center;justify-content:center;font:800 16px system-ui;border:2px solid white;box-shadow:0 6px 14px -4px #dc2626">+</div>`,
  });
}
