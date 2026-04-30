'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Utensils, UtensilsCrossed, Wine, Beer, Store, MapPin, Globe, FileText, X, ChevronDown, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Restaurant } from '@/lib/supabase/restaurants'
import { getVisitLogs, logVisit, type VisitLog } from '@/app/actions'

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
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const statusColor = STATUS_COLORS[restaurant.status]
  const VenueIcon = restaurant.venue_type ? (VENUE_ICONS[restaurant.venue_type] ?? UtensilsCrossed) : null

  // Visit log state
  const [visits, setVisits] = useState<VisitLog[] | null>(null)
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visitsError, setVisitsError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset visits when restaurant changes so we don't show stale data
  useEffect(() => {
    setVisits(null)
    setVisitsError(null)
    setShowForm(false)
  }, [restaurant.id])

  // Fetch visits once when first expanded
  useEffect(() => {
    if (!expanded || visits !== null) return
    setVisitsLoading(true)
    setVisitsError(null)
    getVisitLogs(restaurant.id)
      .then((data) => setVisits(data))
      .catch(() => setVisitsError('Could not load visits.'))
      .finally(() => setVisitsLoading(false))
  }, [expanded, restaurant.id, visits])

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0])
    setFormNote('')
    setSaveError(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!formDate) {
      setSaveError('Please enter a date.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const { visit, statusChanged } = await logVisit(restaurant.id, formDate, formNote.trim() || null)
      setVisits((prev) => {
        const updated = [visit, ...(prev ?? [])]
        return updated.sort((a, b) => b.visited_at.localeCompare(a.visited_at))
      })
      resetForm()
      if (statusChanged) router.refresh()
    } catch {
      setSaveError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-col"
      style={{
        backgroundColor: '#F7F3EE',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.13)',
        zIndex: 10,
        height: expanded ? '60dvh' : 180,
        transition: 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center pt-3 pb-1 shrink-0 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        onTouchStart={(e) => { dragStartY.current = e.touches[0].clientY }}
        onTouchEnd={(e) => {
          if (dragStartY.current === null) return
          const dy = e.changedTouches[0].clientY - dragStartY.current
          dragStartY.current = null
          if (Math.abs(dy) < 10) return
          e.preventDefault() // suppress synthesized click that would toggle state back
          if (dy < 0) setExpanded(true)
          else if (expanded) setExpanded(false)
          else onClose()
        }}
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

      {/* Fade gradient — teases content below when collapsed */}
      {!expanded && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 52,
            background: 'linear-gradient(to bottom, transparent, #F7F3EE)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* Expanded detail — scrollable */}
      <div
        className="flex-1 px-4"
        style={{
          overflowY: expanded ? 'auto' : 'hidden',
          pointerEvents: expanded ? 'auto' : 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
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
            className="bg-white rounded-2xl p-4 mb-3"
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

        {/* Visit log section */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: showForm || (visits && visits.length > 0) ? '1px solid #F0EBE5' : undefined }}
          >
            <div className="flex items-center gap-2">
              <Clock size={14} strokeWidth={2} style={{ color: '#A8A09A' }} />
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#A8A09A' }}
              >
                Visits
              </span>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                aria-label="Log a visit"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: '#C2410C',
                  color: '#fff',
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
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

          {/* Inline log form */}
          {showForm && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F0EBE5' }}>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full text-sm p-2 rounded-lg mb-2"
                style={{ border: '1px solid #D1C9C0', color: '#1C1917' }}
              />
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="w-full text-sm p-2 rounded-lg mb-2 resize-none"
                style={{ border: '1px solid #D1C9C0', color: '#1C1917' }}
              />
              {saveError && (
                <p className="text-xs mb-2" style={{ color: '#DC2626' }}>{saveError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-opacity"
                  style={{ backgroundColor: '#C2410C', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={resetForm}
                  className="text-sm transition-opacity hover:opacity-60"
                  style={{ color: '#6B6560' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Visit list */}
          {visitsLoading && (
            <p className="px-4 py-3 text-sm" style={{ color: '#A8A09A' }}>Loading…</p>
          )}
          {visitsError && (
            <p className="px-4 py-3 text-sm" style={{ color: '#A8A09A' }}>{visitsError}</p>
          )}
          {!visitsLoading && !visitsError && visits !== null && visits.length === 0 && !showForm && (
            <p className="px-4 py-3 text-sm" style={{ color: '#A8A09A' }}>No visits yet.</p>
          )}
          {!visitsLoading && !visitsError && visits && visits.length > 0 && visits.map((v, i) => (
            <div
              key={v.id}
              className="px-4 py-3"
              style={{ borderTop: i === 0 && !showForm ? undefined : '1px solid #F0EBE5' }}
            >
              <p className="text-sm font-medium" style={{ color: '#1C1917' }}>
                {new Date(v.visited_at.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {v.note && (
                <p className="text-sm mt-0.5" style={{ color: '#6B6560' }}>{v.note}</p>
              )}
            </div>
          ))}
        </div>
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
