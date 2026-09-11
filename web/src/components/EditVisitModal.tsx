'use client'

import { useEffect, useState } from 'react'
import { updateVisit, deleteVisit, type VisitLog } from '@/app/actions'
import type { VisitLogWithRestaurantResolved } from '@/lib/historyGrouping'

// Local calendar day, not UTC -- same as AddVisitModal.tsx's todayLocal(),
// so editing a visit can't silently set a future date any more than adding
// one can.
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Props = {
  log: VisitLogWithRestaurantResolved
  onClose: () => void
  onUpdated: (visit: VisitLog) => void
  onDeleted: (id: string) => void
}

// CAP-4: Journal's own edit surface. JournalRow is a full-row navigation
// button, so editing here goes through a modal rather than fighting the
// row's click target inline (Design Notes, story 5) -- unlike
// RestaurantPanel.tsx, which already had an inline log-form/delete-confirm
// pattern to reuse per-row. Chrome (overlay/card/header) copied from
// AddVisitModal.tsx; the confirm-gated delete strip copies
// EditRestaurantModal.tsx's own restaurant-delete pattern.
export default function EditVisitModal({ log, onClose, onUpdated, onDeleted }: Props) {
  const [formDate, setFormDate] = useState(log.visited_at.slice(0, 10))
  const [formNote, setFormNote] = useState(log.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const busy = saving || deleting

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose()
  }

  function requestClose() {
    if (busy) return
    onClose()
  }

  async function handleSave() {
    if (!formDate) {
      setSaveError('Please enter a date.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateVisit(log.id, formDate, formNote.trim() || null)
      onUpdated(updated)
      onClose()
    } catch {
      // Form state is preserved deliberately, same as AddVisitModal -- a
      // retry starts from what the user already typed.
      setSaveError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteVisit(log.id)
      onDeleted(log.id)
      onClose()
    } catch {
      // confirmingDelete stays true here -- the error text only renders
      // inside that branch, so resetting it on failure would make a failed
      // delete look like it silently did nothing.
      setDeleteError('Could not delete. Try again.')
      setDeleting(false)
    }
  }

  return (
    <div onClick={handleOverlayClick} style={overlayStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
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
            {log.restaurant.name}
          </span>
          <button onClick={requestClose} style={iconBtnStyle} aria-label="Close" disabled={busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            max={todayLocal()}
            disabled={busy}
            style={textInputStyle}
          />
          <textarea
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            placeholder="Note (optional)"
            rows={3}
            disabled={busy}
            style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          {saveError && (
            <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{saveError}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={busy}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: '#C2410C',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={requestClose}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 14,
                color: '#6B6560',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 13,
                color: '#DC2626',
                cursor: busy ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                width: '100%',
              }}
            >
              Delete visit
            </button>
          ) : (
            <div
              style={{
                border: '1px solid #FECACA',
                borderRadius: 10,
                padding: 12,
                backgroundColor: '#FEF2F2',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <p style={{ fontSize: 13, color: '#DC2626', margin: 0, textAlign: 'center' }}>
                Delete this visit?
              </p>
              {deleteError && (
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{deleteError}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: 9,
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={() => { setConfirmingDelete(false); setDeleteError(null) }}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: 9,
                    borderRadius: 8,
                    border: '1px solid #D1C9C0',
                    backgroundColor: 'transparent',
                    color: '#6B6560',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
