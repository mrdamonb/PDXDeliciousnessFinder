import Foundation
import SwiftData

@Model
final class VisitLog {
    #Unique<VisitLog>([\.id])

    var id: UUID
    var restaurantId: UUID
    var userId: UUID
    var visitedAt: Date
    var note: String?
    var createdAt: Date

    var restaurant: Restaurant?

    init(
        id: UUID = UUID(),
        restaurantId: UUID,
        userId: UUID,
        visitedAt: Date = .now,
        note: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.restaurantId = restaurantId
        self.userId = userId
        self.visitedAt = visitedAt
        self.note = note
        self.createdAt = createdAt
    }
}
