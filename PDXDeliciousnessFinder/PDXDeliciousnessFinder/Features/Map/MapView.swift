import SwiftUI
import SwiftData
import MapKit

/// Full-screen map showing the user's saved restaurants as custom pins.
///
/// AC coverage:
/// - AC1: MapKit map centered on Portland, renders in <2 s (SwiftData local = fast)
/// - AC2/3/4: Pin colors, icons, star via PDXMapPin
/// - AC5: Tap a pin → RestaurantDetailView sheet
/// - AC6: Empty state overlay when no restaurants
/// - AC7: Location permission → center on user; fallback to Portland
/// - AC8: Map tab is index 0 (set in HomeView)
struct MapView: View {
    let userId: UUID

    @Environment(AppState.self) private var appState
    @State private var viewModel = MapViewModel()
    @Query private var restaurants: [Restaurant]
    @State private var showAddSheet = false
    @State private var cameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 45.5051, longitude: -122.6750),
            span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
        )
    )

    init(userId: UUID) {
        self.userId = userId
        _restaurants = Query(
            filter: #Predicate<Restaurant> { $0.userId == userId },
            sort: \Restaurant.updatedAt,
            order: .reverse
        )
    }

    var body: some View {
        // Compute filter pass/fail at the top level of body so SwiftUI's @Observable
        // tracking registers the appState property accesses and re-renders on change.
        let filteredIds = Set(restaurants.filter { appState.isFiltered($0) }.map(\.id))

        Map(position: $cameraPosition) {
            ForEach(restaurants) { restaurant in
                if let coord = restaurant.coordinate {
                    Annotation(restaurant.name, coordinate: coord) {
                        PDXMapPin(
                            restaurant: restaurant,
                            isFilteredOut: !filteredIds.contains(restaurant.id)
                        )
                        .onTapGesture {
                            viewModel.selectedRestaurant = restaurant
                        }
                    }
                    .annotationTitles(.hidden)
                }
            }
            UserAnnotation()
        }
        .mapStyle(.standard(elevation: .flat))
        .ignoresSafeArea(edges: .top)
        .safeAreaInset(edge: .top) {
            FilterBarView(restaurants: restaurants)
        }
        .overlay(alignment: .center) {
            if restaurants.isEmpty {
                emptyStateOverlay
            } else if !restaurants.isEmpty && filteredIds.isEmpty && appState.hasActiveFilters {
                filteredEmptyOverlay
            }
        }
        .sheet(item: $viewModel.selectedRestaurant) { restaurant in
            NavigationStack {
                RestaurantDetailView(restaurant: restaurant)
            }
            // Peek (~220pt) shows name, status badge, venue/price at a glance.
            // Drag up to .large for full detail. Tap map above sheet to dismiss.
            .presentationDetents([.height(220), .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showAddSheet) {
            AddRestaurantView()
        }
        .overlay(alignment: .bottomTrailing) {
            VStack(spacing: 12) {
                // Locate me button — visible only when location is available
                if viewModel.userLocation != nil {
                    Button {
                        guard let loc = viewModel.userLocation else { return }
                        withAnimation {
                            cameraPosition = .region(MKCoordinateRegion(
                                center: loc,
                                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
                            ))
                        }
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.pdxAccent)
                            .frame(width: 44, height: 44)
                            .background(.regularMaterial, in: Circle())
                            .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 1)
                    }
                }

                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .background(Color.pdxAccent, in: Circle())
                        .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 36)
        }
        .onChange(of: viewModel.hasCenteredOnUser) { _, centered in
            if centered, let loc = viewModel.userLocation {
                cameraPosition = .region(MKCoordinateRegion(
                    center: loc,
                    span: MKCoordinateSpan(latitudeDelta: 0.10, longitudeDelta: 0.10)
                ))
            }
        }
        .onChange(of: appState.mapFocusTrigger) { _, _ in
            guard let coord = appState.mapFocusCoordinate else { return }
            withAnimation {
                cameraPosition = .region(MKCoordinateRegion(
                    center: coord,
                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                ))
            }
            appState.mapFocusCoordinate = nil
        }
        .task {
            viewModel.requestLocationPermission()
        }
    }

    // MARK: - Empty / Filtered-Empty States

    private var filteredEmptyOverlay: some View {
        VStack(spacing: 12) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 48))
                .foregroundStyle(Color.pdxAccent.opacity(0.7))

            Text("No restaurants match your filters")
                .font(.headline)
                .multilineTextAlignment(.center)

            Button("Clear Filters") {
                appState.clearAllFilters()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.pdxAccent)
        }
        .padding(24)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 32)
    }

    private var emptyStateOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 64))
                .foregroundStyle(Color.pdxAccent.opacity(0.7))

            Text("Your Portland food map starts here")
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)

            Text("Add restaurants to see them pinned on the map.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button("Add Restaurant") {
                showAddSheet = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.pdxAccent)
        }
        .padding(24)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 32)
    }
}
