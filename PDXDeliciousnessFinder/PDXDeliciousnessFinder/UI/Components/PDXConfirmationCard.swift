import SwiftUI

/// Edited values from the confirmation card, ready to be persisted.
struct ConfirmationCardResult {
    var name: String
    var address: String?
    var website: String?
    var cuisine: String?
    var venueType: VenueType
    var priceRange: PriceRange?
    var status: RestaurantStatus
    var latitude: Double?
    var longitude: Double?
    var sourceUrl: String?
}

/// A standalone form card that pre-fills from an `EnrichmentResult` and
/// lets the user review/edit before saving.
///
/// Design constraints (architecture):
/// - Lives in `UI/Components/` — importable by main app AND ShareExtension
/// - Must NOT import `Features/` or use `AppState` / `@Environment(AppState.self)`
/// - Writes no data itself — calls back via `onSave` / `onCancel`
struct PDXConfirmationCard: View {
    let enrichment: EnrichmentResult
    let existingCuisines: [String]
    var isSaving: Bool = false
    let onSave: (ConfirmationCardResult) -> Void
    let onCancel: () -> Void

    // MARK: - Local editing state
    @State private var name: String
    @State private var address: String
    @State private var website: String
    @State private var cuisine: String
    @State private var venueType: VenueType
    @State private var priceRange: PriceRange?
    @State private var status: RestaurantStatus
    @FocusState private var cuisineFocused: Bool

    init(
        enrichment: EnrichmentResult,
        existingCuisines: [String] = [],
        isSaving: Bool = false,
        onSave: @escaping (ConfirmationCardResult) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.enrichment = enrichment
        self.existingCuisines = existingCuisines
        self.isSaving = isSaving
        self.onSave = onSave
        self.onCancel = onCancel
        _name = State(initialValue: enrichment.name ?? "")
        _address = State(initialValue: enrichment.address ?? "")
        _website = State(initialValue: enrichment.website ?? "")
        _cuisine = State(initialValue: enrichment.cuisine ?? "")
        _venueType = State(initialValue: enrichment.venueType ?? .restaurant)
        _priceRange = State(initialValue: enrichment.priceRange)
        _status = State(initialValue: .wantToGo)
    }

    private var cuisineSuggestions: [String] {
        let input = cuisine.trimmingCharacters(in: .whitespaces)
        guard !input.isEmpty else { return [] }
        return existingCuisines.filter {
            $0.localizedCaseInsensitiveContains(input) &&
            $0.localizedCaseInsensitiveCompare(input) != .orderedSame
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Drag handle
            Capsule()
                .fill(Color(.systemGray4))
                .frame(width: 40, height: 4)
                .padding(.top, 8)
                .padding(.bottom, 12)

            Text("Save Restaurant")
                .font(.headline)
                .padding(.bottom, 16)

            Form {
                Section("Restaurant Info") {
                    TextField("Name (required)", text: $name)
                    TextField("Address", text: $address)
                    TextField("Website", text: $website)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                    TextField("Cuisine", text: $cuisine)
                        .focused($cuisineFocused)
                    if cuisineFocused && !cuisineSuggestions.isEmpty {
                        ForEach(cuisineSuggestions, id: \.self) { suggestion in
                            Button {
                                cuisine = suggestion
                                cuisineFocused = false
                            } label: {
                                Text(suggestion).foregroundStyle(.primary)
                            }
                        }
                    }
                }

                Section("Details") {
                    Picker("Venue Type", selection: $venueType) {
                        ForEach(VenueType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }

                    Picker("Price Range", selection: $priceRange) {
                        Text("Not specified").tag(PriceRange?.none)
                        ForEach(PriceRange.allCases, id: \.self) { range in
                            Text(range.displayName).tag(PriceRange?.some(range))
                        }
                    }

                    Picker("Status", selection: $status) {
                        ForEach(RestaurantStatus.allCases, id: \.self) { s in
                            Text(s.displayName).tag(s)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)

            // Button row
            HStack(spacing: 12) {
                Button("Cancel") {
                    onCancel()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(.systemGray5))
                .foregroundStyle(.primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    let result = ConfirmationCardResult(
                        name: name,
                        address: address.isEmpty ? nil : address,
                        website: website.isEmpty ? nil : website,
                        cuisine: { let t = cuisine.trimmingCharacters(in: .whitespaces); return t.isEmpty ? nil : t }(),
                        venueType: venueType,
                        priceRange: priceRange,
                        status: status,
                        latitude: enrichment.latitude,
                        longitude: enrichment.longitude,
                        sourceUrl: enrichment.sourceUrl
                    )
                    onSave(result)
                } label: {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Save")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(name.isEmpty || isSaving ? Color(.systemGray4) : Color.pdxAccent)
                .foregroundStyle(name.isEmpty || isSaving ? Color(.systemGray2) : .white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(name.isEmpty || isSaving)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(Color(.systemBackground))
    }
}

