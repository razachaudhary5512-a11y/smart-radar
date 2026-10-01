import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { PageBody, PageHeader, RequireAuth } from '@/components/layout/Page';
import { PostCard } from '@/components/post/PostCard';
import { EmptyState, ErrorState, PostCardSkeleton } from '@/components/ui';
import { useApi } from '@/data';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { useRadar } from '@/lib/location-context';
import { haversineKm } from '@/lib/location';
import type { PostWithRelations } from '@/lib/types';

export function Saved() {
  return (
    <>
      <PageHeader title="Saved" subtitle="Posts you’ve bookmarked for later." />
      <PageBody narrow>
        <RequireAuth icon={Bookmark} title="Save posts for later" body="Sign in to bookmark deals, jobs, rentals and services and find them here.">
          <SavedList />
        </RequireAuth>
      </PageBody>
    </>
  );
}

function SavedList() {
  const api = useApi();
  const { user } = useAuth();
  const { coords } = useRadar();
  const { data, loading, error, refetch, setData } = useQuery(() => api.listBookmarks(user!.id), [api, user?.id], { scopes: ['bookmarks', 'posts'] });

  const onChange = useCallback(
    (p: PostWithRelations) =>
      setData((list) => (p.is_bookmarked ? (list ?? []).map((x) => (x.id === p.id ? p : x)) : (list ?? []).filter((x) => x.id !== p.id))),
    [setData]
  );

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading)
    return (
      <div className="space-y-3">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  if (!data?.length)
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved posts yet"
        body="Tap the bookmark icon on any post to keep it here."
        action={
          <Link to="/" className="btn-primary">
            Browse your feed
          </Link>
        }
      />
    );
  return (
    <div className="space-y-3">
      {data.map((p) => (
        <PostCard key={p.id} post={{ ...p, distance_km: haversineKm(coords, p) }} onChange={onChange} />
      ))}
    </div>
  );
}
