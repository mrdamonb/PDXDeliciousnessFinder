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
  query: string
  onClearSearch: () => void
  // Space the floating view pill covers at the top of the scroll area. Rows
  // scroll up under it; at rest, the sort row sits just below it.
  topInset?: number
}

export default function ListView({ restaurants, onSelect, filtersActive, onClearFilters, query, onClearSearch, topInset = 0 }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('alpha')

  const sorted = [...restaurants].sort((a, b) =>
    sortOrder === 'alpha'
      ? a.name.localeCompare(b.name)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (sorted.length === 0) {
    const trimmedQuery = query.trim()
    const searchActive = trimmedQuery.length > 0
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          boxSizing: 'border-box',
          paddingTop: topInset,
          gap: 12,
          color: '#6B6560',
        }}
      >
        {searchActive ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 500 }}>No results for &ldquo;{trimmedQuery}&rdquo;</p>
            <button
              onClick={onClearSearch}
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
              Clear search
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    )
  }

  // One scroll container, sort row included: it scrolls away with the rows so
  // they can pass up under HomeView's opaque pill band (header 1c) instead of
  // being clipped below a fixed sort row.
  return (
    <div style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', paddingTop: topInset }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px' }}>
        <SortPill label="A–Z" active={sortOrder === 'alpha'} onClick={() => setSortOrder('alpha')} />
        <SortPill label="Latest" active={sortOrder === 'latest'} onClick={() => setSortOrder('latest')} />
      </div>
      {sorted.map((r) => (
        <RestaurantRow key={r.id} restaurant={r} onClick={() => onSelect(r.id)} />
      ))}
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
