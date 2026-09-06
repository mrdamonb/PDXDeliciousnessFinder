import SwiftUI
import SafariServices

/// Presents a URL in an in-app Safari view controller, layered over the presenting sheet.
///
/// Per `SFSafariViewControllerDelegate` docs, tapping the Done button does **not**
/// dismiss the controller on its own — the delegate is responsible for calling
/// `dismiss(animated:)` on it. Only clearing the SwiftUI binding (the previous
/// implementation here) left the controller in limbo: swipe-to-dismiss worked because
/// that's a genuinely different path (UIKit's own interactive transition, no delegate
/// involved), but tapping Done triggered a state change with no matching dismiss call,
/// and the resulting mismatch cascaded the dismissal up through every sheet presented
/// above this one instead of just this one (device report, 2026-09-05 — reproduced via
/// Done, not reproducible via swipe, on the History → Add Visit → Safari path).
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
            // Dismiss the controller ourselves, as the delegate contract requires,
            // and only clear the SwiftUI binding once that dismissal has actually
            // completed — otherwise the binding change and the pending dismiss can
            // race and unwind more of the presentation stack than intended.
            controller.dismiss(animated: true) { [weak self] in
                self?.onFinish?()
            }
        }
    }
}
