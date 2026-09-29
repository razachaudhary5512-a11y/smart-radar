import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Pin,
  Search,
  Radar,
  Vote,
  Wrench,
  Home,
  MessageSquarePlus,
  Sparkles,
  LayoutGrid,
  Plus,
  Siren,
  Star,
  MapPin,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { CATEGORIES, CATEGORY_MAP, GROUP_LABELS, type CategoryConfig } from '@/lib/categories';
import type { PostWithRelations, WatchedArea } from '@/lib/types';
import { haversineKm, type Coords } from '@/lib/location';
import { getStoredLocalPosts, getStoredWatchedAreas } from '@/lib/dummy-data';
import { PostCard } from '@/components/PostCard';
import { EmptyState, Spinner, Modal, Toast } from '@/components/ui';
import { QuickPostWidget } from '@/components/QuickPostWidget';

export function HomeFeed() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const { coords, radiusKm, setRadiusKm } = useLocation();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });
  const [activeCount, setActiveCount] = useState(38);
  // Area switcher: null = local GPS, or a WatchedArea id
  const [activeWatchedArea, setActiveWatchedArea] = useState<WatchedArea | null>(null);
  const [watchedAreas, setWatchedAreas] = useState<WatchedArea[]>([]);
  const [showAreaSwitcher, setShowAreaSwitcher] = useState(false);
  const [showQuickWidget, setShowQuickWidget] = useState(false);

  // Load watched areas
  useEffect(() => {
    const areas = getStoredWatchedAreas();
    setWatchedAreas(areas);
    const handleUpdate = () => setWatchedAreas(getStoredWatchedAreas());
    window.addEventListener('smart_radar_watched_areas_updated', handleUpdate);
    return () => window.removeEventListener('smart_radar_watched_areas_updated', handleUpdate);
  }, []);

  const pinnedCategories = profile?.pinned_categories ?? [];

  const showToast = (msg: string) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast({ msg: '', show: false }), 2000);
  };

  // Effective coords: use watched area center if selected, else GPS
  const effectiveCoords = activeWatchedArea
    ? { lat: activeWatchedArea.lat, lng: activeWatchedArea.lng }
    : coords;
  const effectiveRadius = activeWatchedArea ? activeWatchedArea.radius_km : radiusKm;

  const loadPosts = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('posts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeCategory) {
      query = query.eq('category', activeCategory);
    }

    let rawData: any[] = [];
    try {
      const { data, error } = await query;
      if (!error && data) {
        rawData = data;
      }
    } catch {
      // Fallback
    }

    const localList = getStoredLocalPosts();
    const allCombined = [...localList, ...rawData];

    // Deduplicate by ID
    const seenIds = new Set<string>();
    const uniquePosts: any[] = [];
    for (const p of allCombined) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        uniquePosts.push(p);
      }
    }

    // Filter by category if selected
    const categoryFiltered = activeCategory
      ? uniquePosts.filter((p) => p.category === activeCategory)
      : uniquePosts;

    // Filter by radius and scheduled status
    // When viewing a watched area, use that area's center + radius; otherwise use GPS coords
    const scanCoords = activeWatchedArea
      ? { lat: activeWatchedArea.lat, lng: activeWatchedArea.lng }
      : coords;
    const scanRadius = activeWatchedArea ? activeWatchedArea.radius_km : radiusKm;

    const filtered = categoryFiltered.filter((p) => {
      if (p.scheduled_for && new Date(p.scheduled_for).getTime() > Date.now()) {
        return false;
      }
      const dist = haversineKm(scanCoords, { lat: p.lat, lng: p.lng });
      const catRadius = CATEGORY_MAP[p.category]?.defaultRadiusKm ?? scanRadius;
      const effectiveR = Math.min(catRadius, scanRadius);
      // When viewing watched area: show ALL categories (property, deals, events prioritized)
      if (activeWatchedArea) {
        return dist <= scanRadius;
      }
      return dist <= effectiveR;
    });

    // Fetch author profiles for supabase items
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

    // Fetch user's bookmarks and votes
    let bookmarkSet = new Set<string>();
    let voteMap = new Map<string, 'up' | 'down'>();

    if (session?.user) {
      try {
        const [{ data: bookmarks }, { data: votes }] = await Promise.all([
          supabase.from('bookmarks').select('post_id').eq('user_id', session.user.id),
          supabase.from('votes').select('post_id, vote_type').eq('user_id', session.user.id),
        ]);
        bookmarkSet = new Set((bookmarks ?? []).map((b) => b.post_id));
        voteMap = new Map((votes ?? []).map((v) => [v.post_id, v.vote_type as 'up' | 'down']));
      } catch {
        // Fallback
      }
    }

    const enriched: any[] = filtered.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
        ...p,
        author_name: p.author_name ?? prof?.display_name ?? 'Community Member',
        author_avatar: p.author_avatar ?? prof?.avatar_url ?? null,
        is_bookmarked: p.is_bookmarked ?? bookmarkSet.has(p.id),
        user_vote: p.user_vote ?? (voteMap.get(p.id) ?? null),
      };
    });

    // Sort: pinned categories first, then by recency
    if (!activeCategory && pinnedCategories.length > 0) {
      enriched.sort((a, b) => {
        const aPinned = pinnedCategories.includes(a.category) ? 0 : 1;
        const bPinned = pinnedCategories.includes(b.category) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // Featured posts on top
    enriched.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });

    setPosts(enriched);
    setActiveCount(enriched.length + 18);
    setLoading(false);
  }, [coords, radiusKm, activeCategory, activeWatchedArea, session?.user, pinnedCategories]);

  useEffect(() => {
    loadPosts();
    const handleUpdate = () => loadPosts();
    window.addEventListener('smart_radar_posts_updated', handleUpdate);
    return () => window.removeEventListener('smart_radar_posts_updated', handleUpdate);
  }, [loadPosts]);

  async function handleVote(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const isUpvoted = post.user_vote === 'up';
    const newVote = isUpvoted ? null : 'up';
    const delta = isUpvoted ? -1 : 1;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              user_vote: newVote,
              upvotes: Math.max(0, p.upvotes + delta),
            }
          : p
      )
    );

    if (session?.user) {
      try {
        if (isUpvoted) {
          await supabase.from('votes').delete().eq('post_id', postId).eq('user_id', session.user.id);
        } else {
          await supabase.from('votes').upsert({ post_id: postId, user_id: session.user.id, vote_type: 'up' });
        }
      } catch {}
    }
  }

  async function handleBookmark(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.is_bookmarked) {
      if (session?.user) {
        try {
          await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', session.user.id);
        } catch {}
      }
      showToast('Removed from saved');
    } else {
      if (session?.user) {
        try {
          await supabase.from('bookmarks').insert({ post_id: postId, user_id: session.user.id });
        } catch {}
      }
      showToast('Saved to your bookmarks');
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p)));
  }

  const orderedCategories = [...CATEGORIES].sort((a, b) => {
    const aPinned = pinnedCategories.includes(a.slug) ? 0 : 1;
    const bPinned = pinnedCategories.includes(b.slug) ? 0 : 1;
    return aPinned - bPinned;
  });

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/80 shadow-sm">
        <div className="px-4 pt-3.5 pb-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20">
                <Radar size={20} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
                    Smart Radar
                  </h1>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-200/50 dark:border-primary-800/50">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {activeWatchedArea ? `📍 ${activeWatchedArea.name}, ${activeWatchedArea.city}` : 'Hyperlocal Neighborhood Feed'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs transition-colors cursor-pointer"
                title="View your profile & settings"
              >
                <img
                  src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={profile?.display_name || 'User'}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white"
                />
                <span className="max-w-[70px] truncate font-bold text-[11px]">
                  {profile?.display_name?.split(' ')[0] || 'Profile'}
                </span>
              </button>

              <button
                onClick={() => navigate('/search')}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              {!activeWatchedArea && (
                <button
                  onClick={() => setShowRadiusModal(true)}
                  className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="Change radius"
                >
                  <SlidersHorizontal size={18} />
                  <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400">{radiusKm}km</span>
                </button>
              )}
            </div>
          </div>

          {/* Area Switcher */}
          <div className="mb-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {/* My Local Radar chip */}
              <button
                onClick={() => { setActiveWatchedArea(null); setShowAreaSwitcher(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                  !activeWatchedArea
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <MapPin size={11} />
                My Local Radar
              </button>

              {/* Watched area chips */}
              {watchedAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => { setActiveWatchedArea(area); setActiveCategory(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                    activeWatchedArea?.id === area.id
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-dashed border-indigo-400/50 dark:border-indigo-600/40'
                  }`}
                >
                  <Star size={10} className={activeWatchedArea?.id === area.id ? 'fill-white text-white' : 'text-indigo-500'} />
                  {area.name}
                  {activeWatchedArea?.id === area.id && (
                    <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded-full">{area.radius_km}km</span>
                  )}
                </button>
              ))}

              {/* Manage / + Watch Area */}
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 transition-all"
              >
                <Eye size={11} />
                {watchedAreas.length === 0 ? '+ Follow Area' : 'Manage'}
              </button>
            </div>
          </div>

          {/* Watched Area Active Banner */}
          {activeWatchedArea && (
            <div className="mb-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                  <Eye size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-200">
                    Viewing: {activeWatchedArea.name} • {activeWatchedArea.radius_km}km radius
                  </p>
                  {activeWatchedArea.notes && (
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 truncate max-w-[220px]">{activeWatchedArea.notes}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveWatchedArea(null)}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-900/40 px-2 py-1 rounded-lg whitespace-nowrap shrink-0 hover:bg-indigo-100"
              >
                Back to GPS
              </button>
            </div>
          )}

          {/* Category filter tabs — only show when viewing local radar */}
          {!activeWatchedArea && <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={`chip px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeCategory === null
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                  : 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              🌟 All Feed
            </button>
            {orderedCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  onClick={() => setActiveCategory(isActive ? null : cat.slug)}
                  className={`chip px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                      : 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  } ${pinnedCategories.includes(cat.slug) && !isActive ? 'ring-1 ring-primary-400/60' : ''}`}
                >
                  {pinnedCategories.includes(cat.slug) && <Pin size={10} className="text-primary-500" />}
                  <Icon size={13} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setShowPinModal(true)}
              className="chip px-2.5 py-1.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 hover:bg-gray-200 shrink-0"
              title="Pin preferred categories"
            >
              <Pin size={12} /> Pin
            </button>
          </div>}
        </div>
      </header>

      {/* Main Feed Content */}
      <div className="px-4 py-3.5 space-y-3.5">
        {/* Facebook-style "Create Post / Share with Neighborhood" Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3.5 shadow-sm border border-gray-200/80 dark:border-gray-800 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={profile?.display_name || 'You'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-500/20 shrink-0"
            />
            <button
              onClick={() => navigate('/create?category=community_feed')}
              className="flex-1 text-left px-4 py-2.5 bg-gray-100 dark:bg-gray-800/90 hover:bg-gray-200 dark:hover:bg-gray-700/80 text-gray-500 dark:text-gray-400 text-sm rounded-full transition-all cursor-pointer font-normal border border-transparent hover:border-primary-500/20"
            >
              What's on your mind? Share with neighbors...
            </button>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-800/80 text-xs">
            <button
              onClick={() => navigate('/create?category=community_feed')}
              className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <MessageSquarePlus size={16} />
              <span>Post</span>
            </button>
            <button
              onClick={() => navigate('/create?category=property_rent')}
              className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <Home size={16} />
              <span>Rentals</span>
            </button>
            <button
              onClick={() => navigate('/create?category=home_services')}
              className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <Wrench size={16} />
              <span>Service</span>
            </button>
            <button
              onClick={() => navigate('/create?category=community_poll')}
              className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <Vote size={16} />
              <span>Poll</span>
            </button>
            <button
              onClick={() => navigate('/create')}
              className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 px-2 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <LayoutGrid size={16} />
              <span>More</span>
            </button>
          </div>
        </div>

        {/* Live Activity Banner */}
        <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
          activeWatchedArea
            ? 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100/60 dark:border-indigo-900/40'
            : 'bg-gradient-to-r from-primary-50/80 to-indigo-50/80 dark:from-primary-950/30 dark:to-indigo-950/30 border-primary-100/60 dark:border-primary-900/40'
        }`}>
          <div className={`flex items-center gap-2 font-medium ${
            activeWatchedArea ? 'text-indigo-700 dark:text-indigo-300' : 'text-primary-700 dark:text-primary-300'
          }`}>
            <Sparkles size={14} className={`animate-bounce ${activeWatchedArea ? 'text-indigo-600' : 'text-primary-600'}`} />
            {activeWatchedArea ? (
              <span>Watching <strong>{activeWatchedArea.name}</strong> • {activeWatchedArea.radius_km} km radius</span>
            ) : (
              <span>Showing posts within <strong>{radiusKm} km</strong> of your location</span>
            )}
          </div>
          <span className={`font-semibold bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full shadow-2xs ${
            activeWatchedArea ? 'text-indigo-600 dark:text-indigo-400' : 'text-primary-600 dark:text-primary-400'
          }`}>
            {posts.length} posts
          </span>
        </div>

        {/* Radius Nudge if feed is nearly empty and radius < 5km */}
        {!loading && posts.length <= 1 && radiusKm < 10 && (
          <div className="bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-950/50 dark:to-indigo-950/50 p-3.5 rounded-2xl border border-primary-200/60 dark:border-primary-800/50 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0">
                <Radar size={16} />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">Need more neighborhood posts?</p>
                <p className="text-gray-500 dark:text-gray-400">Expand your radar to 10km to view the full sector.</p>
              </div>
            </div>
            <button
              onClick={() => setRadiusKm(10)}
              className="px-3 py-1.5 rounded-xl bg-primary-600 text-white font-semibold shrink-0 hover:bg-primary-700 active:scale-95 transition-transform shadow-xs cursor-pointer"
            >
              Expand 10km
            </button>
          </div>
        )}

        {/* Posts List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size={36} />
            <p className="text-xs text-gray-400 font-medium animate-pulse">Scanning neighborhood radar...</p>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Radar size={32} />}
            title="No posts yet in this area"
            message={
              activeCategory
                ? `No ${CATEGORY_MAP[activeCategory]?.label ?? 'posts'} within ${radiusKm} km. Be the first to share something with your neighborhood!`
                : `Nothing nearby yet within ${radiusKm} km — be the first to post!`
            }
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userCoords={coords as Coords | null}
              onBookmark={handleBookmark}
              onVote={handleVote}
            />
          ))
        )}

        {/* Floating Action Buttons */}
        <button
          onClick={() => navigate('/create')}
          className="fixed bottom-20 right-5 z-40 w-13 h-13 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white/20"
          title="Create New Post"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Quick Urgent Report Widget Button */}
        <button
          onClick={() => setShowQuickWidget(true)}
          className="fixed bottom-20 left-5 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 text-white shadow-xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white/20 text-xs font-bold"
          title="Quick urgent report"
        >
          <Siren size={15} />
          <span>SOS / Alert</span>
        </button>
      </div>

      {/* Quick Post Widget Overlay */}
      {showQuickWidget && (
        <QuickPostWidget
          onClose={() => setShowQuickWidget(false)}
          onPosted={() => {
            showToast('⚡ Urgent alert posted! Neighbors notified.');
          }}
        />
      )}

      {/* Radius Modal */}
      <Modal
        open={showRadiusModal}
        onClose={() => setShowRadiusModal(false)}
        title="Neighborhood Radar Radius"
        footer={
          <button onClick={() => setShowRadiusModal(false)} className="btn-primary w-full py-2.5">
            Apply Radius ({radiusKm} km)
          </button>
        }
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adjust how far your radar scans for neighborhood posts, listings, and services:
          </p>
          <div className="flex items-center justify-between text-2xl font-bold text-primary-600">
            <span>{radiusKm} km</span>
            <span className="text-xs font-normal text-gray-400">Up to {(radiusKm * 1000).toLocaleString()} meters</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={radiusKm}
            onChange={(e) => {
              const km = Number(e.target.value);
              setRadiusKm(km);
            }}
            className="w-full accent-primary-600 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
          />
          <div className="flex justify-between text-xs text-gray-400 font-medium">
            <span>1 km (Immediate block)</span>
            <span>5 km (Sector)</span>
            <span>10 km (Wide Area)</span>
          </div>
        </div>
      </Modal>

      {/* Pin Categories Modal */}
      <PinCategoriesModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        pinned={pinnedCategories}
        onToast={showToast}
      />

      <Toast message={toast.msg} show={toast.show} />
    </div>
  );
}

function PinCategoriesModal({
  open,
  onClose,
  pinned,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  pinned: string[];
  onToast: (msg: string) => void;
}) {
  const { session, updateProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>(pinned);

  useEffect(() => {
    setSelected(pinned);
  }, [pinned, open]);

  function toggle(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 4) return prev;
      return [...prev, slug];
    });
  }

  async function handleSave() {
    await updateProfile({ pinned_categories: selected });
    onToast('Pinned categories updated');
    onClose();
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfig[]>);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pin Top Categories"
      footer={
        <button onClick={handleSave} className="btn-primary w-full py-2.5">
          Save Preferences ({selected.length}/4)
        </button>
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Pin up to 4 categories to appear first in your top radar navigation bar.
      </p>
      <div className="space-y-4">
        {Object.entries(grouped).map(([group, cats]) => (
          <div key={group}>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {GROUP_LABELS[group as keyof typeof GROUP_LABELS] ?? group}
            </h4>
            <div className="flex flex-wrap gap-2">
              {cats.map((cat) => {
                const isPinned = selected.includes(cat.slug);
                const disabled = !isPinned && selected.length >= 4;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => toggle(cat.slug)}
                    disabled={disabled}
                    className={`chip px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isPinned ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {isPinned && <Pin size={10} />}
                    <Icon size={12} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
