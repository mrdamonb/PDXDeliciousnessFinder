import SwiftUI

/// Shown while `AppState.initialize()` is still running, before `ContentRouter`
/// can decide between `OnboardingView` and `HomeView`. Replaces a bare
/// `ProgressView()` with the app's actual branding.
struct SplashView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 140, height: 140)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

            Text("PDX Deliciousness Finder")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

#Preview {
    SplashView()
}
