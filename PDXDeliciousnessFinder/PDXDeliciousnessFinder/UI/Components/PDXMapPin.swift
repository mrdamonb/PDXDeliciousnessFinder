import SwiftUI
import MapKit

// MARK: - PDXMapPin

/// Custom map annotation view for the PDX Deliciousness Finder.
///
/// Pin anatomy:
/// ```
///      ★           ← star (Favorite only, centered above body)
///   ╭─────╮
///   │  icon │      ← SF Symbol (venue type or checkmark for Been There)
///   │       │      ← fill = status color
///   ╰───┬───╯
///       │           ← teardrop point
/// ```
///
/// Sizes:
/// - Standard (Want to Go, Been There): 34×42 pt
/// - Large (Favorite): 38×46 pt
struct PDXMapPin: View {
    let restaurant: Restaurant
    /// When `true`, the pin is hidden (filtered-out state). Using opacity 0 instead of
    /// removing the annotation avoids MapKit flicker on filter changes.
    var isFilteredOut: Bool = false

    private var isFavorite: Bool { restaurant.status == .favorite }

    private var pinWidth: CGFloat { isFavorite ? 38 : 34 }
    private var pinHeight: CGFloat { isFavorite ? 46 : 42 }

    var body: some View {
        ZStack(alignment: .center) {
            VStack(spacing: 0) {
                if isFavorite {
                    Image(systemName: "star.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.pdxStatusFav)
                        .shadow(color: .black.opacity(0.25), radius: 1, x: 0, y: 1)
                        .padding(.bottom, 1)
                }

                // Pin body
                ZStack {
                    TearDropShape()
                        .fill(restaurant.status.pdxColor)
                        .shadow(color: .black.opacity(0.25), radius: 2, x: 0, y: 2)

                    TearDropShape()
                        .stroke(Color.white.opacity(0.6), lineWidth: 1)

                    Image(systemName: pinIcon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .offset(y: -4)  // shift icon into the circular head, above the point
                }
                .frame(width: pinWidth, height: pinHeight)
            }
        }
        // Transparent tap-target overlay — required for reliable MapKit hit-testing
        .contentShape(Rectangle())
        .frame(width: max(pinWidth, 44), height: max(pinHeight + (isFavorite ? 14 : 0), 44))
        .opacity(isFilteredOut ? 0.0 : 1.0)
        .accessibilityLabel(accessibilityLabel)
    }

    // MARK: - Icon

    private var pinIcon: String {
        restaurant.venueType.mapPinIcon
    }

    // MARK: - Accessibility

    private var accessibilityLabel: String {
        let parts: [String?] = [
            restaurant.name,
            restaurant.status.displayName,
            restaurant.venueType.displayName,
            restaurant.neighborhood ?? "Portland"
        ]
        return parts.compactMap { $0 }.joined(separator: ", ")
    }
}

// MARK: - TearDropShape

/// Upright teardrop: circular head + two tangent lines converging to a bottom point.
private struct TearDropShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let r = rect.width / 2
        let h = rect.height
        let center = CGPoint(x: r, y: r)

        // Distance from circle center to tip
        let d = h - r
        guard d > r else {
            // Fallback: full ellipse if dimensions are unusual
            path.addEllipse(in: rect)
            return path
        }

        // Half-angle of the tangent sector
        let angle = asin(r / d)

        // Angles of the two tangent points on the circle
        // π/2 is the "downward" direction in screen coords (y-axis is down)
        let rightAngle = CGFloat.pi / 2 - angle
        let leftAngle  = CGFloat.pi / 2 + angle

        let rightTangent = CGPoint(
            x: center.x + r * cos(rightAngle),
            y: center.y + r * sin(rightAngle)
        )

        // Start at right tangent, arc counterclockwise over the top to left tangent
        path.move(to: rightTangent)
        path.addArc(
            center: center,
            radius: r,
            startAngle: .radians(Double(rightAngle)),
            endAngle: .radians(Double(leftAngle)),
            clockwise: true    // SwiftUI y-axis is flipped: true = over the top on screen
        )

        // Line from left tangent down to tip, then close back to right tangent
        path.addLine(to: CGPoint(x: r, y: h))
        path.closeSubpath()

        return path
    }
}

// MARK: - VenueType map icon

extension VenueType {
    /// SF Symbol name used inside map pins (distinct from list/badge icon).
    var mapPinIcon: String {
        switch self {
        case .restaurant: "fork.knife"
        case .bar:        "wineglass"
        case .brewery:    "mug.fill"
        case .foodCart:   "storefront.fill"
        }
    }
}

// MARK: - Restaurant coordinate helper

import CoreLocation

extension Restaurant {
    /// `CLLocationCoordinate2D` if both lat/lon are non-nil, otherwise `nil`.
    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lon = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}
