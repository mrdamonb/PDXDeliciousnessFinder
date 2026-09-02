import SwiftUI
import SafariServices

/// Presents a URL in an in-app Safari view controller, layered over the presenting sheet.
///
/// `SFSafariViewController` dismisses itself when the user taps its own Done button,
/// which happens outside SwiftUI's presentation binding. Without the delegate below the
/// binding stays set and the next tap on the presenting control does nothing.
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    var onFinish: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinish: onFinish)
    }

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}

    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        private let onFinish: (() -> Void)?

        init(onFinish: (() -> Void)?) {
            self.onFinish = onFinish
        }

        func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
            onFinish?()
        }
    }
}
