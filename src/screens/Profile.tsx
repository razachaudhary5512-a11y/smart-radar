import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Bell,
  Moon,
  Sun,
  Bookmark,
  Ban,
  ShieldCheck,
  SlidersHorizontal,
  ChevronRight,
  LogOut,
  Phone,
  Plus,
  Trash2,
  Star,
  Siren,
  Settings,
  Store,
  Newspaper,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  Tag,
  Briefcase,
  Home,
  MessageSquarePlus,
  X,
  Eye,
  Download,
  AlertOctagon,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location-context';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CATEGORY_MAP, type CategoryConfig } from '@/lib/categories';
import type { SavedLocation, TrustedContact, PostWithRelations, WatchedArea, VerificationAuditItem } from '@/lib/types';
import {
  getStoredLocalPosts,
  getStoredWatchedAreas,
  saveWatchedArea,
  deleteWatchedArea,
  exportAccountDataPackage,
  wipeAllAccountData,
  POPULAR_NEIGHBORHOODS,
} from '@/lib/dummy-data';
import { Modal, ConfirmDialog, Toast, Badge, EmptyState } from '@/components/ui';

type SettingsSection = 'main' | 'radius' | 'notifications' | 'saved' | 'blocked' | 'trusted' | 'verification' | 'watched_areas' | 'privacy';

