import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { Sheet, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/data';
import { Turnstile, captchaEnabled } from '@/components/Turnstile';

type Step = 'start' | 'code' | 'name';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email sign-in (Gmail or any address): a one-time link, or a 6-digit code if the email contains one. */
export function AuthSheet() {
  const { authPrompt, closeAuthPrompt, sendEmailOtp, verifyEmailOtp } = useAuth();
  const api = useApi();
  const toast = useToast();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState(''); // normalised email the link/code was sent to
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    if (authPrompt.open) {
      setStep('start');
      setCode('');
      setError(null);
      setDevCode(undefined);
    }
  }, [authPrompt.open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const to = email.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return setError('Enter a valid email address, e.g. yourname@gmail.com');
    if (captchaEnabled && !captcha) return setError('Please wait a moment while we check you’re not a robot, then try again.');
    setBusy(true);
    setError(null);
    const res = await sendEmailOtp(to, captcha ?? undefined);
    setCaptchaReset((n) => n + 1); // tokens are single-use
    setBusy(false);
    if (res.error) return setError(friendlyError(res.error));
    setTarget(to);
    setDevCode(res.devCode);
    setStep('code');
    setCooldown(60);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function submitCode(value = code) {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    const res = await verifyEmailOtp(target, value);
    if (res.error) {
      setBusy(false);
      setError(friendlyError(res.error));
      setCode('');
      return;
    }
    const session = await api.auth.getSession();
    const profile = session ? await api.auth.getProfile(session.id) : null;
    setBusy(false);
    if (!profile?.display_name) {
      setStep('name');
      return;
    }
    toast.success(`Welcome back, ${profile.display_name.split(' ')[0]}!`);
    closeAuthPrompt(true);
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setError('Please enter at least 2 characters.');
    setBusy(true);
    const session = await api.auth.getSession();
    if (session) await api.auth.updateProfile(session.id, { display_name: n });
    setBusy(false);
    toast.success(`Welcome to Be Alert, ${n.split(' ')[0]}!`);
    closeAuthPrompt(true);
  }

  return (
    <Sheet open={authPrompt.open} onClose={() => closeAuthPrompt(false)} size="sm" bare>
      <div className="px-6 pb-7 pt-4 lg:pt-7">
        {step === 'code' && (
          <button onClick={() => setStep('start')} className="btn-ghost btn-sm -ml-2 mb-2 px-2">
            <ArrowLeft className="h-4 w-4" /> Change email
          </button>
        )}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow">
          {step === 'start' ? <Mail className="h-6 w-6" /> : step === 'code' ? <MailCheck className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>

        {step === 'start' && (
          <form onSubmit={sendCode}>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Sign in to Be Alert</h2>
            <p className="mt-1.5 text-sm text-ink-2">
              {authPrompt.reason ?? 'Post, vote and connect with neighbours.'} Enter your Gmail or any email — we’ll send you a sign-in link. No password needed.
            </p>
            <label className="label mt-5" htmlFor="sr-email">Email address</label>
            <input
              id="sr-email"
              data-autofocus
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input text-base"
              placeholder="yourname@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
            <button type="submit" className="btn-primary mt-5 w-full" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="mt-4 flex items-start gap-2 text-xs text-ink-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your email is never shown publicly.
            </p>
          </form>
        )}

        {step === 'code' && (
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{devCode ? 'Enter the code' : 'Check your email'}</h2>
            <p className="mt-1.5 text-sm text-ink-2">
              Sent to <span className="font-semibold text-ink">{target}</span> — check your spam folder too.
            </p>
            {!devCode && (
              <div className="mt-4 rounded-xl bg-primary-600/10 px-3.5 py-3 text-[13px] text-ink">
                <b>Open the email and tap “Log In”</b> on this device — you’ll come back here signed in automatically. You can close this window.
                <span className="mt-1 block text-ink-2">If the email shows a 6-digit code instead, enter it below.</span>
              </div>
            )}
            {devCode && (
              <div className="mt-4 rounded-xl border border-dashed border-warning-500/50 bg-warning-50 px-3.5 py-2.5 text-[13px] text-warning-700 dark:bg-warning-500/10 dark:text-warning-500">
                Demo mode — nothing is actually sent. Use code <b className="tracking-widest">{devCode}</b>
              </div>
            )}
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label="6-digit code"
              className="input mt-5 h-14 text-center text-2xl font-bold tracking-[0.45em] placeholder:tracking-[0.3em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) submitCode(v);
              }}
            />
            {error && <p className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
            <button className="btn-primary mt-5 w-full" onClick={() => submitCode()} disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="btn-ghost mt-2 w-full" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
              {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
            </button>
          </div>
        )}

        {step === 'name' && (
          <form onSubmit={submitName}>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">What should neighbours call you?</h2>
            <p className="mt-1.5 text-sm text-ink-2">This name appears on your posts and comments.</p>
            <input data-autofocus className="input mt-5" placeholder="e.g., Ayesha Khan" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            {error && <p className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}
        {step !== 'name' && <Turnstile onToken={setCaptcha} resetKey={captchaReset} className="mt-4 flex justify-center" />}
        <p className="mt-5 text-center text-xs text-ink-3">
          By continuing you agree to our{' '}
          <Link to="/terms" onClick={() => closeAuthPrompt(false)} className="font-semibold underline">Terms</Link> and{' '}
          <Link to="/privacy" onClick={() => closeAuthPrompt(false)} className="font-semibold underline">Privacy Policy</Link>.
        </p>
      </div>
    </Sheet>
  );
}

/** Turn Supabase's technical auth errors into plain language. */
function friendlyError(msg: string): string {
  if (/rate limit|too many|seconds/i.test(msg)) return 'Too many emails were requested. Please wait a minute and try again.';
  if (/expired|invalid/i.test(msg)) return 'That code is wrong or has expired. Request a new email.';
  if (/captcha/i.test(msg)) return 'Security check failed. Please try again.';
  if (/fetch|network/i.test(msg)) return 'No internet connection. Check your connection and try again.';
  return msg;
}
