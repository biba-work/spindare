import SwiftUI
import CoreLocation

// Real device location, for Zone.
//
// "When in use" only — Zone is a foreground map you look at, not something
// that tracks you in the background, so "Always" would be asking for more
// than the feature does anything with. Requesting it anyway is the same
// mistake this file's previous version was written specifically to avoid: a
// permission with no matching use is a review risk, not a convenience.
//
// One authorization request per launch, made only when Zone actually appears
// — never at app startup — so the system prompt shows up in the context that
// explains it.
//
// `#if os(iOS)`-gated throughout: this package also builds for macOS so
// `swift test` runs without Xcode, and macOS's `CLAuthorizationStatus` doesn't
// split "when in use" from "always" the way iOS's does — the cases this file
// switches on (`.authorizedWhenInUse`) don't exist there at all.

/// Plain, cross-platform coordinate — `CLLocationCoordinate2D` itself isn't
/// `Equatable` on every platform this package builds for, which SwiftUI's
/// `.onChange` requires of anything it watches.
public struct Coordinate: Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double
}

#if os(iOS)
@MainActor
@Observable
public final class LocationProvider: NSObject {
    public private(set) var coordinate: Coordinate?

    private let manager = CLLocationManager()

    public override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Human-readable summary of the current location authorization for the
    /// Settings → Zone card. Static so Settings can display it without
    /// holding a LocationProvider instance.
    public static var authorizationSummary: String {
        switch CLLocationManager().authorizationStatus {
        case .notDetermined: return "Not determined"
        case .restricted: return "Restricted"
        case .denied: return "Denied — tap to open Settings"
        case .authorizedWhenInUse: return "While using the app"
        case .authorizedAlways: return "Always"
        @unknown default: return "Unknown"
        }
    }

    /// Requests permission if undetermined, or starts updating if already
    /// granted. Safe to call every time Zone appears — a granted/denied status
    /// makes this a no-op/single-fetch respectively rather than a repeat
    /// prompt, since iOS only ever asks once.
    public func start() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }
}

extension LocationProvider: CLLocationManagerDelegate {
    public nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            guard status == .authorizedWhenInUse || status == .authorizedAlways else { return }
            // `self.manager`, not the callback's `manager` parameter — that
            // parameter is only nonisolated-safe inside this synchronous
            // callback; sending it into a `@MainActor` Task is what the
            // compiler was flagging. `self.manager` is the same instance,
            // reached through `self` (already `@MainActor`) instead.
            self.manager.requestLocation()
        }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        let plain = Coordinate(latitude: coordinate.latitude, longitude: coordinate.longitude)
        Task { @MainActor in self.coordinate = plain }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Silent: Zone already has a sensible default region. A location
        // failure should degrade to "the mock region", not surface an error
        // over a feature that still works without it.
    }
}
#else
@MainActor
@Observable
public final class LocationProvider: NSObject {
    public private(set) var coordinate: Coordinate?
    public static var authorizationSummary: String { "Not available" }
    public func start() {}
}
#endif
