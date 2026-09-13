'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { Restaurant } from '@/lib/supabase/restaurants'
import pdxLogo from '@/assets/pdx-logo.png'
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

// One 64px bar (logo badge, search, avatar) replaces the old 52px header and
// 56px search row. Below it floats a row holding the Map/List/Journal pill
// and, on Map and List, the Filter chip (header 1c, step 2a:
// _bmad-output/planning-artifacts/header-1c-decisions.md). Content below
// (list/journal insets, filter popover) reads off these exported constants so
// it stays in sync if either ever changes.
export const BAR_HEIGHT = 64
const PILL_ROW_GAP = 12
const PILL_HEIGHT = 48
// The band the pill row occupies under the bar. On List and Journal it is
// opaque, rows scroll up under it, and Journal month headers stick at its
// bottom edge.
export const PILL_BAND_HEIGHT = PILL_ROW_GAP + PILL_HEIGHT

type View = 'map' | 'list' | 'journal'

const VIEWS: { value: View; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
  { value: 'journal', label: 'Journal' },
]

// Magnifier for the search field
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A8A09A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

// App logo — the full "PDX" pin in a cream badge (header 1c, step 1:
// _bmad-output/planning-artifacts/header-1c-decisions.md). The solid badge
// gives the mark an opaque ground so the frosted header's blur never sits
// behind its white lettering. Tapping it returns to the map with filters and
// search kept; it also closes any open restaurant panel.
function LogoBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="PDX Deliciousness Finder, back to map"
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F7F3EE',
        border: '1px solid #E0D8D0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Image src={pdxLogo} alt="" height={30} style={{ width: 'auto', height: 30 }} unoptimized priority />
    </button>
  )
}

type Props = {
  restaurants: Restaurant[]
  userEmail: string
}

export default function HomeView({ restaurants, userEmail }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('map')
  const [filterState, setFilterState] = useState<FilterState>(EMPTY_FILTER)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Visits HistoryView is showing (after search), for the "N visits" chip in
  // the pill row. Null while the journal is loading or errored.
  const [visitCount, setVisitCount] = useState<number | null>(null)

  const filterOptions = getFilterOptions(restaurants)
  const filteredRestaurants = filterRestaurants(restaurants, filterState)
  const activeCount = activeFilterCount(filterState)
  const cuisineSuggestions = Array.from(new Set(restaurants.map((r) => r.cuisine).filter((c): c is string => !!c))).sort()
  const searchActive = filterState.query.trim() !== ''

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
      {/* Frosted glass bar: logo badge, search, account */}
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
          className="flex items-center"
          style={{ height: BAR_HEIGHT, padding: '0 14px', gap: 10 }}
        >
          <LogoBadge
            onClick={() => {
              setView('map')
              setSelectedId(null)
            }}
          />

          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              value={filterState.query}
              onChange={(e) => setFilterState((prev) => ({ ...prev, query: e.target.value }))}
              placeholder={view === 'journal' ? 'Search restaurants and notes…' : 'Search your places…'}
              aria-label={view === 'journal' ? 'Search restaurants and notes' : 'Search your places'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                // Right padding only makes room for the clear button when it
                // shows, so an empty field keeps its width for the placeholder.
                padding: searchActive ? '10px 36px 10px 34px' : '10px 14px 10px 34px',
                borderRadius: 999,
                // The query persists across Map/List/Journal, so an active
                // search tints the field: it is never an invisible filter.
                border: `1px solid ${searchActive ? '#C2410C' : '#D1C9C0'}`,
                backgroundColor: 'white',
                fontSize: 14,
                color: '#1C1917',
                outline: 'none',
              }}
            />
            {searchActive && (
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <UserMenu email={userEmail} />
            {/* Stays in the bar for step 2a; step 2b moves it to a floating
                action button. */}
            {view !== 'journal' && (
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
            )}
          </div>
        </div>
      </header>

      {/* Floating view pill, with the Filter chip on Map/List or the visit
          count on Journal. The row itself ignores pointer events so map
          gestures pass through the gap between its two ends. Journal hides
          Filter: it ignores the popover's dimensions (status/venueType/
          neighborhood/cuisine/price) and only consumes filterState.query. */}
      <div
        style={{
          position: 'absolute',
          top: `calc(${BAR_HEIGHT + PILL_ROW_GAP}px + env(safe-area-inset-top))`,
          left: 14,
          right: 14,
          height: PILL_HEIGHT,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <div
          role="group"
          aria-label="View"
          style={{
            display: 'flex',
            height: PILL_HEIGHT,
            boxSizing: 'border-box',
            padding: 1,
            flexShrink: 0,
            backgroundColor: 'rgba(247, 243, 238, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(237, 232, 227, 0.9)',
            borderRadius: 999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            pointerEvents: 'auto',
          }}
        >
          {VIEWS.map(({ value, label }) => {
            const active = view === value
            return (
              <button
                key={value}
                onClick={() => setView(value)}
                aria-pressed={active}
                style={{
                  height: 44,
                  // 12px, not wider: at 320pt (iPhone SE) the pill plus a
                  // Filter chip showing a two-digit count only just fits.
                  padding: '0 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: active ? '#1C1917' : 'transparent',
                  color: active ? '#fff' : '#6B6560',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {(view === 'map' || view === 'list') && (
          <div style={{ pointerEvents: 'auto' }}>
            <FilterButton
              activeCount={activeCount}
              onClick={() => setPopoverOpen((o) => !o)}
            />
          </div>
        )}

        {view === 'journal' && visitCount !== null && (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              backgroundColor: 'rgba(247, 243, 238, 0.92)',
              border: '1px solid rgba(237, 232, 227, 0.9)',
              fontSize: 12,
              color: '#6B6560',
              whiteSpace: 'nowrap',
            }}
          >
            {visitCount} {visitCount === 1 ? 'visit' : 'visits'}
          </div>
        )}
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
                paddingTop: `calc(${BAR_HEIGHT}px + env(safe-area-inset-top))`,
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
                topInset={PILL_BAND_HEIGHT}
              />
            </div>
          )}

          {view === 'journal' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                paddingTop: `calc(${BAR_HEIGHT}px + env(safe-area-inset-top))`,
                backgroundColor: '#F7F3EE',
              }}
            >
              <HistoryView
                restaurants={restaurants}
                onSelectRestaurant={(id) => {
                  setSelectedId(id)
                  setView('map')
                }}
                query={filterState.query}
                onClearSearch={clearSearch}
                topInset={PILL_BAND_HEIGHT}
                onVisibleCountChange={setVisitCount}
              />
            </div>
          )}

          {/* Pill band — List and Journal only. Opaque under the pill so a
              row scrolling up is cut off rather than ghosting through it,
              then a 12px fade into the content. The map keeps the pill
              floating over it with no band. */}
          {(view === 'list' || view === 'journal') && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: `calc(${BAR_HEIGHT}px + env(safe-area-inset-top))`,
                  left: 0,
                  right: 0,
                  height: PILL_BAND_HEIGHT,
                  zIndex: 35,
                  backgroundColor: '#F7F3EE',
                  pointerEvents: 'none',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: `calc(${BAR_HEIGHT + PILL_BAND_HEIGHT}px + env(safe-area-inset-top))`,
                  left: 0,
                  right: 0,
                  height: 12,
                  zIndex: 35,
                  background: 'linear-gradient(to bottom, #F7F3EE, rgba(247, 243, 238, 0))',
                  pointerEvents: 'none',
                }}
              />
            </>
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
