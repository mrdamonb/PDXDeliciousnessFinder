'use client'

import { useEffect, useState } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { Utensils, Wine, Beer, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Restaurant } from '@/lib/supabase/restaurants'
import RestaurantPanel from './RestaurantPanel'

const PORTLAND_CENTER = { lat: 45.5051, lng: -122.6750 }

const STATUS_COLORS: Record<Restaurant['status'], string> = {
  want_to_go: '#D97706',
  been_there: '#16A34A',
  favorite: '#DC2626',
}

const VENUE_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  bar: Wine,
  brewery: Beer,
  food_cart: Store,
}

// Paths computed from the iOS TearDropShape algorithm:
// r = width/2, center = (r, r), d = height - r, tangent angle = asin(r/d)
// Standard 34×42: r=17, d=25, angle=42.84° → tangent points at y=29.46, x=±11.57 from center
const PIN_PATH_STANDARD = 'M 28.57 29.46 A 17 17 0 1 0 5.43 29.46 L 17 42 Z'
// Favorite 38×46:  r=19, d=27, angle=44.68° → tangent points at y=32.52, x=±13.35 from center
const PIN_PATH_FAVORITE = 'M 32.35 32.52 A 19 19 0 1 0 5.65 32.52 L 19 46 Z'

function PinMarker({ restaurant, selected }: { restaurant: Restaurant; selected: boolean }) {
  const isFavorite = restaurant.status === 'favorite'
  const color = STATUS_COLORS[restaurant.status]
  const Icon = VENUE_ICONS[restaurant.venue_type ?? ''] ?? Utensils
  const pinW = isFavorite ? 38 : 34
  const pinH = isFavorite ? 46 : 42
  const pinPath = isFavorite ? PIN_PATH_FAVORITE : PIN_PATH_STANDARD
  // r = circle radius = circle center coordinates — icon sits at (r, r) matching iOS .offset(y:-4)
  const r = pinW / 2

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        transform: selected ? 'scale(1.2)' : 'scale(1)',
        transformOrigin: 'bottom center',
        transition: 'transform 0.1s ease',
      }}
    >
      {/* Red star above Favorites — matches iOS Color.pdxStatusFav */}
      {isFavorite && (
        <span
          style={{
            color: '#DC2626',
            fontSize: 11,
            lineHeight: 1,
            marginBottom: 2,
            textShadow: '0 1px 1px rgba(0,0,0,0.25)',
          }}
        >
          ★
        </span>
      )}

      {/* Pin body + icon */}
      <div style={{ position: 'relative', width: pinW, height: pinH }}>
        <svg
          width={pinW}
          height={pinH}
          viewBox={`0 0 ${pinW} ${pinH}`}
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))', display: 'block' }}
        >
          <path d={pinPath} fill={color} />
          <path d={pinPath} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          {selected && (
            <path d={pinPath} fill="none" stroke="white" strokeWidth="2.5" />
          )}
        </svg>

        {/* Icon centered at circle center (r, r) — matches iOS .offset(y: -4) from frame center */}
        <div
          style={{
            position: 'absolute',
            top: r,
            left: r,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={15} color="white" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}

type Props = {
  filteredRestaurants: Restaurant[]
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onEdit: (id: string) => void
  onDelete: () => void
}

function UserLocationDot() {
  return (
    <>
      <style>{`
        @keyframes pdx-user-pulse {
          0%   { transform: scale(1);   opacity: 0.45; }
          100% { transform: scale(2.6); opacity: 0;    }
        }
      `}</style>
      <div style={{ position: 'relative', width: 18, height: 18 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: '#4285F4',
            animation: 'pdx-user-pulse 2s ease-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: '#4285F4',
            border: '2px solid white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
          }}
        />
      </div>
    </>
  )
}

function LocateMeButton({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap()
  if (!userLocation) return null
  return (
    <button
      onClick={() => {
        map?.panTo(userLocation)
        map?.setZoom(15)
      }}
      aria-label="Zoom to my location"
      style={{
        position: 'absolute',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 8,
        border: 'none',
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      {/* Crosshair / locate icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" fill="#4285F4" fillOpacity="0.2" />
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  )
}

export default function MapView({ filteredRestaurants, selectedId, onSelectId, onEdit, onDelete }: Props) {
  const selected = filteredRestaurants.find((r) => r.id === selectedId) ?? null
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Map
          defaultCenter={PORTLAND_CENTER}
          defaultZoom={12}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? ''}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          onClick={() => onSelectId(null)}
        >
          {filteredRestaurants.map((r) => (
            <AdvancedMarker
              key={r.id}
              position={{ lat: r.latitude, lng: r.longitude }}
              onClick={() => onSelectId(r.id)}
              zIndex={selectedId === r.id ? 10 : 1}
            >
              <PinMarker restaurant={r} selected={selectedId === r.id} />
            </AdvancedMarker>
          ))}

          {userLocation && (
            <AdvancedMarker position={userLocation} zIndex={20}>
              <UserLocationDot />
            </AdvancedMarker>
          )}
        </Map>

        <LocateMeButton userLocation={userLocation} />

        {selected && (
          <RestaurantPanel
            key={selected.id}
            restaurant={selected}
            onClose={() => onSelectId(null)}
            onEdit={() => onEdit(selected.id)}
            onDelete={onDelete}
          />
        )}
      </div>
    </APIProvider>
  )
}
