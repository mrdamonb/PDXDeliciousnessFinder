import SwiftUI
import UIKit

// MARK: - PDX Design Token Colors
// All status and brand colors for PDX Deliciousness Finder.
// Always reference these via Color.pdx* — never use raw hex literals in feature code.

extension Color {
    /// Amber — "Want to Go" pin/badge color.
    static let pdxStatusWant = Color(uiColor: .pdxStatusWant)

    /// Green — "Been There" pin/badge color.
    static let pdxStatusBeen = Color(uiColor: .pdxStatusBeen)

    /// Red — "Favorite" pin/badge color.
    static let pdxStatusFav = Color(uiColor: .pdxStatusFav)

    /// Burnt-orange — primary accent (buttons, selected filters).
    static let pdxAccent = Color(uiColor: .pdxAccent)

    /// Warm tinted background — adapts to dark mode.
    static let pdxBackground = Color(uiColor: .pdxBackground)

    /// Surface / card background — adapts to dark mode.
    static let pdxSurface = Color(uiColor: .pdxSurface)
}

// MARK: - UIColor dynamic variants (light + dark)

extension UIColor {
    /// Amber — readable on both light and dark backgrounds.
    static let pdxStatusWant = UIColor(light: 0xD97706, dark: 0xFBBF24)

    /// Green — readable on both light and dark backgrounds.
    static let pdxStatusBeen = UIColor(light: 0x16A34A, dark: 0x4ADE80)

    /// Red — readable on both light and dark backgrounds.
    static let pdxStatusFav = UIColor(light: 0xDC2626, dark: 0xF87171)

    /// Burnt-orange accent — lightened for dark mode legibility.
    static let pdxAccent = UIColor(light: 0xC2410C, dark: 0xF97316)

    /// Warm off-white background / dark warm near-black.
    static let pdxBackground = UIColor(light: 0xF7F3EE, dark: 0x1C1915)

    /// White surface / dark warm card surface.
    static let pdxSurface = UIColor(light: 0xFFFFFF, dark: 0x2C2823)
}

// MARK: - Private helpers

private extension UIColor {
    /// Dynamic color that automatically switches between light and dark mode values.
    convenience init(light lightHex: UInt32, dark darkHex: UInt32) {
        self.init { traitCollection in
            traitCollection.userInterfaceStyle == .dark
                ? UIColor(hex: darkHex)
                : UIColor(hex: lightHex)
        }
    }

    /// Initialize from a 24-bit RGB hex integer (e.g. 0xF59E0B).
    convenience init(hex: UInt32) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255
        let g = CGFloat((hex >> 8) & 0xFF) / 255
        let b = CGFloat(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}

// MARK: - RestaurantStatus → PDX color

extension RestaurantStatus {
    /// The canonical PDX token color for this status, used by map pins and badges.
    var pdxColor: Color {
        switch self {
        case .wantToGo: .pdxStatusWant
        case .beenThere: .pdxStatusBeen
        case .favorite:  .pdxStatusFav
        }
    }
}
