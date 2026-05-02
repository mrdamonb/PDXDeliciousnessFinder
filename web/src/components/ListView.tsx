'use client'

import { useState } from 'react'
import type { Restaurant } from '@/lib/supabase/restaurants'
import RestaurantRow from './RestaurantRow'

type SortOrder = 'alpha' | 'latest'

type Props = {
  restaurants: Restaurant[]
  onSelect: (id: string) => void
  filtersActive: boolean
  onClearFilters: () => void
}

export default function ListView({ restaurants, onSelect, filtersActive, onClearFilters }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('alpha')

  const sorted = [...restaurants].sort((a, b) =>
    sortOrder === 'alpha'
      ? a.name.localeCompare(b.name)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexShrink: 0 }}>
        <SortPill label="A–Z" active={sortOrder === 'alpha'} onClick={() => setSortOrder('alpha')} />
        <SortPill label="Latest" active={sortOrder === 'latest'} onClick={() => setSortOrder('latest')} />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.map((r) => (
          <RestaurantRow key={r.id} restaurant={r} onClick={() => onSelect(r.id)} />
        ))}
      </div>
    </div>
  )
}

function SortPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        border: 'none',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        backgroundColor: active ? '#1C1917' : '#EDE8E3',
        color: active ? '#fff' : '#6B6560',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
