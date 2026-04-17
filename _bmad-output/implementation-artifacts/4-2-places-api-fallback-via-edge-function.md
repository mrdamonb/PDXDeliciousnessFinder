# Story 4.2: Places API Fallback via Edge Function

Status: ready

## Story

As a Portland food enthusiast,
I want the app to fill in restaurant details from a Places API when the shared URL doesn't have structured data,
So that the confirmation card is still useful even for URLs without schema.org markup.

## Acceptance Criteria

1. **Given** a shared URL yields incomplete schema.org data (name or address is missing) **When** the extension detects incomplete data **Then** it calls the Supabase `enrich-restaurant` Edge Function with the available data (name, URL, partial address) to request Places API enrichment.

2. **Given** the Edge Function receives a request **When** it queries the Places API **Then** it returns name, address, latitude, longitude, cuisine, venue type, and price — merged with any data already extracted from schema.org (schema.org fields take precedence; Edge Function fills gaps only).

3. **Given** the Edge Function returns enriched data **When** the confirmation card updates **Then** all returned fields are pre-filled and editable.

4. **Given** the Edge Function fails (rate limit, timeout, 4xx/5xx, or network error) **When** the failure is handled **Then** the confirmation card shows whatever schema.org data is available (even if only the URL) with empty fields ready for manual entry — no error modal is shown, no crash.

5. **Given** the user is offline when the share extension fires **When** the extension runs **Then** the Edge Function call is skipped; the confirmation card opens with schema.org data (however incomplete) and all fields are editable for manual completion.

6. **Given** the Places API key **When** the system architecture is inspected **Then** the key exists only in Supabase Edge Function environment variables — it is never shipped on-device or committed to the repository.

## Tasks / Subtasks

> ⚠️ **PREREQUISITE CHECK — do this BEFORE writing any code**
>
> **1. Verify the ShareExtension `Info.plist` has Supabase keys.** Check `ShareExtension/Info.plist` for `SUPABASE_HOST` and `SUPABASE_ANON_KEY` keys. If absent, add them with `$(SUPABASE_HOST)` and `$(SUPABASE_ANON_KEY)` as values (same xcconfig variable expansion the main app uses). These are needed so `PlacesEnrichmentService` can build a Supabase client from `Bundle.main.infoDictionary` in the extension process.
>
> **2. Verify the `supabase/` directory structure exists.** Run `ls PDXDeliciousnessFinder/supabase/` — if absent, create `supabase/functions/enrich-restaurant/` manually. The Supabase CLI is not required to write the Edge Function file; Deno TypeScript is plain code.

---

