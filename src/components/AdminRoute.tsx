/**
 * AdminRoute.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Route guard for admin-only pages (item 3).
 *
 * Behaviour:
 * - If the user is not authenticated at all  → redirect to /admin/login
 * - If the user is authenticated but not admin → redirect to /admin/login
 * - If the user is an admin                   → render children normally
 *
 * This enforcement runs on the FRONTEND; the backend (RLS policies) provides
 * the real security barrier — the frontend guard is an additional UX layer.
 */

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, isAdmin, loading } = useAuth();

  // While auth is resolving, render nothing (avoids flash)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  // No session, or session exists but user is not an admin → go to login
  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
