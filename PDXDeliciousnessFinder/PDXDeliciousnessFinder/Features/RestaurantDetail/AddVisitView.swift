import SwiftUI
import Auth

/// Sheet for logging a new visit with an optional date and note.
struct AddVisitView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    let restaurant: Restaurant
    /// When true, also changes the restaurant status to .beenThere on save.
    var markVisited: Bool = false
    var onSave: (() -> Void)? = nil

    @State private var visitedAt: Date = .now
    @State private var note = ""
    @State private var isSaving = false
    @State private var saveError: AppError?
    @State private var hapticSuccessTrigger = 0

    var body: some View {
        NavigationStack {
            Form {
                Section("Visit Details") {
                    DatePicker("Date", selection: $visitedAt, in: ...Date.now, displayedComponents: .date)
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
            .sensoryFeedback(.success, trigger: hapticSuccessTrigger)
            .navigationTitle(markVisited ? "Mark as Visited" : "Add Visit")
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
        guard let userId = appState.currentUser?.id else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let visitLog = VisitLog(
                restaurantId: restaurant.id,
                userId: userId,
                visitedAt: visitedAt,
                note: note.isEmpty ? nil : note
            )
            visitLog.restaurant = restaurant
            try appState.visitLogRepository.save(visitLog)

            if markVisited {
                restaurant.status = .beenThere
                try appState.restaurantRepository.update(restaurant)
            }

            hapticSuccessTrigger += 1
            onSave?()
            dismiss()
        } catch {
            saveError = .persistence(underlying: error)
        }
    }
}
