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
