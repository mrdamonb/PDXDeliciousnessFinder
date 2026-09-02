import { SupabaseClient } from '@supabase/supabase-js'

export type Restaurant = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  status: 'want_to_go' | 'been_there' | 'favorite'
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  neighborhood: string | null
  city: string
  website: string | null
  menu_url: string | null
  general_note: string | null
  created_at: string
}

export async function getRestaurants(supabase: SupabaseClient): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, latitude, longitude, status, venue_type, cuisine, price_range, neighborhood, city, website, menu_url, general_note, created_at')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  if (error) throw error
  return (data ?? []) as Restaurant[]
}
