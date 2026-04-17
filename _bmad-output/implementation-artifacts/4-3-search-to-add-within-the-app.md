# Story 4.3: Search-to-Add Within the App

Status: ready

## Story

As a Portland food enthusiast,
I want to search for a restaurant by name from inside the app and add it to my list,
So that I have a fallback when I don't have a URL to share.

## Acceptance Criteria

1. **Given** I am on the add restaurant screen **When** I type a restaurant name and tap "Search" **Then** the app calls the `search-places` Edge Function and returns matching restaurants with name, address, and available metadata.

2. **Given** search results are displayed **When** I tap a result **Then** the form fields pre-fill with the result's data — all fields remain editable before saving.

3. **Given** the search returns no results **When** I see the empty state **Then** I am offered a clear path to the manual form (inline message: "No results — fill in the form below.").

4. **Given** I search while offline **When** the search fails **Then** an inline message explains search requires connectivity — no error modal, no crash, manual form remains usable.

5. **Given** search results are shown **When** I dismiss the results without selecting **Then** the form is blank and ready for manual entry.

## Tasks / Subtasks

> ⚠️ **PREREQUISITE: Story 4.2 Fix**
>
> Before implementing 4.3, the 4.2 edge function must be fixed and Foursquare must be configured. Complete these steps first:
>
> **Step 1 — Get a Foursquare API key:**
> 1. foursquare.com/developer → Create App → API Keys tab
> 2. Copy the key
> 3. Supabase Dashboard → Edge Functions → `enrich-restaurant` → Secrets → add `FOURSQUARE_API_KEY`
>
> **Step 2 — Fix `enrich-restaurant` for Yelp short URLs:**
> Update `supabase/functions/enrich-restaurant/index.ts` to follow URL redirects when `body.url` is present and `body.name` is absent, extracting the business name from the resolved URL slug (see Task 1 below).
>
> **Step 3 — Deploy updated `enrich-restaurant`:**
> `npx supabase functions deploy enrich-restaurant --project-ref lkqcuycaejbljuexrvjw`

---

- [ ] Task 1: Fix `enrich-restaurant` to follow redirects and extract business name from Yelp URLs (4.2 fix, AC for 4.2 story)
  - [ ] 1.1 In `buildSearchQuery`, if `body.name` is absent but `body.url` is present, attempt to extract a business name from the URL. First, if the URL contains `/biz/` (Yelp full URL), extract the slug: `"yelp.com/biz/bellwether-coffee-portland-2"` → `"bellwether coffee"` (strip city suffix — last hyphen-word group if it matches a city name or is a number). If the URL is a short URL (no `/biz/`), follow the redirect to get the full URL, then extract.
  - [ ] 1.2 Implement redirect following with a `HEAD` fetch (or `GET` with `redirect: "follow"`) and a 5-second timeout. Extract the final URL from `response.url`. Wrap in try/catch — if redirect fails, fall through to query of just "Portland OR" (existing behavior).
  - [ ] 1.3 The updated `buildSearchQuery` signature:
    ```ts
    async function buildSearchQuery(body: RequestBody): Promise<string>
    ```
    — make the function `async` to support redirect following; update the call site in `serve` accordingly.
  - [ ] 1.4 Deploy updated function: `npx supabase functions deploy enrich-restaurant --project-ref lkqcuycaejbljuexrvjw`

---

- [ ] Task 2: Create the `search-places` Supabase Edge Function (AC: 1, 3, 4)
  - [ ] 2.1 Create `supabase/functions/search-places/index.ts`. Copy the CORS headers and provider selection logic from `enrich-restaurant/index.ts` — same Foursquare-first, Nominatim-fallback pattern.
  - [ ] 2.2 Accept `POST` with body:
    ```ts
    { query: string; limit?: number }
    ```
    If `query` is absent or empty, return `{ success: false, error: "query is required" }` with HTTP 400. Default `limit` to 5; cap at 10.
  - [ ] 2.3 Build the search query: `"${query} Portland OR"`. Call Foursquare Text Search with `limit` param. If Foursquare key is absent, call Nominatim with `limit=5`.
  - [ ] 2.4 Return up to `limit` results as an array (not a single result like `enrich-restaurant`):
    ```ts
    { success: true, results: EnrichedPlace[] }
    ```
    Each `EnrichedPlace` has the same shape as in `enrich-restaurant`: `{ name?, address?, latitude?, longitude?, cuisine?, venueType?, priceRange? }`.
  - [ ] 2.5 On any error (API failure, parse error), return `{ success: false, error: "<message>" }` with HTTP 200. Never 5xx.
  - [ ] 2.6 Include CORS headers on all responses and handle `OPTIONS` preflight (same pattern as `enrich-restaurant`).
  - [ ] 2.7 Deploy: `npx supabase functions deploy search-places --project-ref lkqcuycaejbljuexrvjw`

