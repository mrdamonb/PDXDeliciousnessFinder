'use client'

import { useEffect, useRef, useState } from 'react'
import {
  bulkLookupRestaurants,
  bulkSaveRestaurants,
  searchPlaces,
  type BulkImportRow,
} from '@/app/actions'
import {
  parsePasteInput,
  venueTypeToDB,
  formatVenueType,
  type MatchedRow,
  type LookupRow,
  type SkippedRow,
} from '@/lib/importPipeline'

const ACCENT = '#C2410C'

type Panel = 'paste' | 'loading' | 'preview' | 'confirming' | 'done'

type DoneState = {
  saved: number
  skipped: number
  errors: string[]
}

type Props = {
  onClose: () => void
  onSaveSuccess: () => void
}

export default function ImportModal({ onClose, onSaveSuccess }: Props) {
  const [panel, setPanel] = useState<Panel>('paste')
  const [pasteText, setPasteText] = useState('')
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([])
  const [lookupRows, setLookupRows] = useState<LookupRow[]>([])
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [doneState, setDoneState] = useState<DoneState | null>(null)
  const panelRef = useRef(panel)

  useEffect(() => { panelRef.current = panel }, [panel])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelRef.current !== 'confirming') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canPreview = pasteText.trim().length > 0
  const actionableCount = matchedRows.length + lookupRows.length

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && panel !== 'confirming') onClose()
  }

  async function handlePreview() {
    if (!canPreview) return
    const { names, blankCount } = parsePasteInput(pasteText)

    setLoadError(null)
    setPanel('loading')

    try {
      const lookupMap = names.length > 0 ? await bulkLookupRestaurants(names) : {}

      const matched: MatchedRow[] = []
      const lookup: LookupRow[] = []

      for (const name of names) {
        const dbMatch = lookupMap[name]
        if (dbMatch) {
          matched.push({
            bucket: 'matched',
            name,
            venue_type: dbMatch.venue_type,
            cuisine: dbMatch.cuisine,
            price_range: dbMatch.price_range,
            website: dbMatch.website,
            address: dbMatch.address,
            latitude: dbMatch.latitude,
            longitude: dbMatch.longitude,
          })
        } else {
          lookup.push({ bucket: 'lookup', name })
        }
      }

      const skipped: SkippedRow[] = Array.from({ length: blankCount }, () => ({
        bucket: 'skipped' as const,
        name: '(blank line)',
      }))

      setMatchedRows(matched)
      setLookupRows(lookup)
      setSkippedRows(skipped)
      setPanel('preview')
    } catch (e) {
      console.error('[ImportModal] lookup error:', e)
      setLoadError('Could not look up restaurants. Please try again.')
      setPanel('paste')
    }
  }

  async function handleConfirm() {
    setPanel('confirming')

    const errors: string[] = []
    const saveRows: BulkImportRow[] = []
    let skipped = skippedRows.length

    for (const row of matchedRows) {
      saveRows.push({
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        venue_type: row.venue_type,
        cuisine: row.cuisine,
        price_range: row.price_range,
        website: row.website,
      })
    }

    if (lookupRows.length > 0) {
      const lookupResults = await Promise.allSettled(
        lookupRows.map((row) => searchPlaces(row.name))
      )

      for (let i = 0; i < lookupResults.length; i++) {
        const outcome = lookupResults[i]
        const rowName = lookupRows[i].name

        if (outcome.status === 'rejected') {
          errors.push(`Could not find "${rowName}"`)
          skipped++
        } else {
          const first = outcome.value[0]
          if (!first || first.latitude == null || first.longitude == null) {
            skipped++
          } else {
            saveRows.push({
              name: first.name ?? rowName,
              address: first.address,
              latitude: first.latitude,
              longitude: first.longitude,
              venue_type: venueTypeToDB(first.venueType),
              cuisine: first.cuisine,
              price_range: first.priceRange,
              website: null,
            })
          }
        }
      }
    }

    let saved = 0
    if (saveRows.length > 0) {
      try {
        await bulkSaveRestaurants(saveRows)
        saved = saveRows.length
      } catch (e) {
        console.error('[ImportModal] save error:', e)
        errors.push('Failed to save restaurants. Please try again.')
        skipped += saveRows.length
      }
    }

    setDoneState({ saved, skipped, errors })
    setPanel('done')
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
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
        {panel === 'paste' && (
          <PastePanel
            pasteText={pasteText}
            onTextChange={setPasteText}
            onPreview={handlePreview}
            onClose={onClose}
            error={loadError}
            canPreview={canPreview}
          />
        )}
        {panel === 'loading' && <SpinnerPanel title="Import restaurants" message="Looking up restaurants…" />}
        {panel === 'preview' && (
          <PreviewPanel
            matchedRows={matchedRows}
            lookupRows={lookupRows}
            skippedRows={skippedRows}
            actionableCount={actionableCount}
            onBack={() => setPanel('paste')}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        )}
        {panel === 'confirming' && (
          <SpinnerPanel
            title="Importing…"
            message={
              lookupRows.length > 0
                ? `Looking up ${lookupRows.length} restaurant${lookupRows.length !== 1 ? 's' : ''}…`
                : 'Saving restaurants…'
            }
          />
        )}
        {panel === 'done' && doneState && (
          <DonePanel
            doneState={doneState}
            onClose={() => {
              if (doneState.saved > 0) onSaveSuccess()
              else onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Paste Panel ───────────────────────────────────────────────────────────────

type PastePanelProps = {
  pasteText: string
  onTextChange: (v: string) => void
  onPreview: () => void
  onClose: () => void
  error: string | null
  canPreview: boolean
}

function PastePanel({ pasteText, onTextChange, onPreview, onClose, error, canPreview }: PastePanelProps) {
  return (
    <>
      <ModalHeader title="Import restaurants" onClose={onClose} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>
          Paste restaurant names, one per line. We&apos;ll look them up and pre-fill details automatically.
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={'Tasty Burger\nPizza Palace\nSushi Garden'}
          rows={8}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid #EDE8E3',
            borderRadius: 10,
            outline: 'none',
            color: '#1C1917',
            backgroundColor: '#FAFAF9',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>}
        <button
          onClick={onPreview}
          disabled={!canPreview}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: canPreview ? ACCENT : '#D1C9C0',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: canPreview ? 'pointer' : 'not-allowed',
          }}
        >
          Preview import
        </button>
      </div>
    </>
  )
}

// ── Spinner Panel (loading + confirming) ──────────────────────────────────────

function SpinnerPanel({ title, message }: { title: string; message: string }) {
  return (
    <>
      <ModalHeader title={title} />
      <div
        style={{
          padding: '40px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <span
          className="animate-spin"
          style={{
            display: 'inline-block',
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '3px solid #EDE8E3',
            borderTopColor: ACCENT,
            flexShrink: 0,
          }}
        />
        <p style={{ fontSize: 14, color: '#6B6560', margin: 0, textAlign: 'center' }}>{message}</p>
      </div>
    </>
  )
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

type PreviewPanelProps = {
  matchedRows: MatchedRow[]
  lookupRows: LookupRow[]
  skippedRows: SkippedRow[]
  actionableCount: number
  onBack: () => void
  onConfirm: () => void
  onClose: () => void
}

function PreviewPanel({
  matchedRows,
  lookupRows,
  skippedRows,
  actionableCount,
  onBack,
  onConfirm,
  onClose,
}: PreviewPanelProps) {
  const canConfirm = actionableCount > 0

  return (
    <>
      <ModalHeader title="Review import" onBack={onBack} onClose={onClose} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {matchedRows.length > 0 && (
          <BucketSection icon="✅" title={`Matched in database (${matchedRows.length})`} titleColor="#16A34A">
            {matchedRows.map((row, i) => {
              const detail = [formatVenueType(row.venue_type), row.cuisine].filter(Boolean).join(' · ')
              return (
                <BucketRow key={row.name} isFirst={i === 0}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{row.name}</span>
                  {detail && <span style={{ fontSize: 12, color: '#6B6560' }}>{detail}</span>}
                </BucketRow>
              )
            })}
          </BucketSection>
        )}

        {lookupRows.length > 0 && (
          <BucketSection icon="🔍" title={`Will look up (${lookupRows.length})`} titleColor="#D97706">
            {lookupRows.map((row, i) => (
              <BucketRow key={row.name} isFirst={i === 0}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1917' }}>{row.name}</span>
              </BucketRow>
            ))}
          </BucketSection>
        )}

        {skippedRows.length > 0 && (
          <BucketSection icon="⚠️" title={`Skipped (${skippedRows.length})`} titleColor="#6B6560">
            <BucketRow isFirst>
              <span style={{ fontSize: 13, color: '#6B6560' }}>
                {skippedRows.length} blank {skippedRows.length === 1 ? 'line' : 'lines'}
              </span>
            </BucketRow>
          </BucketSection>
        )}

        <p style={{ fontSize: 12, color: '#6B6560', margin: 0, lineHeight: 1.5 }}>
          Details like cuisine and price are pre-filled from our database where available. You can review and edit each place after import.
        </p>

        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: canConfirm ? ACCENT : '#D1C9C0',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: canConfirm ? 'pointer' : 'not-allowed',
          }}
        >
          {canConfirm
            ? `Import ${actionableCount} restaurant${actionableCount !== 1 ? 's' : ''}`
            : 'Nothing to import'}
        </button>
      </div>
    </>
  )
}

function BucketSection({
  icon,
  title,
  titleColor,
  children,
}: {
  icon: string
  title: string
  titleColor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: titleColor }}>{title}</span>
      </div>
      <div style={{ border: '1px solid #EDE8E3', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function BucketRow({ isFirst, children }: { isFirst?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 12px',
        borderTop: isFirst ? 'none' : '1px solid #F5F0EB',
      }}
    >
      {children}
    </div>
  )
}

// ── Done Panel ────────────────────────────────────────────────────────────────

function DonePanel({ doneState, onClose }: { doneState: DoneState; onClose: () => void }) {
  return (
    <>
      <ModalHeader title="Import complete" />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: '0 0 6px' }}>
            {doneState.saved > 0
              ? `${doneState.saved} restaurant${doneState.saved !== 1 ? 's' : ''} added`
              : 'No restaurants were added'}
          </p>
          {doneState.skipped > 0 && (
            <p style={{ fontSize: 13, color: '#6B6560', margin: '0 0 4px' }}>
              {doneState.skipped} {doneState.skipped === 1 ? 'place' : 'places'} skipped
            </p>
          )}
          {doneState.saved > 0 && (
            <p style={{ fontSize: 13, color: '#6B6560', margin: 0, lineHeight: 1.5 }}>
              Next step: review your imports. Tap each place on the map to confirm the location, venue type, and cuisine look right — imported data can occasionally miss the mark.
            </p>
          )}
        </div>

        {doneState.errors.length > 0 && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            {doneState.errors.map((err, i) => (
              <p
                key={i}
                style={{ fontSize: 13, color: '#DC2626', margin: i === 0 ? 0 : '4px 0 0' }}
              >
                {err}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: ACCENT,
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function ModalHeader({
  title,
  onClose,
  onBack,
}: {
  title: string
  onClose?: () => void
  onBack?: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '16px 16px 12px',
        borderBottom: '1px solid #EDE8E3',
        flexShrink: 0,
      }}
    >
      {onBack && (
        <button onClick={onBack} style={iconBtnStyle} aria-label="Back">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B6560"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <span style={{ fontWeight: 700, fontSize: 16, color: '#1C1917', flex: 1 }}>{title}</span>
      {onClose && (
        <button onClick={onClose} style={iconBtnStyle} aria-label="Close">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B6560"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
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
}
