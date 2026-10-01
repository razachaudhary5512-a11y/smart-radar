export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h left`;
  return `${Math.round(hr / 24)}d left`;
}

export function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(dateStr).toLocaleDateString('en-PK', opts);
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Normalise a Pakistani mobile number to E.164 (+92XXXXXXXXXX). Returns null if invalid. */
export function toE164PK(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('0092')) local = local.slice(4);
  else if (local.startsWith('92')) local = local.slice(2);
  else if (local.startsWith('0')) local = local.slice(1);
  if (!/^3\d{9}$/.test(local)) return null;
  return `+92${local}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/(\+\d{2})(\d{3})(\d+)(\d{2})$/, (_, cc, op, mid, end) => `${cc} ${op} ${'•'.repeat(mid.length)}${end}`);
}

export function maskCnic(cnic: string | null | undefined): string {
  if (!cnic) return '—';
  const d = cnic.replace(/\D/g, '');
  if (d.length !== 13) return '•••••-•••••••-•';
  return `${d.slice(0, 5)}-•••••••-${d.slice(12)}`;
}

export function formatCnic(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prefix ? `${prefix}-${r}` : r;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsappLink(phone: string, text?: string): string {
  const n = (toE164PK(phone) ?? phone).replace(/\D/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
