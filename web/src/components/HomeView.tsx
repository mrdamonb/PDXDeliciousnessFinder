'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Restaurant } from '@/lib/supabase/restaurants'
import AddRestaurantModal from './AddRestaurantModal'
import {
  type FilterState,
  EMPTY_FILTER,
  activeFilterCount,
  filterRestaurants,
  getFilterOptions,
} from '@/lib/filters'
import UserMenu from './UserMenu'
import FilterButton from './FilterButton'
import FilterPopover from './FilterPopover'
import ListView from './ListView'
import ImportModal from './ImportModal'
import EditRestaurantModal from './EditRestaurantModal'
import HistoryView from './HistoryView'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

// Header is 52px tall; the search row below it is 56px. Content below both
// (list padding, floating filter button, filter popover) reads off these
// exported constants so it stays in sync if either row's height ever changes.
export const HEADER_HEIGHT = 52
export const SEARCH_ROW_HEIGHT = 56
export const TOP_BAR_HEIGHT = HEADER_HEIGHT + SEARCH_ROW_HEIGHT

// Map icon (grid of 4 squares)
function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? '#1C1917' : '#6B6560'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

// List icon (horizontal lines)
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? '#1C1917' : '#6B6560'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

// Journal icon (open book) — third toggle segment, CAP-2
function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? '#1C1917' : '#6B6560'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22.5v-17Z" />
      <path d="M12 3h5.5A2.5 2.5 0 0 1 20 5.5v17A2.5 2.5 0 0 0 17.5 20H12" />
    </svg>
  )
}

// App logo mark — solid pin/marker silhouette, replaces the header wordmark.
function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#C2410C" role="img" aria-label="PDX Deliciousness Finder">
      <title>PDX Deliciousness Finder</title>
      <path d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.5 6.5 12 7.02 12.53a.66.66 0 0 0 .96 0C13 21.5 19.5 15 19.5 9.5 19.5 5.36 16.14 2 12 2z" />
    </svg>
  )
}

type Props = {
  restaurants: Restaurant[]
  userEmail: string
}

