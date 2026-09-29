/**
 * AdminDashboard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full admin control panel (items 1, 3, 5).
 * Accessible ONLY via AdminRoute guard — unauthenticated or non-admin users
 * are redirected to /admin/login before this component ever mounts.
 *
 * Features:
 * - Approve / Reject pending provider listings
 * - Approve / Reject pending CNIC verifications (profiles)
 * - Hide / Restore reported posts
 * - Delete any post
 * - View audit log (all admin actions)
 * Every action is logged to admin_audit_log with timestamp + admin ID.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  FileText,
  Users,
  AlertTriangle,
  Store,
  ChevronRight,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingProfile {
  id: string;
  display_name: string;
  phone: string;
  verification_status: string;
  is_business: boolean;
  created_at: string;
}

interface ReportedPost {
  id: string;
  title: string;
  category: string;
  report_count: number;
  status: string;
  created_at: string;
}

interface ProviderListing {
  id: string;
  business_name: string;
  category: string;
  phone: string | null;
  status: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

type Tab = 'overview' | 'providers' | 'verifications' | 'reports' | 'audit';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function logAuditAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {}
) {
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const adminId = session?.user?.id ?? '';

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Data
  const [pendingProfiles, setPendingProfiles]     = useState<PendingProfile[]>([]);
  const [reportedPosts, setReportedPosts]         = useState<ReportedPost[]>([]);
  const [pendingListings, setPendingListings]     = useState<ProviderListing[]>([]);
  const [auditLog, setAuditLog]                   = useState<AuditEntry[]>([]);

  // Counts for overview badges
  const [stats, setStats] = useState({ providers: 0, verifications: 0, reports: 0 });

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    const [prov, verif, rep] = await Promise.all([
      supabase.from('provider_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('report_count', 3),
    ]);
    setStats({
      providers: prov.count ?? 0,
      verifications: verif.count ?? 0,
      reports: rep.count ?? 0,
    });
  }, []);

  const loadPendingProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, phone, verification_status, is_business, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });
    setPendingProfiles((data as PendingProfile[]) ?? []);
    setLoading(false);
  }, []);

  const loadReportedPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, title, category, report_count, status, created_at')
      .gte('report_count', 3)
      .order('report_count', { ascending: false });
    setReportedPosts((data as ReportedPost[]) ?? []);
    setLoading(false);
  }, []);

  const loadPendingListings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('provider_listings')
      .select('id, business_name, category, phone, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setPendingListings((data as ProviderListing[]) ?? []);
    setLoading(false);
  }, []);

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditLog((data as AuditEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'verifications') loadPendingProfiles();
    if (tab === 'reports') loadReportedPosts();
    if (tab === 'providers') loadPendingListings();
    if (tab === 'audit') loadAuditLog();
  }, [tab, loadPendingProfiles, loadReportedPosts, loadPendingListings, loadAuditLog]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function approveVerification(profileId: string, displayName: string) {
    const now = new Date();
    const expiry = new Date(now.getTime() + 180 * 86400000);
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: 'approved', verification_date: now.toISOString(), verification_expiry: expiry.toISOString() })
      .eq('id', profileId);
    if (error) { showToast('Failed to approve', 'err'); return; }
    await logAuditAction(adminId, 'approve_verification', 'profile', profileId, { display_name: displayName });
    showToast(`✅ Approved verification for ${displayName}`);
    loadPendingProfiles();
    loadStats();
  }

  async function rejectVerification(profileId: string, displayName: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: 'rejected' })
      .eq('id', profileId);
    if (error) { showToast('Failed to reject', 'err'); return; }
    await logAuditAction(adminId, 'reject_verification', 'profile', profileId, { display_name: displayName });
    showToast(`❌ Rejected verification for ${displayName}`);
    loadPendingProfiles();
    loadStats();
  }

  async function approveListing(listingId: string, name: string) {
    const { error } = await supabase
      .from('provider_listings')
      .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', listingId);
    if (error) { showToast('Failed to approve listing', 'err'); return; }
    await logAuditAction(adminId, 'approve_listing', 'listing', listingId, { business_name: name });
    showToast(`✅ Listing "${name}" approved`);
    loadPendingListings();
    loadStats();
  }

  async function rejectListing(listingId: string, name: string) {
    const { error } = await supabase
      .from('provider_listings')
      .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', listingId);
    if (error) { showToast('Failed to reject listing', 'err'); return; }
    await logAuditAction(adminId, 'reject_listing', 'listing', listingId, { business_name: name });
    showToast(`❌ Listing "${name}" rejected`);
    loadPendingListings();
    loadStats();
  }

  async function hidePost(postId: string, title: string) {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'expired' })
      .eq('id', postId);
    if (error) { showToast('Failed to hide post', 'err'); return; }
    await logAuditAction(adminId, 'hide_post', 'post', postId, { title });
    showToast(`🚫 Post hidden: "${title}"`);
    loadReportedPosts();
    loadStats();
  }

  async function restorePost(postId: string, title: string) {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'active', report_count: 0 })
      .eq('id', postId);
    if (error) { showToast('Failed to restore post', 'err'); return; }
    await logAuditAction(adminId, 'restore_post', 'post', postId, { title });
    showToast(`✅ Post restored: "${title}"`);
    loadReportedPosts();
    loadStats();
  }

  async function deletePost(postId: string, title: string) {
    if (!window.confirm(`Permanently delete "${title}"?`)) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) { showToast('Failed to delete post', 'err'); return; }
    await logAuditAction(adminId, 'delete_post', 'post', postId, { title });
    showToast(`🗑️ Post deleted: "${title}"`);
    loadReportedPosts();
    loadStats();
  }

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login', { replace: true });
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview',       label: 'Overview',      icon: Activity },
    { id: 'providers',      label: 'Providers',     icon: Store,      badge: stats.providers },
    { id: 'verifications',  label: 'Verifications', icon: ShieldCheck, badge: stats.verifications },
    { id: 'reports',        label: 'Reports',       icon: AlertTriangle, badge: stats.reports },
    { id: 'audit',          label: 'Audit Log',     icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all animate-slide-up ${
          toast.type === 'ok'
            ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-200'
            : 'bg-red-900/90 border border-red-700 text-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">Smart Radar Admin</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">{profile?.display_name ?? 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            id="admin-signout-btn"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Tab nav */}
        <div className="flex gap-1.5 mb-6 bg-gray-900 p-1 rounded-2xl overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`admin-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <t.icon size={13} />
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Pending Providers',     value: stats.providers,     icon: Store,         color: 'from-amber-600 to-orange-600',  tab: 'providers' as Tab },
              { label: 'Pending Verifications', value: stats.verifications, icon: ShieldCheck,   color: 'from-indigo-600 to-blue-600',   tab: 'verifications' as Tab },
              { label: 'Reported Posts',        value: stats.reports,       icon: AlertTriangle, color: 'from-red-600 to-rose-600',      tab: 'reports' as Tab },
            ].map((card) => (
              <button
                key={card.label}
                onClick={() => setTab(card.tab)}
                className="relative bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left hover:border-gray-700 transition-all group cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <card.icon size={20} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
                <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </button>
            ))}

            <div className="sm:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-indigo-400" />
                <h2 className="text-sm font-bold text-white">Admin Session</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Signed in as</p>
                  <p className="text-gray-200 font-medium mt-0.5 truncate">{session?.user?.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Admin ID</p>
                  <p className="text-gray-400 font-mono mt-0.5 text-[10px] truncate">{adminId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Role</p>
                  <p className="text-emerald-400 font-bold mt-0.5">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Providers ── */}
        {tab === 'providers' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Pending Provider Listings</h2>
              <button onClick={loadPendingListings} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {loading ? <Spinner /> : pendingListings.length === 0 ? (
              <EmptyState icon={Store} text="No pending listings" />
            ) : (
              <div className="space-y-3">
                {pendingListings.map((l) => (
                  <div key={l.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{l.business_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{l.category} · {l.phone ?? 'No phone'}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{new Date(l.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <ActionBtn color="green" icon={CheckCircle2} label="Approve" onClick={() => approveListing(l.id, l.business_name)} />
                        <ActionBtn color="red"   icon={XCircle}     label="Reject"  onClick={() => rejectListing(l.id, l.business_name)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Verifications ── */}
        {tab === 'verifications' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Pending CNIC Verifications</h2>
              <button onClick={loadPendingProfiles} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 mb-4 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>CNIC numbers are <strong>never shown here</strong> — they are only accessible via the Supabase service-role. Approve based on your offline verification process.</span>
            </div>
            {loading ? <Spinner /> : pendingProfiles.length === 0 ? (
              <EmptyState icon={Users} text="No pending verifications" />
            ) : (
              <div className="space-y-3">
                {pendingProfiles.map((p) => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{p.display_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.phone} · {p.is_business ? 'Business' : 'Individual'}</p>
                        <p className="text-[10px] text-gray-600 mt-1">Submitted {new Date(p.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <ActionBtn color="green" icon={CheckCircle2} label="Approve" onClick={() => approveVerification(p.id, p.display_name)} />
                        <ActionBtn color="red"   icon={XCircle}     label="Reject"  onClick={() => rejectVerification(p.id, p.display_name)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Reported Posts ── */}
        {tab === 'reports' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Reported Posts (≥3 reports)</h2>
              <button onClick={loadReportedPosts} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {loading ? <Spinner /> : reportedPosts.length === 0 ? (
              <EmptyState icon={AlertTriangle} text="No reported posts" />
            ) : (
              <div className="space-y-3">
                {reportedPosts.map((post) => (
                  <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] bg-red-900/50 text-red-400 border border-red-800/50 px-1.5 py-0.5 rounded-full font-bold">
                            {post.report_count} reports
                          </span>
                          <span className={`text-[10px] font-semibold ${post.status === 'active' ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {post.status}
                          </span>
                        </div>
                        <p className="font-semibold text-white text-sm truncate">{post.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{post.category}</p>
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        {post.status === 'active' ? (
                          <ActionBtn color="amber" icon={EyeOff} label="Hide"    onClick={() => hidePost(post.id, post.title)} />
                        ) : (
                          <ActionBtn color="green" icon={Eye}    label="Restore"  onClick={() => restorePost(post.id, post.title)} />
                        )}
                        <ActionBtn color="red" icon={Trash2} label="Delete" onClick={() => deletePost(post.id, post.title)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Audit Log ── */}
        {tab === 'audit' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Admin Audit Log</h2>
              <button onClick={loadAuditLog} className="text-xs text-gray-400 flex items-center gap-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {loading ? <Spinner /> : auditLog.length === 0 ? (
              <EmptyState icon={FileText} text="No audit entries yet" />
            ) : (
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-900/50 border border-indigo-800/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock size={12} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{entry.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-md">{entry.target_type}</span>
                      </div>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {JSON.stringify(entry.details)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-600 mt-1">
                        {new Date(entry.created_at).toLocaleString()} · Admin: {entry.admin_id.slice(0, 8)}…
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-gray-600">
      <Icon size={32} className="mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function ActionBtn({
  color, icon: Icon, label, onClick,
}: {
  color: 'green' | 'red' | 'amber';
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  const cls = {
    green: 'bg-emerald-900/40 border-emerald-800/50 text-emerald-400 hover:bg-emerald-800/60',
    red:   'bg-red-900/40 border-red-800/50 text-red-400 hover:bg-red-800/60',
    amber: 'bg-amber-900/40 border-amber-800/50 text-amber-400 hover:bg-amber-800/60',
  }[color];

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${cls}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}
