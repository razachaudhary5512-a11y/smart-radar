import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { categoryPin, youAreHere } from './pins';
import { TILE_ATTRIBUTION, TILE_URL } from '@/services/maps';
import type { Coords } from '@/lib/types';

interface Props {
  center: Coords;
  category?: string;
  you?: Coords | null;
  zoom?: number;
  className?: string;
  /** Makes the map a location picker. */
  onPick?(c: Coords): void;
  radiusKm?: number;
  interactive?: boolean;
}

function Recenter({ center, zoom }: { center: Coords; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

function Picker({ onPick }: { onPick(c: Coords): void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function MiniMap({ center, category, you, zoom = 15, className, onPick, radiusKm, interactive = true }: Props) {
  return (
    <div className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={false}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <Recenter center={center} zoom={zoom} />
        {radiusKm && <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: '#2549ea', weight: 1.5, fillOpacity: 0.06 }} />}
        {category ? (
          <Marker
            position={[center.lat, center.lng]}
            icon={categoryPin(category, { selected: true })}
            draggable={Boolean(onPick)}
            eventHandlers={onPick ? { dragend: (e) => onPick(e.target.getLatLng()) } : undefined}
          />
        ) : null}
        {you && <Marker position={[you.lat, you.lng]} icon={youAreHere} />}
        {onPick && <Picker onPick={onPick} />}
      </MapContainer>
    </div>
  );
}
