import Foundation
import CoreLocation

/// Detects the Portland neighborhood for a given coordinate using a bundled
/// GeoJSON polygon file. Runs entirely offline — no network calls.
///
/// Usage:
/// ```swift
/// let name = NeighborhoodService.shared.neighborhood(for: coordinate)
/// ```
final class NeighborhoodService {

    static let shared = NeighborhoodService()

    // MARK: - Private types

    private struct NeighborhoodPolygon {
        let name: String
        let exteriorRing: [CLLocationCoordinate2D]
    }

    // MARK: - State

    private let polygons: [NeighborhoodPolygon]

    // MARK: - Init

    private init() {
        polygons = Self.loadPolygons()
    }

    // MARK: - Public API

    /// Returns the Portland neighborhood name for `coordinate`, or `nil` if the
    /// coordinate falls outside all known neighborhood polygons.
    func neighborhood(for coordinate: CLLocationCoordinate2D) -> String? {
        polygons.first { pointInPolygon(coordinate, ring: $0.exteriorRing) }?.name
    }

    // MARK: - GeoJSON loading

    private static func loadPolygons() -> [NeighborhoodPolygon] {
        guard
            let url = Bundle.main.url(forResource: "portland-neighborhoods", withExtension: "geojson"),
            let data = try? Data(contentsOf: url),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let features = json["features"] as? [[String: Any]]
        else {
            return []
        }

        var result: [NeighborhoodPolygon] = []

        for feature in features {
            guard
                let properties = feature["properties"] as? [String: Any],
                let name = properties["name"] as? String,
                let geometry = feature["geometry"] as? [String: Any],
                let type_ = geometry["type"] as? String,
                type_ == "Polygon",
                let rings = geometry["coordinates"] as? [[[Double]]],
                let exteriorRing = rings.first
            else { continue }

            // GeoJSON coordinates are [longitude, latitude]
            let coords = exteriorRing.compactMap { pair -> CLLocationCoordinate2D? in
                guard pair.count >= 2 else { return nil }
                return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
            }

            guard coords.count >= 3 else { continue }
            result.append(NeighborhoodPolygon(name: name, exteriorRing: coords))
        }

        return result
    }

    // MARK: - Point-in-polygon (ray casting)

    private func pointInPolygon(
        _ point: CLLocationCoordinate2D,
        ring: [CLLocationCoordinate2D]
    ) -> Bool {
        var inside = false
        let n = ring.count
        var j = n - 1
        for i in 0..<n {
            let xi = ring[i].longitude, yi = ring[i].latitude
            let xj = ring[j].longitude, yj = ring[j].latitude
            if ((yi > point.latitude) != (yj > point.latitude)) &&
               (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi) {
                inside = !inside
            }
            j = i
        }
        return inside
    }
}
