import SwiftUI
import Auth

/// Primary post-auth shell (Epic 3+).
///
/// Tab 0 (default): Map — full-screen Portland map with restaurant pins.
/// Tab 1: List — the filterable restaurant list.
///
/// The Sign Out action lives on the List tab toolbar so it remains accessible
/// without cluttering the full-bleed map chrome.
struct HomeView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        if let userId = appState.currentUser?.id {
            @Bindable var appState = appState
            TabView(selection: $appState.selectedTab) {
                MapView(userId: userId)
                    .tabItem { Label("Map", systemImage: "map") }
                    .tag(0)

                NavigationStack {
                    RestaurantListView(userId: userId)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Sign Out") {
                                    Task { try? await appState.signOut() }
                                }
                            }
                        }
                }
                .tabItem { Label("List", systemImage: "list.bullet") }
                .tag(1)
            }
        }
    }
}
