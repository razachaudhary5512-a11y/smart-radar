import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Eye, EyeOff, Lock, Mail, ScrollText, ShieldCheck, UserCheck } from 'lucide-react';
import { LogoMark } from '@/components/layout/Logo';
import { useAuth } from '@/lib/auth';
import { useBackend } from '@/data';
import { loadDemoSeed } from '@/data/demo-loader';
import { Turnstile, captchaEnabled } from '@/components/Turnstile';
type DemoCreds = { ownerEmail: string; ownerPassword: string; adminEmail: string; adminPassword: string };

export function AdminLogin() {
  const { adminSignIn, isAdmin, user, profile, signOut, requireAuth } = useAuth();
  const { demoReason } = useBackend();
  // Demo logins are loaded only in demo mode, so they never ship with the live app.
  const [demo, setDemo] = useState<DemoCreds | null>(null);
  useEffect(() => {
    if (!demoReason) return;
    loadDemoSeed().then((m) =>
      setDemo({ ownerEmail: m.DEMO_OWNER_EMAIL, ownerPassword: m.DEMO_OWNER_PASSWORD, adminEmail: m.DEMO_ADMIN_EMAIL, adminPassword: m.DEMO_ADMIN_PASSWORD })
    );
  }, [demoReason]);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    if (isAdmin) navigate(from, { replace: true });
  }, [isAdmin, from, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaEnabled && !captcha) return setError('Please wait a moment for the security check, then try again.');
    setBusy(true);
    setError(null);
    const res = await adminSignIn(email.trim(), password, captcha ?? undefined);
    setCaptchaReset((n) => n + 1);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1024] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary-600/30 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={36} />
          <span className="text-lg font-extrabold tracking-tight">Smart Radar · Admin</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Keep every neighbourhood safe and trusted.</h1>
          <ul className="mt-8 space-y-4 text-white/80">
            {[
              [ShieldCheck, 'Moderate reported posts — scams are auto-hidden at 3 reports'],
              [UserCheck, 'Review CNIC verifications and provider listings'],
              [ScrollText, 'Every action is written to an immutable audit log'],
            ].map(([Icon, t]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={t as string} className="flex items-start gap-3">
                  <I className="mt-0.5 h-5 w-5 shrink-0 text-radar-400" /> {t as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Access is restricted to accounts with admin privileges. Attempts are logged.</p>
      </div>

      <div className="flex flex-col px-6 py-8 lg:justify-center lg:px-16">
        <Link to="/" className="btn-ghost btn-sm -ml-2 self-start">
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
        <div className="mx-auto w-full max-w-sm flex-1 lg:flex-none">
          <div className="mt-10 lg:mt-0">
            <LogoMark size={48} className="lg:hidden" />
            <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-ink lg:mt-0">Owner & admin sign in</h2>
            <p className="mt-1.5 text-sm text-ink-2">Sign in with the email linked to your owner or admin account.</p>
          </div>

          {user && profile && !isAdmin && (
            <div className="mt-6 rounded-xl bg-surface-2 p-3.5 text-[13px] text-ink-2">
              You’re signed in as <b className="text-ink">{profile.display_name || user.email || 'a member'}</b>, which doesn’t have admin access yet. Ask the
              owner to add you under <b>Team &amp; roles</b>, or{' '}
              <button className="font-semibold text-primary-600" onClick={signOut}>
                sign out
              </button>{' '}
              and use another account.
            </div>
          )}

          {!user && !demoReason && (
            <>
              <button type="button" className="btn-primary mt-6 w-full" onClick={() => requireAuth('Sign in with your owner or admin email.')}>
                <Mail className="h-4 w-4" /> Sign in with email code / link
              </button>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <span className="h-px flex-1 bg-line" /> or with a password <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          {demoReason && demo && (
            <div className="mt-6 rounded-xl border border-dashed border-warning-500/50 bg-warning-50 p-3.5 text-[13px] text-warning-700 dark:bg-warning-500/10 dark:text-warning-500">
              <p>
                <b>Demo mode</b> — try either role:
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-white/70 px-2.5 py-2 text-left font-semibold ring-1 ring-warning-500/40 hover:bg-white dark:bg-black/20"
                  onClick={() => {
                    setEmail(demo.ownerEmail);
                    setPassword(demo.ownerPassword);
                  }}
                >
                  <Crown className="mb-0.5 inline h-3.5 w-3.5" /> Owner
                  <span className="block text-[11px] font-normal opacity-80">Full control</span>
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-white/70 px-2.5 py-2 text-left font-semibold ring-1 ring-warning-500/40 hover:bg-white dark:bg-black/20"
                  onClick={() => {
                    setEmail(demo.adminEmail);
                    setPassword(demo.adminPassword);
                  }}
                >
                  <ShieldCheck className="mb-0.5 inline h-3.5 w-3.5" /> Admin
                  <span className="block text-[11px] font-normal opacity-80">Moderation only</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="admin-email">Email</label>
              <input id="admin-email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="admin-pass">Password</label>
              <div className="relative">
                <input
                  id="admin-pass"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="icon-btn absolute right-0.5 top-0.5" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-400">{error}</p>}
            <Turnstile onToken={setCaptcha} resetKey={captchaReset} className="flex justify-center" />
            <button className="btn-primary w-full" disabled={busy}>
              <Lock className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
