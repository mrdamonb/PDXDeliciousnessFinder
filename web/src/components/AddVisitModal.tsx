'use client'

import { useEffect, useState } from 'react'
import type { Restaurant } from '@/lib/supabase/restaurants'
import { logVisit, type VisitLog } from '@/app/actions'
import { matchesQuery, normalizeSearchText } from '@/lib/filters'

type Step = 'pick' | 'log'

type Props = {
  restaurants: Restaurant[]
  onClose: () => void
  onSaved: (visit: VisitLog, restaurant: Restaurant, statusChanged: boolean) => void
}

// Local calendar day, not UTC — `toISOString()` shifts near local midnight
// for users behind/ahead of UTC, pre-filling tomorrow's or yesterday's date.
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// CAP-3: two-step "+" flow on the Journal — pick a restaurant (reusing CAP-1's
// matchesQuery/normalizeSearchText, no second matching rule), then log a visit
// via the same logVisit action RestaurantPanel.tsx uses. Chrome (overlay, card,
// header, Escape/click-outside close) copied from EditRestaurantModal.tsx.
export default function AddVisitModal({ restaurants, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Restaurant | null>(null)
  const [formDate, setFormDate] = useState(() => todayLocal())
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !saving) onClose()
  }

  function requestClose() {
    if (saving) return
    onClose()
  }

  function selectRestaurant(r: Restaurant) {
    setSelected(r)
    setSaveError(null)
    setStep('log')
  }

  function backToPick() {
    setStep('pick')
    setSaveError(null)
    setFormDate(todayLocal())
    setFormNote('')
  }

  async function handleSave() {
    if (!selected) return
    if (!formDate) {
      setSaveError('Please enter a date.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const { visit, statusChanged } = await logVisit(selected.id, formDate, formNote.trim() || null)
      onSaved(visit, selected, statusChanged)
      onClose()
    } catch {
      // Date/note are preserved deliberately — form state isn't reset here,
      // so a retry starts from what the user already typed.
      setSaveError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const trimmedQuery = query.trim()
  const normalizedQuery = trimmedQuery ? normalizeSearchText(trimmedQuery) : ''
  const filtered = normalizedQuery
    ? restaurants.filter((r) => matchesQuery(r, normalizedQuery))
    : restaurants

  return (
    <div onClick={handleOverlayClick} style={overlayStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {step === 'log' && (
              <button onClick={backToPick} style={iconBtnStyle} aria-label="Back to search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <span
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: '#1C1917',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {step === 'pick' ? 'Add a Visit' : selected?.name ?? 'Log a Visit'}
            </span>
          </div>
          <button onClick={requestClose} style={iconBtnStyle} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 'pick' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '12px 16px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your places…"
                aria-label="Search restaurants"
                autoFocus
                style={textInputStyle}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {filtered.length === 0 ? (
                <p style={{ padding: '24px 16px', fontSize: 13, color: '#A8A09A', textAlign: 'center', margin: 0 }}>
                  No matches
                </p>
              ) : (
                filtered.map((r) => (
                  <button key={r.id} onClick={() => selectRestaurant(r)} style={rowStyle}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#1C1917',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name}
                    </span>
                    {(r.cuisine || r.neighborhood) && (
                      <span
                        style={{
                          fontSize: 12,
                          color: '#6B6560',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {[r.cuisine, r.neighborhood].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              max={todayLocal()}
              style={textInputStyle}
            />
            <textarea
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Note (optional)"
              rows={3}
              style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {saveError && (
              <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{saveError}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: '#C2410C',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={requestClose}
                disabled={saving}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 14,
                  color: '#6B6560',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  zIndex: 45,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
  paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
  paddingLeft: 16,
  paddingRight: 16,
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 16px 12px',
  borderBottom: '1px solid #EDE8E3',
  flexShrink: 0,
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  flexShrink: 0,
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  gap: 2,
  padding: '10px 16px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #F0EBE5',
  cursor: 'pointer',
  textAlign: 'left',
}
