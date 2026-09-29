import { useState } from 'react';
import {
  Zap,
  Construction,
  Siren,
  X,
  CheckCircle2,
  Loader2,
  Info,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';
import { createQuickUrgentPost } from '@/lib/dummy-data';

interface QuickPostWidgetProps {
  onClose: () => void;
  onPosted?: () => void;
}

const QUICK_ACTIONS = [
  {
    id: 'utility_outage' as const,
    icon: Zap,
    label: 'Power / Gas Outage',
    color: 'bg-amber-500',
    ring: 'ring-amber-400/40',
    hoverBg: 'hover:bg-amber-600',
    textColor: 'text-white',
    title: '⚡ Utility Outage Reported',
    description: 'Power or gas supply disruption detected in this area. Neighbors have been alerted.',
    metadata: { type: 'Utility Outage', source: 'Quick Widget', utility: 'Power/Gas' },
  },
  {
    id: 'traffic_alert' as const,
    icon: Construction,
    label: 'Road Block / Traffic Jam',
    color: 'bg-orange-600',
    ring: 'ring-orange-400/40',
    hoverBg: 'hover:bg-orange-700',
    textColor: 'text-white',
    title: '🚧 Road Block / Traffic Alert',
    description: 'A road block or severe traffic disruption has been reported at this location.',
    metadata: { type: 'Traffic Alert', source: 'Quick Widget', severity: 'High' },
  },
  {
    id: 'urgent_blood' as const,
    icon: Siren,
    label: 'Emergency SOS / Urgent Alert',
    color: 'bg-red-600',
    ring: 'ring-red-400/40',
    hoverBg: 'hover:bg-red-700',
    textColor: 'text-white',
    title: '🚨 Emergency SOS Alert',
    description: 'An emergency situation has been reported nearby. Community is being alerted. Please stay safe.',
    metadata: { type: 'Emergency SOS', source: 'Quick Widget', priority: 'CRITICAL' },
  },
];

export function QuickPostWidget({ onClose, onPosted }: QuickPostWidgetProps) {
  const { profile } = useAuth();
  const { coords } = useLocation();
  const [posting, setPosting] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  async function handleQuickPost(action: (typeof QUICK_ACTIONS)[0]) {
    if (!coords) return;
    setPosting(action.id);

    await new Promise((r) => setTimeout(r, 900));

    createQuickUrgentPost({
      category: action.id,
      title: action.title,
      description: action.description,
      coords,
      locationLabel: 'Near Current Location',
      authorName: profile?.display_name || 'Radar Citizen',
      authorAvatar: profile?.avatar_url || null,
      metadata: action.metadata,
    });

    setPosting(null);
    setPosted(action.id);

    setTimeout(() => {
      setPosted(null);
      onPosted?.();
      onClose();
    }, 1600);
  }

  if (showPwaGuide) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl p-6 border-t border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up space-y-4 pb-8">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">Add Smart Radar to Home Screen</h3>
              <p className="text-[11px] text-gray-400">One-tap urgent reporting from your home screen</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                step: '1',
                os: 'Android (Chrome)',
                instruction: 'Tap the ⋮ menu in Chrome → "Add to Home Screen" → Confirm. Smart Radar icon will appear on your home screen.',
              },
              {
                step: '2',
                os: 'iPhone / iPad (Safari)',
                instruction: 'Tap the Share icon (□↑) at the bottom → "Add to Home Screen" → tap "Add". Done!',
              },
            ].map((item) => (
              <div key={item.step} className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    {item.step}
                  </span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.os}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed pl-7">{item.instruction}</p>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/50 text-xs text-primary-700 dark:text-primary-300 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Once installed, tap the Smart Radar icon, and this Quick-Post widget loads instantly — no sign-in needed for urgent alerts.
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowPwaGuide(false)}
              className="flex-1 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Back to Widget
            </button>
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 rounded-2xl bg-primary-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary-700 transition-colors cursor-pointer"
            >
              <ExternalLink size={13} />
              Open in Browser
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl border-t border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="pt-4 pb-3 flex justify-center">
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="px-5 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25">
                <Siren size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-gray-900 dark:text-white">Quick Urgent Report</h2>
                <p className="text-[11px] text-gray-400">1-tap alert • GPS auto-tagged • Goes live instantly</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Widget Preview Phone Card */}
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 50%)' }}
            />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-primary-600 flex items-center justify-center">
                <Siren size={12} className="text-white" />
              </div>
              <span className="text-white font-bold text-xs">Smart Radar Widget</span>
              <span className="ml-auto text-[10px] text-gray-400 font-semibold">Home Screen</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <div
                  key={action.id}
                  className={`${action.color} rounded-xl p-2.5 flex flex-col items-center gap-1.5 shadow-md`}
                >
                  <action.icon size={18} className="text-white" />
                  <span className="text-[9px] font-bold text-white/90 text-center leading-tight">
                    {action.label.split('/')[0].trim()}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2.5 text-center">
              Add to phone home screen for instant one-tap access
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-2.5 mb-4">
            {QUICK_ACTIONS.map((action) => {
              const isPosting = posting === action.id;
              const isDone = posted === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => !posting && !posted && handleQuickPost(action)}
                  disabled={!!posting || !!posted}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl ${action.color} ${action.hoverBg} ring-2 ${action.ring} shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed group`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    {isPosting ? (
                      <Loader2 size={18} className="text-white animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 size={18} className="text-white" />
                    ) : (
                      <action.icon size={18} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-extrabold text-sm text-white block">
                      {isDone ? 'Alert Posted! Neighbors Notified ✓' : action.label}
                    </span>
                    <span className="text-[10px] text-white/70">
                      {isPosting ? 'Posting to neighborhood feed...' : isDone ? 'Visible in local feed immediately' : 'Tap to report instantly • GPS auto-tagged'}
                    </span>
                  </div>
                  {!isPosting && !isDone && (
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <span className="text-white font-extrabold text-xs">→</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* PWA Guide Link */}
          <button
            onClick={() => setShowPwaGuide(true)}
            className="w-full flex items-center gap-2 py-2.5 px-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Smartphone size={14} className="text-primary-600 shrink-0" />
            <span className="font-semibold flex-1 text-left">How to add Smart Radar widget to your home screen</span>
            <ExternalLink size={13} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
