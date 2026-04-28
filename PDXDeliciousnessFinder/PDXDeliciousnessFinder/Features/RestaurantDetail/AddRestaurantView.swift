import SwiftUI
import SwiftData
import Auth

struct AddRestaurantView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var viewModel = AddRestaurantViewModel()

    var body: some View {
        NavigationStack {
            RestaurantFormView(viewModel: viewModel)
                .navigationTitle("Add Restaurant")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            Task { await save() }
                        }
                        .disabled(viewModel.saveState.isLoading)
                    }
                }
        }
    }

    private func save() async {
        guard let userId = appState.currentUser?.id else { return }
        let succeeded = await viewModel.save(
            repository: appState.restaurantRepository,
            userId: userId
        )
        if succeeded { dismiss() }
    }
}

// MARK: - Shared form fields

struct RestaurantFormView: View {
    @Bindable var viewModel: AddRestaurantViewModel
    @Query private var allRestaurants: [Restaurant]
    @FocusState private var cuisineFocused: Bool

    init(viewModel: AddRestaurantViewModel) {
        self.viewModel = viewModel
    }

    /// Unique cuisines already saved, filtered to the current input.
    /// Hidden when the field is empty or already matches exactly.
    private var cuisineSuggestions: [String] {
        let input = viewModel.cuisine.trimmingCharacters(in: .whitespaces)
        guard !input.isEmpty else { return [] }
        let known = Set(allRestaurants.compactMap(\.cuisine).filter { !$0.isEmpty })
        return known
            .filter {
                $0.localizedCaseInsensitiveContains(input) &&
                $0.localizedCaseInsensitiveCompare(input) != .orderedSame
            }
            .sorted()
    }

    var body: some View {
        Form {
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

                switch viewModel.searchState {
                case .loaded(let places) where places.isEmpty:
                    Text("No results — fill in the form below.")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                case .loaded(let places):
                    ForEach(places, id: \.name) { place in
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
                    }
                case .error:
                    Text("Search requires an internet connection.")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                default:
                    EmptyView()
                }
            }

            Section {
                VStack(alignment: .leading, spacing: 4) {
                    TextField("Restaurant Name", text: $viewModel.name)
                        .textContentType(.organizationName)
                    if let error = viewModel.nameError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            } header: {
                Text("Required")
            }

            Section("Details") {
                Picker("Status", selection: $viewModel.status) {
                    ForEach(RestaurantStatus.allCases, id: \.self) { s in
                        Text(s.displayName).tag(s)
                    }
                }
                Picker("Venue Type", selection: $viewModel.venueType) {
                    ForEach(VenueType.allCases, id: \.self) { type in
                        Label(type.displayName, systemImage: type.icon).tag(type)
                    }
                }
                Picker("Price Range", selection: $viewModel.priceRange) {
                    Text("Not set").tag(Optional<PriceRange>.none)
                    ForEach(PriceRange.allCases, id: \.self) { price in
                        Text(price.displayString).tag(Optional(price))
                    }
                }
                TextField("Cuisine (e.g. Thai, Pizza)", text: $viewModel.cuisine)
                    .focused($cuisineFocused)
                if cuisineFocused && !cuisineSuggestions.isEmpty {
                    ForEach(cuisineSuggestions, id: \.self) { suggestion in
                        Button {
                            viewModel.cuisine = suggestion
                            cuisineFocused = false
                        } label: {
                            Text(suggestion)
                                .foregroundStyle(.primary)
                        }
                    }
                }
            }

            Section("Location") {
                TextField("Address", text: $viewModel.address)
                    .textContentType(.fullStreetAddress)
                TextField("Neighborhood", text: $viewModel.neighborhood)
                TextField("City", text: $viewModel.city)
                    .textContentType(.addressCity)
            }

            Section("More") {
                TextField("Website", text: $viewModel.website)
                    .textContentType(.URL)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                TextField("Note", text: $viewModel.generalNote, axis: .vertical)
                    .lineLimit(3...6)
            }

            if case .error(let error) = viewModel.saveState {
                Section {
                    Text(error.localizedDescription)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
        }
    }
}

