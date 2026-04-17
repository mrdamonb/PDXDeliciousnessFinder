import SwiftUI
import SwiftData

@main
struct PDXDeliciousnessFinder: App {
    let modelContainer = PersistenceController.sharedModelContainer
    @State private var appState: AppState

    init() {
        let context = PersistenceController.sharedModelContainer.mainContext
        _appState = State(initialValue: AppState(modelContext: context))
    }

    var body: some Scene {
        WindowGroup {
            ContentRouter()
                .environment(appState)
                .modelContainer(modelContainer)
        }
    }
}

// ContentRouter lives at the root of the view hierarchy for the lifetime of the
// app. Its .task initializes the auth stream once and keeps it running — routing
// to OnboardingView or HomeView based on auth state.
private struct ContentRouter: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if appState.isLoading {
                ProgressView()
                    .controlSize(.large)
            } else if appState.currentUser == nil {
                OnboardingView()
            } else {
                HomeView()
            }
        }
        .task {
            await appState.initialize()
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { await appState.reconcileOnForeground() }
            }
        }
    }
}
