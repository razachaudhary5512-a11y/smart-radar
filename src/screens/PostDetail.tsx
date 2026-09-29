import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowBigUp,
  ArrowBigDown,
  Bookmark,
  MessageCircle,
  Flag,
  Ban,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Flame,
  Phone,
  Briefcase,
  Navigation,
  Sparkles,
  Share2,
  CarFront,
  Repeat2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CalendarClock,
  ShieldAlert,
  CalendarCheck,
  Users,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { getCategory } from '@/lib/categories';
import type { PostWithRelations, Comment, PollOption, EventRsvp } from '@/lib/types';
import { formatDistance, formatTimeAgo, isExpired, haversineKm, type Coords } from '@/lib/location';
import {
  getStoredLocalPosts,
  deleteLocalPost,
  getStoredLocalComments,
  saveLocalComment,
  getStoredEventRsvps,
  toggleEventRsvp,
} from '@/lib/dummy-data';
import { Spinner, EmptyState, ConfirmDialog, Modal, Toast, Badge } from '@/components/ui';

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, profile, updateProfile } = useAuth();
  const { coords } = useLocation();

  const [post, setPost] = useState<PostWithRelations | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [pollOptions, setPollOptions] = useState<PollOption[]>([]);
  const [userPollVote, setUserPollVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });

  // Multi-photo gallery state
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Event RSVP state
  const [eventRsvps, setEventRsvps] = useState<EventRsvp[]>([]);
  const [userRsvpStatus, setUserRsvpStatus] = useState<'going' | 'interested' | null>(null);

  const showToast = (msg: string) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast({ msg: '', show: false }), 2000);
  };

  const isOwner = session?.user?.id === post?.user_id || post?.user_id === profile?.id || post?.user_id === 'local-user';
  const cat = post ? getCategory(post.category) : null;
  const expired = post ? isExpired(post) : false;
  const isScheduled = post?.scheduled_for ? new Date(post.scheduled_for).getTime() > Date.now() : false;

  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    let postData: any = null;
    let authorProfile: any = null;

    try {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        postData = data;
        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();
        authorProfile = prof;
      }
    } catch {
      // Fallback
    }

    if (!postData) {
      const localList = getStoredLocalPosts();
      const found = localList.find((p) => p.id === id);
      if (found) {
        postData = found;
        authorProfile = { display_name: found.author_name, avatar_url: found.author_avatar };
      }
    }

    if (!postData) {
      setLoading(false);
      return;
    }

    let isBookmarked = postData.is_bookmarked ?? false;
    let userVote: 'up' | 'down' | null = postData.user_vote ?? null;

    if (session?.user) {
      try {
        const [{ data: bookmark }, { data: vote }] = await Promise.all([
          supabase.from('bookmarks').select('id').eq('post_id', id).eq('user_id', session.user.id).maybeSingle(),
          supabase.from('votes').select('vote_type').eq('post_id', id).eq('user_id', session.user.id).maybeSingle(),
        ]);
        if (bookmark) isBookmarked = true;
        if (vote) userVote = vote.vote_type as 'up' | 'down';
      } catch {
        // Fallback
      }
    }

    const enriched: PostWithRelations = {
      ...postData,
      author_name: authorProfile?.display_name ?? postData.author_name ?? 'Community Member',
      author_avatar: authorProfile?.avatar_url ?? postData.author_avatar ?? null,
      is_bookmarked: isBookmarked,
      user_vote: userVote,
    };

    setPost(enriched);
    setActivePhotoIdx(0);
    setLoading(false);

    // Load RSVP data for events
    if (postData.category === 'local_event') {
      const rsvps = getStoredEventRsvps(id!);
      setEventRsvps(rsvps);
      const userId = session?.user?.id || profile?.id || '';
      const myRsvp = rsvps.find((r) => r.user_id === userId);
      setUserRsvpStatus(myRsvp?.status ?? null);
    }

    // Load real comments from Supabase & local storage
    let loadedComments: Comment[] = [];
    try {
      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      if (commentsData && commentsData.length > 0) {
        loadedComments = commentsData as Comment[];
      }
    } catch {
      // Fallback
    }

    const localComments = getStoredLocalComments(id);
    const allComments = [...localComments, ...loadedComments];
    const seenCommentIds = new Set<string>();
    const uniqueComments = allComments.filter((c) => {
      if (seenCommentIds.has(c.id)) return false;
      seenCommentIds.add(c.id);
      return true;
    });

    setComments(uniqueComments);

    // Load poll options if poll
    if (postData.category === 'community_poll') {
      try {
        const { data: options } = await supabase
          .from('poll_options')
          .select('*')
          .eq('post_id', id);
        if (options && options.length > 0) {
          setPollOptions(options as PollOption[]);
        } else if (postData.metadata?.poll_options && Array.isArray(postData.metadata.poll_options)) {
          setPollOptions(
            postData.metadata.poll_options.map((text: string, idx: number) => ({
              id: `opt-${idx}`,
              post_id: id,
              option_text: text,
              vote_count: 0,
            }))
          );
        }
      } catch {}
    }
  }, [id, session?.user]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  async function handleVote(voteType: 'up' | 'down') {
    if (!post) return;

    if (post.user_vote === voteType) {
      if (session?.user) {
        try {
          await supabase.from('votes').delete().eq('post_id', post.id).eq('user_id', session.user.id);
        } catch {}
      }
      setPost({
        ...post,
        user_vote: null,
        upvotes: voteType === 'up' ? Math.max(0, post.upvotes - 1) : post.upvotes,
        downvotes: voteType === 'down' ? Math.max(0, post.downvotes - 1) : post.downvotes,
      });
      return;
    }

    if (session?.user) {
      try {
        await supabase.from('votes').upsert({
          post_id: post.id,
          user_id: session.user.id,
          vote_type: voteType,
        });
      } catch {}
    }

    setPost({
      ...post,
      user_vote: voteType,
      upvotes: voteType === 'up' ? post.upvotes + 1 : post.user_vote === 'up' ? Math.max(0, post.upvotes - 1) : post.upvotes,
      downvotes: voteType === 'down' ? post.downvotes + 1 : post.user_vote === 'down' ? Math.max(0, post.downvotes - 1) : post.downvotes,
    });
  }

  async function handleBookmark() {
    if (!post) return;
    const newBookmarked = !post.is_bookmarked;
    if (session?.user) {
      try {
        if (newBookmarked) {
          await supabase.from('bookmarks').insert({ post_id: post.id, user_id: session.user.id });
        } else {
          await supabase.from('bookmarks').delete().eq('post_id', post.id).eq('user_id', session.user.id);
        }
      } catch {}
    }
    setPost({ ...post, is_bookmarked: newBookmarked });
    showToast(newBookmarked ? 'Post saved to bookmarks' : 'Post removed from bookmarks');
  }

  async function handleConfirm(type: 'confirm' | 'resolve') {
    if (!post) return;
    if (session?.user) {
      try {
        await supabase.from('confirmations').insert({
          post_id: post.id,
          user_id: session.user.id,
          confirmation_type: type,
        });
      } catch {}
    }
    if (type === 'confirm') {
      setPost({ ...post, confirm_count: post.confirm_count + 1 });
      showToast('Thank you for confirming!');
    }
  }

  async function handleSendComment(prefillText?: string) {
    const textToSend = prefillText || commentText;
    if (!textToSend.trim() || !post) return;

    setSendingComment(true);
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      post_id: post.id,
      user_id: session?.user?.id || profile?.id || 'local-user',
      body: textToSend.trim(),
      created_at: new Date().toISOString(),
      author_name: profile?.display_name || 'Radar Citizen',
      author_avatar: profile?.avatar_url || null,
    };

    if (session?.user) {
      try {
        await supabase.from('comments').insert({
          post_id: post.id,
          user_id: session.user.id,
          body: textToSend.trim(),
        });
      } catch {}
    }

    saveLocalComment(post.id, newComment);
    setComments((prev) => [...prev, newComment]);
    setCommentText('');
    setSendingComment(false);
    showToast('Message posted');
  }

  async function handleReport() {
    if (!post) return;
    try {
      await supabase.from('reports').insert({
        post_id: post.id,
        user_id: session?.user?.id || profile?.id || 'local-user',
        reason: reportReason.trim() || null,
      });
    } catch {}
    setShowReport(false);
    setReportReason('');
    showToast('Report submitted for review');
  }

  async function handleBlock() {
    if (!post || !profile) return;
    const blocked = [...profile.blocked_users, post.user_id];
    await updateProfile({ blocked_users: blocked });
    setShowBlockConfirm(false);
    showToast('User blocked');
    navigate('/');
  }

  async function handleDelete() {
    if (!post) return;
    try {
      await supabase.from('posts').delete().eq('id', post.id);
    } catch {}
    deleteLocalPost(post.id);
    setShowDeleteConfirm(false);
    showToast('Post deleted');
    navigate('/my-posts');
  }

  async function handleMarkResolved() {
    if (!post) return;
    try {
      await supabase.from('posts').update({ status: 'resolved' }).eq('id', post.id);
    } catch {}
    setPost({ ...post, status: 'resolved' });
    showToast('Marked as resolved');
  }

  async function handlePollVote(optionId: string) {
    if (userPollVote) return;
    try {
      await supabase.from('poll_votes').insert({ option_id: optionId, user_id: profile?.id || session?.user?.id || 'local-user' });
    } catch {}

    setPollOptions((prev) =>
      prev.map((o) => (o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o))
    );
    setUserPollVote(optionId);
    showToast('Vote counted');
  }

  function handleEventRsvp(targetStatus: 'going' | 'interested') {
    if (!post || !id) return;
    const userId = session?.user?.id || profile?.id || `anon-${Date.now()}`;
    const result = toggleEventRsvp(
      id,
      { id: userId, name: profile?.display_name || 'Radar Citizen', avatar: profile?.avatar_url },
      targetStatus
    );
    setEventRsvps(result.rsvps);
    setUserRsvpStatus(result.userStatus);
    if (result.userStatus === 'going') showToast('🎉 You\'re going! Neighbors can see you\'re attending.');
    else if (result.userStatus === 'interested') showToast('⭐ Marked as interested!');
    else showToast('RSVP removed.');
  }

  const quickReplies = (() => {
    if (!post) return [];
    if (post.category === 'jobs_internships') {
      return ["I'm interested in this role!", "Is this position still open?", "Can I share my resume?"];
    }
    if (post.category === 'property_rent') {
      return ["Is this flat still available?", "Can I schedule a visit today?", "What is the advance deposit?"];
    }
    if (post.category === 'second_hand' || post.category === 'local_deals') {
      return ["Is this still available?", "What is your best final price?", "Can I inspect it today?"];
    }
    if (post.category === 'home_services') {
      return ["Are you available today?", "What is your visit charge?", "Please share your phone number."];
    }
    if (post.category === 'ride_share') {
      return ["Is a seat still available?", "What is the exact pickup point?", "What is the departure time?"];
    }
    return ["Is this still available?", "Thanks for sharing with neighbors!", "Where is the exact location?"];
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-950">
        <Spinner size={36} />
      </div>
    );
  }

  if (!post || !cat) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <EmptyState
          icon={<MessageCircle size={32} />}
          title="Post Not Found"
          message="This post may have been deleted or expired."
        />
      </div>
    );
  }

  const distance = coords ? haversineKm(coords, { lat: post.lat, lng: post.lng }) : null;
  const totalPollVotes = pollOptions.reduce((sum, o) => sum + o.vote_count, 0);
  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const photos = post.image_urls || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28 max-w-lg mx-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 -ml-2 rounded-full cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bgColor}`}>
              <cat.icon size={15} className={cat.textColor} />
            </div>
            <span className="text-sm font-bold">{cat.label}</span>
          </div>
          <button onClick={() => setShowActions(true)} className="btn-ghost p-2 -mr-2 rounded-full cursor-pointer">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Main Post Content */}
      <div className="px-4 py-4 space-y-4">
        {/* SCHEDULED BANNER */}
        {isScheduled && (
          <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2.5">
            <CalendarClock size={18} className="shrink-0 text-purple-600" />
            <div>
              <span className="font-bold block">Scheduled Publication</span>
              <span>This post will go live to neighbors on {new Date(post.scheduled_for!).toLocaleDateString()} at {new Date(post.scheduled_for!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
            </div>
          </div>
        )}

        {/* Author Header */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center gap-3">
            <img
              src={
                post.author_avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || 'Neighbor')}&background=2563eb&color=fff&size=100`
              }
              alt=""
              className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-500/20"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{post.author_name}</span>
                <ShieldCheck size={15} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatTimeAgo(post.created_at)}</span>
                {distance !== null && (
                  <>
                    <span>•</span>
                    <span className="text-primary-600 font-semibold">{formatDistance(distance)} away</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleBookmark}
            className="p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary-600 active:scale-95 transition-transform cursor-pointer"
            title="Save post"
          >
            <Bookmark size={18} className={post.is_bookmarked ? 'fill-primary-600 text-primary-600' : ''} />
          </button>
        </div>

        {/* Title, Description & Photos Card */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge category={post.category} />
            {post.is_featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                <Flame size={11} /> Featured
              </span>
            )}
            {post.status === 'resolved' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={11} /> Resolved
              </span>
            )}
            {expired && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600">
                <Clock size={11} /> Expired
              </span>
            )}
          </div>

          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white leading-snug">
            {post.title}
          </h1>

          {post.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {post.description}
            </p>
          )}

          {/* Metadata Highlights */}
          {Object.keys(metadata).length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              {Object.entries(metadata).map(([k, v]) => {
                if (!v || typeof v === 'object') return null;
                return (
                  <div key={k} className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">{k.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{String(v)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* MULTI-PHOTO INTERACTIVE GALLERY */}
          {photos.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-black/5 dark:bg-black/40 border border-gray-100 dark:border-gray-800 flex items-center justify-center">
                <img
                  src={photos[activePhotoIdx] || photos[0]}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setShowPhotoModal(true)}
                />

                {/* Photo counter index pill */}
                {photos.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 shadow-md">
                    <span>{activePhotoIdx + 1}</span>
                    <span className="opacity-60">/</span>
                    <span>{photos.length}</span>
                  </div>
                )}

                {/* Left & Right arrow controls */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                      }}
                      className="absolute left-2.5 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-2.5 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails strip */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhotoIdx(i)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer ${
                        activePhotoIdx === i
                          ? 'ring-2 ring-primary-600 scale-102'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Location & Directions Button */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
              <MapPin size={15} className="text-primary-600 shrink-0" />
              <span className="truncate">{post.location_label || 'Neighborhood location'}</span>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${post.lat},${post.lng}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center gap-1 hover:bg-primary-100 shrink-0"
            >
              <Navigation size={13} />
              <span>Directions</span>
            </a>
          </div>
        </div>

        {/* IN-APP SAFETY TIPS CARD FOR HIGH-RISK CATEGORIES */}
        {cat.safetyTips && cat.safetyTips.length > 0 && (
          <div className="p-4 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-amber-950 dark:text-amber-200 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
              <ShieldCheck size={17} className="text-amber-600 shrink-0" />
              <span>Community Safety Tips ({cat.label})</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
              {cat.safetyTips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* JOBS & INTERNSHIPS SPECIAL QUICK APPLY HERO */}
        {post.category === 'jobs_internships' && (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-600 to-primary-600 text-white shadow-lg shadow-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase size={20} />
              <h3 className="text-base font-bold">Apply for this Opportunity</h3>
            </div>
            <p className="text-xs text-indigo-100">
              Direct neighborhood hiring — tap below to express interest directly with the employer.
            </p>
            <button
              onClick={() => handleSendComment(`Hi! I am interested in applying for this position (${post.title}).`)}
              disabled={sendingComment}
              className="w-full py-3 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Sparkles size={16} />
              <span>I'm Interested (Quick Apply)</span>
            </button>
          </div>
        )}

        {/* POLL VOTING */}
        {post.category === 'community_poll' && pollOptions.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200/80 dark:border-gray-800 space-y-3">
            <h3 className="text-sm font-bold">{userPollVote ? `Poll Results (${totalPollVotes} votes)` : 'Vote on this Community Poll'}</h3>
            <div className="space-y-2">
              {pollOptions.map((opt) => {
                const pct = totalPollVotes > 0 ? Math.round((opt.vote_count / totalPollVotes) * 100) : 0;
                const voted = userPollVote === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handlePollVote(opt.id)}
                    disabled={!!userPollVote}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                      voted ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40' : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    {userPollVote && (
                      <div className="absolute inset-0 bg-primary-100/50 dark:bg-primary-900/30" style={{ width: `${pct}%` }} />
                    )}
                    <div className="relative flex justify-between items-center text-xs font-semibold">
                      <span>{opt.option_text}</span>
                      {userPollVote && <span className="font-bold">{pct}%</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* EVENT RSVP BLOCK */}
        {post.category === 'local_event' && (
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200/80 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <CalendarCheck size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Are you going?</h3>
                <p className="text-[11px] text-gray-400">
                  {eventRsvps.filter(r => r.status === 'going').length} going · {eventRsvps.filter(r => r.status === 'interested').length} interested
                </p>
              </div>
            </div>

            {/* RSVP Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleEventRsvp('going')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  userRsvpStatus === 'going'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700'
                }`}
              >
                <CalendarCheck size={15} />
                {userRsvpStatus === 'going' ? "I'm Going ✓" : "I'm Going"}
              </button>
              <button
                onClick={() => handleEventRsvp('interested')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  userRsvpStatus === 'interested'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700'
                }`}
              >
                <Star size={15} className={userRsvpStatus === 'interested' ? 'fill-white' : ''} />
                {userRsvpStatus === 'interested' ? 'Interested ✓' : 'Interested'}
              </button>
            </div>

            {/* Attendee avatars */}
            {eventRsvps.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {eventRsvps.slice(0, 5).map((rsvp) => (
                    <img
                      key={rsvp.id}
                      src={rsvp.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rsvp.user_name)}&background=4f46e5&color=fff&size=60`}
                      alt={rsvp.user_name}
                      title={`${rsvp.user_name} (${rsvp.status})`}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                    />
                  ))}
                  {eventRsvps.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">
                      +{eventRsvps.length - 5}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {eventRsvps.filter(r => r.status === 'going').map(r => r.user_name).slice(0,2).join(', ')}
                  {eventRsvps.filter(r => r.status === 'going').length > 2 ? ` and ${eventRsvps.filter(r => r.status === 'going').length - 2} more are going` : ' are going'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action / Voting & Repost Toolbar */}
        <div className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote('up')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                post.user_vote === 'up' ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
              }`}
            >
              <ArrowBigUp size={18} />
              <span>{post.upvotes}</span>
            </button>
            <button
              onClick={() => handleVote('down')}
              className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                post.user_vote === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
              }`}
            >
              <ArrowBigDown size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* REPOST SIMILAR SHORTCUT */}
            <button
              onClick={() => navigate(`/create?repost_id=${post.id}`)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
              title="Duplicate & Repost Similar"
            >
              <Repeat2 size={14} />
              <span>Repost Similar</span>
            </button>

            {cat.supportsConfirm && post.status === 'active' && !expired && (
              <button
                onClick={() => handleConfirm('confirm')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={15} />
                <span>Confirm ({post.confirm_count})</span>
              </button>
            )}

            {isOwner && post.status === 'active' && (
              <button
                onClick={handleMarkResolved}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Mark Resolved</span>
              </button>
            )}
          </div>
        </div>

        {/* Comments & Message Thread Section */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-200/80 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle size={17} className="text-primary-600" />
              <span>Neighborhood Discussion ({comments.length})</span>
            </h3>
          </div>

          {/* Quick-reply Suggestions Chips */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400">Quick Replies:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendComment(qr)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:text-primary-600 text-[11px] font-medium text-gray-700 dark:text-gray-300 transition-colors border border-transparent hover:border-primary-300 cursor-pointer"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-3 pt-2">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">
                No messages yet. Ask a question or use a quick reply above!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900 dark:text-gray-100">{c.author_name || 'Neighbor'}</span>
                    <span className="text-[10px] text-gray-400">{formatTimeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300">{c.body}</p>
                </div>
              ))
            )}
          </div>

          {/* New Comment Input */}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendComment();
              }}
              placeholder="Write a message or reply..."
              className="input flex-1 text-xs"
            />
            <button
              onClick={() => handleSendComment()}
              disabled={sendingComment || !commentText.trim()}
              className="btn-primary py-2 px-4 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Modal */}
      {showPhotoModal && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setShowPhotoModal(false)}
        >
          <button
            onClick={() => setShowPhotoModal(false)}
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer"
          >
            <ChevronLeft size={20} /> Close
          </button>
          <img
            src={photos[activePhotoIdx]}
            alt=""
            className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 text-white text-xs font-bold">
            Photo {activePhotoIdx + 1} of {photos.length}
          </div>
        </div>
      )}

      {/* Post Actions Modal */}
      <Modal open={showActions} onClose={() => setShowActions(false)} title="Post Options">
        <div className="space-y-2">
          {/* Repost shortcut available in action menu */}
          <button
            onClick={() => {
              setShowActions(false);
              navigate(`/create?repost_id=${post.id}`);
            }}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold cursor-pointer"
          >
            <Repeat2 size={16} /> Repost Similar Shortcut
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => {
                  setShowActions(false);
                  navigate(`/edit/${post.id}`);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-bold cursor-pointer"
              >
                <Pencil size={16} /> Edit Post
              </button>
              <button
                onClick={() => {
                  setShowActions(false);
                  setShowDeleteConfirm(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-bold cursor-pointer"
              >
                <Trash2 size={16} /> Delete Post
              </button>
            </>
          )}
          {!isOwner && (
            <>
              <button
                onClick={() => {
                  setShowActions(false);
                  setShowReport(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-bold cursor-pointer"
              >
                <Flag size={16} /> Report Content
              </button>
              <button
                onClick={() => {
                  setShowActions(false);
                  setShowBlockConfirm(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-bold cursor-pointer"
              >
                <Ban size={16} /> Block Author
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this post?"
        message="This action will remove the post and all comments from your neighborhood radar."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <Toast message={toast.msg} show={toast.show} />
    </div>
  );
}
