import SwiftUI

/// A single toggleable filter pill used in the map and list filter bars.
///
/// Inactive style: outlined capsule (border + text in `color`).
/// Active style: filled capsule (background `color`, white text).
struct FilterPillView: View {
    let label: String
    let isActive: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isActive ? color : .clear)
                .foregroundStyle(isActive ? Color.white : color)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(color, lineWidth: 1.5))
        }
        .frame(minHeight: 44)   // NFR15: minimum 44pt tap target
    }
}
