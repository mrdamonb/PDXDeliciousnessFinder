import SwiftUI
import SwiftData
import UniformTypeIdentifiers
import MapKit

/// The SwiftUI root view for the PDX Deliciousness Finder share extension.
///
/// Responsibilities:
/// - Extracts the shared URL from the extension context
/// - Runs `SchemaOrgParser` to produce an `EnrichmentResult`
/// - Presents `PDXConfirmationCard` for review/editing
/// - Writes the confirmed restaurant to the shared SwiftData store
/// - Never imports AppState, SyncQueue, RealtimeSubscriptions, or NetworkMonitor
struct ShareExtensionView: View {
    let extensionContext: NSExtensionContext?

    @State private var phase: Phase = .loading
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var pendingSave: (ConfirmationCardResult, EnrichmentResult)?

    private var modelContext: ModelContext {
        PersistenceController.sharedModelContainer.mainContext
    }

    var body: some View {
        ZStack {
            switch phase {
            case .loading:
                VStack(spacing: 16) {
                    ProgressView()
                    Text("Loading restaurant info…")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .enriching:
                VStack(spacing: 16) {
                    ProgressView()
                    Text("Finding restaurant details…")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .notSignedIn:
                VStack(spacing: 16) {
                    Image(systemName: "person.slash")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("Sign in to PDX Deliciousness Finder first.")
                        .multilineTextAlignment(.center)
                    Button("Cancel") { cancel() }
                        .padding(.top, 4)
                }
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .ready(let result):
                VStack(spacing: 0) {
                    if let error = saveError {
                        HStack(spacing: 12) {
                            Text(error)
                                .foregroundStyle(.red)
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Button("Retry") {
                                guard let pending = pendingSave else { return }
                                saveError = nil
                                isSaving = true
                                Task { await save(from: pending.0, enrichment: pending.1) }
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.red)
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .background(.red.opacity(0.08))
                    }
                    PDXConfirmationCard(
                        enrichment: result,
                        existingCuisines: existingCuisines,
                        isSaving: isSaving,
                        onSave: { cardResult in
                            guard !isSaving else { return }
                            saveError = nil
                            pendingSave = (cardResult, result)
                            isSaving = true
                            Task { await save(from: cardResult, enrichment: result) }
                        },
                        onCancel: { cancel() }
                    )
                }
            }
        }
        .task { await loadURL() }
    }

    // MARK: - Existing cuisines (for autocomplete in the card)

    private var existingCuisines: [String] {
        let descriptor = FetchDescriptor<Restaurant>()
        let all = (try? modelContext.fetch(descriptor)) ?? []
        var seen = Set<String>()
        return all
            .compactMap(\.cuisine)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
            .sorted()
    }

    // MARK: - URL extraction

    private func loadURL() async {
        guard let _ = userIdFromDefaults() else {
            phase = .notSignedIn
            return
        }

        guard let url = await extractURL() else {
            phase = .ready(EnrichmentResult(sourceUrl: ""))
            return
        }

        let urlOnly = EnrichmentResult(sourceUrl: url.absoluteString)
        phase = .enriching(urlOnly)

        // Fire schema.org fetch and Places enrichment in parallel — both only need the URL.
        async let schemaTask = SchemaOrgParser().parse(url: url)
        async let enrichTask = PlacesEnrichmentService().enrich(from: urlOnly)
        var (schema, enriched) = await (schemaTask, enrichTask)

        // If the page had no schema.org website field, the shared URL itself is the website.
        if schema.website == nil, !schema.sourceUrl.isEmpty {
            schema.website = schema.sourceUrl
        }

        // Merge: schema.org wins where it found data; edge function fills nil gaps.
        var merged = enriched
        merged.name      = schema.name      ?? enriched.name
        merged.address   = schema.address   ?? enriched.address
        merged.latitude  = schema.latitude  ?? enriched.latitude
        merged.longitude = schema.longitude ?? enriched.longitude
        merged.website   = schema.website   ?? enriched.website
        merged.cuisine   = schema.cuisine   ?? enriched.cuisine
        merged.venueType = schema.venueType ?? enriched.venueType
        merged.priceRange = schema.priceRange ?? enriched.priceRange

        phase = .ready(await geocodingIfNeeded(merged))
    }

    private func extractURL() async -> URL? {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first else { return nil }

        // Try public.url first, then fall back to plain text
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            return await withCheckedContinuation { cont in
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, _ in
                    cont.resume(returning: item as? URL)
                }
            }
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            return await withCheckedContinuation { cont in
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                    if let str = item as? String, let url = URL(string: str) {
                        cont.resume(returning: url)
                    } else {
                        cont.resume(returning: nil)
                    }
                }
            }
        }

        return nil
    }

