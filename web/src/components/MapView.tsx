'use client'

import { useEffect, useState } from 'react'
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'
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
            <AdvancedMarker position={userLocation} zIndex={0}>
              <UserLocationDot />
            </AdvancedMarker>
          )}
        </Map>

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