export function Profile() {
  const navigate = useNavigate();
  const { profile, session, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { radiusKm, setRadiusKm } = useLocation();
  const [section, setSection] = useState<SettingsSection>('main');
  const [savedPosts, setSavedPosts] = useState<{ id: string; title: string; category: string }[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string }[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddTrusted, setShowAddTrusted] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });
  const [cnicInput, setCnicInput] = useState('');
  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  // Watch Areas
  const [watchedAreas, setWatchedAreas] = useState<WatchedArea[]>([]);
  const [showAddWatchArea, setShowAddWatchArea] = useState(false);
  const [customWatchName, setCustomWatchName] = useState('');
  const [customWatchCity, setCustomWatchCity] = useState('');
  const [customWatchRadius, setCustomWatchRadius] = useState(5);
  // Privacy
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const showToast = (msg: string) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast({ msg: '', show: false }), 2000);
  };

  useEffect(() => {
    if (section === 'saved' && session?.user) {
      loadSavedPosts();
    }
    if (section === 'blocked' && profile) {
      loadBlockedUsers();
    }
    if (section === 'trusted' && session?.user) {
      loadTrustedContacts();
    }
    if (section === 'watched_areas') {
      setWatchedAreas(getStoredWatchedAreas());
    }
    if (profile) {
      setEditName(profile.display_name);
    }
  }, [section, session?.user, profile]);

  async function loadSavedPosts() {
    if (!session?.user) return;
    const { data } = await supabase
      .from('bookmarks')
      .select('post_id, posts(title, category)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setSavedPosts(
      (data ?? []).map((b: unknown) => {
        const row = b as { post_id: string; posts: { title: string; category: string } };
        return { id: row.post_id, title: row.posts?.title ?? '', category: row.posts?.category ?? '' };
      })
    );
  }

  async function loadBlockedUsers() {
    if (!profile?.blocked_users?.length) {
      setBlockedUsers([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', profile.blocked_users);
    setBlockedUsers((data ?? []).map((p: { id: string; display_name: string }) => ({ id: p.id, name: p.display_name })));
  }

  async function loadTrustedContacts() {
    if (!session?.user) return;
    const { data } = await supabase
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    setTrustedContacts((data ?? []) as TrustedContact[]);
  }

  async function handleUnblock(userId: string) {
    if (!profile) return;
    const updated = profile.blocked_users.filter((id) => id !== userId);
    await updateProfile({ blocked_users: updated });
    loadBlockedUsers();
    showToast('User unblocked');
  }

  async function handleAddTrusted(name: string, phone: string) {
    if (!session?.user || !name.trim() || !phone.trim()) return;
    await supabase.from('trusted_contacts').insert({
      user_id: session.user.id,
      name: name.trim(),
      phone: phone.trim(),
    });
    setShowAddTrusted(false);
    loadTrustedContacts();
    showToast('Trusted contact added');
  }

  async function handleDeleteTrusted(id: string) {
    await supabase.from('trusted_contacts').delete().eq('id', id);
    setTrustedContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleAddLocation(label: string, lat: number, lng: number) {
    if (!profile) return;
    const locations = [...(profile.saved_locations ?? []), { label, lat, lng }];
    await updateProfile({ saved_locations: locations });
    setShowAddLocation(false);
    showToast('Location saved');
  }

  async function handleDeleteLocation(index: number) {
    if (!profile) return;
    const locations = profile.saved_locations.filter((_, i) => i !== index);
    await updateProfile({ saved_locations: locations });
  }

  async function handleSubmitVerification() {
    if (!cnicInput.trim() || !profile) return;
    const now = new Date();
    const sixMonthsLater = new Date(now.getTime() + 180 * 86400000);
    const newAuditItem: VerificationAuditItem = {
      id: `verify-${Date.now()}`,
      date: now.toISOString(),
      cnic_masked: `${cnicInput.substring(0, 5)}-XXXXXXX-${cnicInput.slice(-1)}`,
      status: 'valid',
      valid_until: sixMonthsLater.toISOString(),
      notes: 'CNIC/NTN verified by user submission',
    };
    const history = [...(profile.verification_history || []), newAuditItem];
    await updateProfile({
      is_business: true,
      cnic_number: cnicInput.trim(),
      verification_status: 'pending',
      verification_date: now.toISOString(),
      verification_expiry: sixMonthsLater.toISOString(),
      verification_history: history,
    });
    setCnicInput('');
    showToast('Verification submitted — pending admin review');
  }

  async function handleSaveName() {
    if (!editName.trim() || !profile) return;
    await updateProfile({ display_name: editName.trim() });
    setIsEditingName(false);
    showToast('Profile name updated');
  }

  function handleExportData() {
    if (!profile) return;
    try {
      const posts = getStoredLocalPosts();
      exportAccountDataPackage(profile, posts);
      showToast('Data package downloaded successfully!');
    } catch {
      showToast('Export failed — try again.');
    }
  }

  async function handleDeleteAccount() {
    if (!profile) return;
    if (deleteConfirmText.toLowerCase() !== profile.display_name.toLowerCase()) {
      showToast('Name does not match. Try again.');
      return;
    }
    try {
      if (session?.user) {
        await supabase.from('posts').delete().eq('user_id', session.user.id);
        await supabase.from('comments').delete().eq('user_id', session.user.id);
        await supabase.from('bookmarks').delete().eq('user_id', session.user.id);
        await supabase.from('votes').delete().eq('user_id', session.user.id);
        await supabase.auth.signOut();
      }
      wipeAllAccountData(profile.id);
      setShowDeleteAccount(false);
      navigate('/');
    } catch {
      showToast('Deletion failed — try again.');
    }
  }

  function handleAddWatchArea(neighborhood: typeof POPULAR_NEIGHBORHOODS[0]) {
    const newArea: WatchedArea = {
      id: `watched-${Date.now()}`,
      name: neighborhood.name,
      city: neighborhood.city,
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      radius_km: neighborhood.radius_km,
      notify: true,
      notes: neighborhood.notes,
      created_at: new Date().toISOString(),
    };
    saveWatchedArea(newArea);
    setWatchedAreas(getStoredWatchedAreas());
    showToast(`Now watching ${neighborhood.name}`);
  }

  function handleDeleteWatchArea(id: string) {
    deleteWatchedArea(id);
    setWatchedAreas(getStoredWatchedAreas());
    showToast('Area unfollowed');
  }

  function handleAddCustomWatchArea() {
    if (!customWatchName.trim()) {
      showToast('Please enter an area name');
      return;
    }
    const newArea: WatchedArea = {
      id: `watched-custom-${Date.now()}`,
      name: customWatchName.trim(),
      city: customWatchCity.trim() || 'Custom Location',
      lat: 24.8607,
      lng: 67.0011,
      radius_km: customWatchRadius,
      notify: true,
      notes: `Custom watched area — radius ${customWatchRadius} km`,
      created_at: new Date().toISOString(),
    };
    saveWatchedArea(newArea);
    setWatchedAreas(getStoredWatchedAreas());
    setCustomWatchName('');
    setCustomWatchCity('');
    setCustomWatchRadius(5);
    setShowAddWatchArea(false);
    showToast(`Now watching ${newArea.name}`);
  }

  // Daily digest helpers
  const digestCategories = profile?.digest_categories ?? ['local_deals', 'local_event', 'jobs_internships', 'property_rent'];
  const mutedCategories = profile?.muted_categories ?? [];
  const isDigestEnabled = profile?.digest_enabled ?? true;
  const digestTime = profile?.digest_time ?? '20:00';

  function setCategoryNotificationPreference(slug: string, preference: 'realtime' | 'digest' | 'muted') {
    if (!profile) return;
    let newMuted = [...(profile.muted_categories || [])];
    let newDigest = [...(profile.digest_categories || [])];

    if (preference === 'realtime') {
      newMuted = newMuted.filter((s) => s !== slug);
      newDigest = newDigest.filter((s) => s !== slug);
    } else if (preference === 'digest') {
      newMuted = newMuted.filter((s) => s !== slug);
      if (!newDigest.includes(slug)) newDigest.push(slug);
    } else if (preference === 'muted') {
      if (!newMuted.includes(slug)) newMuted.push(slug);
      newDigest = newDigest.filter((s) => s !== slug);
    }

    updateProfile({ muted_categories: newMuted, digest_categories: newDigest });
    showToast(`Preferences updated for ${CATEGORY_MAP[slug]?.label ?? slug}`);
  }

  // Sample digest items from current local posts
  const digestPosts = useMemo(() => {
    const posts = getStoredLocalPosts();
    return posts.filter((p) => digestCategories.includes(p.category) && !mutedCategories.includes(p.category));
  }, [digestCategories, mutedCategories]);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => navigate('/onboarding')} className="btn-primary">
          Sign in to view profile
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight">
            {section === 'main' ? 'Citizen Profile' : section === 'notifications' ? 'Alerts & Daily Digest' : 'Settings'}
          </h1>
          {section !== 'main' && (
            <button onClick={() => setSection('main')} className="btn-ghost text-xs font-bold cursor-pointer">
              Back
            </button>
          )}
        </div>
      </div>

      {section === 'main' && (
        <div className="px-4 py-4 space-y-4 animate-fade-in">
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200/80 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={
                    profile.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'Radar Citizen')}&background=2563eb&color=fff&size=120`
                  }
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary-500/20"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900" />
              </div>

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input text-xs py-1"
                      placeholder="Your name"
                    />
                    <button
                      onClick={handleSaveName}
                      className="btn-primary text-xs px-2.5 py-1"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold truncate text-gray-900 dark:text-white">
                      {profile.display_name || 'Radar Citizen'}
                    </h2>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-[11px] text-primary-600 font-bold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{profile.phone || 'Neighborhood Resident'}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
                    <ShieldCheck size={12} /> {profile.trust_score ?? 100}% Trust Score
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                    Active Radar
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Settings Rows */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 shadow-xs overflow-hidden">
            <SettingRow
              icon={Bell}
              label="Notifications & Daily Digest"
              sublabel="Digest summary for deals, events & marketplace"
              badge="Digest Option"
              onClick={() => setSection('notifications')}
            />
            <SettingRow
              icon={SlidersHorizontal}
              label="Radar Scanning Radius"
              value={`${radiusKm} km`}
              onClick={() => setSection('radius')}
            />
            <SettingRow
              icon={Bookmark}
              label="Saved Posts & Bookmarks"
              onClick={() => setSection('saved')}
            />
            <SettingRow
              icon={Ban}
              label="Blocked Users"
              value={profile.blocked_users.length > 0 ? `${profile.blocked_users.length}` : undefined}
              onClick={() => setSection('blocked')}
            />
            <SettingRow
              icon={Siren}
              label="Trusted Emergency Contacts"
              value={trustedContacts.length > 0 ? `${trustedContacts.length}` : undefined}
              onClick={() => setSection('trusted')}
            />
            <SettingRow
              icon={ShieldCheck}
              label="Business & Trader Verification"
              value={profile.verification_status ?? 'Ready to apply'}
              onClick={() => setSection('verification')}
            />
            <SettingRow
              icon={Eye}
              label="Watched Areas (Beyond Radius)"
              sublabel={`${(profile.watched_areas?.length ?? watchedAreas.length)} areas followed — DHA, Gulberg, F-7 etc.`}
              badge="New"
              onClick={() => { setWatchedAreas(getStoredWatchedAreas()); setSection('watched_areas'); }}
            />
            <SettingRow
              icon={Download}
              label="Data Export & Privacy (GDPR)"
              sublabel="Export your data or delete your account"
              badge="Privacy"
              onClick={() => setSection('privacy')}
            />
            <SettingRow
              icon={theme === 'dark' ? Sun : Moon}
              label="App Display Theme"
              value={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              onClick={toggleTheme}
            />
          </div>

          {/* Saved Locations */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-primary-600" />
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Saved Radar Locations</h3>
              </div>
              <button
                onClick={() => setShowAddLocation(true)}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {profile.saved_locations.length > 0 ? (
              <div className="space-y-2">
                {profile.saved_locations.map((loc, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{loc.label}</p>
                      <p className="text-[10px] text-gray-400">{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</p>
                    </div>
                    <button onClick={() => handleDeleteLocation(i)} className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Save common locations like home or workplace for instant radar switching.</p>
            )}
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => setShowSignOut(true)}
            className="w-full py-3 rounded-2xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      )}

      {/* RADIUS SECTION */}
      {section === 'radius' && (
        <div className="px-4 py-4 animate-fade-in space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 text-center border border-gray-200/80 dark:border-gray-800 shadow-xs">
            <div className="text-5xl font-black text-primary-600 mb-2">{radiusKm} km</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Posts, deals, and alerts within this radius appear in your radar feed and interactive map.
            </p>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2 font-bold">
              <span>1 km (Walking)</span>
              <span>5 km (Sector)</span>
              <span>10 km (Max Radar)</span>
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
            <Eye size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>Watch Areas</strong> can reach up to <strong>20 km</strong> — follow a distant neighborhood via Profile → Watched Areas.
            </span>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS & DAILY DIGEST SECTION */}
      {section === 'notifications' && (
        <div className="px-4 py-4 space-y-4 animate-fade-in">
          {/* DAILY DIGEST HERO CARD */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 to-primary-900 text-white shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Newspaper size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Daily Neighborhood Digest</h3>
                  <p className="text-[11px] text-indigo-200">1 bundled summary instead of constant alerts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateProfile({ digest_enabled: !isDigestEnabled });
                  showToast(isDigestEnabled ? 'Daily digest disabled' : 'Daily digest enabled');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isDigestEnabled ? 'bg-emerald-500' : 'bg-white/30'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    isDigestEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {isDigestEnabled && (
              <div className="pt-3 border-t border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-200 flex items-center gap-1">
                    <Clock size={13} /> Preferred Delivery Time:
                  </span>
                  <select
                    value={digestTime}
                    onChange={(e) => updateProfile({ digest_time: e.target.value })}
                    className="bg-white/15 text-white font-bold text-xs rounded-xl px-2 py-1 border border-white/20 outline-hidden"
                  >
                    <option value="09:00" className="text-gray-900">Morning (9:00 AM)</option>
                    <option value="13:00" className="text-gray-900">Midday (1:00 PM)</option>
                    <option value="20:00" className="text-gray-900">Evening (8:00 PM)</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowDigestModal(true)}
                  className="w-full py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center justify-center gap-1.5 backdrop-blur-xs transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Preview Today's Daily Summary</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-gray-500 uppercase px-1">Category Alert Modes</h4>
            <p className="text-[11px] text-gray-400 px-1">
              Choose whether to receive immediate alerts, roll updates into your daily digest, or mute completely.
            </p>
          </div>

          {/* Category List with 3-way segment controls */}
          <div className="space-y-2">
            {CATEGORIES.map((cat) => {
              const isUrgent = cat.slug === 'urgent_blood' || cat.group === 'emergency';
              const isMuted = mutedCategories.includes(cat.slug);
              const isDigest = digestCategories.includes(cat.slug) && !isMuted;
              const isRealtime = !isMuted && !isDigest;

              return (
                <div key={cat.slug} className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-200/80 dark:border-gray-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cat.bgColor}`}>
                        <cat.icon size={16} className={cat.textColor} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">{cat.label}</span>
                        <span className="text-[10px] text-gray-400">{cat.group}</span>
                      </div>
                    </div>
                    {isUrgent && (
                      <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        🚨 Priority Realtime
                      </span>
                    )}
                  </div>

                  {!isUrgent && (
                    <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setCategoryNotificationPreference(cat.slug, 'realtime')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          isRealtime
                            ? 'bg-white dark:bg-gray-900 text-primary-600 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        🔔 Instant
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryNotificationPreference(cat.slug, 'digest')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          isDigest
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        📰 Daily Digest
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryNotificationPreference(cat.slug, 'muted')}
                        className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                          isMuted
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        🔕 Mute
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SAVED POSTS */}
      {section === 'saved' && (
        <div className="px-4 py-4 space-y-2 animate-fade-in">
          {savedPosts.length === 0 ? (
            <EmptyState icon={<Bookmark size={28} />} title="No saved posts" message="Bookmark posts to find them here later." />
          ) : (
            savedPosts.map((p) => {
              const cat = CATEGORY_MAP[p.category];
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/post/${p.id}`)}
                  className="card p-3 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cat?.bgColor ?? 'bg-gray-100'}`}>
                    {cat && <cat.icon size={16} className={cat.textColor} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                    <p className="text-xs text-gray-400">{cat?.label}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* BLOCKED USERS */}
      {section === 'blocked' && (
        <div className="px-4 py-4 space-y-2 animate-fade-in">
          {blockedUsers.length === 0 ? (
            <EmptyState icon={<Ban size={28} />} title="No blocked users" message="Blocked users will appear here." />
          ) : (
            blockedUsers.map((u) => (
              <div key={u.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                </div>
                <button onClick={() => handleUnblock(u.id)} className="btn-ghost text-xs text-primary-600">
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TRUSTED CONTACTS */}
      {section === 'trusted' && (
        <div className="px-4 py-4 space-y-2 animate-fade-in">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            These emergency contacts receive instant SMS/notification broadcasts if you trigger emergency assistance.
          </p>
          <button onClick={() => setShowAddTrusted(true)} className="btn-secondary w-full text-xs font-bold py-2.5">
            <Plus size={16} /> Add Trusted Contact
          </button>
          {trustedContacts.length === 0 ? (
            <EmptyState icon={<Siren size={28} />} title="No trusted contacts" message="Add contacts who will be alerted in an emergency." />
          ) : (
            trustedContacts.map((c) => (
              <div key={c.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                    <Phone size={14} className="text-danger-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteTrusted(c.id)} className="btn-ghost p-1.5">
                  <Trash2 size={14} className="text-gray-400" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* VERIFICATION */}
      {section === 'verification' && (
        <div className="px-4 py-4 space-y-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200/80 dark:border-gray-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Business & Service Verification</h3>
                <p className="text-xs text-gray-400">CNIC-verified providers renew every 6 months to keep badge active</p>
              </div>
            </div>

            {profile.verification_status === 'approved' && (() => {
              const expiryDate = profile.verification_expiry ? new Date(profile.verification_expiry) : null;
              const daysUntilExpiry = expiryDate
                ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)
                : null;
              const isDueSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;
              const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
              return (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs font-bold ${
                    isExpired
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      : isDueSoon
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    <ShieldCheck size={18} />
                    <div className="flex-1">
                      <span>{isExpired ? 'CNIC Verification Expired!' : isDueSoon ? 'Renewal Due Soon' : 'CNIC Verified ✓ (Active)'}</span>
                      {expiryDate && (
                        <p className="font-normal mt-0.5">
                          {isExpired
                            ? `Expired ${Math.abs(daysUntilExpiry!)} days ago — renew now to keep your badge`
                            : isDueSoon
                            ? `Expires in ${daysUntilExpiry} days — renew before ${expiryDate.toLocaleDateString('en-PK', { day: 'numeric', month: 'long' })}`
                            : `Valid until ${expiryDate.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysUntilExpiry} days)`
                          }
                        </p>
                      )}
                    </div>
                    <RefreshCw size={15} className="shrink-0" />
                  </div>

                  {/* Re-verification schedule info */}
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5">
                    <p className="font-bold text-gray-700 dark:text-gray-300">📅 Periodic Re-Verification Schedule</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span><strong>Every 6 months:</strong> Standard CNIC/NTN re-confirmation required</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>30 days before:</strong> Due-soon reminder shown on your badge</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span><strong>After expiry:</strong> Badge paused until renewed</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Providers are required to re-confirm their CNIC/NTN details every 6 months. This keeps the Verified badge meaningful for the entire neighborhood.
                  </p>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Re-verify / Renew CNIC</p>
                    <input
                      type="text"
                      value={cnicInput}
                      onChange={(e) => setCnicInput(e.target.value)}
                      placeholder="Re-enter CNIC (e.g., 42101-1234567-1)"
                      className="input text-xs"
                    />
                    <button onClick={handleSubmitVerification} className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2">
                      <RefreshCw size={14} /> Renew Verification
                    </button>
                  </div>
                  {/* Audit Trail */}
                  {profile.verification_history && profile.verification_history.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Audit Trail</p>
                      {profile.verification_history.map((item) => (
                        <div key={item.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-[10px] space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-800 dark:text-gray-200">{item.cnic_masked}</span>
                            <span className={`font-bold ${item.status === 'valid' ? 'text-emerald-600' : item.status === 'due_soon' ? 'text-amber-600' : 'text-red-600'}`}>
                              {item.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-400">Verified: {new Date(item.date).toLocaleDateString()}</p>
                          <p className="text-gray-400">Valid until: {new Date(item.valid_until).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {profile.verification_status === 'pending' && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                <Star size={18} />
                <span>Verification request pending admin approval</span>
              </div>
            )}
            {(!profile.verification_status || profile.verification_status === 'rejected') && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Enter your CNIC or Business Registration number to obtain the Verified Citizen badge.
                </p>
                <input
                  type="text"
                  value={cnicInput}
                  onChange={(e) => setCnicInput(e.target.value)}
                  placeholder="e.g., 42101-1234567-1"
                  className="input text-xs"
                />
                <button onClick={handleSubmitVerification} className="btn-primary w-full py-2.5 text-xs font-bold">
                  Submit Verification
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WATCHED AREAS SECTION */}
      {section === 'watched_areas' && (
        <div className="px-4 py-4 space-y-4 animate-fade-in">
          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
            <Eye size={16} className="shrink-0 mt-0.5" />
            <span>
              Follow specific areas you <strong>don't currently live in</strong> — plan your move, track distant family neighborhoods, or watch property listings in target cities.
            </span>
          </div>

          {/* Currently Watched */}
          {watchedAreas.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-200/80 dark:border-gray-800 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Followed Areas ({watchedAreas.length})</h4>
              {watchedAreas.map((area) => (
                <div key={area.id} className="flex items-start justify-between p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{area.name}</p>
                      <p className="text-[10px] text-gray-500">{area.city} • {area.radius_km}km radius</p>
                      {area.notes && <p className="text-[10px] text-indigo-600 dark:text-indigo-400 line-clamp-1">{area.notes}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWatchArea(area.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Popular Neighborhoods to Follow */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-200/80 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Popular Neighborhoods</h4>
              <button
                onClick={() => setShowAddWatchArea(!showAddWatchArea)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> Custom Area
              </button>
            </div>

            {/* Custom Area Form */}
            {showAddWatchArea && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 space-y-3 animate-fade-in">
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Add Custom Watch Area (up to 20 km)</p>
                <input
                  type="text"
                  value={customWatchName}
                  onChange={(e) => setCustomWatchName(e.target.value)}
                  placeholder="Area / Neighborhood name"
                  className="input text-xs w-full"
                />
                <input
                  type="text"
                  value={customWatchCity}
                  onChange={(e) => setCustomWatchCity(e.target.value)}
                  placeholder="City (e.g., Karachi, Lahore)"
                  className="input text-xs w-full"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-600 dark:text-gray-400">
                    <span>Watch Radius:</span>
                    <span className="font-bold text-indigo-600">{customWatchRadius} km</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={customWatchRadius}
                    onChange={(e) => setCustomWatchRadius(parseInt(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                    <span>1 km (Walking)</span>
                    <span>10 km (City)</span>
                    <span>20 km (Max)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddWatchArea(false); setCustomWatchName(''); setCustomWatchCity(''); }}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomWatchArea}
                    disabled={!customWatchName.trim()}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    + Follow Area
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {POPULAR_NEIGHBORHOODS.map((hood, idx) => {
                const isAlreadyFollowed = watchedAreas.some((w) => w.name === hood.name && w.city === hood.city);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{hood.name}</p>
                      <p className="text-[10px] text-gray-500">{hood.city} • {hood.radius_km}km scan radius</p>
                      {hood.notes && <p className="text-[10px] text-gray-400 line-clamp-1">{hood.notes}</p>}
                    </div>
                    <button
                      onClick={() => !isAlreadyFollowed && handleAddWatchArea(hood)}
                      disabled={isAlreadyFollowed}
                      className={`ml-3 shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        isAlreadyFollowed
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                      }`}
                    >
                      {isAlreadyFollowed ? 'Following ✓' : '+ Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {watchedAreas.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No areas followed yet. Add one from the list above or create a custom area.</p>
          )}
        </div>
      )}

      {/* PRIVACY & DATA SECTION */}
      {section === 'privacy' && (
        <div className="px-4 py-4 space-y-4 animate-fade-in">
          {/* Data Export Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200/80 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                <Download size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Export My Data</h3>
                <p className="text-xs text-gray-400">GDPR / PECA Privacy Compliance</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Download a complete JSON package of all your data: profile, posts, CNIC verification audit trail, saved locations, watched areas, and preferences. Required for FYP documentation on privacy compliance.
            </p>
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-bold">What's included in the export:</p>
              <ul className="space-y-0.5 pl-2">
                {['Profile & contact info (phone masked)', 'All your posts & their locations', 'CNIC verification history (masked)', 'Saved radar locations & watched areas', 'Category preferences & app settings'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-blue-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleExportData}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download size={15} /> Download My Data Package
            </button>
          </div>

          {/* Account Deletion Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-red-200/60 dark:border-red-800/40 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                <AlertOctagon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-700 dark:text-red-400">Delete Account & All Data</h3>
                <p className="text-xs text-gray-400">Permanent and irreversible action</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This will permanently delete your profile, all posts, comments, bookmarks, and verification records from Smart Radar. This action cannot be undone.
            </p>
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-[11px] text-red-700 dark:text-red-300">
              <p className="font-bold mb-1">What gets deleted:</p>
              <ul className="space-y-0.5 pl-2">
                {['Profile, avatar, and CNIC records', 'All neighborhood posts you authored', 'Comments, votes, and bookmarks', 'Watched areas and saved locations', 'Verification audit trail'].map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500">Type your display name <strong>"{profile.display_name}"</strong> to confirm:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type your display name to confirm"
                className="input text-xs border-red-300 dark:border-red-700/60 focus:ring-red-500"
              />
              <button
                onClick={() => setShowDeleteAccount(true)}
                disabled={deleteConfirmText.toLowerCase() !== profile.display_name.toLowerCase()}
                className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <AlertOctagon size={15} /> Delete My Account Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S DAILY DIGEST PREVIEW MODAL */}
      <Modal
        open={showDigestModal}
        onClose={() => setShowDigestModal(false)}
        title="Today's Neighborhood Daily Digest"
      >
        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <Newspaper size={16} />
            <span>Consolidated summary of non-urgent updates in your {radiusKm} km radar:</span>
          </div>

          {digestPosts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              No new non-urgent posts in your radar today. Check back later this evening!
            </p>
          ) : (
            digestPosts.map((p) => {
              const cat = CATEGORY_MAP[p.category];
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setShowDigestModal(false);
                    navigate(`/post/${p.id}`);
                  }}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-primary-600">{cat?.label}</span>
                    <span className="text-[10px] text-gray-400">{p.location_label || 'Nearby'}</span>
                  </div>
                  <h5 className="font-bold text-xs text-gray-900 dark:text-white leading-tight">{p.title}</h5>
                  {p.description && <p className="text-[11px] text-gray-500 line-clamp-1">{p.description}</p>}
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={showSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of your Radar Citizen account?"
        confirmLabel="Sign Out"
        danger
        onConfirm={async () => {
          await signOut();
          setShowSignOut(false);
          navigate('/');
        }}
        onCancel={() => setShowSignOut(false)}
      />

      {/* Account Deletion Confirmation */}
      <ConfirmDialog
        open={showDeleteAccount}
        title="Delete Account Permanently?"
        message="This will permanently erase your profile, posts, and all associated data. This action cannot be reversed."
        confirmLabel="Yes, Delete Everything"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteAccount(false)}
      />

      <Toast message={toast.msg} show={toast.show} />
    </div>
  );
}


function SettingRow({
  icon: Icon,
  label,
  sublabel,
  value,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  value?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 group-hover:text-primary-600">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600">
              {label}
            </span>
            {badge && (
              <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                {badge}
              </span>
            )}
          </div>
          {sublabel && <p className="text-[10px] text-gray-400 truncate">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value && <span className="text-xs text-gray-400 font-semibold">{value}</span>}
        <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-600 transition-colors" />
      </div>
    </button>
  );
}
