/**
 * Normalizes web addresses that a person typed by hand.
 *
 * People type `nongs.com`, not `https://nongs.com`. An `href` without a scheme is
 * treated as a path relative to the current page, so it navigates *inside* the app
 * instead of out to the restaurant's site — losing whatever the user was typing.
 */
export function normalizeWebUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  // Work out whether a scheme is already present before prefixing anything. Checking
  // for '://' alone is not enough: 'mailto:a@b.com' has no slashes and would otherwise
  // be mangled into 'https://mailto:a@b.com', which parses as host b.com and silently
  // points at the wrong site.
  const lowered = trimmed.toLowerCase()
  let candidate: string
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) {
    candidate = trimmed
  } else if (trimmed.includes('://')) {
    return null // some other scheme entirely
  } else {
    const colon = trimmed.indexOf(':')
    // A colon is only acceptable here when it introduces a port, e.g. example.com:8080.
    if (colon !== -1 && !/^\d/.test(trimmed.slice(colon + 1))) return null
    candidate = `https://${trimmed}` // the common case: a bare domain
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // A real web host has a dot; this also rejects leftovers such as 'tel:5035551234'
    // resolving to hostname 'tel'.
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}
