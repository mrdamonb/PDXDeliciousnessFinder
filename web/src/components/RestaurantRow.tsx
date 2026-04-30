'use client'

import { Utensils, Wine, Beer, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Restaurant } from '@/lib/supabase/restaurants'

const STATUS_COLORS: Record<Restaurant['status'], string> = {
  want_to_go: '#D97706',
  been_there: '#16A34A',
  favorite: '#DC2626',
}

const STATUS_LABELS: Record<Restaurant['status'], string> = {
  want_to_go: 'Want to Go',
  been_there: 'Been There',
  favorite: 'Favorite',
}

const VENUE_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  bar: Wine,
  brewery: Beer,
  food_cart: Store,
}

const VENUE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  brewery: 'Brewery',
  food_cart: 'Food Cart',
}

type Props = {
  restaurant: Restaurant
  onClick: () => void
}

export default function RestaurantRow({ restaurant, onClick }: Props) {
  const Icon = VENUE_ICONS[restaurant.venue_type ?? ''] ?? Utensils
  const statusColor = STATUS_COLORS[restaurant.status]
  const venueLabel = VENUE_LABELS[restaurant.venue_type ?? ''] ?? restaurant.venue_type

  const meta = [restaurant.cuisine, restaurant.neighborhood].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        minHeight: 64,
        padding: '12px 16px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid #F0EBE5',
        cursor: 'pointer',
        textAlign: 'left',
        gap: 12,
      }}
    >
      {/* Left: icon + name stack */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <Icon size={16} color="#A8A09A" strokeWidth={2} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: '#1C1917',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {restaurant.name}
          </p>
          {(venueLabel || meta) && (
            <p
              style={{
                fontSize: 12,
                color: '#6B6560',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {[venueLabel, meta].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Right: status dot + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: '#6B6560', whiteSpace: 'nowrap' }}>
          {STATUS_LABELS[restaurant.status]}
        </span>
      </div>
    </button>
  )
}
