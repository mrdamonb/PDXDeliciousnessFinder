'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Utensils, Wine, Beer, Store, Pencil } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getAllVisitLogs, type VisitLogWithRestaurant, type VisitLog } from '@/app/actions'
import { groupVisitsByMonth, type VisitLogWithRestaurantResolved } from '@/lib/historyGrouping'
import type { Restaurant } from '@/lib/supabase/restaurants'
import AddVisitModal from './AddVisitModal'
import EditVisitModal from './EditVisitModal'

const VENUE_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  bar: Wine,
  brewery: Beer,
  food_cart: Store,
}

type Props = {
  restaurants: Restaurant[]
  onSelectRestaurant: (id: string) => void
}

function toLocalDate(visitedAt: string): Date {
  return new Date(visitedAt.slice(0, 10) + 'T12:00:00')
}

// CAP-2: every logged visit across all restaurants, reverse-chronological,
// grouped under month/year headers — the web counterpart to iOS's
// HistoryView + HistoryGrouping. Fetches via the getAllVisitLogs server
// action, same loading/error/data shape as RestaurantPanel.tsx's visit fetch.
export default function HistoryView({ restaurants, onSelectRestaurant }: Props) {
  const router = useRouter()
  const [logs, setLogs] = useState<VisitLogWithRestaurant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumped by the error state's Retry button to re-run the effect below
  // without depending on the component happening to remount (e.g. by leaving
  // and re-entering the Journal tab).
  const [retryCount, setRetryCount] = useState(0)
  // CAP-3: the "+" picker/log modal lives in HistoryView's own content, not
  // HomeView's shared header/toggle bar.
  const [pickerOpen, setPickerOpen] = useState(false)
  // CAP-4: the visit currently open in EditVisitModal, or null when closed.
  const [editingLog, setEditingLog] = useState<VisitLogWithRestaurantResolved | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAllVisitLogs()
      .then((data) => {
        if (!cancelled) setLogs(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your visits.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retryCount])

  // CAP-3: mirrors RestaurantPanel.tsx's handleSave (lines 104-124) — merge
  // the new visit straight into local state (prepend, re-sort desc), no
  // refetch, and only refresh the router (Map/List) when the restaurant's
  // status actually changed.
  function handleSaved(visit: VisitLog, restaurant: Restaurant, statusChanged: boolean) {
    const entry: VisitLogWithRestaurant = {
      id: visit.id,
      restaurant_id: visit.restaurant_id,
      visited_at: visit.visited_at,
      note: visit.note,
      created_at: visit.created_at,
      updated_at: visit.updated_at,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        neighborhood: restaurant.neighborhood,
        venue_type: restaurant.venue_type,
        status: statusChanged ? 'been_there' : restaurant.status,
      },
    }
    setLogs((prev) => {
      const updated = [entry, ...(prev ?? [])]
      return updated.sort((a, b) => b.visited_at.localeCompare(a.visited_at))
    })
    if (statusChanged) router.refresh()
  }

  // CAP-4: splice an edited visit into local state the same way handleSaved
  // does for a new one -- no refetch. groupVisitsByMonth re-derives sections
  // from `logs` on every render, so a date edit that crosses a month
  // boundary regroups automatically, and an emptied old header disappears
  // the same way.
  function handleVisitUpdated(visit: VisitLog) {
    setLogs((prev) =>
      (prev ?? [])
        .map((log) => (log.id === visit.id ? { ...log, ...visit } : log))
        .sort((a, b) => b.visited_at.localeCompare(a.visited_at))
    )
  }

  function handleVisitDeleted(id: string) {
    setLogs((prev) => (prev ?? []).filter((log) => log.id !== id))
  }

  let content: React.ReactNode

  if (loading) {
    content = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <p style={{ fontSize: 14, color: '#A8A09A' }}>Loading…</p>
      </div>
    )
  } else if (error) {
    content = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 10,
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 14, color: '#A8A09A' }}>{error}</p>
        <button
          onClick={() => setRetryCount((n) => n + 1)}
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
          Retry
        </button>
      </div>
    )
  } else {
    const sections = groupVisitsByMonth(logs ?? [])

    // Zero visits and "every visit's restaurant was deleted" both land here
    // deliberately — either way there is nothing to group, and a blank surface
    // is never the right answer (I/O matrix: "warm empty state, not a blank
    // surface").
    if (sections.length === 0) {
      content = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 4,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: 0 }}>No visits yet</p>
          <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>
            Your food adventures will show up here.
          </p>
        </div>
      )
    } else {
      content = (
        <div style={{ height: '100%', overflowY: 'auto' }}>
          {sections.map((section) => (
            <div key={section.id}>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  padding: '14px 16px 6px',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: '#A8A09A',
                  backgroundColor: '#F7F3EE',
                }}
              >
                {section.title}
              </div>
              {section.entries.map((log) => (
                <JournalRow key={log.id} log={log} onSelect={onSelectRestaurant} onEdit={setEditingLog} />
              ))}
            </div>
          ))}
        </div>
      )
    }
  }

  // The "+" FAB (and therefore the modal it opens) is only available once the
  // initial load has actually succeeded. Otherwise a visit could be
  // optimistically merged into `logs` by handleSaved and then immediately
  // wiped out when the in-flight (or retried) getAllVisitLogs() fetch
  // resolves and unconditionally overwrites it via setLogs(data).
  const canAddVisit = !loading && !error

  return (
    <>
      {content}

      {/* "+" FAB — lives inside the Journal's own content, not HomeView's
          shared header/toggle bar. Same accent as the header's "Add
          restaurant" button. Hidden while the initial fetch is loading or
          errored — see canAddVisit above. */}
      {canAddVisit && (
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="Add a visit"
          style={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
            right: 20,
            zIndex: 20,
            width: 52,
            height: 52,
            borderRadius: 999,
            border: 'none',
            backgroundColor: '#C2410C',
            color: '#fff',
            fontSize: 26,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}
        >
          +
        </button>
      )}

      {canAddVisit && pickerOpen && (
        <AddVisitModal
          restaurants={restaurants}
          onClose={() => setPickerOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {editingLog && (
        <EditVisitModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onUpdated={handleVisitUpdated}
          onDeleted={handleVisitDeleted}
        />
      )}
    </>
  )
}

function JournalRow({
  log,
  onSelect,
  onEdit,
}: {
  log: VisitLogWithRestaurantResolved
  onSelect: (id: string) => void
  onEdit: (log: VisitLogWithRestaurantResolved) => void
}) {
  const restaurant = log.restaurant
  const Icon = VENUE_ICONS[restaurant.venue_type ?? ''] ?? Utensils
  const formattedDate = toLocalDate(log.visited_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  // A plain <button> with a nested edit <button> is invalid HTML (browsers
  // implicitly close the outer button, breaking layout) -- role="button" on
  // a div plus an explicit key handler keeps the whole-row click/keyboard
  // navigation the original <button> gave, while allowing a real nested
  // button for the edit affordance (stopPropagation, per the Code Map).
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(restaurant.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(restaurant.id)
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        gap: 12,
        padding: '12px 16px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid #F0EBE5',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Icon size={16} color="#A8A09A" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: '#1C1917',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {restaurant.name}
          </span>
          {restaurant.status === 'favorite' && (
            <span style={{ color: '#DC2626', fontSize: 12, lineHeight: 1, flexShrink: 0 }}>★</span>
          )}
        </div>
        {restaurant.neighborhood && (
          <p style={{ fontSize: 12, color: '#6B6560', margin: '2px 0 0' }}>
            {restaurant.neighborhood}
          </p>
        )}
        {log.note && (
          <p
            style={{
              fontSize: 12,
              color: '#6B6560',
              margin: '2px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {log.note}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginTop: 2 }}>
        <span style={{ fontSize: 12, color: '#A8A09A' }}>
          {formattedDate}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(log)
          }}
          onKeyDown={(e) => {
            // Without this, Enter/Space on this button bubbles to the row
            // wrapper's own onKeyDown, which navigates to the restaurant
            // instead of opening the edit modal.
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
          aria-label={`Edit visit to ${restaurant.name}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            borderRadius: 6,
            cursor: 'pointer',
            color: '#A8A09A',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
