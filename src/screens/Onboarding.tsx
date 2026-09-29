import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, MapPin, User, ArrowRight, ShieldCheck, Sparkles, Check, Phone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location-context';

type Step = 1 | 2 | 3;

export function Onboarding() {
  const { updateProfile } = useAuth();
  const { requestLocation } = useLocation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setLoading(true);
      await requestLocation();
      setLoading(false);
      setStep(3);
      return;
    }

    if (step === 3) {
      if (displayName.trim()) {
        await updateProfile({
          display_name: displayName.trim(),
          phone: phone.trim() || '+92 300 1234567',
        });
      }
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-800 to-indigo-950 text-white flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 pt-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-300 ${
              step === s ? 'w-8 bg-white' : 'w-2 bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Screen 1: Welcome & Value */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fade-in">
          <div className="relative mb-8">
            <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl shadow-primary-900/50">
              <Radar size={56} className="text-white animate-spin-slow" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
              Live
            </div>
          </div>

          <h1 className="text-3xl font-black mb-3 tracking-tight">Smart Radar</h1>
          <p className="text-base text-primary-100 max-w-xs font-medium leading-relaxed">
            Everything happening within 1–10 km of you — alerts, deals, jobs, services & carpools. Follow distant areas up to 20 km via Watch Areas.
          </p>
        </div>
      )}

      {/* Screen 2: Hyperlocal Location */}
      {step === 2 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fade-in">
          <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl mb-8 text-primary-200">
            <MapPin size={56} className="text-white animate-bounce" />
          </div>

          <h2 className="text-2xl font-black mb-3">Hyperlocal Radar</h2>
          <p className="text-base text-primary-100 max-w-xs font-medium leading-relaxed">
            Scan verified posts and live alerts in your immediate neighborhood block and sector.
          </p>
        </div>
      )}

      {/* Screen 3: Quick Profile */}
      {step === 3 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fade-in w-full">
          <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl mb-6">
            <User size={48} className="text-white" />
          </div>

          <h2 className="text-2xl font-black mb-2">Neighborhood Identity</h2>
          <p className="text-xs text-primary-100 mb-6">Choose how neighbors see you on the radar</p>

          <div className="w-full space-y-3 mb-4 text-left">
            <div>
              <label className="text-xs font-bold text-primary-200 block mb-1">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Hamza Tariq"
                className="w-full px-4 py-3 rounded-2xl bg-white/15 border border-white/20 text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-primary-200 block mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full px-4 py-3 rounded-2xl bg-white/15 border border-white/20 text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA Button */}
      <div className="pb-4 space-y-2">
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-white text-primary-800 font-extrabold text-sm flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all cursor-pointer"
        >
          {loading ? (
            'Configuring Radar...'
          ) : step === 3 ? (
            <>
              <span>Enter Neighborhood Feed</span>
              <Check size={18} />
            </>
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {step < 3 && (
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 text-xs font-semibold text-primary-200 hover:text-white transition-colors cursor-pointer"
          >
            Skip to feed
          </button>
        )}
      </div>
    </div>
  );
}
