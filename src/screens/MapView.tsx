import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Radar,
  SlidersHorizontal,
  Navigation,
  Crosshair,
  Flame,
  Layers,
  MapPin,
  ExternalLink,
  ArrowRight,
  WifiOff,
  X,
  Briefcase,
  Droplet,
  CarFront,
  Wrench,
  Home,
  Tag,
  Vote,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/lib/location-context';
import { CATEGORIES, CATEGORY_MAP, GROUP_LABELS, type CategoryConfig } from '@/lib/categories';
import type { PostWithRelations } from '@/lib/types';
import { haversineKm, formatDistance, isExpired, type Coords } from '@/lib/location';
import { getStoredLocalPosts } from '@/lib/dummy-data';
import { Spinner, EmptyState, Badge, Modal } from '@/components/ui';

// Fix default Leaflet marker assets
delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Cache key for offline support
const MAP_CACHE_KEY = 'smart_radar_map_cached_pins_v3';

// Icon generator for routine vs high-priority emergency pins
function createCustomPin(color: string, isEmergency: boolean, isSelected: boolean): L.DivIcon {
  if (isEmergency) {
    return L.divIcon({
      className: 'emergency-pin',
      html: `
        <div class="relative flex items-center justify-center" style="width: 38px; height: 38px;">
          <div class="absolute inset-0 rounded-full bg-red-500/50 animate-ping"></div>
          <div style="
            width: 36px; height: 36px;
            background: #dc2626;
            border: 3px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(220, 38, 38, 0.6);
            color: white;
            font-size: 16px;
            transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'};
            transition: transform 0.2s ease;
          ">
            🚨
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  return L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="
        position: relative;
        width: 30px; height: 30px;
        transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
        transition: transform 0.2s ease;
      ">
        <div style="
          width: 30px; height: 30px;
          background: ${color};
          border: 2.5px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        "></div>
        <div style="
          position: absolute;
          top: 6px; left: 6px;
          width: 14px; height: 14px;
          background: white;
          border-radius: 50%;
          opacity: 0.9;
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

function createClusterIcon(count: number, hasEmergency: boolean): L.DivIcon {
  const bgGradient = hasEmergency
    ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
    : 'linear-gradient(135deg, #2563eb, #4f46e5)';

  return L.divIcon({
    className: 'custom-cluster-icon',
    html: `
      <div style="
        position: relative;
        width: 44px; height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${hasEmergency ? '<div class="absolute inset-0 rounded-full bg-red-500/40 animate-ping"></div>' : ''}
        <div style="
          width: 40px; height: 40px;
          background: ${bgGradient};
          color: white;
          font-weight: 700;
          font-size: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        ">
          ${count}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

// Map event listener for tracking zoom and bounds for clustering
function MapZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  return null;
}

// Recenter handler component
function RecenterOnUser({ coords, shouldRecenter, onDone }: { coords: Coords; shouldRecenter: boolean; onDone: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (shouldRecenter) {
      map.flyTo([coords.lat, coords.lng], 15, { duration: 0.8 });
      onDone();
    }
  }, [shouldRecenter, coords, map, onDone]);
  return null;
}

interface ClusterItem {
  id: string;
  lat: number;
  lng: number;
  isCluster: boolean;
  count: number;
  posts: PostWithRelations[];
  hasEmergency: boolean;
}

export function MapView() {
  const navigate = useNavigate();
  const { coords, radiusKm, setRadiusKm } = useLocation();
  const [posts, setPosts] = useState<PostWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [zoomLevel, setZoomLevel] = useState(14);
  const [selectedPost, setSelectedPost] = useState<PostWithRelations | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(['all']));
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [showRadiusModal, setShowRadiusModal] = useState(false);
  const [triggerRecenter, setTriggerRecenter] = useState(false);

  // Online / offline event listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPosts = useCallback(async () => {
    if (!coords) return;
    setLoading(true);

    let rawData: PostWithRelations[] = [];
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        rawData = data as PostWithRelations[];
      }
    } catch {
      // Fallback
    }

    const localList = getStoredLocalPosts();
    const allCombined = [...localList, ...rawData];

    // Deduplicate by ID, exclude expired, and exclude future scheduled posts
    const seenIds = new Set<string>();
    const uniquePosts: PostWithRelations[] = [];
    const now = Date.now();
    for (const p of allCombined) {
      const isFuture = p.scheduled_for && new Date(p.scheduled_for).getTime() > now;
      if (!seenIds.has(p.id) && !isExpired(p) && !isFuture) {
        seenIds.add(p.id);
        uniquePosts.push(p);
      }
    }

    // Radius filter
    const radiusFiltered = uniquePosts.filter((p) => {
      const dist = haversineKm(coords, { lat: p.lat, lng: p.lng });
      const catRadius = CATEGORY_MAP[p.category]?.defaultRadiusKm ?? radiusKm;
      const effectiveRadius = Math.min(catRadius, radiusKm);
      return dist <= effectiveRadius;
    });

    if (radiusFiltered.length > 0) {
      // Cache valid loaded pins for offline usage
      try {
        localStorage.setItem(MAP_CACHE_KEY, JSON.stringify(radiusFiltered));
      } catch {}
      setPosts(radiusFiltered);
    } else if (isOffline) {
      // Read from offline cache
      try {
        const cached = localStorage.getItem(MAP_CACHE_KEY);
        if (cached) {
          setPosts(JSON.parse(cached));
        }
      } catch {}
    } else {
      setPosts([]);
    }

    setLoading(false);
  }, [coords, radiusKm, isOffline]);

  // Live-updating pins on window storage events & periodic interval
  useEffect(() => {
    loadPosts();
    const handleStorageUpdate = () => loadPosts();
    window.addEventListener('smart_radar_posts_updated', handleStorageUpdate);

    // Live update interval (polls every 5s for auto-expiry & new posts)
    const interval = setInterval(() => {
      loadPosts();
    }, 5000);

    return () => {
      window.removeEventListener('smart_radar_posts_updated', handleStorageUpdate);
      clearInterval(interval);
    };
  }, [loadPosts]);

  // Layer toggling helper
  const toggleLayer = (key: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (key === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) return new Set(['all']);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Filter posts based on active layer categories
  const filteredPosts = useMemo(() => {
    if (activeLayers.has('all')) return posts;
    return posts.filter((p) => {
      const cat = CATEGORY_MAP[p.category];
      if (!cat) return false;
      return activeLayers.has(p.category) || activeLayers.has(cat.group);
    });
  }, [posts, activeLayers]);

  // Calculate clusters based on proximity and current zoom level
  const clustersAndPins = useMemo<ClusterItem[]>(() => {
    if (filteredPosts.length === 0) return [];
    // At higher zoom levels (zoom >= 16), split all clusters into individual pins
    if (zoomLevel >= 16) {
      return filteredPosts.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        isCluster: false,
        count: 1,
        posts: [p],
        hasEmergency: p.category === 'urgent_blood' || p.category === 'traffic_alert',
      }));
    }

    // Proximity threshold scaled by zoom
    const thresholdDeg = 0.045 / Math.pow(2, zoomLevel - 11);
    const visited = new Set<string>();
    const result: ClusterItem[] = [];

    for (let i = 0; i < filteredPosts.length; i++) {
      const current = filteredPosts[i];
      if (visited.has(current.id)) continue;

      const clusterPosts: PostWithRelations[] = [current];
      visited.add(current.id);

      for (let j = i + 1; j < filteredPosts.length; j++) {
        const other = filteredPosts[j];
        if (visited.has(other.id)) continue;

        const dLat = Math.abs(current.lat - other.lat);
        const dLng = Math.abs(current.lng - other.lng);

        if (dLat < thresholdDeg && dLng < thresholdDeg) {
          clusterPosts.push(other);
          visited.add(other.id);
        }
      }

      if (clusterPosts.length > 1) {
        // Compute centroid
        const avgLat = clusterPosts.reduce((sum, p) => sum + p.lat, 0) / clusterPosts.length;
        const avgLng = clusterPosts.reduce((sum, p) => sum + p.lng, 0) / clusterPosts.length;
        const hasEmergency = clusterPosts.some((p) => p.category === 'urgent_blood' || p.category === 'traffic_alert');

        result.push({
          id: `cluster-${current.id}-${clusterPosts.length}`,
          lat: avgLat,
          lng: avgLng,
          isCluster: true,
          count: clusterPosts.length,
          posts: clusterPosts,
          hasEmergency,
        });
      } else {
        result.push({
          id: current.id,
          lat: current.lat,
          lng: current.lng,
          isCluster: false,
          count: 1,
          posts: [current],
          hasEmergency: current.category === 'urgent_blood' || current.category === 'traffic_alert',
        });
      }
    }

    return result;
  }, [filteredPosts, zoomLevel]);

  // Safety & Emergency alerts for Heatmap mode
  const heatmapAlertPosts = useMemo(() => {
    return posts.filter(
      (p) =>
        p.category === 'urgent_blood' ||
        p.category === 'traffic_alert' ||
        CATEGORY_MAP[p.category]?.group === 'emergency'
    );
  }, [posts]);

  if (!coords) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-950">
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className="relative h-screen pb-16 flex flex-col overflow-hidden">
      {/* Top Map Control Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800 shadow-sm">
        <div className="px-4 pt-3 pb-2.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-md shadow-primary-500/20">
                <Radar size={18} className="animate-spin-slow" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">Radar Map</h1>
                <p className="text-[10px] text-gray-500 font-medium">Live Hyperlocal Density</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Heatmap Mode Toggle */}
              <button
                onClick={() => setHeatmapMode(!heatmapMode)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                  heatmapMode
                    ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-red-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
                title="Toggle Safety Alert Heatmap Overlay"
              >
                <Flame size={14} className={heatmapMode ? 'animate-bounce' : ''} />
                <span>{heatmapMode ? 'Heatmap' : 'Pins'}</span>
              </button>

              {/* Radius Filter Button */}
              <button
                onClick={() => setShowRadiusModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-200/60 dark:border-primary-800/60 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center gap-1"
                title="Change Radius"
              >
                <SlidersHorizontal size={13} />
                <span>{radiusKm}km</span>
              </button>
            </div>
          </div>

          {/* Category Filter Layer Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              onClick={() => toggleLayer('all')}
              className={`chip px-3 py-1 rounded-full font-semibold transition-all ${
                activeLayers.has('all')
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              All ({posts.length})
            </button>
            <button
              onClick={() => toggleLayer('emergency')}
              className={`chip px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-all ${
                activeLayers.has('emergency') || activeLayers.has('urgent_blood')
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
              }`}
            >
              <Droplet size={12} />
              <span>Safety & Blood</span>
            </button>
            <button
              onClick={() => toggleLayer('jobs')}
              className={`chip px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-all ${
                activeLayers.has('jobs') || activeLayers.has('jobs_internships')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
              }`}
            >
              <Briefcase size={12} />
              <span>Jobs</span>
            </button>
            <button
              onClick={() => toggleLayer('rentals')}
              className={`chip px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-all ${
                activeLayers.has('rentals') || activeLayers.has('property_rent')
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Home size={12} />
              <span>Rentals</span>
            </button>
            <button
              onClick={() => toggleLayer('services')}
              className={`chip px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-all ${
                activeLayers.has('services') || activeLayers.has('home_services')
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
              }`}
            >
              <Wrench size={12} />
              <span>Services</span>
            </button>
            <button
              onClick={() => toggleLayer('transport')}
              className={`chip px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-all ${
                activeLayers.has('transport') || activeLayers.has('ride_share')
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
              }`}
            >
              <CarFront size={12} />
              <span>Carpool</span>
            </button>
          </div>
        </div>

        {/* Offline cached indicator banner */}
        {isOffline && (
          <div className="bg-amber-500 text-white px-4 py-1 text-[11px] font-medium flex items-center justify-center gap-1.5">
            <WifiOff size={13} />
            <span>Showing last available cached radar data (Offline mode)</span>
          </div>
        )}
      </div>

      {/* Map Content */}
      {loading && posts.length === 0 ? (
        <div className="flex-1 flex justify-center items-center">
          <Spinner size={36} />
        </div>
      ) : (
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={14}
          className="flex-1 w-full z-0"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
          />

          <MapZoomTracker onZoomChange={setZoomLevel} />
          <RecenterOnUser
            coords={coords}
            shouldRecenter={triggerRecenter}
            onDone={() => setTriggerRecenter(false)}
          />

          {/* User Location Radar Radius Circle */}
          <Circle
            center={[coords.lat, coords.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.07,
              weight: 1.8,
              dashArray: '6 6',
            }}
          />

          {/* User Location Center Marker */}
          <Marker
            position={[coords.lat, coords.lng]}
            icon={L.divIcon({
              className: 'user-radar-pin',
              html: `
                <div class="relative flex items-center justify-center" style="width: 24px; height: 24px;">
                  <div class="absolute inset-0 rounded-full bg-primary-500/40 animate-ping"></div>
                  <div style="
                    width: 16px; height: 16px;
                    background: #2563eb;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.3);
                  "></div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          />

          {/* HEATMAP MODE OVERLAY */}
          {heatmapMode && (
            <>
              {heatmapAlertPosts.map((p) => (
                <Circle
                  key={`heat-${p.id}`}
                  center={[p.lat, p.lng]}
                  radius={800}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#dc2626',
                    fillOpacity: 0.28,
                    weight: 2,
                  }}
                />
              ))}
              {heatmapAlertPosts.map((p) => (
                <Circle
                  key={`heat-core-${p.id}`}
                  center={[p.lat, p.lng]}
                  radius={350}
                  pathOptions={{
                    color: '#f59e0b',
                    fillColor: '#ea580c',
                    fillOpacity: 0.55,
                    weight: 1,
                  }}
                />
              ))}
            </>
          )}

          {/* TRANSPORT ROUTE PREVIEW POLYLINE */}
          {selectedPost && (selectedPost.category === 'ride_share' || selectedPost.category === 'traffic_alert') && (
            <>
              <Polyline
                positions={[
                  [selectedPost.lat, selectedPost.lng],
                  [selectedPost.lat + 0.012, selectedPost.lng + 0.015],
                ]}
                pathOptions={{
                  color: '#0284c7',
                  weight: 4,
                  dashArray: '8, 8',
                  opacity: 0.9,
                }}
              />
              <Marker
                position={[selectedPost.lat + 0.012, selectedPost.lng + 0.015]}
                icon={L.divIcon({
                  className: 'dest-pin',
                  html: `
                    <div style="
                      background: #0284c7;
                      color: white;
                      font-size: 10px;
                      font-weight: 700;
                      padding: 2px 6px;
                      border-radius: 6px;
                      border: 2px solid white;
                      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                      white-space: nowrap;
                    ">
                      🏁 Dropoff Point
                    </div>
                  `,
                  iconSize: [80, 24],
                  iconAnchor: [40, 12],
                })}
              />
            </>
          )}

          {/* PINS & CLUSTER RENDERING */}
          {!heatmapMode &&
            clustersAndPins.map((item) => {
              if (item.isCluster) {
                return (
                  <Marker
                    key={item.id}
                    position={[item.lat, item.lng]}
                    icon={createClusterIcon(item.count, item.hasEmergency)}
                    eventHandlers={{
                      click: () => {
                        // Zoom in to split cluster
                        setZoomLevel((prev) => Math.min(prev + 2, 17));
                        setTriggerRecenter(true);
                      },
                    }}
                  />
                );
              }

              const post = item.posts[0];
              const cat = CATEGORY_MAP[post.category];
              const isEmergency = post.category === 'urgent_blood' || cat?.group === 'emergency';
              const color = cat?.color ?? '#2563eb';
              const isSelected = selectedPost?.id === post.id;

              return (
                <Marker
                  key={post.id}
                  position={[post.lat, post.lng]}
                  icon={createCustomPin(color, isEmergency, isSelected)}
                  eventHandlers={{
                    click: () => {
                      setSelectedPost(post);
                    },
                  }}
                />
              );
            })}
        </MapContainer>
      )}

      {/* Floating Recenter GPS Button */}
      <div className="absolute bottom-20 right-4 z-[999] flex flex-col gap-2">
        <button
          onClick={() => setTriggerRecenter(true)}
          className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-xl border border-gray-200/90 dark:border-gray-800 flex items-center justify-center hover:bg-primary-50 dark:hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          title="Recenter to my location"
        >
          <Crosshair size={22} />
        </button>
      </div>

      {/* TAP-TO-PREVIEW FLOATING CARD */}
      {selectedPost && (
        <div className="absolute bottom-20 left-4 right-18 z-[999] animate-slide-up">
          <div className="bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl rounded-2xl p-3.5 shadow-2xl border border-gray-200/90 dark:border-gray-800">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: CATEGORY_MAP[selectedPost.category]?.color || '#2563eb' }}
                />
                <Badge category={selectedPost.category} />
                <span className="text-[11px] text-gray-500 font-medium">
                  {formatDistance(haversineKm(coords, { lat: selectedPost.lat, lng: selectedPost.lng }))} away
                </span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3 mt-2.5">
              {selectedPost.image_urls && selectedPost.image_urls[0] && (
                <img
                  src={selectedPost.image_urls[0]}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-800 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {selectedPost.title}
                </h3>
                {selectedPost.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                    {selectedPost.description}
                  </p>
                )}
                {selectedPost.location_label && (
                  <p className="text-[11px] text-primary-600 dark:text-primary-400 flex items-center gap-1 mt-1 truncate">
                    <MapPin size={11} /> {selectedPost.location_label}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPost.lat},${selectedPost.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation size={13} />
                <span>Directions</span>
              </a>

              <button
                onClick={() => navigate(`/post/${selectedPost.id}`)}
                className="flex-1 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-primary-600/30 transition-colors"
              >
                <span>View Details</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no pins match within radius */}
      {!loading && filteredPosts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
          <div className="pointer-events-auto max-w-xs mx-auto text-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-800">
            <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 flex items-center justify-center mx-auto mb-3">
              <Radar size={24} />
            </div>
            <h3 className="font-bold text-sm mb-1">No Posts in this Area</h3>
            <p className="text-xs text-gray-500 mb-4">
              Try increasing your radar radius or turn on other category layers.
            </p>
            <button
              onClick={() => setRadiusKm(10)}
              className="btn-primary w-full py-2 text-xs font-semibold"
            >
              Expand Radar to 10 km
            </button>
          </div>
        </div>
      )}

      {/* Radius adjustment modal */}
      <Modal
        open={showRadiusModal}
        onClose={() => setShowRadiusModal(false)}
        title="Map Radar Radius"
        footer={
          <button onClick={() => setShowRadiusModal(false)} className="btn-primary w-full py-2.5">
            Apply Radius ({radiusKm} km)
          </button>
        }
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adjust how far your map radar scans for posts, listings, and services:
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
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-full accent-primary-600 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
          />
          <div className="flex justify-between text-xs text-gray-400 font-medium">
            <span>1 km (Immediate block)</span>
            <span>5 km (Sector)</span>
            <span>10 km (Wide Area)</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
