import type { Restaurant } from '@/lib/supabase/restaurants'

export type FilterState = {
  status: string[]
  venueType: string[]
  neighborhood: string[]
  cuisine: string[]
  price: string[]
  query: string
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
  query: '',
}

export function activeFilterCount(state: FilterState): number {
  return (
    state.status.length +
    state.venueType.length +
    state.neighborhood.length +
    state.cuisine.length +
    state.price.length +
    (state.query.trim() ? 1 : 0)
  )
}

// Lowercase + strip diacritics for search matching. Distinct from
// normalizeForMatch in importPipeline.ts, which is import-matching semantics
// (curly-quote normalization, no diacritic stripping) and must not be reused.
const DIACRITIC_MARKS = /[\u0300-\u036f]/g

export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS, '')
}

export function matchesQuery(r: Restaurant, normalizedQuery: string): boolean {
  const haystacks = [r.name, r.cuisine ?? '', r.neighborhood ?? '']
  return haystacks.some((h) => normalizeSearchText(h).includes(normalizedQuery))
}

export function filterRestaurants(restaurants: Restaurant[], state: FilterState): Restaurant[] {
  const trimmedQuery = state.query.trim()
  const normalizedQuery = trimmedQuery ? normalizeSearchText(trimmedQuery) : ''
  return restaurants.filter((r) => {
    if (state.status.length > 0 && !state.status.includes(r.status)) return false
    if (state.venueType.length > 0 && !state.venueType.includes(r.venue_type ?? '')) return false
    if (state.neighborhood.length > 0 && !state.neighborhood.includes(r.neighborhood ?? '')) return false
    if (state.cuisine.length > 0 && !state.cuisine.includes(r.cuisine ?? '')) return false
    if (state.price.length > 0 && !state.price.includes(r.price_range ?? '')) return false
    if (normalizedQuery && !matchesQuery(r, normalizedQuery)) return false
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
