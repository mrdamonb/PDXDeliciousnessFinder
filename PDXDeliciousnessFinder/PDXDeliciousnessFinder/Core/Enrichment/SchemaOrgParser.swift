import Foundation
import SwiftSoup

/// Fetches a URL and attempts to extract schema.org Restaurant data from
/// embedded JSON-LD `<script>` blocks. Never throws — always returns a result.
final class SchemaOrgParser {

    /// Fetch and parse schema.org data from the given URL.
    /// Returns an `EnrichmentResult` with whatever fields were extractable.
    /// All fields other than `sourceUrl` may be nil on partial or failed parse.
    nonisolated func parse(url: URL) async -> EnrichmentResult { // nonisolated: URLSession work off MainActor
        var base = EnrichmentResult(sourceUrl: url.absoluteString)

        guard let html = await fetchHTML(from: url) else {
            return base
        }

        guard let jsonLD = extractJsonLD(from: html) else {
            return base
        }

        base.name = jsonLD["name"] as? String
        base.website = jsonLD["url"] as? String

        // address: prefer streetAddress + addressLocality
        if let addressObj = jsonLD["address"] as? [String: Any] {
            let street = addressObj["streetAddress"] as? String
            let city = addressObj["addressLocality"] as? String
            let parts = [street, city].compactMap { $0 }
            if !parts.isEmpty {
                base.address = parts.joined(separator: ", ")
            }
        } else if let addressStr = jsonLD["address"] as? String {
            base.address = addressStr
        }

        // coordinates
        if let geo = jsonLD["geo"] as? [String: Any] {
            base.latitude = doubleValue(geo["latitude"])
            base.longitude = doubleValue(geo["longitude"])
        }

        // cuisine: may be String or [String]
        if let cuisineArr = jsonLD["servesCuisine"] as? [String] {
            base.cuisine = cuisineArr.first
        } else if let cuisineStr = jsonLD["servesCuisine"] as? String {
            base.cuisine = cuisineStr
        }

        // priceRange
        if let priceStr = jsonLD["priceRange"] as? String {
            base.priceRange = parsePriceRange(priceStr)
        }

        // venueType from @type
        if let typeStr = jsonLD["@type"] as? String {
            base.venueType = parseVenueType(typeStr)
        }

        return base
    }

    // MARK: - Private helpers
    // All helpers are nonisolated so they don't hop back to MainActor
    // (project uses SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor).

    nonisolated private func fetchHTML(from url: URL) async -> String? {
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            forHTTPHeaderField: "User-Agent"
        )
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode),
                  let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
                return nil
            }
            return html
        } catch {
            return nil
        }
    }

    /// Extract and parse the first JSON-LD block with a restaurant-type @type.
    nonisolated private func extractJsonLD(from html: String) -> [String: Any]? {
        guard let doc = try? SwiftSoup.parse(html) else { return nil }
        guard let scripts = try? doc.select("script[type=application/ld+json]") else { return nil }

        let acceptedTypes: Set<String> = [
            "Restaurant", "FoodEstablishment", "Bakery",
            "CafeOrCoffeeShop", "BarOrPub", "Brewery", "NightClub",
            "LocalBusiness"   // Squarespace & many restaurant CMS platforms emit this
        ]

        // Parse all blocks up front so we can merge across them
        var allBlocks: [[String: Any]] = []
        for script in scripts {
            guard let text = try? script.html(),
                  let data = text.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            allBlocks.append(json)
        }

        // Find the primary restaurant-typed block (may be inside a @graph wrapper)
        var primary: [String: Any]? = nil
        for json in allBlocks {
            if let matched = firstMatchingNode(in: json, acceptedTypes: acceptedTypes) {
                primary = matched
                break
            }
        }
        guard var result = primary else { return nil }

        // Squarespace and similar CMSes split name/url into a separate WebSite block.
        // Supplement missing fields from any other block on the page.
        for block in allBlocks {
            if result["name"] == nil, let name = block["name"] as? String, !name.isEmpty {
                result["name"] = name
            }
            if result["url"] == nil, let url = block["url"] as? String, !url.isEmpty {
                result["url"] = url
            }
            if result["name"] != nil, result["url"] != nil { break }
        }

        return result
    }

    /// Returns the first node (or nested @graph node) matching an accepted type.
    nonisolated private func firstMatchingNode(in json: [String: Any], acceptedTypes: Set<String>) -> [String: Any]? {
        if matchesType(json, acceptedTypes: acceptedTypes) {
            // If this block matches but has no name and has a @graph, prefer an inner node
            if json["name"] == nil, let graph = json["@graph"] as? [[String: Any]] {
                for node in graph where matchesType(node, acceptedTypes: acceptedTypes) {
                    return node
                }
            }
            return json
        }
        // Unwrapped @graph with no top-level @type
        if let graph = json["@graph"] as? [[String: Any]] {
            for node in graph where matchesType(node, acceptedTypes: acceptedTypes) {
                return node
            }
        }
        return nil
    }

    nonisolated private func matchesType(_ json: [String: Any], acceptedTypes: Set<String>) -> Bool {
        if let typeStr = json["@type"] as? String {
            return acceptedTypes.contains(typeStr)
        } else if let typeArr = json["@type"] as? [String] {
            return typeArr.contains(where: { acceptedTypes.contains($0) })
        }
        return false
    }

    nonisolated private func doubleValue(_ value: Any?) -> Double? {
        if let d = value as? Double { return d }
        if let s = value as? String { return Double(s) }
        if let n = value as? NSNumber { return n.doubleValue }
        return nil
    }

    nonisolated private func parsePriceRange(_ raw: String) -> PriceRange? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        switch trimmed {
        case "$":    return .one
        case "$$":   return .two
        case "$$$":  return .three
        case "$$$$": return .four
        default:
            // Handle numeric strings
            if let n = Int(trimmed) {
                return PriceRange(rawValue: n)
            }
            return nil
        }
    }

    nonisolated private func parseVenueType(_ typeStr: String) -> VenueType {
        switch typeStr {
        case "BarOrPub", "NightClub": return .bar
        case "Brewery":               return .brewery
        default:                      return .restaurant
        }
    }
}
