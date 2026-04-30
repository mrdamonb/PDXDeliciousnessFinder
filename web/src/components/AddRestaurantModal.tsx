'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Utensils, Wine, Beer, Store } from 'lucide-react'
import { searchPlaces, saveRestaurant, type PlaceResult } from '@/app/actions'

type VenueTypeCamel = 'restaurant' | 'bar' | 'brewery' | 'foodCart'
type VenueTypeSnake = 'restaurant' | 'bar' | 'brewery' | 'food_cart'
type Status = 'want_to_go' | 'been_there' | 'favorite'
type PriceRange = '$' | '$$' | '$$$' | '$$$$'

type SearchResult = PlaceResult

type ConfirmState = {
  name: string
  address: string | null
  latitude: number
  longitude: number
  venue_type: VenueTypeSnake | null
  cuisine: string
  price_range: PriceRange | null
  status: Status
}

function venueTypeToDB(v: VenueTypeCamel | null): VenueTypeSnake | null {
  if (v === 'foodCart') return 'food_cart'
  if (v === 'restaurant' || v === 'bar' || v === 'brewery') return v
  return null
}

const VENUE_OPTIONS: { value: VenueTypeSnake; label: string; Icon: typeof Utensils }[] = [
  { value: 'restaurant', label: 'Restaurant', Icon: Utensils },
  { value: 'bar', label: 'Bar', Icon: Wine },
  { value: 'brewery', label: 'Brewery', Icon: Beer },
  { value: 'food_cart', label: 'Food Cart', Icon: Store },
]

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: 'want_to_go', label: 'Want to Go', color: '#D97706' },
  { value: 'been_there', label: 'Been There', color: '#16A34A' },
  { value: 'favorite', label: 'Favorite', color: '#DC2626' },
]

const PRICE_OPTIONS: PriceRange[] = ['$', '$$', '$$$', '$$$$']

const ACCENT = '#C2410C'

type Props = {
  onClose: () => void
  onSaveSuccess: () => void
}

export default function AddRestaurantModal({ onClose, onSaveSuccess }: Props) {
  const [panel, setPanel] = useState<'search' | 'confirm'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeqRef = useRef(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cancel pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runSearch = useCallback(async (q: string) => {
    const seq = ++searchSeqRef.current
    setSearching(true)
    setSearchError(null)
    try {
      const results = await searchPlaces(q)
      if (seq !== searchSeqRef.current) return // stale response
      setResults(results)
    } catch (e) {
      if (seq !== searchSeqRef.current) return
      console.error('[AddRestaurantModal] search error:', e)
      setSearchError('Search failed. Try again.')
      setResults([])
    } finally {
      if (seq === searchSeqRef.current) setSearching(false)
    }
  }, [])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 3) {
      setResults([])
      setSearchError(null)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(q.trim()), 400)
  }

  function selectResult(r: SearchResult) {
    if (r.latitude == null || r.longitude == null) return
    setConfirm({
      name: r.name ?? '',
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      venue_type: venueTypeToDB(r.venueType),
      cuisine: r.cuisine ?? '',
      price_range: r.priceRange,
      status: 'want_to_go',
    })
    setSaveError(null)
    setPanel('confirm')
  }

  async function handleSave() {
    if (!confirm || !confirm.name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveRestaurant({
        name: confirm.name.trim(),
        address: confirm.address,
        latitude: confirm.latitude,
        longitude: confirm.longitude,
        venue_type: confirm.venue_type,
        cuisine: confirm.cuisine.trim() || null,
        price_range: confirm.price_range,
        status: confirm.status,
        city: 'Portland',
      })
      onSaveSuccess()
    } catch (e) {
      console.error('[AddRestaurantModal] save error:', e)
      setSaveError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {panel === 'search' ? (
          <SearchPanel
            query={query}
            inputRef={inputRef}
            onChange={handleQueryChange}
            results={results}
            searching={searching}
            searchError={searchError}
            onSelect={selectResult}
            onClose={onClose}
          />
        ) : confirm ? (
          <ConfirmPanel
            confirm={confirm}
            onChange={setConfirm}
            onBack={() => setPanel('search')}
            onSave={handleSave}
            saving={saving}
            saveError={saveError}
          />
        ) : null}
      </div>
    </div>
  )
}

// ── Search Panel ──────────────────────────────────────────────────────────────

type SearchPanelProps = {
  query: string
  inputRef: React.RefObject<HTMLInputElement>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  results: SearchResult[]
  searching: boolean
  searchError: string | null
  onSelect: (r: SearchResult) => void
  onClose: () => void
}

