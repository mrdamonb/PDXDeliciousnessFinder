'use client'

import { useEffect, useRef } from 'react'
import type { FilterState, FilterOptions } from '@/lib/filters'

const STATUS_OPTIONS = [
  { value: 'want_to_go', label: 'Want to Go', activeColor: '#F59E0B' },
  { value: 'been_there', label: 'Been There', activeColor: '#16A34A' },
  { value: 'favorite', label: 'Favorite', activeColor: '#DC2626' },
]

const VENUE_OPTIONS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'brewery', label: 'Brewery' },
  { value: 'food_cart', label: 'Food Cart' },
]

const PRICE_OPTIONS = [
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
  { value: '$$$$', label: '$$$$' },
]

const ACCENT = '#C2410C'

type Props = {
  filterState: FilterState
  onFilterChange: (next: FilterState) => void
  filterOptions: FilterOptions
  onClose: () => void
}

export default function FilterPopover({ filterState, onFilterChange, filterOptions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside as EventListener)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside as EventListener)
    }
  }, [onClose])

  function toggle(dimension: keyof FilterState, value: string) {
    const current = filterState[dimension]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onFilterChange({ ...filterState, [dimension]: next })
  }

  function clearAll() {
    onFilterChange({ status: [], venueType: [], neighborhood: [], cuisine: [], price: [] })
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 52,
        left: 16,
        right: 16,
        zIndex: 40,
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
        maxHeight: 'calc(100dvh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable filter sections */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 16px 0' }}>
        <Section label="Status">
          {STATUS_OPTIONS.map(({ value, label, activeColor }) => (
            <Pill
              key={value}
              label={label}
              active={filterState.status.includes(value)}
              activeColor={activeColor}
              onClick={() => toggle('status', value)}
            />
          ))}
        </Section>

        <Section label="Venue Type">
          {VENUE_OPTIONS.map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={filterState.venueType.includes(value)}
              activeColor={ACCENT}
              onClick={() => toggle('venueType', value)}
            />
          ))}
        </Section>

        {filterOptions.neighborhoods.length > 0 && (
          <Section label="Neighborhood">
            {filterOptions.neighborhoods.map((n) => (
              <Pill
                key={n}
                label={n}
                active={filterState.neighborhood.includes(n)}
                activeColor={ACCENT}
                onClick={() => toggle('neighborhood', n)}
              />
            ))}
          </Section>
        )}

        {filterOptions.cuisines.length > 0 && (
          <Section label="Cuisine">
            {filterOptions.cuisines.map((c) => (
              <Pill
                key={c}
                label={c}
                active={filterState.cuisine.includes(c)}
                activeColor={ACCENT}
                onClick={() => toggle('cuisine', c)}
              />
            ))}
          </Section>
        )}

        <Section label="Price">
          {PRICE_OPTIONS.map(({ value, label }) => (
            <Pill
              key={value}
              label={label}
              active={filterState.price.includes(value)}
              activeColor={ACCENT}
              onClick={() => toggle('price', value)}
            />
          ))}
        </Section>
      </div>

      {/* Sticky footer — always visible, never scrolls away */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderTop: '1px solid #F0EBE5',
          flexShrink: 0,
        }}
      >
        <button
          onClick={clearAll}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: '#6B6560',
            padding: 0,
          }}
        >
          Clear all
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: ACCENT,
            padding: 0,
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#A8A09A',
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function Pill({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string
  active: boolean
  activeColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        border: `1.5px solid ${active ? activeColor : '#D1C9C0'}`,
        backgroundColor: active ? activeColor : 'transparent',
        color: active ? 'white' : '#6B6560',
        transition: 'all 0.1s',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  )
}
