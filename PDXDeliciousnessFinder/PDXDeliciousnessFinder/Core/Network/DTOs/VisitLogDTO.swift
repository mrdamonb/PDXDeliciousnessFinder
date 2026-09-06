import Foundation

/// Codable transfer object for the Supabase `visit_logs` table.
/// Maps snake_case columns to camelCase Swift properties.
///
/// Encodable and Decodable are implemented explicitly as `nonisolated` so this
/// struct can satisfy `Encodable & Sendable` constraints in PostgREST calls
/// despite the project-wide `@MainActor` default isolation.
struct VisitLogDTO: Identifiable, Sendable {
    let id: UUID
    let restaurantId: UUID
    let userId: UUID
    var visitedAt: Date
    var note: String?
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case restaurantId = "restaurant_id"
        case userId = "user_id"
        case visitedAt = "visited_at"
        case note
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Codable (nonisolated to satisfy Sendable constraints across actor boundaries)

extension VisitLogDTO: Encodable {
    nonisolated func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(restaurantId, forKey: .restaurantId)
        try c.encode(userId, forKey: .userId)
        try c.encode(visitedAt, forKey: .visitedAt)
        try c.encodeIfPresent(note, forKey: .note)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encode(updatedAt, forKey: .updatedAt)
    }
}

extension VisitLogDTO: Decodable {
    nonisolated init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        restaurantId = try c.decode(UUID.self, forKey: .restaurantId)
        userId = try c.decode(UUID.self, forKey: .userId)
        visitedAt = try c.decode(Date.self, forKey: .visitedAt)
        note = try c.decodeIfPresent(String.self, forKey: .note)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
    }
}

// MARK: - Model ↔ DTO Conversion

extension VisitLogDTO {
    init(from model: VisitLog) {
        self.id = model.id
        self.restaurantId = model.restaurantId
        self.userId = model.userId
        self.visitedAt = model.visitedAt
        self.note = model.note
        self.createdAt = model.createdAt
        self.updatedAt = model.updatedAt
    }

    func toModel() -> VisitLog {
        VisitLog(
            id: id,
            restaurantId: restaurantId,
            userId: userId,
            visitedAt: visitedAt,
            note: note,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}