---

- [ ] Task 3: Create `Core/Enrichment/PlacesSearchService.swift` (AC: 1, 3, 4)
  - [ ] 3.1 Create `PDXDeliciousnessFinder/Core/Enrichment/PlacesSearchService.swift`. Uses URLSession directly (no Supabase SDK import) — same pattern as `PlacesEnrichmentService`. All methods `nonisolated`.
  - [ ] 3.2 Define a result type:
    ```swift
    struct PlaceSearchResult {
        let name: String
        let address: String?
        let latitude: Double?
        let longitude: Double?
        let cuisine: String?
        let venueType: VenueType?
        let priceRange: PriceRange?
    }
    ```
  - [ ] 3.3 Define `Codable` DTOs matching the edge function response:
    ```swift
    private struct SearchResponse: Codable {
        let success: Bool
        let results: [SearchResultDTO]?
        let error: String?
    }
    private struct SearchResultDTO: Codable {
        let name: String?
        let address: String?
        let latitude: Double?
        let longitude: Double?
        let cuisine: String?
        let venueType: String?
        let priceRange: String?
    }
    ```
  - [ ] 3.4 Implement:
    ```swift
    nonisolated func search(query: String) async -> Result<[PlaceSearchResult], Error>
    ```
    - Build the request: `POST https://<host>/functions/v1/search-places` with body `{ "query": query, "limit": 5 }`, headers `apikey` and `Authorization: Bearer <anonKey>`.
    - Decode response as `SearchResponse`.
    - If `success == true`, map `results` to `[PlaceSearchResult]` filtering out entries with nil `name`.
    - On `success == false` or network/decode error, return `.failure(...)`.
    - Timeout: 10 seconds.
  - [ ] 3.5 Use the same `credentials()` helper pattern as `PlacesEnrichmentService` — read from `Bundle.main.infoDictionary`. Return `.failure` if credentials are missing.
  - [ ] 3.6 Reuse `venueTypeFromString` and `priceRangeFromString` mapping logic. (If desired, extract these into a small `PlacesMapping.swift` file to share between `PlacesEnrichmentService` and `PlacesSearchService` — but only do this if it genuinely reduces duplication; otherwise repeat them.)

---

- [ ] Task 4: Update `AddRestaurantViewModel` to support search (AC: 1, 2, 3, 4, 5)
  - [ ] 4.1 Add to `AddRestaurantViewModel`:
    ```swift
    var searchQuery = ""
    var searchState: ViewState<[PlaceSearchResult]> = .idle
    ```
  - [ ] 4.2 Add method:
    ```swift
    func searchPlaces() async {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        searchState = .loading
        let result = await PlacesSearchService().search(query: query)
        switch result {
        case .success(let places):
            searchState = .loaded(places)
        case .failure:
            searchState = .error(.network)   // use existing AppError.network or nearest equivalent
        }
    }
    ```
  - [ ] 4.3 Add method to pre-fill form fields from a search result:
    ```swift
    func populate(from result: PlaceSearchResult) {
        name = result.name
        address = result.address ?? ""
        if let lat = result.latitude, let lon = result.longitude {
            // Store coords for use during save — add latitude/longitude fields to the ViewModel
        }
        cuisine = result.cuisine ?? ""
        if let vt = result.venueType { venueType = vt }
        if let pr = result.priceRange { priceRange = pr }
        searchState = .idle   // dismiss results
        searchQuery = ""
    }
    ```
  - [ ] 4.4 Add `var latitude: Double? = nil` and `var longitude: Double? = nil` to the ViewModel. Update `save()` to skip the `geocode()` call if both are already set (the Places API returned them). Fall back to `geocode()` if they're nil.

---

