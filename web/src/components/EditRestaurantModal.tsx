'use client'

import { useEffect, useState } from 'react'
import { Utensils, Wine, Beer, Store } from 'lucide-react'
import { updateRestaurant, deleteRestaurant, type UpdateRestaurantData } from '@/app/actions'
import type { Restaurant } from '@/lib/supabase/restaurants'
import { normalizeWebUrl } from '@/lib/url'

type VenueTypeSnake = 'restaurant' | 'bar' | 'brewery' | 'food_cart'
type Status = 'want_to_go' | 'been_there' | 'favorite'
type PriceRange = '$' | '$$' | '$$$' | '$$$$'

const ACCENT = '#C2410C'

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

type FormState = {
  name: string
  venue_type: VenueTypeSnake | null
  cuisine: string
  price_range: PriceRange | null
  status: Status
  general_note: string
  website: string
  menu_url: string
}

type Props = {
  restaurant: Restaurant
  onClose: () => void
  onSaveSuccess: () => void
  onDeleteSuccess: () => void
  cuisineSuggestions: string[]
}

export default function EditRestaurantModal({ restaurant, onClose, onSaveSuccess, onDeleteSuccess, cuisineSuggestions }: Props) {
  const [form, setForm] = useState<FormState>({
    name: restaurant.name,
    venue_type: (restaurant.venue_type as VenueTypeSnake) ?? null,
    cuisine: restaurant.cuisine ?? '',
    price_range: (restaurant.price_range as PriceRange) ?? null,
    status: restaurant.status,
    general_note: restaurant.general_note ?? '',
    website: restaurant.website ?? '',
    menu_url: restaurant.menu_url ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const data: UpdateRestaurantData = {
        name: form.name.trim(),
        venue_type: form.venue_type,
        cuisine: form.cuisine.trim() || null,
        price_range: form.price_range,
        status: form.status,
        general_note: form.general_note.trim() || null,
        website: form.website.trim() || null,
        menu_url: normalizeWebUrl(form.menu_url),
      }
      await updateRestaurant(restaurant.id, data)
      onSaveSuccess()
    } catch (e) {
      console.error('[EditRestaurantModal] save error:', e)
      setSaveError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteRestaurant(restaurant.id)
      onDeleteSuccess()
    } catch (e) {
      console.error('[EditRestaurantModal] delete error:', e)
      setDeleteError('Could not delete. Please try again.')
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const canSave = form.name.trim().length > 0 && !saving

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
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
            borderBottom: '1px solid #EDE8E3',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1C1917' }}>Edit Restaurant</span>
          <button onClick={onClose} style={iconBtnStyle} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Address display (read-only) */}
        {restaurant.address && (
          <div style={{ padding: '10px 16px 0', fontSize: 13, color: '#6B6560' }}>
            {restaurant.address}
          </div>
        )}

        {/* Form */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              style={textInputStyle}
            />
          </Field>

          <Field label="Status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_OPTIONS.map(({ value, label, color }) => {
                const active = form.status === value
                return (
                  <button key={value} onClick={() => set('status', value)} style={pillStyle(active, color)}>
                    {label}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Venue Type">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VENUE_OPTIONS.map(({ value, label, Icon }) => {
                const active = form.venue_type === value
                return (
                  <button key={value} onClick={() => set('venue_type', active ? null : value)} style={pillStyle(active, ACCENT)}>
                    <Icon size={12} color={active ? '#fff' : '#6B6560'} strokeWidth={2} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Cuisine (optional)">
            <input
              value={form.cuisine}
              onChange={(e) => set('cuisine', e.target.value)}
              placeholder="e.g. Mexican, Japanese…"
              style={textInputStyle}
              list="cuisine-suggestions-edit"
            />
            <datalist id="cuisine-suggestions-edit">
              {cuisineSuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>

          <Field label="Price">
            <div style={{ display: 'flex', gap: 6 }}>
              {PRICE_OPTIONS.map((p) => {
                const active = form.price_range === p
                return (
                  <button key={p} onClick={() => set('price_range', active ? null : p)} style={pillStyle(active, ACCENT)}>
                    {p}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Website (optional)">
            <input
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://…"
              style={textInputStyle}
            />
          </Field>

          <Field label="Menu URL (optional)">
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={form.menu_url}
              onChange={(e) => set('menu_url', e.target.value)}
              placeholder="https://…"
              style={textInputStyle}
            />
          </Field>

          <Field label="Note (optional)">
            <textarea
              value={form.general_note}
              onChange={(e) => set('general_note', e.target.value)}
              placeholder="Any notes about this place…"
              rows={3}
              style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          {saveError && (
            <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{saveError}</p>
          )}

          <button
            onClick={handleSave}
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
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 13,
                color: '#DC2626',
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
              }}
            >
              Delete restaurant
            </button>
          ) : (
            <div
              style={{
                border: '1px solid #FECACA',
                borderRadius: 10,
                padding: '12px',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <p style={{ fontSize: 13, color: '#DC2626', margin: 0, textAlign: 'center' }}>
                Permanently delete this restaurant?
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
                    padding: '9px',
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
                    padding: '9px',
                    borderRadius: 8,
                    border: '1px solid #D1C9C0',
                    backgroundColor: 'transparent',
                    color: '#6B6560',
                    fontSize: 14,
                    cursor: 'pointer',
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
