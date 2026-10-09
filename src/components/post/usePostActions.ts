import { useCallback, useState } from 'react';
import { useApi } from '@/data';
import { appUrl } from '@/config/env';
import { shareContent } from '@/lib/native';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui';
import type { PostWithRelations } from '@/lib/types';

/**
 * Shared post interactions (feed cards + detail screen). Every action is
 * optimistic, rolls back on error, and prompts sign-in when needed.
 */
export function usePostActions(post: PostWithRelations, onChange: (p: PostWithRelations) => void) {
  const api = useApi();
  const { user, requireAuth } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const withAuth = useCallback(
    async (reason: string, fn: (uid: string) => Promise<void>) => {
      const ok = user ? true : await requireAuth(reason);
      if (!ok) return;
      // `user` may be stale right after sign-in; read the fresh session.
      const session = user ?? (await api.auth.getSession());
      if (!session) return;
      await fn(session.id);
    },
    [user, requireAuth, api]
  );

  const vote = useCallback(
    (dir: 'up' | 'down') =>
      withAuth('Sign in to vote on posts', async (uid) => {
        const prev = post;
        const next = prev.user_vote === dir ? null : dir;
        const up = prev.upvotes - (prev.user_vote === 'up' ? 1 : 0) + (next === 'up' ? 1 : 0);
        const down = prev.downvotes - (prev.user_vote === 'down' ? 1 : 0) + (next === 'down' ? 1 : 0);
        onChange({ ...prev, user_vote: next, upvotes: up, downvotes: down });
        try {
          await api.setVote(uid, prev.id, next);
        } catch (e) {
          onChange(prev);
          toast.error('Could not save your vote', (e as Error).message);
        }
      }),
    [post, onChange, api, toast, withAuth]
  );

  const bookmark = useCallback(
    () =>
      withAuth('Sign in to save posts', async (uid) => {
        const prev = post;
        onChange({ ...prev, is_bookmarked: !prev.is_bookmarked });
        try {
          const saved = await api.toggleBookmark(uid, prev.id);
          toast.success(saved ? 'Saved to your bookmarks' : 'Removed from bookmarks');
        } catch (e) {
          onChange(prev);
          toast.error('Could not update bookmark', (e as Error).message);
        }
      }),
    [post, onChange, api, toast, withAuth]
  );

  const confirm = useCallback(
    (type: 'confirm' | 'resolve') =>
      withAuth('Sign in to confirm alerts', async (uid) => {
        const prev = post;
        const was = prev.user_confirmation;
        const next = was === type ? null : type;
        onChange({
          ...prev,
          user_confirmation: next,
          confirm_count: prev.confirm_count - (was === 'confirm' ? 1 : 0) + (next === 'confirm' ? 1 : 0),
          resolve_count: prev.resolve_count - (was === 'resolve' ? 1 : 0) + (next === 'resolve' ? 1 : 0),
        });
        try {
          await api.setConfirmation(uid, prev.id, type);
          if (next) toast.success(type === 'confirm' ? 'Thanks — marked as still happening' : 'Thanks — marked as resolved');
        } catch (e) {
          onChange(prev);
          toast.error('Could not save', (e as Error).message);
        }
      }),
    [post, onChange, api, toast, withAuth]
  );

  const report = useCallback(
    (reason: string) =>
      withAuth('Sign in to report posts', async (uid) => {
        setBusy(true);
        try {
          await api.reportPost(uid, post.id, reason);
          toast.success('Report received', 'Our moderators will review this post. Posts with 3+ reports are hidden automatically.');
        } catch (e) {
          toast.error('Could not report', (e as Error).message);
        } finally {
          setBusy(false);
        }
      }),
    [post.id, api, toast, withAuth]
  );

  const share = useCallback(async () => {
    const url = appUrl(`post/${post.id}`);
    try {
      const how = await shareContent({ title: post.title, text: `${post.title} — on Be Alert`, url });
      if (how === 'copied') toast.success('Link copied', 'Share it with your neighbours.');
    } catch {
      toast.error('Could not share this post');
    }
  }, [post.id, post.title, toast]);

  return { vote, bookmark, confirm, report, share, busy };
}
