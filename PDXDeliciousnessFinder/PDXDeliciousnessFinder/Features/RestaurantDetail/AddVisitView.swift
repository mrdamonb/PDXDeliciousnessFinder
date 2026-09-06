import SwiftUI
import Auth

/// Sheet for logging a new visit with an optional date and note.
struct AddVisitView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let restaurant: Restaurant
    /// When true, a `want_to_go` restaurant is promoted to `been_there` on save.
    /// Never downgrades a `favorite` — see `save()`.
    var markVisited: Bool = false
    /// Overrides the sheet title. The promotion flag drives behaviour, not wording:
    /// the History picker promotes status but is still "Add Visit" to the user.
    var title: String?
    var onSave: (() -> Void)? = nil

    /// Non-nil when this sheet is editing an existing visit rather than
    /// logging a new one. `save()` branches on this to call
    /// `VisitLogRepository.update` instead of `.save`, preserving `id` and
    /// `createdAt` — an edit is a mutation, never a new row.
    private let editingVisitLog: VisitLog?

    @State private var visitedAt: Date = .now
    @State private var note = ""
    @State private var isSaving = false
    @State private var saveError: AppError?
    @State private var hapticSuccessTrigger = 0
    @State private var menuLink: MenuLink?

    init(
        restaurant: Restaurant,
        markVisited: Bool = false,
        title: String? = nil,
        onSave: (() -> Void)? = nil
    ) {
        self.restaurant = restaurant
        self.markVisited = markVisited
        self.title = title
        self.onSave = onSave
        self.editingVisitLog = nil
    }

    /// Edits an existing visit, reusing this form rather than a second UI.
    /// `restaurant` is passed explicitly (not read from `visitLog.restaurant`)
    /// because that relationship is optional on the model — callers only
    /// reach this initializer once they already have both in hand (e.g. a
    /// History row, which only renders once its restaurant is non-nil).
    init(editing visitLog: VisitLog, restaurant: Restaurant, onSave: (() -> Void)? = nil) {
        self.restaurant = restaurant
        self.markVisited = false
        self.title = "Edit Visit"
        self.onSave = onSave
        self.editingVisitLog = visitLog
        _visitedAt = State(initialValue: visitLog.visitedAt)
        _note = State(initialValue: visitLog.note ?? "")
    }

    /// Wrapper so the browser is presented with `.sheet(item:)` — setting this to nil
    /// is the single way it closes, whether that came from SwiftUI or Safari's own
    /// Done button.
    private struct MenuLink: Identifiable {
        let id = UUID()
        let url: URL
    }

    /// The menu if there is a usable one, otherwise the website. Recomputed each pass.
    ///
    /// Both candidates go through `WebURL`, so a value stored without a scheme — or
    /// with stray whitespace — still resolves, and a genuinely unusable menu URL falls
    /// through to the website rather than suppressing the action entirely.
    private var menuURL: URL? {
        WebURL.url(restaurant.menuUrl) ?? WebURL.url(restaurant.website)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Visit Details") {
                    DatePicker("Date", selection: $visitedAt, in: ...Date.now, displayedComponents: .date)
                    if let menuURL {
                        Button("View menu") {
                            menuLink = MenuLink(url: menuURL)
                        }
                        .accessibilityHint("Opens the menu in a browser without leaving this visit")
                    }
                }
                Section("Note (optional)") {
                    TextField("How was it?", text: $note, axis: .vertical)
                        .lineLimit(3...8)
                }
                if let error = saveError {
                    Section {
                        Text(error.localizedDescription)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
            .sheet(item: $menuLink) { link in
                SafariView(url: link.url) { menuLink = nil }
            }
            .sensoryFeedback(.success, trigger: hapticSuccessTrigger)
            .navigationTitle(title ?? (markVisited ? "Mark as Visited" : "Add Visit"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            if let editingVisitLog {
                // Editing never changes the restaurant's status — no
                // markVisited path here, and restaurantId/createdAt are
                // untouched, matching VisitLogRepository.update. No userId
                // lookup here either: an edit mutates an already-owned row,
                // so a stale/nil auth session must not block it.
                editingVisitLog.visitedAt = visitedAt
                editingVisitLog.note = note.isEmpty ? nil : note
                try appState.visitLogRepository.update(editingVisitLog)
            } else {
                guard let userId = appState.currentUser?.id else {
                    saveError = .unauthorized
                    return
                }
                let visitLog = VisitLog(
                    restaurantId: restaurant.id,
                    userId: userId,
                    visitedAt: visitedAt,
                    note: note.isEmpty ? nil : note
                )
                visitLog.restaurant = restaurant
                try appState.visitLogRepository.save(visitLog)

                // Only a want_to_go restaurant is promoted by logging a visit — a
                // favorite must never be downgraded to been_there (story 2.8).
                if markVisited && restaurant.status == .wantToGo {
                    restaurant.status = .beenThere
                    try appState.restaurantRepository.update(restaurant)
                }
            }

            hapticSuccessTrigger += 1
            onSave?()
            dismiss()
        } catch {
            saveError = .persistence(underlying: error)
        }
    }
}