function SearchPanel({ query, inputRef, onChange, results, searching, searchError, onSelect, onClose }: SearchPanelProps) {
  const showEmpty = !searching && !searchError && query.trim().length >= 3 && results.length === 0
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid #EDE8E3',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, color: '#1C1917' }}>Add Restaurant</span>
        <button onClick={onClose} style={iconBtnStyle} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={onChange}
          placeholder="Search restaurants, bars, food carts…"
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 15,
            border: '1px solid #EDE8E3',
            borderRadius: 10,
            outline: 'none',
            color: '#1C1917',
            backgroundColor: '#FAFAF9',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {searching && (
        <div style={{ padding: '8px 16px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="animate-spin"
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid #EDE8E3',
              borderTopColor: '#C2410C',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, color: '#6B6560' }}>Searching…</span>
        </div>
      )}
      {searchError && (
        <div style={{ padding: '4px 16px 16px', color: '#DC2626', fontSize: 14 }}>{searchError}</div>
      )}
      {showEmpty && (
        <div style={{ padding: '4px 16px 16px', color: '#6B6560', fontSize: 14 }}>No places found.</div>
      )}

      {results.map((r, i) => (
        <SearchResultRow key={`${r.name}-${i}`} result={r} onSelect={() => onSelect(r)} />
      ))}
      {results.length > 0 && <div style={{ height: 8 }} />}
    </>
  )
}

function SearchResultRow({ result, onSelect }: { result: SearchResult; onSelect: () => void }) {
  const hasCoords = result.latitude != null && result.longitude != null
  const venueSnake = venueTypeToDB(result.venueType)
  const option = VENUE_OPTIONS.find(o => o.value === venueSnake)
  const Icon = option?.Icon ?? Utensils
  const venueLabel = option?.label ?? null
  const secondary = [venueLabel, result.priceRange].filter(Boolean).join(' · ')

  return (
    <button
      onClick={hasCoords ? onSelect : undefined}
      disabled={!hasCoords}
      title={hasCoords ? undefined : 'Location data unavailable'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderTop: '1px solid #F5F0EB',
        cursor: hasCoords ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        opacity: hasCoords ? 1 : 0.4,
      }}
    >
      <Icon size={16} color="#A8A09A" strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, color: '#1C1917', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.name ?? '—'}
        </p>
        <p style={{ fontSize: 12, color: '#6B6560', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[result.address, secondary].filter(Boolean).join(' · ')}
          {!hasCoords && ' · No location data'}
        </p>
      </div>
    </button>
  )
}

// ── Confirm Panel ─────────────────────────────────────────────────────────────

type ConfirmPanelProps = {
  confirm: ConfirmState
  onChange: (c: ConfirmState) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
}

function ConfirmPanel({ confirm, onChange, onBack, onSave, saving, saveError }: ConfirmPanelProps) {
  const canSave = confirm.name.trim().length > 0 && !saving

  function set<K extends keyof ConfirmState>(key: K, value: ConfirmState[K]) {
    onChange({ ...confirm, [key]: value })
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 16px 12px',
          borderBottom: '1px solid #EDE8E3',
        }}
      >
        <button onClick={onBack} style={{ ...iconBtnStyle, gap: 4, display: 'flex', alignItems: 'center', color: '#6B6560', fontSize: 14 }} aria-label="Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#1C1917', flex: 1 }}>Add Restaurant</span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Name">
          <input
            value={confirm.name}
            onChange={e => set('name', e.target.value)}
            style={textInputStyle}
          />
        </Field>

        {confirm.address && (
          <Field label="Address">
            <p style={{ fontSize: 14, color: '#6B6560', margin: 0 }}>{confirm.address}</p>
          </Field>
        )}

        <Field label="Venue Type">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {VENUE_OPTIONS.map(({ value, label, Icon }) => {
              const active = confirm.venue_type === value
              return (
                <button
                  key={value}
                  onClick={() => set('venue_type', active ? null : value)}
                  style={pillStyle(active, ACCENT)}
                >
                  <Icon size={12} color={active ? '#fff' : '#6B6560'} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Cuisine (optional)">
          <input
            value={confirm.cuisine}
            onChange={e => set('cuisine', e.target.value)}
            placeholder="e.g. Mexican, Japanese…"
            style={textInputStyle}
          />
        </Field>

        <Field label="Price">
          <div style={{ display: 'flex', gap: 6 }}>
            {PRICE_OPTIONS.map(p => {
              const active = confirm.price_range === p
              return (
                <button
                  key={p}
                  onClick={() => set('price_range', active ? null : p)}
                  style={pillStyle(active, ACCENT)}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Status">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_OPTIONS.map(({ value, label, color }) => {
              const active = confirm.status === value
              return (
                <button
                  key={value}
                  onClick={() => set('status', value)}
                  style={pillStyle(active, color)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        {saveError && (
          <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{saveError}</p>
        )}

        <button
          onClick={onSave}
          disabled={!canSave}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: canSave ? ACCENT : '#D1C9C0',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Save Restaurant'}
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#A8A09A', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
}

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  fontSize: 14,
  border: '1px solid #EDE8E3',
  borderRadius: 8,
  outline: 'none',
  color: '#1C1917',
  backgroundColor: '#FAFAF9',
  boxSizing: 'border-box',
}

function pillStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    backgroundColor: active ? color : '#EDE8E3',
    color: active ? '#fff' : '#6B6560',
  }
}
