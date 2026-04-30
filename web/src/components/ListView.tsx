'use client'

import type { Restaurant } from '@/lib/supabase/restaurants'
import RestaurantRow from './RestaurantRow'

type Props = {
  restaurants: Restaurant[]
  onSelect: (id: string) => void
  filtersActive: boolean
  onClearFilters: () => void
}

export default function ListView({ restaurants, onSelect, filtersActive, onClearFilters }: Props) {
  const sorted = [...restaurants].sort((a, b) => a.name.localeCompare(b.name))

  if (sorted.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: '#6B6560',
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 500 }}>No places match these filters</p>
        {filtersActive && (
          <button
            onClick={onClearFilters}
            style={{
              background: 'none',
              border: '1px solid #D1C9C0',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 13,
              color: '#6B6560',
              cursor: 'pointer',
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {sorted.map((r) => (
        <RestaurantRow key={r.id} restaurant={r} onClick={() => onSelect(r.id)} />
      ))}
    </div>
  )
}
