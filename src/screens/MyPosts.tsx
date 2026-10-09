import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowBigUp,
  CalendarClock,
  CheckCircle2,
  EyeOff,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { PageBody, PageHeader, RequireAuth } from '@/components/layout/Page';
import { Badge, CategoryIcon, ConfirmDialog, EmptyState, ErrorState, Segmented, Sheet, Spinner, useToast } from '@/components/ui';
import { useApi } from '@/data';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { getCategory, getExpiryDate, headlineValue } from '@/lib/categories';
import { isExpired } from '@/lib/location';
import { formatDateTime, timeAgo, timeUntil } from '@/lib/format';
import type { PostWithRelations } from '@/lib/types';

type Tab = 'active' | 'scheduled' | 'closed';

export function MyPosts() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="My posts"
        subtitle="Manage, edit and repost everything you’ve shared."
        actions={
          <button className="btn-primary btn-sm lg:h-11 lg:px-4 lg:text-sm" onClick={() => navigate('/create')}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New post</span>
          </button>
        }
      />
      <PageBody narrow>
        <RequireAuth icon={FileText} title="Your posts live here" body="Sign in with your email to post and manage your listings, alerts and events.">
          <MyPostsList />
        </RequireAuth>
      </PageBody>
    </>
  );
}

function bucket(p: PostWithRelations): Tab {
  if (p.scheduled_for && new Date(p.scheduled_for).getTime() > Date.now()) return 'scheduled';
  if (p.status !== 'active' || isExpired(p)) return 'closed';
  return 'active';
}

function MyPostsList() {
  const api = useApi();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');
  const [menu, setMenu] = useState<PostWithRelations | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PostWithRelations | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, refetch } = useQuery(() => api.listUserPosts(user!.id), [api, user?.id], { scopes: ['posts', 'comments'] });

  const groups = useMemo(() => {
    const g: Record<Tab, PostWithRelations[]> = { active: [], scheduled: [], closed: [] };
    (data ?? []).forEach((p) => g[bucket(p)].push(p));
    return g;
  }, [data]);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      posts: list.length,
      votes: list.reduce((s, p) => s + p.upvotes - p.downvotes, 0),
      replies: list.reduce((s, p) => s + (p.comment_count ?? 0), 0),
      confirms: list.reduce((s, p) => s + p.confirm_count, 0),
    };
  }, [data]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      setMenu(null);
      setConfirmDelete(null);
    } catch (e) {
      toast.error('Something went wrong', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading) return <Spinner className="mx-auto mt-10" />;

  const list = groups[tab];

  return (
    <>
      <div className="grid grid-cols-4 gap-2.5">
        {[
          ['Posts', totals.posts],
          ['Votes', totals.votes],
          ['Replies', totals.replies],
          ['Confirms', totals.confirms],
        ].map(([label, v]) => (
          <div key={label} className="card p-3 text-center lg:p-4">
            <p className="text-xl font-extrabold tabular-nums text-ink lg:text-2xl">{v}</p>
            <p className="text-[11px] font-semibold text-ink-3 lg:text-xs">{label}</p>
          </div>
        ))}
      </div>

      <Segmented
        className="mt-5 flex w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Active · ${groups.active.length}` },
          { value: 'scheduled', label: `Scheduled · ${groups.scheduled.length}` },
          { value: 'closed', label: `Closed · ${groups.closed.length}` },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'scheduled' ? CalendarClock : FileText}
          title={tab === 'active' ? 'No active posts' : tab === 'scheduled' ? 'Nothing scheduled' : 'No closed posts'}
          body={tab === 'active' ? 'Share an update, alert, deal or listing with your neighbourhood.' : undefined}
          action={
            tab !== 'closed' && (
              <Link to="/create" className="btn-primary">
                <Plus className="h-4 w-4" /> Create a post
              </Link>
            )
          }
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {list.map((p) => {
            const cat = getCategory(p.category);
            const h = headlineValue(p.category, p.metadata);
            const b = bucket(p);
            return (
              <li key={p.id} className="card flex items-start gap-3 p-3.5 transition hover:shadow-lift">
                <CategoryIcon slug={p.category} size={44} />
                <Link to={`/post/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cat.color }}>
                      {cat.short}
                    </span>
                    {p.status === 'hidden' && (
                      <Badge tone="danger">
                        <EyeOff className="h-3 w-3" /> Hidden by moderation
                      </Badge>
                    )}
                    {p.status === 'resolved' && <Badge tone="success">Resolved</Badge>}
                    {p.status === 'active' && isExpired(p) && <Badge>Expired</Badge>}
                    {b === 'scheduled' && <Badge tone="primary">Goes live {formatDateTime(p.scheduled_for!)}</Badge>}
                    {b === 'active' && p.expires_at && <Badge tone="warning">{timeUntil(p.expires_at)}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[15px] font-bold text-ink">{p.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                    <span>{timeAgo(p.created_at)}</span>
                    {h && <span className="font-semibold text-ink-2">{h}</span>}
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowBigUp className="h-3.5 w-3.5" />
                      {p.upvotes - p.downvotes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {p.comment_count ?? 0}
                    </span>
                  </div>
                </Link>
                <button className="icon-btn h-9 w-9" aria-label="Post actions" onClick={() => setMenu(p)}>
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={Boolean(menu)} onClose={() => setMenu(null)} title={menu?.title} size="sm">
        {menu && (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {menu.status !== 'hidden' && (
              <MenuItem icon={Pencil} label="Edit post" onClick={() => navigate(`/edit/${menu.id}`)} />
            )}
            {menu.status === 'active' && !isExpired(menu) && (
              <MenuItem
                icon={CheckCircle2}
                label="Mark as resolved / closed"
                onClick={() => run('Marked as resolved', () => api.updatePost(user!.id, menu.id, { status: 'resolved' }))}
              />
            )}
            {(menu.status === 'resolved' || (menu.status === 'active' && isExpired(menu))) && (
              <MenuItem
                icon={RotateCcw}
                label="Reopen for another round"
                onClick={() =>
                  run('Post reopened', () =>
                    api.updatePost(user!.id, menu.id, { status: 'active', expires_at: getExpiryDate(menu.category) })
                  )
                }
              />
            )}
            <MenuItem icon={Repeat2} label="Repost as new" onClick={() => navigate(`/create?repost=${menu.id}`)} />
            <MenuItem icon={Trash2} label="Delete post" danger onClick={() => setConfirmDelete(menu)} />
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this post?"
        body="It will be removed for everyone, along with its comments and votes. This can’t be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && run('Post deleted', () => api.deletePost(user!.id, confirmDelete.id))}
      />
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick(): void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex h-12 w-full items-center gap-3 px-4 text-left text-[14px] font-semibold hover:bg-surface-2 ${danger ? 'text-danger-600' : 'text-ink'}`}>
      <Icon className="h-5 w-5 opacity-70" />
      {label}
    </button>
  );
}
