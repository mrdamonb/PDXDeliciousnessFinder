'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export type SaveRestaurantData = {
  name: string
  address: string | null
  latitude: number
  longitude: number
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  status: 'want_to_go' | 'been_there' | 'favorite'
  city: string
}

export type PlaceResult = {
  name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  cuisine: string | null
  venueType: 'restaurant' | 'bar' | 'brewery' | 'foodCart' | null
  priceRange: '$' | '$$' | '$$$' | '$$$$' | null
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/search-places`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ query, limit: 5 }),
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Edge function error ${resp.status}: ${text}`)
  const json = JSON.parse(text)
  if (!json.success) throw new Error(json.error ?? 'Search failed')
  return json.results ?? []
}

export async function saveRestaurant(data: SaveRestaurantData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('restaurants')
    .insert({ ...data, user_id: user.id })

  if (error) throw new Error(error.message)
}

export type VisitLog = {
  id: string
  restaurant_id: string
  visited_at: string
  note: string | null
  created_at: string
}

export async function getVisitLogs(restaurantId: string): Promise<VisitLog[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('visit_logs')
    .select('id, restaurant_id, visited_at, note, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .order('visited_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as VisitLog[]
}

export type UpdateRestaurantData = {
  name: string
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  status: 'want_to_go' | 'been_there' | 'favorite'
  general_note: string | null
  website: string | null
}

export async function updateRestaurant(id: string, data: UpdateRestaurantData): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('restaurants')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

export type DbMatch = {
  name: string
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  website: string | null
  address: string | null
  latitude: number
  longitude: number
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').trim()
}

export async function bulkLookupRestaurants(names: string[]): Promise<Record<string, DbMatch | null>> {
  if (names.length === 0) return {}
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('restaurants')
    .select('name, venue_type, cuisine, price_range, website, address, latitude, longitude')
    .eq('user_id', user.id)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Build normalized-name → first match map (covers curly vs straight apostrophe differences)
  const byNormalizedName = new Map<string, DbMatch>()
  for (const row of data ?? []) {
    const key = normalizeForMatch(row.name)
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, row as DbMatch)
  }

  const result: Record<string, DbMatch | null> = {}
  for (const name of names) {
    result[name] = byNormalizedName.get(normalizeForMatch(name)) ?? null
  }
  return result
}

export type BulkImportRow = {
  name: string
  address: string | null
  latitude: number
  longitude: number
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  website: string | null
}

export async function bulkSaveRestaurants(rows: BulkImportRow[]): Promise<void> {
  if (rows.length === 0) return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const records = rows.map(r => ({
    ...r,
    user_id: user.id,
    status: 'want_to_go' as const,
    city: 'Portland',
  }))

  const { error } = await supabase
    .from('restaurants')
    .insert(records)

  if (error) throw new Error(error.message)
}

export async function deleteRestaurant(id: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}

export async function logVisit(
  restaurantId: string,
  visitedAt: string,
  note: string | null,
): Promise<{ visit: VisitLog; statusChanged: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: inserted, error: insertError } = await supabase
    .from('visit_logs')
    .insert({ restaurant_id: restaurantId, user_id: user.id, visited_at: visitedAt, note })
    .select('id, restaurant_id, visited_at, note, created_at')
    .single()

  if (insertError) throw new Error(insertError.message)

  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('status')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  let statusChanged = false
  if (restaurant?.status === 'want_to_go') {
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ status: 'been_there' })
      .eq('id', restaurantId)
      .eq('user_id', user.id)

    if (updateError) throw new Error(updateError.message)
    statusChanged = true
  }

  return { visit: inserted as VisitLog, statusChanged }
}
