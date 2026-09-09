import type { VisitLogWithRestaurant } from '@/app/actions'

// Same shape as VisitLogWithRestaurant but with `restaurant` narrowed to
// non-null — the type-level record of "already filtered before grouping".
export type VisitLogWithRestaurantResolved = VisitLogWithRestaurant & {
  restaurant: NonNullable<VisitLogWithRestaurant['restaurant']>
}

export type MonthSection = {
  id: string
  title: string
  entries: VisitLogWithRestaurantResolved[]
}

// visited_at is a date-only string ("YYYY-MM-DD"). Parsing it with an
// explicit noon time (RestaurantPanel.tsx precedent) keeps the calendar date
// stable across timezones instead of rolling it back a day in UTC-negative
// zones.
function toLocalDate(visitedAt: string): Date {
  return new Date(visitedAt.slice(0, 10) + 'T12:00:00')
}

/// Pure grouping for the Journal view. Mirrors iOS's HistoryGrouping.swift:
/// filter out entries whose restaurant join returned nothing BEFORE grouping
/// (a month header must never render with nothing beneath it — this was
/// violated on iOS 3.5 despite being an explicit AC), then group by
/// year+month, months descending, entries within a month descending by
/// visited_at.
export function groupVisitsByMonth(logs: VisitLogWithRestaurant[]): MonthSection[] {
  const renderable = logs.filter(
    (log): log is VisitLogWithRestaurantResolved => log.restaurant !== null
  )

  const byMonth = new Map<string, VisitLogWithRestaurantResolved[]>()
  for (const log of renderable) {
    const date = toLocalDate(log.visited_at)
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(log)
    else byMonth.set(key, [log])
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // months descending
    .map(([key, entries]) => {
      const [year, month] = key.split('-').map(Number)
      const title = new Date(year, month, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
      // visited_at is date-only ("YYYY-MM-DD"), so two visits logged on the
      // same calendar day tie on the primary key — created_at (a full
      // timestamp, already fetched but otherwise unused) breaks the tie
      // deterministically instead of leaving same-day order to whatever
      // Postgres happened to return.
      const sorted = [...entries].sort(
        (a, b) =>
          b.visited_at.localeCompare(a.visited_at) || b.created_at.localeCompare(a.created_at)
      )
      return { id: key, title, entries: sorted }
    })
}