    // MARK: - Save

    private func save(from result: ConfirmationCardResult, enrichment: EnrichmentResult) async {
        guard let userId = userIdFromDefaults() else {
            saveError = "Not signed in. Please open PDX Deliciousness Finder and sign in."
            isSaving = false
            return
        }

        do {
            // Geocode if we still lack coordinates — picks up whatever name/address the user typed.
            var lat = result.latitude
            var lon = result.longitude
            if lat == nil || lon == nil {
                let query: String
                if let address = result.address, !address.isEmpty {
                    query = address.localizedCaseInsensitiveContains("portland")
                        ? address : "\(address), Portland, OR"
                } else if !result.name.isEmpty {
                    query = "\(result.name), Portland, OR"
                } else {
                    query = ""
                }
                if !query.isEmpty,
                   let coord = try? await MKLocalSearch(request: {
                       let r = MKLocalSearch.Request()
                       r.naturalLanguageQuery = query
                       return r
                   }()).start().mapItems.first?.location.coordinate {
                    lat = coord.latitude
                    lon = coord.longitude
                }
            }

            let restaurant = Restaurant(
                userId: userId,
                name: result.name,
                address: result.address,
                latitude: lat,
                longitude: lon,
                city: "Portland",
                website: result.website,
                cuisine: result.cuisine,
                venueType: result.venueType,
                priceRange: result.priceRange,
                status: result.status,
                sourceUrl: result.sourceUrl
            )

            modelContext.insert(restaurant)
            try modelContext.save()

            // Queue sync operation for the main app to process on next launch/foreground
            let op = SyncOperation(
                table: SupabaseTables.restaurants,
                action: .upsert,
                recordId: restaurant.id
            )
            modelContext.insert(op)
            try modelContext.save()

            // Signal to main app that a pending write exists
            UserDefaults(suiteName: PersistenceController.appGroupID)?
                .set(true, forKey: "pendingExtensionWrite")

            extensionContext?.completeRequest(returningItems: nil)
        } catch {
            saveError = "Save failed: \(error.localizedDescription)"
            isSaving = false
        }
    }

    // MARK: - Geocoding

    /// Returns `result` unchanged if it already has coordinates or no address.
    /// Otherwise attempts a MapKit lookup and fills in lat/lon before returning.
    private func geocodingIfNeeded(_ result: EnrichmentResult) async -> EnrichmentResult {
        guard result.latitude == nil || result.longitude == nil else { return result }

        // Prefer address; fall back to name so a restaurant with no address still gets a pin.
        let rawQuery: String
        if let address = result.address, !address.isEmpty {
            rawQuery = address
        } else if let name = result.name, !name.isEmpty {
            rawQuery = name
        } else {
            return result
        }

        let query = rawQuery.localizedCaseInsensitiveContains("portland")
            ? rawQuery
            : "\(rawQuery), Portland, OR"

        var updated = result
        do {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            let response = try await MKLocalSearch(request: request).start()
            if let coord = response.mapItems.first?.location.coordinate {
                updated.latitude = coord.latitude
                updated.longitude = coord.longitude
            }
        } catch {}
        return updated
    }

    // MARK: - Network check

    private func cancel() {
        extensionContext?.cancelRequest(
            withError: NSError(
                domain: "com.damonbrennen.PDXDeliciousnessFinder",
                code: NSUserCancelledError
            )
        )
    }

    // MARK: - Shared UserDefaults

    private func userIdFromDefaults() -> UUID? {
        guard let str = UserDefaults(suiteName: PersistenceController.appGroupID)?
            .string(forKey: "currentUserId") else { return nil }
        return UUID(uuidString: str)
    }
}

// MARK: - Phase

private enum Phase {
    case loading
    case notSignedIn
    case enriching(EnrichmentResult)   // schema.org done; Places call in flight
    case ready(EnrichmentResult)
}
