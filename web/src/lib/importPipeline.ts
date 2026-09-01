export type MatchedRow = {
  bucket: 'matched'
  name: string
  venue_type: string | null
  cuisine: string | null
  price_range: string | null
  website: string | null
  address: string | null
  latitude: number
  longitude: number
}

export type LookupRow = {
  bucket: 'lookup'
  name: string
}

export type SkippedRow = {
  bucket: 'skipped'
  name: string
}

export type PreviewRow = MatchedRow | LookupRow | SkippedRow

export function venueTypeToDB(v: 'restaurant' | 'bar' | 'brewery' | 'foodCart' | null): string | null {
  if (v === 'foodCart') return 'food_cart'
  return v
}

export function formatVenueType(v: string | null): string | null {
  if (!v) return null
  const map: Record<string, string> = {
    restaurant: 'Restaurant',
    bar: 'Bar',
    brewery: 'Brewery',
    food_cart: 'Food Cart',
  }
  return map[v] ?? v
}

// Normalize for case-insensitive matching that treats curly/straight quotes as equal
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
}

export function parsePasteInput(text: string): { names: string[]; blankCount: number } {
  const lines = text.split('\n')
  const names: string[] = []
  let blankCount = 0
  const seen = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      blankCount++
      continue
    }
    const key = normalizeForMatch(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    names.push(trimmed)
  }

  return { names, blankCount }
}
