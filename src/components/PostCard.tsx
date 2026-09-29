import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  ThumbsUp,
  MessageCircle,
  Bookmark,
  ShieldCheck,
  Flame,
  Clock,
  CheckCircle2,
  Tag,
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Repeat2,
  Layers,
  CalendarCheck,
  Users,
  Star,
} from 'lucide-react';
import type { PostWithRelations } from '@/lib/types';
import { getCategory } from '@/lib/categories';
import { formatDistance, formatTimeAgo, isExpired, haversineKm, type Coords } from '@/lib/location';
import { toggleEventRsvp } from '@/lib/dummy-data';
import { useState } from 'react';

interface PostCardProps {
  post: PostWithRelations;
  userCoords: Coords | null;
  onBookmark?: (postId: string) => void;
  onVote?: (postId: string) => void;
}

export function PostCard({ post, userCoords, onBookmark, onVote }: PostCardProps) {
  const navigate = useNavigate();
  const cat = getCategory(post.category);
  const Icon = cat?.icon ?? MapPin;
  const expired = isExpired(post);
  const isEmergency = post.category === 'urgent_blood' || cat?.group === 'emergency';
  const isScheduled = post.scheduled_for ? new Date(post.scheduled_for).getTime() > Date.now() : false;
  const photos = post.image_urls || [];
  const isEvent = post.category === 'local_event';

  const distance = userCoords ? haversineKm(userCoords, { lat: post.lat, lng: post.lng }) : null;

  // RSVP local state for events (quick RSVP from feed)
  const [localRsvpStatus, setLocalRsvpStatus] = useState<'going' | 'interested' | null>(
    post.user_rsvp ?? null
  );
  const [localRsvpCount, setLocalRsvpCount] = useState(post.rsvp_count ?? { going: 0, interested: 0 });

  function handleQuickRsvp(e: React.MouseEvent, targetStatus: 'going' | 'interested') {
    e.stopPropagation();
    const result = toggleEventRsvp(
      post.id,
      { id: 'local-user', name: 'Radar Citizen', avatar: null },
      targetStatus
    );
    setLocalRsvpStatus(result.userStatus);
    setLocalRsvpCount({
      going: result.rsvps.filter((r) => r.status === 'going').length,
      interested: result.rsvps.filter((r) => r.status === 'interested').length,
    });
  }

  return (
    <article
      onClick={() => navigate(`/post/${post.id}`)}
      className={`bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border transition-all hover:shadow-md cursor-pointer animate-fade-in ${
        isEmergency
          ? 'border-red-500/80 dark:border-red-500/80 ring-2 ring-red-500/20 bg-red-50/10'
          : 'border-gray-200/80 dark:border-gray-800'
      } ${expired ? 'opacity-65' : ''}`}
    >
      {/* Emergency Alert Banner */}
      {isEmergency && (
        <div className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs font-bold animate-pulse">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <AlertTriangle size={14} className="text-red-600" />
            <span>URGENT NEIGHBORHOOD ALERT</span>
          </div>
          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-extrabold uppercase">
            Priority
          </span>
        </div>
      )}

      {/* Scheduled Future Post Banner */}
      {isScheduled && (
        <div className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <CalendarClock size={14} className="text-purple-600" />
            <span>Scheduled for {new Date(post.scheduled_for!).toLocaleDateString()}</span>
          </div>
          <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">
            Future
          </span>
        </div>
      )}

      {/* Author Header */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={
              post.author_avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || 'Neighbor')}&background=2563eb&color=fff&size=100`
            }
            alt={post.author_name || 'Neighbor'}
            className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700 shrink-0"
            loading="lazy"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {post.author_name || 'Radar Citizen'}
              </span>
              <ShieldCheck size={14} className="text-primary-600 dark:text-primary-400 shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              {distance !== null && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-primary-600 dark:text-primary-400">
                  <MapPin size={11} /> {formatDistance(distance)}
                </span>
              )}
              <span>•</span>
              <span>{formatTimeAgo(post.created_at)}</span>
              {post.location_label && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[110px]">{post.location_label}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Category Pill */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            cat?.bgColor ?? 'bg-gray-100 dark:bg-gray-800'
          } ${cat?.textColor ?? 'text-gray-600 dark:text-gray-300'}`}
        >
          <Icon size={12} />
          <span>{cat?.label ?? post.category}</span>
        </span>
      </div>

      {/* Post Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {post.is_featured && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <Flame size={11} /> Featured
          </span>
        )}
        {post.women_only && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-900/50">
            Women Only
          </span>
        )}
        {post.status === 'resolved' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} /> Resolved
          </span>
        )}
        {cat?.isHighRisk && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
            <ShieldCheck size={11} /> Verified Safety Tips
          </span>
        )}
        {/* Verification badge for providers */}
        {post.author_is_verified && post.author_verification_status === 'valid' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <ShieldCheck size={11} /> CNIC Verified
          </span>
        )}
        {post.author_is_verified && post.author_verification_status === 'due_soon' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <ShieldCheck size={11} /> Verified (Renewal Due)
          </span>
        )}
        {/* RSVP count for events */}
        {post.category === 'local_event' && post.rsvp_count && (post.rsvp_count.going > 0 || post.rsvp_count.interested > 0) && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
            <Users size={11} />
            {post.rsvp_count.going > 0 && <span>{post.rsvp_count.going} Going</span>}
            {post.rsvp_count.going > 0 && post.rsvp_count.interested > 0 && <span> · </span>}
            {post.rsvp_count.interested > 0 && <span>{post.rsvp_count.interested} Interested</span>}
          </span>
        )}
      </div>

      {/* Title & Body */}
      <h3 className="font-bold text-base leading-snug mb-1.5 text-gray-900 dark:text-gray-100">
        {post.title}
      </h3>

      {post.description && (
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3 line-clamp-3">
          {post.description}
        </p>
      )}

      {/* Metadata highlights (Price, Salary, Rent, Blood group, Service, etc.) */}
      {post.metadata && Object.keys(post.metadata).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(post.metadata).map(([key, val]) => {
            if (!val || typeof val === 'object') return null;
            const labelKey = key.replace(/_/g, ' ');
            const isPrice = key === 'price' || key === 'rent' || key === 'fare' || key === 'salary';
            const isJobType = key === 'job_type';
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  isPrice
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                    : isJobType
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {isPrice ? <Tag size={11} /> : isJobType ? <Briefcase size={11} /> : null}
                <span className="capitalize">{labelKey}:</span>
                <span className="font-bold">{String(val)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Attached Photos (Multi-Photo Grid / Banner) */}
      {photos.length > 0 ? (
        <div
          className={`grid gap-1.5 mb-3 rounded-2xl overflow-hidden ${
            photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {photos.slice(0, 2).map((url, i) => (
            <div key={i} className="relative w-full h-44 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
                loading="lazy"
              />
              {i === 1 && photos.length > 2 && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-2xs">
                  <Layers size={20} />
                  <span className="text-xs font-extrabold mt-1">+{photos.length - 1} More Photos</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`w-full py-3 px-4 rounded-2xl flex items-center justify-between mb-3 ${cat?.bgColor || 'bg-gray-100'}`}>
          <div className="flex items-center gap-2">
            <Icon size={18} className={cat?.textColor || 'text-primary-600'} />
            <span className={`text-xs font-semibold ${cat?.textColor || 'text-gray-700'}`}>
              {cat?.description || post.title}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-medium">Tap to view</span>
        </div>
      )}

      {/* Action Bar */}
      {isEvent ? (
        /* Event RSVP Action Bar */
        <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Users size={13} className="text-indigo-500" />
            <span>
              <strong className="text-indigo-600">{localRsvpCount.going}</strong> going
              {localRsvpCount.interested > 0 && (
                <> · <strong className="text-amber-600">{localRsvpCount.interested}</strong> interested</>
              )}
              {localRsvpStatus && <span className="ml-1 text-emerald-600 font-bold">• You're marked!</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => handleQuickRsvp(e, 'going')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                localRsvpStatus === 'going'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <CalendarCheck size={13} />
              {localRsvpStatus === 'going' ? "I'm Going ✓" : "I'm Going"}
            </button>
            <button
              onClick={(e) => handleQuickRsvp(e, 'interested')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                localRsvpStatus === 'interested'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-amber-50 hover:text-amber-700'
              }`}
            >
              <Star size={13} className={localRsvpStatus === 'interested' ? 'fill-white' : ''} />
              {localRsvpStatus === 'interested' ? 'Interested ✓' : 'Interested'}
            </button>
            {onBookmark && (
              <button
                onClick={(e) => { e.stopPropagation(); onBookmark(post.id); }}
                className={`p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                  post.is_bookmarked ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                <Bookmark size={15} className={post.is_bookmarked ? 'fill-primary-600 text-primary-600' : ''} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Regular Action Bar */
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onVote) onVote(post.id);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-semibold cursor-pointer ${
              post.user_vote === 'up' ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50' : ''
            }`}
          >
            <ThumbsUp size={15} />
            <span>{post.upvotes > 0 ? post.upvotes : 'Like'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/post/${post.id}`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-semibold cursor-pointer"
          >
            <MessageCircle size={15} />
            <span>Inquire / Chat</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/create?repost_id=${post.id}`);
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-indigo-600 cursor-pointer"
              title="Repost Similar"
            >
              <Repeat2 size={16} />
            </button>

            {onBookmark && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmark(post.id);
                }}
                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                  post.is_bookmarked ? 'text-primary-600 dark:text-primary-400' : ''
                }`}
                title="Save post"
              >
                <Bookmark
                  size={16}
                  className={post.is_bookmarked ? 'fill-primary-600 text-primary-600' : ''}
                />
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
