import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Repeat2,
  CalendarClock,
  Send,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { CATEGORY_MAP } from '@/lib/categories';
import type { PostWithRelations } from '@/lib/types';
import { haversineKm, formatTimeAgo, isExpired, type Coords } from '@/lib/location';
import { getStoredLocalPosts, deleteLocalPost, saveLocalPost, getStoredLocalComments } from '@/lib/dummy-data';
import { PostCard } from '@/components/PostCard';
import { EmptyState, Spinner, ConfirmDialog, Toast } from '@/components/ui';

type Filter = 'all' | 'active' | 'scheduled' | 'resolved';

export function MyPosts() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { coords } = useLocation();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });

  const showToast = (msg: string) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast({ msg: '', show: false }), 2000);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let supabasePosts: PostWithRelations[] = [];
    if (session?.user) {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          supabasePosts = data as PostWithRelations[];
        }
      } catch {}
    }

    const localPosts = getStoredLocalPosts();
    const combined = [...localPosts, ...supabasePosts];
    const seen = new Set<string>();
    const unique = combined.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    setPosts(unique);
    setLoading(false);
  }, [session?.user]);

  useEffect(() => {
    loadPosts();
    const handleUpdate = () => loadPosts();
    window.addEventListener('smart_radar_posts_updated', handleUpdate);
    return () => window.removeEventListener('smart_radar_posts_updated', handleUpdate);
  }, [loadPosts]);

  async function handleMarkResolved(postId: string) {
    if (session?.user) {
      try {
        await supabase.from('posts').update({ status: 'resolved' }).eq('id', postId);
      } catch {}
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: 'resolved' as const } : p)));
    const local = getStoredLocalPosts().find((p) => p.id === postId);
    if (local) {
      saveLocalPost({ ...local, status: 'resolved' });
    }
    showToast('Marked as resolved');
  }

  async function handlePublishNow(post: PostWithRelations) {
    const updated = { ...post, scheduled_for: null, created_at: new Date().toISOString() };
    if (session?.user) {
      try {
        await supabase.from('posts').update({ scheduled_for: null }).eq('id', post.id);
      } catch {}
    }
    saveLocalPost(updated);
    setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    showToast('Post is now live on neighborhood feeds!');
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (session?.user) {
      try {
        await supabase.from('posts').delete().eq('id', deleteId);
      } catch {}
    }
    deleteLocalPost(deleteId);
    setPosts((prev) => prev.filter((p) => p.id !== deleteId));
    setDeleteId(null);
    showToast('Post removed');
  }

  const scheduledPosts = posts.filter((p) => p.scheduled_for && new Date(p.scheduled_for).getTime() > Date.now());
  const activePosts = posts.filter((p) => p.status === 'active' && !isExpired(p) && (!p.scheduled_for || new Date(p.scheduled_for).getTime() <= Date.now()));
  const resolvedPosts = posts.filter((p) => p.status === 'resolved' || isExpired(p));

  const filtered = posts.filter((p) => {
    const isFutureScheduled = p.scheduled_for && new Date(p.scheduled_for).getTime() > Date.now();
    if (filter === 'scheduled') return isFutureScheduled;
    if (filter === 'active') return p.status === 'active' && !isExpired(p) && !isFutureScheduled;
    if (filter === 'resolved') return p.status === 'resolved' || isExpired(p);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">My Radar Posts</h1>
            <p className="text-[11px] text-gray-400 font-medium">Manage and track your neighborhood activity</p>
          </div>
          <button
            onClick={() => navigate('/create')}
            className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-primary-600/30 cursor-pointer"
          >
            <Plus size={16} /> New Post
          </button>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pb-2.5 flex gap-1.5 overflow-x-auto">
          {([
            { key: 'all', label: `All (${posts.length})` },
            { key: 'active', label: `Active (${activePosts.length})` },
            { key: 'scheduled', label: `Scheduled (${scheduledPosts.length})` },
            { key: 'resolved', label: `Resolved (${resolvedPosts.length})` },
          ] as { key: Filter; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`chip px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                filter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts & Analytics */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size={36} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} />}
            title="No posts in this view"
            message={
              filter === 'scheduled'
                ? 'You have no scheduled future posts. You can schedule announcements or events in advance when creating a post!'
                : filter === 'resolved'
                ? 'You have no resolved or expired posts.'
                : 'You haven\'t posted anything yet. Tap "New Post" to share an update, listing, service or job with your neighborhood.'
            }
          />
        ) : (
          filtered.map((post) => {
            const commentsCount = getStoredLocalComments(post.id).length;
            const viewsEstimate = 32 + (post.upvotes || 1) * 7;
            const isFuture = post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now();

            return (
              <div
                key={post.id}
                className="space-y-2.5 bg-white dark:bg-gray-900 rounded-3xl p-3.5 border border-gray-200/80 dark:border-gray-800 shadow-xs"
              >
                <PostCard post={post} userCoords={coords as Coords | null} />

                {/* POST ANALYTICS BAR */}
                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-semibold">
                    <Eye size={14} className="text-primary-600" />
                    <span>{isFuture ? 'Scheduled to broadcast' : `Seen by ~${viewsEstimate} neighbors`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} className="text-blue-500" /> {commentsCount} inquiries
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 font-bold">
                      <ShieldCheck size={12} /> {profile?.trust_score ?? 100}% Trust
                    </span>
                  </div>
                </div>

                {/* MANAGE ACTIONS TOOLBAR */}
                <div className="flex items-center gap-2 pt-1">
                  {/* REPOST SIMILAR SHORTCUT BUTTON */}
                  <button
                    onClick={() => navigate(`/create?repost_id=${post.id}`)}
                    className="btn bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex-1 py-2 text-xs font-bold hover:bg-indigo-100 cursor-pointer flex items-center justify-center gap-1.5"
                    title="Create a fresh copy with 1-tap"
                  >
                    <Repeat2 size={14} />
                    <span>Repost Similar</span>
                  </button>

                  {/* If Scheduled: Publish Now */}
                  {isFuture && (
                    <button
                      onClick={() => handlePublishNow(post)}
                      className="btn bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 py-2 px-3 text-xs font-bold hover:bg-purple-100 cursor-pointer flex items-center gap-1"
                    >
                      <Send size={13} /> Publish Now
                    </button>
                  )}

                  {/* If Active: Mark Resolved */}
                  {post.status === 'active' && !isExpired(post) && !isFuture && (
                    <button
                      onClick={() => handleMarkResolved(post.id)}
                      className="btn bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 py-2 px-3 text-xs font-bold hover:bg-emerald-100 cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 size={14} /> Resolved
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/edit/${post.id}`)}
                    className="btn bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 px-2.5 text-xs font-bold hover:bg-gray-200 cursor-pointer"
                    title="Edit Post"
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    onClick={() => setDeleteId(post.id)}
                    className="btn bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 py-2 px-2.5 text-xs font-bold hover:bg-red-100 cursor-pointer"
                    title="Delete Post"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this post?"
        message="This action will remove the post permanently from all neighborhood feeds and map radar."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <Toast message={toast.msg} show={toast.show} />
    </div>
  );
}
