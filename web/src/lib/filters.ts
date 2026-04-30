import type { Restaurant } from '@/lib/supabase/restaurants'

export type FilterState = {
  status: string[]
  venueType: string[]
  neighborhood: string[]
  cuisine: string[]
  price: string[]
}

export type FilterOptions = {
  neighborhoods: string[]
  cuisines: string[]
}

export const EMPTY_FILTER: FilterState = {
  status: [],
  venueType: [],
  neighborhood: [],
  cuisine: [],
  price: [],
}

export function activeFilterCount(state: FilterState): number {
  return (
    state.status.length +
    state.venueType.length +
    state.neighborhood.length +
    state.cuisine.length +
    state.price.length
  )
}

export function filterRestaurants(restaurants: Restaurant[], state: FilterState): Restaurant[] {
  return restaurants.filter((r) => {
    if (state.status.length > 0 && !state.status.includes(r.status)) return false
    if (state.venueType.length > 0 && !state.venueType.includes(r.venue_type ?? '')) return false
    if (state.neighborhood.length > 0 && !state.neighborhood.includes(r.neighborhood ?? '')) return false
    if (state.cuisine.length > 0 && !state.cuisine.includes(r.cuisine ?? '')) return false
    if (state.price.length > 0 && !state.price.includes(r.price_range ?? '')) return false
    return true
  })
}

export function getFilterOptions(restaurants: Restaurant[]): FilterOptions {
  const neighborhoods = Array.from(
    new Set(restaurants.map((r) => r.neighborhood).filter((n): n is string => n !== null && n !== ''))
  ).sort()
  const cuisines = Array.from(
    new Set(restaurants.map((r) => r.cuisine).filter((c): c is string => c !== null && c !== ''))
  ).sort()
  return { neighborhoods, cuisines }
}
