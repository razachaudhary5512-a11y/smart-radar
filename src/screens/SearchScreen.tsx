import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { CATEGORIES, CATEGORY_MAP, type CategoryConfig } from '@/lib/categories';
import type { PostWithRelations } from '@/lib/types';
import { haversineKm, type Coords } from '@/lib/location';
import { getStoredLocalPosts } from '@/lib/dummy-data';
import { PostCard } from '@/components/PostCard';
import { EmptyState, Spinner } from '@/components/ui';

export function SearchScreen() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { coords, radiusKm } = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim() && selectedCategories.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);

    let dbQuery = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (query.trim()) {
      dbQuery = dbQuery.or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`);
    }

    let rawData: any[] = [];
    try {
      const { data, error } = await dbQuery;
      if (!error && data) {
        rawData = data;
      }
    } catch {
      // Fallback
    }

    const localList = getStoredLocalPosts();
    const allCombined = [...localList, ...rawData];

    // Deduplicate by ID and exclude future scheduled posts
    const seenIds = new Set<string>();
    const uniquePosts: PostWithRelations[] = [];
    const now = Date.now();
    for (const p of allCombined) {
      const isFuture = p.scheduled_for && new Date(p.scheduled_for).getTime() > now;
      if (!seenIds.has(p.id) && !isFuture) {
        seenIds.add(p.id);
        uniquePosts.push(p);
      }
    }

    // Filter by query string
    let filtered = uniquePosts;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter((p) => {
        const tMatch = p.title?.toLowerCase().includes(q);
        const dMatch = p.description?.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        const locMatch = p.location_label?.toLowerCase().includes(q);
        return tMatch || dMatch || catMatch || locMatch;
      });
    }

    // Filter by category
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => selectedCategories.includes(p.category));
    }

    // Filter by radius
    if (coords) {
      filtered = filtered.filter((p) => {
        const dist = haversineKm(coords, { lat: p.lat, lng: p.lng });
        const catRadius = CATEGORY_MAP[p.category]?.defaultRadiusKm ?? radiusKm;
        return dist <= Math.min(catRadius, radiusKm);
      });
    }

    // Fetch author profiles
    const userIds = [...new Set(filtered.map((p) => p.user_id).filter((uid) => uid && !uid.startsWith('user-')))];
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      } catch {}
    }

    // Fetch bookmarks
    let bookmarkSet = new Set<string>();
    if (session?.user) {
      try {
        const { data: bookmarks } = await supabase
          .from('bookmarks')
          .select('post_id')
          .eq('user_id', session.user.id);
        bookmarkSet = new Set((bookmarks ?? []).map((b) => b.post_id));
      } catch {}
    }

    const enriched = filtered.map((p) => ({
      ...p,
      author_name: p.author_name ?? profileMap.get(p.user_id)?.display_name ?? 'Community Member',
      author_avatar: p.author_avatar ?? profileMap.get(p.user_id)?.avatar_url ?? null,
      is_bookmarked: p.is_bookmarked ?? bookmarkSet.has(p.id),
    }));

    setResults(enriched);
    setLoading(false);
  }, [query, selectedCategories, coords, radiusKm, session?.user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || selectedCategories.length > 0) {
        doSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedCategories, doSearch]);

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfig[]>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2 rounded-full">
              <SearchIcon size={20} className="text-gray-400" />
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts... e.g. electrician, 2 bedroom flat"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="btn-ghost p-1.5 rounded-full">
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost p-2 rounded-full ${selectedCategories.length > 0 ? 'text-primary-600' : ''}`}
            >
              <Filter size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Filter by category</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {Object.entries(grouped).map(([group, cats]) =>
                  cats.map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => toggleCategory(cat.slug)}
                      className={`chip ${selectedCategories.includes(cat.slug) ? 'chip-active' : 'chip-inactive'} text-xs`}
                    >
                      <cat.icon size={10} />
                      {cat.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size={32} />
          </div>
        ) : !searched ? (
          <EmptyState
            icon={<SearchIcon size={28} />}
            title="Search nearby posts"
            message={'Find posts by keyword — try "electrician", "flat", "blood", or anything else.'}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={28} />}
            title="No results"
            message="No posts match your search. Try different keywords or expand your radius."
          />
        ) : (
          <>
            <p className="text-xs text-gray-400 px-1">{results.length} results found</p>
            {results.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                userCoords={coords as Coords | null}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