- [ ] Task 5: Update `AddRestaurantView` with search UI (AC: 1, 2, 3, 4, 5)
  - [ ] 5.1 Add a search section at the TOP of the `Form` in `RestaurantFormView`, above the "Required" section:
    ```swift
    Section("Search") {
        HStack {
            TextField("Restaurant name…", text: $viewModel.searchQuery)
                .textContentType(.organizationName)
                .submitLabel(.search)
                .onSubmit { Task { await viewModel.searchPlaces() } }
            if viewModel.searchState.isLoading {
                ProgressView()
            } else {
                Button("Search") {
                    Task { await viewModel.searchPlaces() }
                }
                .disabled(viewModel.searchQuery.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
    ```
  - [ ] 5.2 Below the search row, show results inline (still within the "Search" section):
    - `.loaded(let places)` where `places` is non-empty: show a `ForEach` of result rows. Each row shows `name` (bold) and `address` (secondary, caption). Tap → call `viewModel.populate(from: place)`.
    - `.loaded([])` (empty array): show `Text("No results — fill in the form below.").foregroundStyle(.secondary).font(.footnote)`.
    - `.error`: show `Text("Search requires an internet connection.").foregroundStyle(.secondary).font(.footnote)`.
    - `.loading` and `.idle`: show nothing extra (the ProgressView in the search bar covers loading).
  - [ ] 5.3 Each result row:
    ```swift
    Button {
        viewModel.populate(from: place)
    } label: {
        VStack(alignment: .leading, spacing: 2) {
            Text(place.name).foregroundStyle(.primary)
            if let address = place.address {
                Text(address).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
    ```
  - [ ] 5.4 After `populate()` is called, `searchState` returns to `.idle` and the results disappear. The form fields are now pre-filled. No sheet, no navigation — the results collapse in place.
  - [ ] 5.5 The existing "Required", "Details", "Location", and "More" form sections are unchanged. The pre-filled fields are fully editable.

---

- [ ] Task 6: Manual smoke test (AC: 1–5)
  - [ ] 6.1 Open Add Restaurant → type "Bellwether" → tap Search → results appear with Bellwether Coffee pre-filled → tap result → form fills with name, address, coordinates, venue type.
  - [ ] 6.2 Tap Search with a nonsense query → "No results" inline message appears → form remains usable below.
  - [ ] 6.3 Put device in airplane mode → tap Search → "Search requires an internet connection" message → no crash, no modal, form usable.
  - [ ] 6.4 Populate from a search result → tap Save → restaurant appears in list and on map with correct pin location (coordinates came from Foursquare, not MapKit geocoder).
  - [ ] 6.5 Share a Yelp URL → "Finding restaurant details…" → confirmation card pre-fills correctly (4.2 fix verified).

## Dev Notes

### Why a separate `search-places` function?

`enrich-restaurant` is designed for single-result enrichment given a known URL. `search-places` is designed for multi-result lookup from a user-typed query. Keeping them separate means:
- `enrich-restaurant` can be optimized for speed (first result wins)
- `search-places` can return ranked lists and tune `limit`
- Both can evolve independently without coupling their failure modes

### Coordinates from Places vs. MapKit geocoder

When `populate(from:)` stores `latitude`/`longitude` from Foursquare, `save()` must skip the `geocode()` call — Foursquare coordinates are more accurate than MapKit for restaurant-specific locations (MapKit geocodes the address string, which can drift to the street midpoint; Foursquare pins to the actual establishment).

### `ViewState<[PlaceSearchResult]>` for search results

This follows ARCH-8 (all async UI state uses `ViewState<T>`). The `.idle` state means "no search yet" — the search section shows only the search bar. The `.loaded([])` state means "searched and got nothing" — show the empty state message. This distinction matters for UX: don't show "No results" before the user has searched.

### No `AppError.network` member?

If `AppError` doesn't have a `.network` case, use `.persistence(underlying: URLError(.notConnectedToInternet))` or add a `.network` case to `AppError`. Check `Core/AppError.swift` before deciding.

### New Files

```
PDXDeliciousnessFinder/supabase/functions/search-places/
└── index.ts                               ← new Edge Function

PDXDeliciousnessFinder/Core/Enrichment/
└── PlacesSearchService.swift              ← new
```

Modified files:
- `supabase/functions/enrich-restaurant/index.ts` — redirect following for Yelp URLs (4.2 fix)
- `Features/RestaurantDetail/AddRestaurantView.swift` — search section added to form
- `Features/RestaurantDetail/AddRestaurantViewModel.swift` — search state + populate method + stored coords

### References

- [Source: epics.md#Story 4.3] — covers FR13, ARCH-5
- [Source: architecture.md#API Key Management] — `FOURSQUARE_API_KEY` in Supabase secrets only, never on-device
- [Source: architecture.md#ARCH-8] — `ViewState<T>` for all async UI state
