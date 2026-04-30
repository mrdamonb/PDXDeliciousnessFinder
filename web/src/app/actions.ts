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

export async function saveRestaurant(data: SaveRestaurantData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('restaurants')
    .insert({ ...data, user_id: user.id })

  if (error) throw new Error(error.message)
}