export default function HomeView({ restaurants, userEmail }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'map' | 'list' | 'journal'>('map')
  const [filterState, setFilterState] = useState<FilterState>(EMPTY_FILTER)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const filterOptions = getFilterOptions(restaurants)
  const filteredRestaurants = filterRestaurants(restaurants, filterState)
  const activeCount = activeFilterCount(filterState)
  const cuisineSuggestions = Array.from(new Set(restaurants.map((r) => r.cuisine).filter((c): c is string => !!c))).sort()

  function clearFilters() {
    setFilterState((prev) => ({ ...EMPTY_FILTER, query: prev.query }))
  }

  function clearSearch() {
    setFilterState((prev) => ({ ...prev, query: '' }))
  }

  return (
    <div
      className="h-dvh relative overflow-hidden"
      style={{ backgroundColor: '#F7F3EE' }}
    >
      {/* Frosted glass header */}
      <header
        className="absolute top-0 left-0 right-0 backdrop-blur-md"
        style={{
          zIndex: 50,
          backgroundColor: 'rgba(247, 243, 238, 0.88)',
          borderBottom: '1px solid rgba(237, 232, 227, 0.8)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          className="flex items-center justify-between px-4"
          style={{ height: 52 }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <LogoMark />
          </div>

          <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
            {/* Map / List toggle */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#EDE8E3',
                borderRadius: 8,
                padding: 2,
                gap: 0,
              }}
            >
              <button
                onClick={() => setView('map')}
                style={{
                  padding: '14px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: view === 'map' ? 'white' : 'transparent',
                  boxShadow: view === 'map' ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                aria-label="Map view"
              >
                <MapIcon active={view === 'map'} />
              </button>
              <button
                onClick={() => setView('list')}
                style={{
                  padding: '14px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: view === 'list' ? 'white' : 'transparent',
                  boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                aria-label="List view"
              >
                <ListIcon active={view === 'list'} />
              </button>
              <button
                onClick={() => setView('journal')}
                style={{
                  padding: '14px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: view === 'journal' ? 'white' : 'transparent',
                  boxShadow: view === 'journal' ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                aria-label="Journal view"
              >
                <JournalIcon active={view === 'journal'} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserMenu email={userEmail} />
              <button
                onClick={() => setModalOpen(true)}
                disabled={modalOpen}
                aria-label="Add restaurant"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: '#C2410C',
                  color: '#fff',
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: modalOpen ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search row — new row below the header, not inside it (Ask-First zone) */}
      <div
        className="absolute left-0 right-0 backdrop-blur-md"
        style={{
          top: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top))`,
          zIndex: 45,
          height: SEARCH_ROW_HEIGHT,
          backgroundColor: 'rgba(247, 243, 238, 0.88)',
          borderBottom: '1px solid rgba(237, 232, 227, 0.8)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            value={filterState.query}
            onChange={(e) => setFilterState((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Search your places…"
            aria-label="Search your places"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 36px 10px 14px',
              borderRadius: 10,
              border: '1px solid #D1C9C0',
              backgroundColor: 'white',
              fontSize: 14,
              color: '#1C1917',
              outline: 'none',
            }}
          />
          {filterState.query.trim() && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 22,
                height: 22,
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#EDE8E3',
                color: '#6B6560',
                fontSize: 13,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {modalOpen && (
        <AddRestaurantModal
          onClose={() => setModalOpen(false)}
          onSaveSuccess={() => {
            setModalOpen(false)
            router.refresh()
          }}
          onImport={() => {
            setModalOpen(false)
            setImportModalOpen(true)
          }}
          cuisineSuggestions={cuisineSuggestions}
        />
      )}

      {editingId && (() => {
        const editingRestaurant = restaurants.find((r) => r.id === editingId) ?? null
        return editingRestaurant ? (
          <EditRestaurantModal
            restaurant={editingRestaurant}
            onClose={() => setEditingId(null)}
            onSaveSuccess={() => {
              setEditingId(null)
              router.refresh()
            }}
            onDeleteSuccess={() => {
              setEditingId(null)
              setSelectedId(null)
              router.refresh()
            }}
            cuisineSuggestions={cuisineSuggestions}
          />
        ) : null
      })()}

      {importModalOpen && (
        <ImportModal
          onClose={() => setImportModalOpen(false)}
          onSaveSuccess={() => {
            setImportModalOpen(false)
            router.refresh()
          }}
        />
      )}

      {/* Full-bleed content area */}
      <main className="absolute inset-0">
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>

          {view === 'map' && (
            <MapView
              filteredRestaurants={filteredRestaurants}
              restaurants={restaurants}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              onEdit={setEditingId}
              onDelete={() => {
                setSelectedId(null)
                router.refresh()
              }}
            />
          )}

          {view === 'list' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                paddingTop: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top))`,
                backgroundColor: '#F7F3EE',
              }}
            >
              <ListView
                restaurants={filteredRestaurants}
                onSelect={(id) => {
                  setSelectedId(id)
                  setView('map')
                }}
                filtersActive={activeCount > 0}
                onClearFilters={clearFilters}
                query={filterState.query}
                onClearSearch={clearSearch}
              />
            </div>
          )}

          {view === 'journal' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                paddingTop: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top))`,
                backgroundColor: '#F7F3EE',
              }}
            >
              <HistoryView
                onSelectRestaurant={(id) => {
                  setSelectedId(id)
                  setView('map')
                }}
              />
            </div>
          )}

          {/* Filter button — floats top-right, below header. Journal ignores
              filterState entirely (spec: it always shows the full unfiltered
              visit set), so the button would sit there doing nothing — hide
              it there rather than show a control with no effect. */}
          {(view === 'map' || view === 'list') && (
            <FilterButton
              activeCount={activeCount}
              onClick={() => setPopoverOpen((o) => !o)}
            />
          )}

          {/* Filter popover */}
          {(view === 'map' || view === 'list') && popoverOpen && (
            <FilterPopover
              filterState={filterState}
              onFilterChange={setFilterState}
              filterOptions={filterOptions}
              onClose={() => setPopoverOpen(false)}
            />
          )}

          {/* Empty state — map view, zero restaurants */}
          {view === 'map' && restaurants.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 15,
                width: '100%',
                maxWidth: 300,
                padding: '0 24px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(247, 243, 238, 0.97)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 20,
                  padding: '24px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: '0 0 6px' }}>
                  No places saved yet
                </p>
                <p style={{ fontSize: 13, color: '#6B6560', margin: '0 0 16px' }}>
                  Add your favorite Portland restaurants, bars, and food carts.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => setModalOpen(true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#C2410C',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Add your first place
                  </button>
                  <button
                    onClick={() => setImportModalOpen(true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 10,
                      border: '1px solid #D1C9C0',
                      backgroundColor: 'transparent',
                      color: '#6B6560',
                      fontWeight: 500,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Import a list
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resting pill — map view only, no restaurant selected, has restaurants */}
          {view === 'map' && !selectedId && restaurants.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(72px + env(safe-area-inset-bottom))',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(247, 243, 238, 0.92)',
                backdropFilter: 'blur(8px)',
                borderRadius: 999,
                padding: '8px 18px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {activeCount > 0 ? (
                <span style={{ fontSize: 13, color: '#6B6560' }}>
                  <span style={{ fontWeight: 600, color: '#1C1917' }}>{filteredRestaurants.length}</span>
                  {' of '}
                  <span style={{ fontWeight: 600, color: '#1C1917' }}>{restaurants.length}</span>
                  {' places · tap a pin to explore'}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: '#6B6560' }}>
                  <span style={{ fontWeight: 600, color: '#1C1917' }}>{restaurants.length}</span>
                  {' places saved · tap a pin to explore'}
                </span>
              )}
            </div>
          )}

          {/* Map zero-results overlay */}
          {view === 'map' && activeCount > 0 && filteredRestaurants.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                zIndex: 15,
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(247, 243, 238, 0.95)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 16,
                  padding: '16px 24px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  textAlign: 'center',
                }}
              >
                {filterState.query.trim() ? (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1917', marginBottom: 10 }}>
                      No results for &ldquo;{filterState.query.trim()}&rdquo;
                    </p>
                    <button
                      onClick={clearSearch}
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
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1917', marginBottom: 10 }}>
                      No places match these filters
                    </p>
                    <button
                      onClick={clearFilters}
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
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
