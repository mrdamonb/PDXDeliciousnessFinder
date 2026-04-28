import SwiftUI
import SwiftData
import Supabase

struct OnboardingView: View {
    @Environment(AppState.self) private var appState

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var needsEmailConfirmation = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // MARK: - Branding

            VStack(spacing: 16) {
                Image(systemName: "fork.knife.circle.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(Color.pdxAccent)

                VStack(spacing: 6) {
                    Text("PDX Deliciousness Finder")
                        .font(.title)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)

                    Text("Your Portland food list.")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // MARK: - Auth Form

            VStack(spacing: 16) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding()
                    .background(.quaternary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                SecureField("Password", text: $password)
                    .textContentType(isSignUp ? .newPassword : .password)
                    .padding()
                    .background(.quaternary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                if needsEmailConfirmation {
                    VStack(spacing: 6) {
                        Text("Check your email")
                            .fontWeight(.semibold)
                        Text("We sent a confirmation link to \(email). Click it to activate your account, then sign in here.")
                            .font(.caption)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(.orange.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                } else if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await submit() }
                } label: {
                    Group {
                        if isSubmitting {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(isSignUp ? "Create Account" : "Sign In")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .fontWeight(.semibold)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.pdxAccent)
                .disabled(!isFormValid || isSubmitting)

                Button {
                    withAnimation {
                        isSignUp.toggle()
                        errorMessage = nil
                        needsEmailConfirmation = false
                    }
                } label: {
                    Text(isSignUp
                         ? "Already have an account? Sign In"
                         : "Don't have an account? Create one")
                        .font(.subheadline)
                        .foregroundStyle(Color.pdxAccent)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 48)
        }
        .padding()
    }

    // MARK: - Helpers

    private var isFormValid: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty
        && password.count >= 6
    }

    private func submit() async {
        errorMessage = nil
        needsEmailConfirmation = false
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            if isSignUp {
                let session = try await appState.signUp(email: email, password: password)
                // If Supabase email confirmation is enabled, signUp returns no session.
                // Show a prompt to check email rather than silently doing nothing.
                if session == nil {
                    withAnimation { needsEmailConfirmation = true }
                }
            } else {
                try await appState.signIn(email: email, password: password)
            }
        } catch {
            errorMessage = friendlyError(from: error)
        }
    }

    /// Maps Supabase auth errors to user-friendly messages.
    ///
    /// Tries NSError domain/code first for stable matching, then falls back to
    /// localizedDescription string matching as a safety net for SDK version changes.
    private func friendlyError(from error: Error) -> String {
        // Try to extract a structured error code from the underlying NSError.
        // Supabase surfaces API error codes in userInfo["errorCode"] or via the message.
        let nsError = error as NSError
        let errorCode = (nsError.userInfo["errorCode"] as? String)
            ?? (nsError.userInfo["code"] as? String)
            ?? ""

        switch errorCode {
        case "invalid_credentials":
            return "Incorrect email or password."
        case "user_already_exists", "email_exists":
            return "An account with this email already exists. Try signing in."
        case "over_email_send_rate_limit", "over_sms_send_rate_limit":
            return "Too many attempts. Please wait a moment and try again."
        case "weak_password":
            return "Password is too weak. Please choose a stronger password."
        case "email_not_confirmed":
            return "Please confirm your email address before signing in."
        default:
            break
        }

        // Fallback: normalised string matching on localizedDescription.
        let message = error.localizedDescription.lowercased()

        if message.contains("invalid login") || message.contains("invalid_credentials")
            || message.contains("invalid credentials") {
            return "Incorrect email or password."
        }
        if message.contains("user already registered") || message.contains("already exists") {
            return "An account with this email already exists. Try signing in."
        }
        if message.contains("rate limit") || message.contains("rate_limit")
            || message.contains("too many") {
            return "Too many attempts. Please wait a moment and try again."
        }
        if message.contains("weak password") {
            return "Password is too weak. Please choose a stronger password."
        }
        if message.contains("not confirmed") || message.contains("email confirm") {
            return "Please confirm your email address before signing in."
        }
        if message.contains("network") || message.contains("offline")
            || message.contains("internet") {
            return "No internet connection. Please check your network."
        }

        // Last resort: show the raw message so it's at least visible.
        return error.localizedDescription
    }
}

#Preview {
    OnboardingView()
        .environment(AppState(modelContext: PersistenceController.sharedModelContainer.mainContext))
}
