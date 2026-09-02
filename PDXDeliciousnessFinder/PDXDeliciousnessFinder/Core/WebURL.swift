import Foundation

/// Normalizes web addresses that a person typed by hand.
///
/// People type `nongs.com`, not `https://nongs.com`. Both `SFSafariViewController`
/// and an HTML `href` need a complete http(s) URL, and `URL(string:)` is no help as
/// a validator — it happily returns a non-nil URL for `nongs.com/menu` (no scheme)
/// and even for a string of spaces.
enum WebURL {
    /// Trims, adds `https://` when no scheme is present, and returns nil unless the
    /// result is a usable http(s) address with a host. Use on write, so the stored
    /// value is already complete.
    static func normalized(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        // Work out whether a scheme is already present before prefixing anything.
        // Checking for "://" alone is not enough: "mailto:a@b.com" has no slashes and
        // would otherwise be mangled into "https://mailto:a@b.com", which parses as
        // host b.com and silently opens the wrong site.
        let lowered = trimmed.lowercased()
        let candidate: String
        if lowered.hasPrefix("http://") || lowered.hasPrefix("https://") {
            candidate = trimmed
        } else if trimmed.contains("://") {
            return nil  // some other scheme entirely
        } else if let colon = trimmed.firstIndex(of: ":"),
                  !trimmed[trimmed.index(after: colon)...].prefix(1).allSatisfy(\.isNumber) {
            return nil  // mailto:, tel:, javascript: — a colon not introducing a port
        } else {
            candidate = "https://\(trimmed)"  // the common case: a bare domain
        }

        guard let url = URL(string: candidate),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = url.host,
              // A real web host has a dot. This also rejects the leftovers of a
              // colon-bearing value that survived the checks above, e.g. "tel:5035551234"
              // becoming host "tel".
              host.contains(".")
        else { return nil }

        return url.absoluteString
    }

    /// Same rules, returning a `URL`. Use on read, so values stored before
    /// normalization existed — or written by the web client — still resolve.
    static func url(_ raw: String?) -> URL? {
        guard let normalized = normalized(raw) else { return nil }
        return URL(string: normalized)
    }
}