- [ ] Task 1: Create the `enrich-restaurant` Supabase Edge Function (AC: 1, 2, 6)
  - [ ] 1.1 Create `PDXDeliciousnessFinder/supabase/functions/enrich-restaurant/index.ts`. This is a Deno TypeScript file that runs on the Supabase Edge Runtime.
  - [ ] 1.2 The function accepts `POST` requests with a JSON body:
    ```ts
    { name?: string; url?: string; address?: string }
    ```
    If none of these fields are present, return `{ success: false, error: "No search query provided" }` with HTTP 400.
  - [ ] 1.3 Build a search query string: prefer `name` if present; append `address` if present and different from `name`; append `"Portland OR"` unconditionally. Example: `"Hat Yai Portland OR"`.
  - [ ] 1.4 Check `Deno.env.get("FOURSQUARE_API_KEY")`. If present, call Foursquare Places Text Search (`https://api.foursquare.com/v3/places/search?query=...&near=Portland%2C+OR&limit=1`, header `Authorization: <key>`). If absent, fall back to OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/search?q=...&format=json&addressdetails=1&limit=1`, header `User-Agent: PDXDeliciousnessFinder/1.0`).
  - [ ] 1.5 Map the API response to a normalized `EnrichedPlace` shape and return it as `{ success: true, data: { name, address, latitude, longitude, cuisine, venueType, priceRange } }`. All fields are optional strings/numbers — return `null` for fields the API did not provide.
    - Foursquare: `name` from `name`; `address` from `location.formatted_address`; `latitude`/`longitude` from `geocodes.main.latitude/.longitude`; `venueType` derived from `categories[0].name` (map "Restaurant" → `"restaurant"`, "Bar" → `"bar"`, "Brewery" → `"brewery"`, "Food Truck" → `"foodCart"`, default → `"restaurant"`); `cuisine` from `categories[0].name` when more specific than venue type; `priceRange` from `price` (1→`"$"`, 2→`"$$"`, 3→`"$$$"`, 4→`"$$$$"`).
    - Nominatim: `name` from `display_name` (first comma-separated token); `address` from `display_name`; `latitude`/`longitude` from `lat`/`lon`; `venueType` and `cuisine` from `type` and `class` fields (best-effort mapping); `priceRange` → `null` (Nominatim does not provide it).
  - [ ] 1.6 Wrap all external API calls in `try/catch`. On any error (network, parsing, rate limit), return `{ success: false, error: "<short message>" }` with HTTP 200 — never return a 5xx from the function itself; let the iOS client distinguish success vs. failure via the `success` field.
  - [ ] 1.7 Add CORS headers so the function can be called from any origin (Supabase Edge Functions are called via the Supabase SDK, which handles auth, but explicit CORS avoids future issues):
    ```ts
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
    ```
    Return `corsHeaders` on `OPTIONS` preflight and include them in all responses.

---

- [ ] Task 2: Create `Core/Enrichment/PlacesEnrichmentService.swift` (AC: 1, 2, 3, 4, 5)
  - [ ] 2.1 Create `PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Enrichment/PlacesEnrichmentService.swift`.
  - [ ] 2.2 Define a `Codable` response DTO matching the Edge Function's output:
    ```swift
    struct EnrichmentResponse: Codable {
        let success: Bool
        let data: EnrichedPlaceData?
        let error: String?
    }
    struct EnrichedPlaceData: Codable {
        let name: String?
        let address: String?
        let latitude: Double?
        let longitude: Double?
        let cuisine: String?
        let venueType: String?    // raw string: "restaurant" | "bar" | "brewery" | "foodCart"
        let priceRange: String?   // "$" | "$$" | "$$$" | "$$$$" or nil
    }
    ```
    Both structs are `nonisolated` (plain value types — no actor annotation needed).
  - [ ] 2.3 Declare `final class PlacesEnrichmentService`. Mark all methods `nonisolated` (network work off `@MainActor`). The class creates its own Supabase client from the current bundle's `Info.plist` so it works identically in both the main app and the Share Extension:
    ```swift
    private nonisolated func makeClient() -> SupabaseClient {
        let host = Bundle.main.infoDictionary?["SUPABASE_HOST"] as? String ?? ""
        let key  = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String ?? ""
        return SupabaseClient(supabaseURL: URL(string: "https://\(host)")!, supabaseKey: key)
    }
    ```
  - [ ] 2.4 Implement the primary method:
    ```swift
    nonisolated func enrich(from partial: EnrichmentResult) async -> EnrichmentResult
    ```
    - Build the request body `["name": partial.name, "url": partial.sourceUrl, "address": partial.address]`, omitting nil values.
    - Call the Edge Function: `try await client.functions.invoke("enrich-restaurant", options: .init(body: requestData))`.
    - Decode the `Data` response as `EnrichmentResponse`.
    - If `success == true` and `data` is non-nil, merge: return a new `EnrichmentResult` where schema.org fields take precedence and Edge Function fills nil gaps.
    - On any error (network, decode failure, `success == false`), return `partial` unchanged — never throw.
  - [ ] 2.5 The merge logic (schema.org wins, Places fills gaps):
    ```swift
    var merged = partial
    if let d = response.data {
        merged.name     = partial.name     ?? d.name
        merged.address  = partial.address  ?? d.address
        merged.latitude = partial.latitude ?? d.latitude
        merged.longitude = partial.longitude ?? d.longitude
        merged.cuisine  = partial.cuisine  ?? d.cuisine
        if partial.venueType == nil, let vt = d.venueType { merged.venueType = VenueType(rawValue: vt) }
        if partial.priceRange == nil, let pr = d.priceRange { merged.priceRange = priceRangeFromString(pr) }
    }
    return merged
    ```
  - [ ] 2.6 Add a private helper `priceRangeFromString(_ s: String) -> PriceRange?` that maps `"$"→.one`, `"$$"→.two`, `"$$$"→.three`, `"$$$$"→.four`, else `nil`.
  - [ ] 2.7 `PlacesEnrichmentService` must NOT import `Features/`, `AppState`, `SyncQueue`, or any other main-app-only module.

---

- [ ] Task 3: Wire the fallback into `ShareExtensionView` (AC: 1, 3, 4, 5)
  - [ ] 3.1 Define "incomplete" data: `result.name == nil || result.address == nil`.
  - [ ] 3.2 Add a new `Phase` case for enrichment in progress:
    ```swift
    case enriching(EnrichmentResult)   // schema.org done; Places call in flight
    ```
    In the view body, render `.enriching` the same as `.loading` — show a `ProgressView` with text "Finding restaurant details…".
  - [ ] 3.3 In `loadURL()`, after the schema.org parse, add the enrichment gate:
    ```swift
    let schemaResult = await SchemaOrgParser().parse(url: url)

    guard schemaResult.name == nil || schemaResult.address == nil else {
        phase = .ready(schemaResult)   // schema.org was sufficient — skip Places
        return
    }

    // Check connectivity before calling the Edge Function
    guard isNetworkAvailable() else {
        phase = .ready(schemaResult)   // offline — skip Places, show partial card
        return
    }

    phase = .enriching(schemaResult)
    let enriched = await PlacesEnrichmentService().enrich(from: schemaResult)
    phase = .ready(enriched)
    ```
  - [ ] 3.4 Implement `isNetworkAvailable() -> Bool` using `NWPathMonitor` for a one-shot synchronous check. Because the extension process is short-lived and doesn't need ongoing monitoring, use the pattern:
    ```swift
    private func isNetworkAvailable() -> Bool {
        let monitor = NWPathMonitor()
        let sema = DispatchSemaphore(value: 0)
        var isAvailable = false
        monitor.pathUpdateHandler = { path in
            isAvailable = path.status == .satisfied
            sema.signal()
        }
        monitor.start(queue: DispatchQueue(label: "network-check"))
        sema.wait()
        monitor.cancel()
        return isAvailable
    }
    ```
    Add `import Network` at the top of the file.
  - [ ] 3.5 No changes to the `save(from:enrichment:)` path — the save logic is already correct; it simply persists whatever `EnrichmentResult` is in the `.ready` phase.

---

- [ ] Task 4: Update `ShareExtension/Info.plist` with Supabase keys (AC: 1, if not already present)
  - [ ] 4.1 Open `PDXDeliciousnessFinder/ShareExtension/Info.plist`. If `SUPABASE_HOST` and `SUPABASE_ANON_KEY` are absent, add them:
    ```xml
    <key>SUPABASE_HOST</key>
    <string>$(SUPABASE_HOST)</string>
    <key>SUPABASE_ANON_KEY</key>
    <string>$(SUPABASE_ANON_KEY)</string>
    ```
    The xcconfig is already applied to the ShareExtension build configuration (it was set up in Story 4.1); these keys just need to be in the `Info.plist` dictionary so `Bundle.main.infoDictionary` returns them at runtime.

---

- [ ] Task 5: Supabase configuration and deployment notes (AC: 6)
  - [ ] 5.1 **For the developer (Damonbrennen) to do in Supabase Dashboard, not in code:** Navigate to your Supabase project → Edge Functions → `enrich-restaurant` → Secrets. Add `FOURSQUARE_API_KEY` with your Foursquare API key. If you don't have a Foursquare key yet, the Edge Function falls back to OpenStreetMap Nominatim automatically (no key needed for Nominatim).
  - [ ] 5.2 **To deploy the Edge Function:** From the `PDXDeliciousnessFinder/` directory, run: `supabase functions deploy enrich-restaurant --project-ref lkqcuycaejbljuexrvjw`. This requires the Supabase CLI to be installed (`brew install supabase/tap/supabase`). If the CLI is not installed, the function can also be copy-pasted into the Supabase Dashboard → Edge Functions → New Function UI.
  - [ ] 5.3 **Verify deployment:** Test the Edge Function from the Dashboard using the "Test" tab with body `{"name": "Gado Gado", "url": "https://gadogadopdx.com"}`. A successful response includes `{"success": true, "data": {"name": "Gado Gado", ...}}`.
  - [ ] 5.4 The `FOURSQUARE_API_KEY` must never appear in `Config.xcconfig`, `Info.plist`, source code, or git history — the architecture explicitly prohibits on-device third-party API keys (see ARCH-5, architecture.md "API Key Management").

---

- [ ] Task 6: Manual smoke test (AC: 1–6)
  - [ ] 6.1 Share a Yelp URL (which returned HTTP 403 to schema.org in Story 4.1) → schema.org returns empty → Edge Function is called → confirmation card pre-fills with data from Places API.
  - [ ] 6.2 Share a URL with complete schema.org data (e.g., Hat Yai or Gado Gado) → schema.org is sufficient → Edge Function is **not** called → confirmation card shows schema.org data (verify in logs/breakpoint that `PlacesEnrichmentService` is never invoked).
  - [ ] 6.3 Put the device in airplane mode → share any URL → confirmation card opens with schema.org data (or empty) and no error modal → all fields remain editable.
  - [ ] 6.4 Temporarily make the Edge Function return `{ "success": false, "error": "simulated failure" }` (edit the function, re-deploy) → share a Yelp URL → confirmation card opens with empty fields, no crash, no error modal.
  - [ ] 6.5 Save a restaurant added via the Places fallback path → verify it appears in the main app list with correct name and address.

## Dev Notes

### Architecture Constraints

- **`PlacesEnrichmentService` must live in `Core/Enrichment/`** and must not import `Features/`, `AppState`, `SyncQueue`, or any main-app-only module. It is imported by the ShareExtension target. This mirrors the same boundary constraint as `SchemaOrgParser` and `PDXConfirmationCard`.
- **`PlacesEnrichmentService` creates its own Supabase client** from `Bundle.main.infoDictionary` rather than using the global `supabase` singleton from `SupabaseClient.swift`. This keeps `SupabaseClient.swift` out of the ShareExtension compile target (the existing pbxproj exception set from Story 4.1 is preserved). There is intentional duplication of the URL-building logic — this is the right tradeoff to maintain extension isolation.
- **Schema.org wins in the merge.** The Places API fills gaps; it never overwrites schema.org data. This is important for accuracy: a restaurant's own website schema.org data is authoritative; Places API is approximate.
- **No UI error modal for enrichment failure.** This is an explicit UX requirement (NFR18): graceful degradation means showing a partial card, never blocking the user with an error.
- **`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` is set project-wide.** Mark `PlacesEnrichmentService` and all its helpers `nonisolated` — the class does network work and must not inherit the `@MainActor` default. Model this after `SchemaOrgParser`.

### Edge Function Design Notes

The `enrich-restaurant` function is intentionally simple: one search call, first result wins. It is not a ranking engine. Portland restaurant uniqueness (especially for food carts) is high enough that a name + "Portland OR" search reliably returns the right place. If ambiguous results are a problem in practice, that's a future refinement.

**Foursquare Places API v3 (Text Search):**
```
GET https://api.foursquare.com/v3/places/search
  ?query=Hat+Yai+Portland+OR
  &near=Portland%2C+OR
  &limit=1
