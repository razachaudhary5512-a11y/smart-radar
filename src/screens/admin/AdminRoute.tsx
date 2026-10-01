import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/**
 * UX guard for /admin/* — the real enforcement is Postgres RLS + the
 * SECURITY DEFINER admin RPCs, which re-check auth_is_admin() server-side.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
