import Foundation

/// Async UI state container. Use this for all screen-level loading state
/// instead of parallel boolean flags.
enum ViewState<T> {
    case idle
    case loading
    case loaded(T)
    case error(AppError)

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    var loadedValue: T? {
        if case .loaded(let value) = self { return value }
        return nil
    }

    var errorValue: AppError? {
        if case .error(let e) = self { return e }
        return nil
    }
}