Authorization: <FOURSQUARE_API_KEY>
Accept: application/json
```
Response: `{ results: [{ name, location: { formatted_address }, geocodes: { main: { latitude, longitude } }, categories: [{ name }], price }] }`

**Nominatim (fallback when no Foursquare key):**
```
GET https://nominatim.openstreetmap.org/search
  ?q=Hat+Yai+Portland+OR
  &format=json
  &addressdetails=1
  &limit=1
User-Agent: PDXDeliciousnessFinder/1.0
```
Note: Nominatim usage policy requires a `User-Agent` header identifying the app. Do not remove it.

**Edge Function response contract (both providers produce the same shape):**
```ts
interface EnrichResponse {
  success: boolean;
  data?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    cuisine?: string;
    venueType?: "restaurant" | "bar" | "brewery" | "foodCart";
    priceRange?: "$" | "$$" | "$$$" | "$$$$";
  } | null;
  error?: string;
}
```

### `supabase.functions.invoke` in the Share Extension

The Supabase Swift SDK's `functions.invoke()` requires:
1. A valid `SupabaseURL` and `anonKey` — provided by `PlacesEnrichmentService.makeClient()` from `Bundle.main.infoDictionary`.
2. The ShareExtension does NOT send a user JWT in this call — the anon key is sufficient because the Edge Function does not query the database and does not need RLS. The anon key lets Supabase route the request to the correct project's Edge Function.
3. The `body` parameter to `.init(body: ...)` accepts `Encodable`. Use a `struct EnrichmentRequest: Encodable { let name: String?; let url: String?; let address: String? }` to produce the JSON body cleanly.

### `isNetworkAvailable()` placement

The `isNetworkAvailable()` helper in `ShareExtensionView` blocks the calling thread briefly. Since it's called from inside `.task { await loadURL() }`, which runs off the main thread, the semaphore wait is safe. Do not call it from the main actor directly.

Alternatively, if `NWPathMonitor` causes issues in the extension sandbox, use a simpler check:
```swift
// Fallback: attempt a DNS lookup as a connectivity probe
private func isNetworkAvailable() -> Bool {
    var flags = SCNetworkReachabilityFlags()
    guard let reach = SCNetworkReachabilityCreateWithName(nil, "supabase.co") else { return false }
    SCNetworkReachabilityGetFlags(reach, &flags)
    return flags.contains(.reachable) && !flags.contains(.connectionRequired)
}
```
Add `import SystemConfiguration` if using this version.

### Places API Provider Decision

**Decision (2026-04-15): Start with Nominatim only. Add Foursquare later if needed.**

Rationale: Portland restaurant names are distinctive enough that Nominatim reliably finds them by name + "Portland OR". The only meaningful gap vs. Foursquare is price range pre-fill — which the confirmation card's manual picker covers. Foursquare adds setup friction with no immediate payoff for a personal app.

The Edge Function is already designed to upgrade with zero code changes: add `FOURSQUARE_API_KEY` to Supabase secrets and Foursquare activates automatically. Do this when approaching App Store submission or sharing with others.

**To get a Foursquare key when ready:**
1. Go to foursquare.com/developer → Create an App → API Keys tab
2. Free tier: 1,000 calls/day — sufficient for personal use
3. Add to Supabase Dashboard → Edge Functions → `enrich-restaurant` → Secrets as `FOURSQUARE_API_KEY`

### New Files

```
PDXDeliciousnessFinder/supabase/
└── functions/
    └── enrich-restaurant/
        └── index.ts                ← new (Deno Edge Function)

PDXDeliciousnessFinder/PDXDeliciousnessFinder/Core/Enrichment/
└── PlacesEnrichmentService.swift   ← new
```

Modified files:
- `ShareExtension/ShareExtensionView.swift` — add `.enriching` phase + `PlacesEnrichmentService` call + `isNetworkAvailable()` check
- `ShareExtension/Info.plist` — add `SUPABASE_HOST` and `SUPABASE_ANON_KEY` keys (if not already present)

### References

- [Source: architecture.md#Enrichment Pipeline Location] — "Two-stage hybrid pipeline: on-device schema.org scraping (Stage 1); Supabase Edge Function for Places API fallback (Stage 2)"
- [Source: architecture.md#API Key Management] — "Places API key stored exclusively in Supabase Edge Functions environment variables — never shipped on device"
- [Source: architecture.md#Edge functions naming] — `enrich-restaurant` (kebab-case)
- [Source: architecture.md#Edge Function responses] — "JSON object with explicit `success: Bool` + `data` / `error` fields"
- [Source: epics.md#Story 4.2] — Covers FR10, NFR18, ARCH-5
- [Source: ux-design-specification.md#Journey 1] — Partial enrichment = slower success, never a failure state; no error modals on enrichment failure
