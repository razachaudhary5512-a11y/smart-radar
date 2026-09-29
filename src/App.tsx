import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Radar,
  Map,
  Plus,
  FileText,
  User,
  Search,
  Bookmark,
  Briefcase,
  Droplet,
  Home,
  Wrench,
  CarFront,
  Sparkles,
  SlidersHorizontal,
  X,
  ChevronRight,
  ShieldCheck,
  Grid,
} from 'lucide-react';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { LocationProvider } from '@/lib/location-context';
import { HomeFeed } from '@/screens/HomeFeed';
import { MapView } from '@/screens/MapView';
import { CreatePost } from '@/screens/CreatePost';
import { PostDetail } from '@/screens/PostDetail';
import { Profile } from '@/screens/Profile';
import { MyPosts } from '@/screens/MyPosts';
import { SearchScreen } from '@/screens/SearchScreen';
import { Onboarding } from '@/screens/Onboarding';
import { AdminLogin } from '@/screens/AdminLogin';
import { AdminDashboard } from '@/screens/AdminDashboard';
import { AdminRoute } from '@/components/AdminRoute';

function NavigationBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (location.pathname === '/onboarding') {
    return null;
  }

  // Admin pages have their own layout — hide regular nav bar
  if (location.pathname.startsWith('/admin')) {
    return null;
  }


  const navItems = [
    { to: '/', label: 'Feed', icon: Radar, exact: true },
    { to: '/map', label: 'Map', icon: Map },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/create', label: 'Post', icon: Plus, isAction: true },
    { to: '/my-posts', label: 'My Posts', icon: FileText },
    {
      to: '#more',
      label: 'More',
      icon: Grid,
      isMore: true,
      onClick: () => setShowMoreMenu(true),
    },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const quickShortcuts = [
    {
      label: 'Search & Explore',
      desc: 'Find nearby deals, jobs, services & alerts',
      icon: Search,
      color: 'bg-blue-500 text-white',
      path: '/search',
    },
    {
      label: 'Jobs & Internships',
      desc: 'Local hiring & internship opportunities',
      icon: Briefcase,
      color: 'bg-indigo-600 text-white',
      path: '/create?category=jobs_internships',
    },
    {
      label: 'Safety & Blood Alert',
      desc: 'Urgent emergency requests & blood donation',
      icon: Droplet,
      color: 'bg-red-500 text-white',
      path: '/create?category=blood_request',
    },
    {
      label: 'Rentals & Property',
      desc: 'Browse or post flats, rooms & shops',
      icon: Home,
      color: 'bg-emerald-500 text-white',
      path: '/create?category=property_rent',
    },
    {
      label: 'Home Services',
      desc: 'Electricians, plumbers, AC technicians',
      icon: Wrench,
      color: 'bg-amber-500 text-white',
      path: '/create?category=home_services',
    },
    {
      label: 'Carpool & Transport',
      desc: 'Daily rides and neighborhood carpooling',
      icon: CarFront,
      color: 'bg-sky-500 text-white',
      path: '/create?category=ride_share',
    },
    {
      label: 'Saved Bookmarks',
      desc: 'View bookmarked posts & contacts',
      icon: Bookmark,
      color: 'bg-purple-500 text-white',
      path: '/profile',
    },
    {
      label: 'Radar Settings & Radius',
      desc: 'Adjust scanning distance & notifications',
      icon: SlidersHorizontal,
      color: 'bg-gray-700 text-white',
      path: '/profile',
    },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-t border-gray-200/80 dark:border-gray-800/80 safe-area-bottom shadow-xl">
        <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-between">
          {navItems.map((item) => {
            if (item.isAction) {
              const isActive = location.pathname === '/create';
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center justify-center -mt-6 group px-1"
                  aria-label="Create Post"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-105 active:scale-95 ${
                      isActive
                        ? 'bg-primary-700 text-white ring-4 ring-primary-500/20'
                        : 'bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-primary-600/30'
                    }`}
                  >
                    <item.icon size={22} strokeWidth={2.5} />
                  </div>
                  <span
                    className={`text-[9px] font-bold mt-1 tracking-tight ${
                      isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            }

            if (item.isMore) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center flex-1 py-1 group transition-colors cursor-pointer"
                >
                  <div className="p-1 rounded-xl text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    <item.icon size={18} strokeWidth={2} />
                  </div>
                  <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 tracking-tight">
                    {item.label}
                  </span>
                </button>
              );
            }

            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center flex-1 py-1 group transition-colors"
              >
                <div
                  className={`p-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  }`}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.9} />
                </div>
                <span
                  className={`text-[9px] font-semibold tracking-tight ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 font-bold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* "MORE" BOTTOM DRAWER SHEET */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl p-5 shadow-2xl border-t border-gray-200 dark:border-gray-800 max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <Grid size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Neighborhood Radar Hub</h3>
                  <p className="text-[11px] text-gray-400">All shortcuts, categories & features</p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Shortcuts Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {quickShortcuts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate(item.path);
                  }}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/70 hover:bg-primary-50 dark:hover:bg-primary-950/40 border border-gray-100 dark:border-gray-800/80 transition-all text-left group cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${item.color}`}>
                    <item.icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-gray-900 dark:text-gray-100 group-hover:text-primary-600 block truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-400 line-clamp-1 leading-tight">
                      {item.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowMoreMenu(false)}
              className="w-full py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Close Menu
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased flex flex-col items-center justify-start">
      <div className="w-full max-w-xl md:max-w-2xl min-h-screen bg-white dark:bg-gray-950 flex flex-col shadow-2xl relative overflow-x-hidden border-x border-gray-200/60 dark:border-gray-800/60">
        <main className="flex-1">
          <Routes>
            {/* ── Regular app routes ── */}
            <Route path="/" element={<HomeFeed />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/create" element={<CreatePost />} />
            <Route path="/edit/:id" element={<CreatePost />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/my-posts" element={<MyPosts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* ── Admin routes (item 3) ── */}
            {/* Admin login is always accessible */}
            <Route path="/admin/login" element={<AdminLogin />} />
            {/* Admin dashboard is protected by AdminRoute guard */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            {/* Redirect /admin → /admin/login */}
            <Route path="/admin" element={<AdminLogin />} />

            <Route path="*" element={<HomeFeed />} />
          </Routes>
        </main>
        <NavigationBar />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocationProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </LocationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
