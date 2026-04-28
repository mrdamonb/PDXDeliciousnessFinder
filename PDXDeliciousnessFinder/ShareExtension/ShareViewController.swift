import UIKit
import SwiftUI

/// Thin view controller that hosts the SwiftUI `ShareExtensionView`.
/// The storyboard's initial view controller is this class.
final class ShareViewController: UIViewController {

    private var hostingController: UIHostingController<ShareExtensionView>?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.systemBackground
        preferredContentSize = CGSize(width: UIScreen.main.bounds.width, height: 520)

        let rootView = ShareExtensionView(extensionContext: extensionContext)
        let hosting = UIHostingController(rootView: rootView)
        hostingController = hosting

        addChild(hosting)
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        hosting.view.backgroundColor = .clear
        view.addSubview(hosting.view)

        NSLayoutConstraint.activate([
            hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
            hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        hosting.didMove(toParent: self)
    }
}
