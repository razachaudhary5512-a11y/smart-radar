import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, type LucideIcon } from 'lucide-react';
import { LogoMark } from './Logo';
import { EmptyState, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';

interface HeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
  /** Mobile only: show logo instead of back button. */
  brand?: boolean;
}

/** Sticky compact header on mobile, spacious title block on desktop. */
export function PageHeader({ title, subtitle, back, actions, brand }: HeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-safe backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          {back ? (
            <button onClick={goBack} className="icon-btn" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : brand ? (
            <LogoMark size={30} className="ml-1" />
          ) : null}
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-[17px] font-bold tracking-tight text-ink">{title}</h1>
          </div>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      </header>
      <div className="hidden items-end justify-between gap-4 px-8 pb-2 pt-9 lg:flex">
        <div className="flex items-start gap-3">
          {back && (
            <button onClick={goBack} className="icon-btn -ml-2 mt-0.5" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </>
  );
}

export function PageBody({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 pt-4 lg:px-8 lg:pt-6', narrow ? 'max-w-3xl' : 'max-w-6xl', className)}>{children}</div>;
}

/** Renders children only for signed-in users; otherwise a friendly sign-in prompt. */
export function RequireAuth({ children, icon, title, body }: { children: ReactNode; icon: LucideIcon; title: string; body: string }) {
  const { user, loading, requireAuth } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return (
      <EmptyState
        icon={icon}
        title={title}
        body={body}
        action={
          <button className="btn-primary" onClick={() => requireAuth()}>
            <Lock className="h-4 w-4" /> Sign in
          </button>
        }
      />
    );
  }
  return <>{children}</>;
}
