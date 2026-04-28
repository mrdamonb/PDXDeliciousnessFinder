import SwiftUI
import CoreLocation

struct EditRestaurantView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let restaurant: Restaurant

    // Copy fields into local state — Cancel discards without touching the model.
    @State private var viewModel: AddRestaurantViewModel

    init(restaurant: Restaurant) {
        self.restaurant = restaurant
        let vm = AddRestaurantViewModel()
        vm.name = restaurant.name
        vm.address = restaurant.address ?? ""
        vm.city = restaurant.city
        vm.website = restaurant.website ?? ""
        vm.cuisine = restaurant.cuisine ?? ""
        vm.neighborhood = restaurant.neighborhood ?? ""
        vm.venueType = restaurant.venueType
        vm.priceRange = restaurant.priceRange
        vm.generalNote = restaurant.generalNote ?? ""
        _viewModel = State(initialValue: vm)
    }

    var body: some View {
        NavigationStack {
            RestaurantFormView(viewModel: viewModel)
                .navigationTitle("Edit Restaurant")
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
        guard viewModel.validate() else { return }
        viewModel.saveState = .loading
        do {
            let newAddress = viewModel.address.isEmpty ? nil : viewModel.address
            let addressChanged = newAddress != restaurant.address
            // Re-geocode if the address changed or coordinates are missing.
            if addressChanged || restaurant.latitude == nil {
                let (lat, lon) = await viewModel.geocode(
                    address: viewModel.address,
                    city: viewModel.city.isEmpty ? "Portland" : viewModel.city
                )
                restaurant.latitude = lat
                restaurant.longitude = lon
            }
            restaurant.name = viewModel.name.trimmingCharacters(in: .whitespaces)
            restaurant.address = newAddress
            restaurant.city = viewModel.city.isEmpty ? "Portland" : viewModel.city
            restaurant.website = viewModel.website.isEmpty ? nil : viewModel.website
            restaurant.cuisine = viewModel.cuisine.isEmpty ? nil : viewModel.cuisine
            // Re-detect neighborhood when address changed or field is blank.
            // If the user typed a custom neighborhood and the address didn't change, preserve it.
            if addressChanged || viewModel.neighborhood.isEmpty {
                if let lat = restaurant.latitude, let lon = restaurant.longitude {
                    let coord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
                    restaurant.neighborhood = NeighborhoodService.shared.neighborhood(for: coord)
                } else {
                    restaurant.neighborhood = nil
                }
            } else {
                restaurant.neighborhood = viewModel.neighborhood
            }
            restaurant.venueType = viewModel.venueType
            restaurant.priceRange = viewModel.priceRange
            restaurant.generalNote = viewModel.generalNote.isEmpty ? nil : viewModel.generalNote
            try appState.restaurantRepository.update(restaurant)
            viewModel.saveState = .loaded(())
            dismiss()
        } catch {
            viewModel.saveState = .error(.persistence(underlying: error))
        }
    }
}
