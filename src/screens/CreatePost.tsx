import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  X,
  Check,
  Loader2,
  MapPin,
  Flame,
  AlertTriangle,
  Eye,
  Undo2,
  Sparkles,
  ShieldAlert,
  Briefcase,
  Calendar,
  DollarSign,
  Tag,
  Upload,
  Image as ImageIcon,
  Clock,
  Repeat2,
  ShieldCheck,
  Plus,
  Trash2,
  CalendarClock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { CATEGORIES, CATEGORY_MAP, GROUP_LABELS, getExpiryDate, type CategoryConfig, type CategoryField } from '@/lib/categories';
import { saveLocalPost, deleteLocalPost, getStoredLocalPosts } from '@/lib/dummy-data';
import { Modal, Badge } from '@/components/ui';

export function CreatePost() {
  const { id: editId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const repostId = searchParams.get('repost_id');
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const { coords, requestLocation } = useLocation();

  const [step, setStep] = useState<'category' | 'form' | 'preview'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [womenOnly, setWomenOnly] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Scheduled / Future Post State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // Repost info banner
  const [isRepostMode, setIsRepostMode] = useState(false);

  // First-use Emergency warning modal
  const [showEmergencyNotice, setShowEmergencyNotice] = useState(false);

  // Undo / Grace period state (10-second window)
  const [undoState, setUndoState] = useState<{ active: boolean; postId: string; timeLeft: number } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectCategory = useCallback((slug: string) => {
    setSelectedCategory(slug);
    const cat = CATEGORY_MAP[slug];
    if (cat?.group === 'emergency' || slug === 'urgent_blood') {
      setShowEmergencyNotice(true);
    }
    setStep('form');
  }, []);

  // Handle Edit or Repost Similar pre-population
  useEffect(() => {
    if (repostId) {
      setIsRepostMode(true);
      // Load source post for Repost Similar
      const localList = getStoredLocalPosts();
      const sourcePost = localList.find((p) => p.id === repostId);
      if (sourcePost) {
        setSelectedCategory(sourcePost.category);
        setTitle(sourcePost.title);
        setDescription(sourcePost.description || '');
        setFormData(sourcePost.metadata || {});
        setImageUrls(sourcePost.image_urls || []);
        setWomenOnly(sourcePost.women_only || false);
        setIsFeatured(false);
        setLocationLabel(sourcePost.location_label || '');
        setCustomLat(sourcePost.lat);
        setCustomLng(sourcePost.lng);
        setStep('form');
        return;
      }

      async function loadRemoteRepost() {
        try {
          const { data } = await supabase.from('posts').select('*').eq('id', repostId).maybeSingle();
          if (data) {
            setSelectedCategory(data.category);
            setTitle(data.title);
            setDescription(data.description || '');
            setFormData(data.metadata || {});
            setImageUrls(data.image_urls || []);
            setWomenOnly(data.women_only || false);
            setIsFeatured(false);
            setLocationLabel(data.location_label || '');
            setCustomLat(data.lat);
            setCustomLng(data.lng);
            setStep('form');
          }
        } catch {}
      }
      loadRemoteRepost();
      return;
    }

    if (!editId) {
      const catQuery = searchParams.get('category');
      if (catQuery && CATEGORY_MAP[catQuery]) {
        selectCategory(catQuery);
      } else {
        setStep('category');
        setSelectedCategory(null);
      }
      return;
    }

    async function loadPostToEdit() {
      const { data } = await supabase.from('posts').select('*').eq('id', editId).maybeSingle();
      if (data) {
        setSelectedCategory(data.category);
        setTitle(data.title);
        setDescription(data.description || '');
        setFormData(data.metadata || {});
        setImageUrls(data.image_urls || []);
        setWomenOnly(data.women_only || false);
        setIsFeatured(data.is_featured || false);
        setLocationLabel(data.location_label || '');
        setCustomLat(data.lat);
        setCustomLng(data.lng);
        if (data.scheduled_for) {
          setIsScheduled(true);
          const d = new Date(data.scheduled_for);
          setScheduledDate(d.toISOString().split('T')[0]);
          setScheduledTime(d.toTimeString().slice(0, 5));
        }
        setStep('form');
      }
    }
    loadPostToEdit();
  }, [editId, repostId, searchParams, selectCategory]);

  // Handle Undo Timer Countdown
  useEffect(() => {
    if (!undoState?.active) return;

    if (undoState.timeLeft <= 0) {
      // Grace period expired, navigate to post
      navigate(`/post/${undoState.postId}`);
      return;
    }

    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null));
    }, 1000);

    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [undoState, navigate]);

  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    deleteLocalPost(undoState.postId);
    setUndoState(null);
    setStep('form');
  }

  function setFieldValue(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // Handle multi-photo file picker
  function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remainingSlots = 6 - imageUrls.length;
    if (remainingSlots <= 0) {
      setError('Maximum 6 photos allowed per post');
      return;
    }

    const filesToRead = Array.from(files).slice(0, remainingSlots);
    filesToRead.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setImageUrls((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleAddImageUrl() {
    if (!imageUrlInput.trim()) return;
    if (imageUrls.length >= 6) {
      setError('Maximum 6 photos allowed per post');
      return;
    }
    setImageUrls((prev) => [...prev, imageUrlInput.trim()]);
    setImageUrlInput('');
    setError(null);
  }

  function handleSetScheduledPreset(daysAhead: number, defaultHour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setScheduledDate(d.toISOString().split('T')[0]);
    setScheduledTime(`${String(defaultHour).padStart(2, '0')}:00`);
    setIsScheduled(true);
  }

  function validateForm(): boolean {
    if (!selectedCategory) return false;
    const cat = CATEGORY_MAP[selectedCategory];
    if (!cat) return false;

    if (!title.trim()) {
      setError('Please enter a title');
      return false;
    }

    for (const field of cat.fields) {
      if (field.required && !formData[field.key]) {
        setError(`Please fill in: ${field.label}`);
        return false;
      }
    }

    if (cat.requiresPhoto && imageUrls.length === 0) {
      setError('At least one photo is required for this marketplace category');
      return false;
    }

    if (isScheduled) {
      if (!scheduledDate) {
        setError('Please select a scheduled publication date');
        return false;
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`);
      if (scheduledDateTime.getTime() <= Date.now()) {
        setError('Scheduled date & time must be in the future');
        return false;
      }
    }

    setError(null);
    return true;
  }

  function handleGoToPreview() {
    if (validateForm()) {
      setStep('preview');
    }
  }

  async function handleFinalSubmit() {
    const userId = session?.user?.id || profile?.id || 'local-user';
    if (!selectedCategory) return;
    const cat = CATEGORY_MAP[selectedCategory];
    if (!cat) return;

    setSubmitting(true);
    setError(null);

    let lat = customLat ?? coords?.lat;
    let lng = customLng ?? coords?.lng;

    if (!lat || !lng) {
      await requestLocation();
      lat = 24.8607;
      lng = 67.0011;
    }

    const metadata: Record<string, unknown> = {};
    for (const field of cat.fields) {
      if (formData[field.key] !== undefined) {
        metadata[field.key] = formData[field.key];
      }
    }

    const womenOnlyValue = formData['women_only'] as boolean | undefined;
    const finalWomenOnly = womenOnlyValue ?? womenOnly;
    const expiresAt = getExpiryDate(selectedCategory);

    // Compute scheduled_for ISO
    let scheduledForIso: string | null = null;
    if (isScheduled && scheduledDate) {
      scheduledForIso = new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`).toISOString();
    }

    if (editId) {
      try {
        await supabase
          .from('posts')
          .update({
            category: selectedCategory,
            title: title.trim(),
            description: description.trim() || null,
            metadata,
            image_urls: imageUrls,
            lat,
            lng,
            location_label: locationLabel.trim() || null,
            is_featured: isFeatured,
            women_only: finalWomenOnly,
            scheduled_for: scheduledForIso,
          })
          .eq('id', editId);
      } catch {}

      navigate(`/post/${editId}`);
      return;
    }

    let data: any = null;
    try {
      const res = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          category: selectedCategory,
          title: title.trim(),
          description: description.trim() || null,
          metadata,
          image_urls: imageUrls,
          lat,
          lng,
          location_label: locationLabel.trim() || null,
          is_featured: isFeatured,
          women_only: finalWomenOnly,
          expires_at: expiresAt,
          scheduled_for: scheduledForIso,
          reposted_from_id: repostId || null,
        })
        .select('*')
        .maybeSingle();
      data = res.data;
    } catch {}

    const newPostId = data?.id ?? `local-post-${Date.now()}`;
    const newPostItem = {
      id: newPostId,
      user_id: userId,
      category: selectedCategory,
      title: title.trim(),
      description: description.trim() || null,
      metadata,
      image_urls: imageUrls,
      lat,
      lng,
      location_label: locationLabel.trim() || 'Neighborhood Location',
      status: 'active' as const,
      is_featured: isFeatured,
      women_only: finalWomenOnly,
      expires_at: expiresAt,
      scheduled_for: scheduledForIso,
      reposted_from_id: repostId || null,
      confirm_count: 0,
      resolve_count: 0,
      report_count: 0,
      upvotes: 1,
      downvotes: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author_name: profile?.display_name || 'Radar Citizen',
      author_avatar: profile?.avatar_url || null,
      is_bookmarked: false,
      user_vote: 'up' as const,
    };

    saveLocalPost(newPostItem as any);

    if (selectedCategory === 'community_poll' && data && Array.isArray(formData['poll_options'])) {
      const options = formData['poll_options'] as string[];
      const validOptions = options.filter((o) => o.trim());
      if (validOptions.length >= 2) {
        try {
          await supabase
            .from('poll_options')
            .insert(validOptions.map((text) => ({ post_id: data.id, option_text: text.trim() })));
        } catch {}
      }
    }

    setSubmitting(false);
    // Start 10-second Undo grace period
    setUndoState({ active: true, postId: newPostId, timeLeft: 10 });
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfig[]>);

  const cat = selectedCategory ? CATEGORY_MAP[selectedCategory] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'preview') setStep('form');
              else if (step === 'form') {
                setStep('category');
                setSelectedCategory(null);
              } else navigate(-1);
            }}
            className="btn-ghost p-2 -ml-2 rounded-full cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-sm">
            {editId
              ? 'Edit Post'
              : isRepostMode
              ? 'Repost Similar'
              : step === 'category'
              ? 'Choose Category'
              : step === 'form'
              ? cat?.label ?? 'Create Post'
              : 'Review & Confirm'}
          </h1>
          <div className="w-8" />
        </div>
      </div>

      {/* STEP 1: CATEGORY PICKER */}
      {step === 'category' && (
        <div className="px-4 py-4 space-y-6 max-w-lg mx-auto animate-fade-in">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-600/20">
            <h2 className="text-base font-extrabold mb-1">What would you like to broadcast?</h2>
            <p className="text-xs text-primary-100">
              Select a category to reach verified neighbors living around your radar radius.
            </p>
          </div>

          {(Object.keys(grouped) as (keyof typeof GROUP_LABELS)[]).map((groupKey) => (
            <div key={groupKey} className="space-y-2.5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
                {GROUP_LABELS[groupKey]}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {grouped[groupKey].map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => selectCategory(c.slug)}
                      className="card p-3.5 flex items-center gap-3.5 text-left hover:border-primary-500 hover:shadow-md transition-all active:scale-98 group cursor-pointer"
                    >
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${c.bgColor}`}>
                        <Icon size={20} className={c.textColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-primary-600">
                            {c.label}
                          </span>
                          {c.isHighRisk && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                              <ShieldCheck size={10} /> Safe Trade
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {c.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP 2: POST DETAILS FORM */}
      {step === 'form' && cat && (
        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto animate-fade-in">
          {/* Repost Banner */}
          {isRepostMode && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
              <Repeat2 size={18} className="shrink-0 mt-0.5 text-indigo-600" />
              <div>
                <span className="font-bold block">Reposting Similar Shortcut</span>
                <span>Pre-filled from previous post. You can update any fields or photos and post it fresh to your neighborhood radar!</span>
              </div>
            </div>
          )}

          {/* Selected Category Header Pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cat.bgColor}`}>
                <cat.icon size={16} className={cat.textColor} />
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-medium">Category</span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{cat.label}</span>
              </div>
            </div>
            <button
              onClick={() => setStep('category')}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="label">
              Post Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a clear, descriptive title..."
              className="input text-sm font-semibold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Details & Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide full details for your neighborhood..."
              className="input min-h-[90px] resize-none"
            />
          </div>

          {/* Category-specific dynamic fields */}
          {cat.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={formData[field.key]}
              onChange={(val) => setFieldValue(field.key, val)}
            />
          ))}

          {/* Location */}
          <div>
            <label className="label">Location & Landmark</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Sector, Block, or Landmark name"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={async () => {
                  await requestLocation();
                  setCustomLat(null);
                  setCustomLng(null);
                }}
                className="btn-secondary shrink-0 text-xs flex items-center gap-1 cursor-pointer"
              >
                <MapPin size={14} /> My GPS
              </button>
            </div>
          </div>

          {/* MULTI-PHOTO UPLOAD SUPPORT */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="label mb-0">
                Photos {cat.requiresPhoto ? <span className="text-red-500">* (Required)</span> : '(Optional)'}
              </label>
              <span className="text-[11px] font-semibold text-gray-400">
                {imageUrls.length} / 6 photos
              </span>
            </div>

            {/* Photo Gallery Grid */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative group rounded-2xl overflow-hidden aspect-square border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-primary-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-md hover:bg-red-700 text-xs cursor-pointer transition-transform active:scale-90"
                      title="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {imageUrls.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50/20 text-gray-400 hover:text-primary-600 aspect-square transition-all cursor-pointer"
                  >
                    <Plus size={20} />
                    <span className="text-[10px] font-bold mt-1">Add Photo</span>
                  </button>
                )}
              </div>
            )}

            {/* Upload Buttons & URL Input */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoFiles(e.target.files)}
              />

              {imageUrls.length < 6 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>Upload from Device</span>
                  </button>
                </div>
              )}

              {/* Paste Image URL Fallback */}
              {imageUrls.length < 6 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste web image link..."
                    className="input text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="btn-secondary text-xs font-bold px-3 shrink-0 cursor-pointer"
                  >
                    Add Link
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SCHEDULED / FUTURE POST SETTINGS */}
          <div className="card p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                  <CalendarClock size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">Schedule for Future Date</h4>
                  <p className="text-[11px] text-gray-400">Post goes live at your chosen future date & time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduled(!isScheduled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isScheduled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    isScheduled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {isScheduled && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2.5 animate-fade-in">
                {/* Presets */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSetScheduledPreset(1, 9)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[11px] font-semibold hover:bg-purple-100 cursor-pointer"
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetScheduledPreset(2, 10)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[11px] font-semibold hover:bg-purple-100 cursor-pointer"
                  >
                    In 2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetScheduledPreset(7, 9)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[11px] font-semibold hover:bg-purple-100 cursor-pointer"
                  >
                    Next Week
                  </button>
                </div>

                {/* Date & Time Picker */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Live Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Live Time</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Featured boost toggle */}
          {cat.supportsFeatured && (
            <div className="card p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">Pin to Top of Radar Feed</h4>
                    <p className="text-[11px] text-gray-500">Free neighborhood promotion during launch</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFeatured(!isFeatured)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isFeatured ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      isFeatured ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* IN-APP SAFETY REMINDER FOR HIGH-RISK CATEGORIES */}
          {cat.isHighRisk && cat.safetyTips && (
            <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 text-xs text-sky-800 dark:text-sky-300 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sky-900 dark:text-sky-200">
                <ShieldCheck size={16} className="text-sky-600" />
                <span>Safety Guidelines for {cat.label}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-sky-700 dark:text-sky-400">
                {cat.safetyTips.slice(0, 2).map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Review Button */}
          <button
            type="button"
            onClick={handleGoToPreview}
            className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 cursor-pointer"
          >
            <Eye size={18} />
            <span>Review Post</span>
          </button>
        </div>
      )}

      {/* STEP 3: POST PREVIEW SCREEN */}
      {step === 'preview' && cat && (
        <div className="px-4 py-4 space-y-4 animate-fade-in max-w-lg mx-auto">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Sparkles size={16} />
            <span>Review your post details below before broadcasting:</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-lg border border-gray-200/80 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <Badge category={cat.slug} />
              <div className="flex items-center gap-1.5">
                {isScheduled && (
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                    ⏰ Scheduled for {scheduledDate}
                  </span>
                )}
                {isFeatured && (
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    ★ Featured
                  </span>
                )}
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              {title}
            </h2>

            {description && (
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {description}
              </p>
            )}

            {Object.keys(formData).length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                {Object.entries(formData).map(([k, v]) => {
                  if (!v || typeof v === 'object') return null;
                  return (
                    <span key={k} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium">
                      <strong className="capitalize">{k.replace(/_/g, ' ')}:</strong> {String(v)}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Attached Photo Gallery in Preview */}
            {imageUrls.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-gray-400 block">Attached Photos ({imageUrls.length})</span>
                <div className="grid grid-cols-3 gap-2">
                  {imageUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full aspect-square rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 text-xs text-gray-400 flex items-center gap-1.5">
              <MapPin size={13} className="text-primary-600" />
              <span>{locationLabel || 'Nearby within your radar radius'}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="btn-secondary flex-1 py-3 text-xs font-semibold cursor-pointer"
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{isScheduled ? 'Confirm & Schedule' : 'Confirm & Post Live'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 10-SECOND UNDO GRACE PERIOD BANNER */}
      {undoState?.active && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-slide-up max-w-md mx-auto">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
                {undoState.timeLeft}s
              </div>
              <div>
                <p className="text-xs font-bold">
                  {isScheduled ? 'Post scheduled successfully!' : 'Post published to radar!'}
                </p>
                <p className="text-[11px] opacity-75">
                  {isScheduled ? 'Saved in scheduled queue...' : 'Broadcasting live to neighbors...'}
                </p>
              </div>
            </div>
            <button
              onClick={handleUndo}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Undo2 size={14} />
              <span>Undo</span>
            </button>
          </div>
        </div>
      )}

      {/* First-use Emergency Disclaimer Modal */}
      <Modal
        open={showEmergencyNotice}
        onClose={() => setShowEmergencyNotice(false)}
        title="Emergency Radar Broadcast"
        footer={
          <button
            onClick={() => setShowEmergencyNotice(false)}
            className="btn-danger w-full py-2.5 text-xs font-bold cursor-pointer"
          >
            I Understand, Proceed to Post
          </button>
        }
      >
        <div className="space-y-3 py-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
            <ShieldAlert size={28} />
          </div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Emergency Notice</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Emergency & Blood Need requests are broadcast with top priority across your entire radar radius. Please ensure your contact details and hospital/location details are accurate.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
          {field.helper && <p className="text-xs text-gray-400 mt-1">{field.helper}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input min-h-[80px] resize-none"
          />
        </div>
      );

    case 'number':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="number"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input"
          />
        </div>
      );

    case 'price':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rs</span>
            <input
              type="text"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              className="input pl-9"
            />
          </div>
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input"
          >
            <option value="">Select option...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'toggle':
      return (
        <div className="card p-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            <button
              type="button"
              onClick={() => onChange(!value)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                value ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  value ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      );

    case 'blood_type':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
              <button
                type="button"
                key={bt}
                onClick={() => onChange(bt)}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  value === bt
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'urgency':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Immediate / Surgery', color: 'bg-red-600 text-white' },
              { label: 'Within 2-4 hours', color: 'bg-amber-500 text-white' },
              { label: 'Needed tonight', color: 'bg-emerald-600 text-white' },
            ].map((u) => (
              <button
                type="button"
                key={u.label}
                onClick={() => onChange(u.label)}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  value === u.label ? u.color : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="label">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="input"
          />
        </div>
      );

    case 'poll_options':
      return (
        <PollOptionsField
          value={(value as string[]) ?? []}
          onChange={(val) => onChange(val)}
          required={field.required}
        />
      );

    default:
      return null;
  }
}

function PollOptionsField({
  value,
  onChange,
  required,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  required: boolean;
}) {
  const [options, setOptions] = useState<string[]>(value.length >= 2 ? value : ['', '']);

  useEffect(() => {
    onChange(options);
  }, [options, onChange]);

  function updateOption(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)));
  }

  function addOption() {
    if (options.length < 6) {
      setOptions((prev) => [...prev, '']);
    }
  }

  function removeOption(index: number) {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  }

  return (
    <div>
      <label className="label">
        Poll Options
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="input flex-1"
            />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className="btn-ghost shrink-0 cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button type="button" onClick={addOption} className="btn-ghost mt-2 text-xs font-semibold cursor-pointer">
          + Add option
        </button>
      )}
    </div>
  );
}
