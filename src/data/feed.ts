import { haversineKm, isExpired } from '@/lib/location';
import type { FeedQuery, PostWithRelations } from '@/lib/types';

/** Score for "Top": votes and crowd confirmations, decayed by age. */
function hotScore(p: PostWithRelations): number {
  const ageHours = (Date.now() - new Date(p.created_at).getTime()) / 3_600_000;
  const points = p.upvotes - p.downvotes + p.confirm_count * 0.5 + (p.comment_count ?? 0) * 0.3 + (p.is_featured ? 3 : 0);
  return points / Math.pow(ageHours + 2, 1.2);
}

function matchesSearch(p: PostWithRelations, term: string): boolean {
  const hay = [p.title, p.description, p.location_label, ...Object.values(p.metadata ?? {}).map(String)].join(' ').toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function finalizeFeed(posts: PostWithRelations[], q: FeedQuery): PostWithRelations[] {
  const now = Date.now();
  let out = posts
    .map((p) => ({ ...p, distance_km: haversineKm(q.center, { lat: p.lat, lng: p.lng }) }))
    .filter((p) => p.distance_km! <= q.radiusKm)
    .filter((p) => p.status !== 'hidden')
    .filter((p) => !p.scheduled_for || new Date(p.scheduled_for).getTime() <= now)
    .filter((p) => (q.includeResolved ? true : p.status === 'active' && !isExpired(p)));

  if (q.category) out = out.filter((p) => p.category === q.category);
  if (q.search?.trim()) out = out.filter((p) => matchesSearch(p, q.search!.trim()));

  const sort = q.sort ?? 'latest';
  out.sort((a, b) => {
    if (sort === 'nearest') return a.distance_km! - b.distance_km!;
    if (sort === 'top') return hotScore(b) - hotScore(a);
    // latest — featured posts float up within the last 24h
    const fa = a.is_featured && now - new Date(a.created_at).getTime() < 86_400_000 ? 1 : 0;
    const fb = b.is_featured && now - new Date(b.created_at).getTime() < 86_400_000 ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return q.limit ? out.slice(0, q.limit) : out;
}
