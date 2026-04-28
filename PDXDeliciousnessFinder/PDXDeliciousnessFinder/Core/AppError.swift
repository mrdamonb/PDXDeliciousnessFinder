import Foundation

/// Unified error type surfaced through ViewState.
enum AppError: LocalizedError {
    case network(underlying: Error)
    case persistence(underlying: Error)
    case notFound
    case unauthorized
    case unknown(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .network(let error):
            return "Network error: \(error.localizedDescription)"
        case .persistence(let error):
            return "Storage error: \(error.localizedDescription)"
        case .notFound:
            return "The requested item was not found."
        case .unauthorized:
            return "You must be signed in to perform this action."
        case .unknown(let error):
            return error.localizedDescription
        }
    }
}
