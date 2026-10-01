import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ambulance,
  Flame,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Share2,
  Shield,
  ShieldAlert,
  Siren,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/Page';
import { CategoryIcon, EmptyState, Sheet, Spinner, useToast } from '@/components/ui';
import { useApi } from '@/data';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { shareContent } from '@/lib/native';
import { useRadar } from '@/lib/location-context';
import { formatDistance, googleMapsLink } from '@/lib/location';
import { getCategory, headlineValue } from '@/lib/categories';
import { cn, telLink, timeAgo, toE164PK, whatsappLink } from '@/lib/format';

const TYPE_ICON: Record<string, typeof Siren> = { rescue: Siren, police: Shield, ambulance: Ambulance, fire: Flame, hospital: Plus };
const TYPE_COLOR: Record<string, string> = { rescue: '#dc2626', police: '#2549ea', ambulance: '#059669', fire: '#ea580c', hospital: '#db2777' };

export function Emergency() {
  const api = useApi();
  const { user, requireAuth } = useAuth();
  const radar = useRadar();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const contacts = useQuery(() => api.listEmergencyContacts(), [api], { scopes: ['emergency'] });
  const trusted = useQuery(() => (user ? api.listTrustedContacts(user.id) : Promise.resolve([])), [api, user?.id], { scopes: ['trusted'] });
  const alerts = useQuery(
    () => api.listPosts({ center: radar.coords, radiusKm: 5, sort: 'nearest' }, user?.id),
    [api, radar.coords.lat, radar.coords.lng, user?.id]
  );
  const urgent = (alerts.data ?? []).filter((p) => getCategory(p.category).isUrgent);

  const here = radar.gpsCoords ?? radar.coords;
  const sosMessage = `I need help. My current location: ${googleMapsLink(here)} (sent from Smart Radar)`;

  async function shareLocation() {
    if (!radar.gpsCoords) await radar.requestLocation();
    try {
      const how = await shareContent({ title: 'My location', text: sosMessage });
      if (how === 'copied') toast.success('Location message copied', 'Paste it into any chat or SMS.');
    } catch {
      toast.error('Could not share location');
    }
  }

  return (
    <>
      <PageHeader title="Emergency" subtitle="Help numbers, your trusted contacts and urgent alerts nearby." />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {/* SOS */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-danger-600 to-[#7f1d1d] p-5 text-white shadow-lift lg:p-7">
              <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
              <p className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <ShieldAlert className="h-4 w-4" /> In immediate danger?
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight lg:text-3xl">Call Rescue 1122</h2>
              <p className="mt-1 text-sm text-white/80">Free from any mobile or landline, 24/7. If 1122 isn’t available in your city, call Edhi 115 or Police 15.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a href={telLink('1122')} className="btn h-12 bg-white px-6 text-base text-danger-700 hover:bg-white/90">
                  <Phone className="h-5 w-5" /> Call 1122
                </a>
                <button onClick={shareLocation} className="btn h-12 bg-white/15 px-5 text-white backdrop-blur hover:bg-white/25">
                  <Share2 className="h-5 w-5" /> Share my location
                </button>
              </div>
            </section>

            {/* Directory */}
            <section>
              <h2 className="mb-3 text-[17px] font-bold tracking-tight text-ink">Emergency numbers</h2>
              {contacts.loading ? (
                <Spinner />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(contacts.data ?? []).map((c) => {
                    const Icon = TYPE_ICON[c.type] ?? Phone;
                    const color = TYPE_COLOR[c.type] ?? '#475569';
                    return (
                      <a key={c.id} href={telLink(c.phone)} className="card group flex items-center gap-3 p-3.5 transition hover:shadow-lift">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}17`, color }}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-lg font-extrabold leading-none text-ink">{c.phone}</p>
                          <p className="mt-1 truncate text-xs font-medium text-ink-2">{c.name}</p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Urgent nearby */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[17px] font-bold tracking-tight text-ink">Urgent alerts within 5 km</h2>
                <Link to="/create?category=urgent_blood" className="text-[13px] font-semibold text-primary-600">
                  Request blood
                </Link>
              </div>
              {alerts.loading ? (
                <Spinner />
              ) : urgent.length === 0 ? (
                <div className="card p-6 text-center text-sm text-ink-2">No urgent alerts nearby right now. 🌿</div>
              ) : (
                <div className="card divide-y divide-line overflow-hidden">
                  {urgent.map((p) => {
                    const c = getCategory(p.category);
                    const h = headlineValue(p.category, p.metadata);
                    return (
                      <Link key={p.id} to={`/post/${p.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface-2">
                        <CategoryIcon slug={p.category} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.color }}>
                            {c.short}
                            {h ? ` · ${h}` : ''}
                          </p>
                          <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                          <p className="text-xs text-ink-3">
                            {timeAgo(p.created_at)} · {formatDistance(p.distance_km)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Trusted contacts */}
          <aside className="space-y-4">
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-ink">
                  <Users className="h-4 w-4 text-primary-600" /> Trusted contacts
                </h2>
                {user && (
                  <button onClick={() => setAddOpen(true)} className="btn-secondary btn-sm">
                    <UserPlus className="h-4 w-4" /> Add
                  </button>
                )}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">One tap to call or WhatsApp your location to family.</p>
              {!user ? (
                <button className="btn-primary mt-4 w-full" onClick={() => requireAuth('Sign in to save trusted contacts')}>
                  Sign in to add contacts
                </button>
              ) : trusted.loading ? (
                <Spinner className="mt-4" />
              ) : !trusted.data?.length ? (
                <EmptyState icon={Users} title="No trusted contacts" body="Add family or friends you’d contact in an emergency." className="py-8" />
              ) : (
                <ul className="mt-4 space-y-2">
                  {trusted.data.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-2.5 pl-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                        <p className="text-xs text-ink-3">{t.phone}</p>
                      </div>
                      <a href={telLink(t.phone)} className="icon-btn h-9 w-9 bg-surface" aria-label={`Call ${t.name}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                      <a href={whatsappLink(t.phone, sosMessage)} target="_blank" rel="noreferrer" className="icon-btn h-9 w-9 bg-surface text-success-600" aria-label={`WhatsApp ${t.name}`}>
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <button
                        onClick={async () => {
                          await api.removeTrustedContact(user.id, t.id);
                          toast.success('Contact removed');
                        }}
                        className="icon-btn h-9 w-9"
                        aria-label={`Remove ${t.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-5">
              <h2 className="flex items-center gap-2 font-bold text-ink">
                <MapPin className="h-4 w-4 text-primary-600" /> Your location
              </h2>
              <p className="mt-1 text-[13px] text-ink-2">
                {radar.gpsCoords ? `${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}` : 'Location not shared yet.'}
              </p>
              <div className="mt-3 flex gap-2">
                {!radar.gpsCoords && (
                  <button className="btn-secondary btn-sm flex-1" onClick={radar.requestLocation}>
                    Enable GPS
                  </button>
                )}
                <a href={googleMapsLink(here)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm flex-1">
                  Open in Maps
                </a>
              </div>
            </section>
          </aside>
        </div>
      </PageBody>
      {user && <AddTrustedSheet open={addOpen} onClose={() => setAddOpen(false)} userId={user.id} />}
    </>
  );
}

function AddTrustedSheet({ open, onClose, userId }: { open: boolean; onClose(): void; userId: string }) {
  const api = useApi();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length >= 2 && toE164PK(phone);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const e164 = toE164PK(phone);
    if (!e164) return;
    setBusy(true);
    try {
      await api.addTrustedContact(userId, name.trim(), e164);
      toast.success('Trusted contact added');
      setName('');
      setPhone('');
      onClose();
    } catch (err) {
      toast.error('Could not add contact', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add trusted contact" size="sm">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="tc-name">Name</label>
          <input id="tc-name" data-autofocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Ammi" />
        </div>
        <div>
          <label className="label" htmlFor="tc-phone">Mobile number</label>
          <input id="tc-phone" inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" />
        </div>
        <button className={cn('btn-primary w-full')} disabled={!valid || busy}>
          {busy ? 'Saving…' : 'Save contact'}
        </button>
      </form>
    </Sheet>
  );
}
