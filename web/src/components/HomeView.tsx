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

const MapView = dynamic(() => import('./MapView'), { ssr: false })

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

type Props = {
  restaurants: Restaurant[]
  userEmail: string
}

export default function HomeView({ restaurants, userEmail }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'map' | 'list'>('map')
  const [filterState, setFilterState] = useState<FilterState>(EMPTY_FILTER)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const filterOptions = getFilterOptions(restaurants)
  const filteredRestaurants = filterRestaurants(restaurants, filterState)
  const activeCount = activeFilterCount(filterState)

  function clearFilters() {
    setFilterState(EMPTY_FILTER)
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
            <span
              className="font-semibold text-base"
              style={{ color: '#C2410C', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              PDX Deliciousness Finder
            </span>
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
                paddingTop: 'calc(52px + env(safe-area-inset-top))',
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
              />
            </div>
          )}

          {/* Filter button — floats top-right, below header, in both views */}
          <FilterButton
            activeCount={activeCount}
            onClick={() => setPopoverOpen((o) => !o)}
          />

          {/* Filter popover */}
          {popoverOpen && (
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
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
