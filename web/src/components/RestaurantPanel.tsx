'use client'

import { useState } from 'react'
import { Utensils, UtensilsCrossed, Wine, Beer, Store, MapPin, Globe, FileText, X, ChevronDown } from 'lucide-react'
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
  favorite: 'Favorite ★',
}

const VENUE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  brewery: 'Brewery',
  food_cart: 'Food Cart',
}

const VENUE_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  bar: Wine,
  brewery: Beer,
  food_cart: Store,
}

type Props = {
  restaurant: Restaurant
  onClose: () => void
}

export default function RestaurantPanel({ restaurant, onClose }: Props) {
  const [expanded, setExpanded] = useState(false)
  const statusColor = STATUS_COLORS[restaurant.status]
  const VenueIcon = restaurant.venue_type ? (VENUE_ICONS[restaurant.venue_type] ?? UtensilsCrossed) : null

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-col"
      style={{
        backgroundColor: '#F7F3EE',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.13)',
        zIndex: 10,
        height: expanded ? '60vh' : 180,
        transition: 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center pt-3 pb-1 shrink-0 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        aria-hidden="true"
      >
        <div
          className="w-9 h-1 rounded-full"
          style={{ backgroundColor: '#D1C9C0' }}
        />
      </div>

      {/* Peek row — always visible, tap to expand/collapse */}
      <div
        className="flex items-start justify-between gap-3 px-5 pt-2 pb-3 shrink-0 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <h2
            className="text-xl font-bold leading-tight truncate"
            style={{ color: '#1C1917' }}
          >
            {restaurant.name}
          </h2>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="px-2.5 py-1 rounded-full text-white text-xs font-semibold tracking-wide shrink-0"
              style={{ backgroundColor: statusColor }}
            >
              {STATUS_LABELS[restaurant.status]}
            </span>

            {(VenueIcon || restaurant.price_range) && (
              <div
                className="flex items-center gap-1.5 text-sm"
                style={{ color: '#6B6560' }}
              >
                {VenueIcon && (
                  <>
                    <VenueIcon size={13} strokeWidth={2} />
                    <span>{VENUE_LABELS[restaurant.venue_type!] ?? restaurant.venue_type}</span>
                  </>
                )}
                {VenueIcon && restaurant.price_range && <span>·</span>}
                {restaurant.price_range && (
                  <span className="font-semibold" style={{ color: '#1C1917' }}>
                    {restaurant.price_range}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          {expanded && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(false)
              }}
              className="p-1.5 rounded-lg transition-opacity hover:opacity-60"
              style={{ color: '#6B6560' }}
              aria-label="Collapse panel"
            >
              <ChevronDown size={18} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-60"
            style={{ color: '#6B6560' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Expanded detail — scrollable */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-6"
        style={{
          opacity: expanded ? 1 : 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: expanded ? 'auto' : 'none',
        }}
      >
        {(restaurant.cuisine || restaurant.address || restaurant.neighborhood || restaurant.website) && (
          <div
            className="bg-white rounded-2xl overflow-hidden mb-3"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            {restaurant.cuisine && (
              <DetailRow
                icon={<UtensilsCrossed size={14} strokeWidth={2} style={{ color: '#A8A09A' }} />}
                label="Cuisine"
                value={restaurant.cuisine}
              />
            )}
            {restaurant.address && (
              <DetailRow
                icon={<MapPin size={14} strokeWidth={2} style={{ color: '#A8A09A' }} />}
                label="Address"
                value={restaurant.address}
              />
            )}
            {restaurant.neighborhood && (
              <DetailRow
                icon={<MapPin size={14} strokeWidth={2} style={{ color: '#A8A09A' }} />}
                label="Neighborhood"
                value={restaurant.neighborhood}
              />
            )}
            {restaurant.website && (
              <div
                className="flex items-start gap-3 px-4 py-3 border-t first:border-t-0"
                style={{ borderColor: '#F0EBE5' }}
              >
                <Globe size={14} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: '#A8A09A' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Website</p>
                  <a
                    href={restaurant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium truncate block transition-opacity hover:opacity-70"
                    style={{ color: '#C2410C' }}
                  >
                    {restaurant.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {restaurant.general_note && (
          <div
            className="bg-white rounded-2xl p-4"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} strokeWidth={2} style={{ color: '#A8A09A' }} />
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#A8A09A' }}
              >
                Note
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#1C1917' }}>
              {restaurant.general_note}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-t first:border-t-0"
      style={{ borderColor: '#F0EBE5' }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: '#1C1917' }}>
          {value}
        </p>
      </div>
    </div>
  )
}
