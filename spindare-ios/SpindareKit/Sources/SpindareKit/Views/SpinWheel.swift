import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// The wheel is an abstract dial, not a prize wheel. It carries no text — just
// 48 tick marks, four of them accented, a hub and a pointer. What you're
// spinning is deliberately unreadable until it stops.
//
// The detent haptic is the whole reason it exists: one selection tick every
// 7.5° of travel, during both the drag and the coast. Without that it's a
// spinning circle; with it, it's a physical object.

// MARK: - Geometry (pure, testable)

public struct WheelGeometry: Equatable, Sendable {
    /// Visual ticks. Unrelated to how many outcomes there are.
    public static let tickCount = 48
    public static let tickAngle = 360.0 / Double(tickCount)
    /// Every 12th tick is an accent, giving four cardinal marks.
    public static let accentEvery = 12

    public let optionCount: Int

    public init(optionCount: Int) {
        self.optionCount = max(1, optionCount)
    }

    public var segmentAngle: Double { 360.0 / Double(optionCount) }

    /// Which outcome sits under the pointer at a given rotation.
    ///
    /// The pointer is fixed at 12 o'clock while segment 0 starts at 3 o'clock,
    /// hence the +270° offset.
    public func landedIndex(atRotation rotation: Double) -> Int {
        let normalized = (270 - rotation).wrappedDegrees
        return Int((normalized / segmentAngle).rounded(.down)) % optionCount
    }

    /// Which tick index a rotation falls in — drives the detent haptic.
    public func tickIndex(atRotation rotation: Double) -> Int {
        Int(rotation.wrappedDegrees / Self.tickAngle)
    }

    /// The exact rotation required to center the landed segment under the pointer,
    /// keeping the delta minimal (no spinning backward across the 0/360 boundary).
    public func snapRotation(forRotation rotation: Double) -> Double {
        let index = landedIndex(atRotation: rotation)
        let centerAngle = Double(index) * segmentAngle + (segmentAngle / 2)
        let targetDegrees = 270 - centerAngle
        // Find nearest modulo equivalent to current rotation
        let currentRevs = floor(rotation / 360)
        let targetRaw = targetDegrees + (currentRevs * 360)
        
        // Find closest path
        let diff = targetRaw - rotation
        if diff > 180 {
            return targetRaw - 360
        } else if diff < -180 {
            return targetRaw + 360
        }
        return targetRaw
    }
}

public extension Double {
    /// Normalised into 0..<360, handling negatives.
    var wrappedDegrees: Double {
        let r = truncatingRemainder(dividingBy: 360)
        return r < 0 ? r + 360 : r
    }

    /// Shortest signed delta between two angles, resolving the ±180 seam so a
    /// drag across the 0/360 boundary doesn't jump a full turn.
    func angleDelta(to other: Double) -> Double {
        var delta = other - self
        while delta > 180 { delta -= 360 }
        while delta < -180 { delta += 360 }
        return delta
    }
}

// MARK: - Physics

public enum WheelPhysics {
    /// Below this, a flick is treated as a tap rather than a spin.
    public static let tapVelocityThreshold: Double = 15
    /// Per-millisecond retention. RN's default is 0.997; this coasts longer.
    public static let deceleration: Double = 0.998
    /// Stop once we're slower than this (degrees/second).
    public static let restingVelocity: Double = 12

    public static func velocityMagnitude(vx: Double, vy: Double) -> Double {
        (vx * vx + vy * vy).squareRoot() * 0.1
    }

    /// Velocity after `dt` seconds of coasting.
    public static func decayed(_ velocity: Double, over dt: Double) -> Double {
        velocity * pow(deceleration, dt * 1000)
    }
}

// MARK: - View

public struct SpinWheel: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage(AppSettingsKey.showDialLines) private var showDialLines = true

    /// Outcomes. The wheel shows none of them — it only resolves one.
    let options: [String]
    let canSpin: Bool
    let onSpinEnd: (String) -> Void
    var onTap: (() -> Void)?

    @State private var rotation: Double = 0
    @State private var isSpinning = false
    @State private var lastTick = 0
    @State private var dragAngle: Double?
    @State private var idleRotation: Double = 0
    @State private var spinTask: Task<Void, Never>?

    private var geometry: WheelGeometry { WheelGeometry(optionCount: options.count) }

    public init(
        options: [String],
        canSpin: Bool = true,
        onTap: (() -> Void)? = nil,
        onSpinEnd: @escaping (String) -> Void
    ) {
        self.options = options
        self.canSpin = canSpin
        self.onTap = onTap
        self.onSpinEnd = onSpinEnd
    }

    public var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let radius = size / 2

            ZStack {
                dial(radius: radius, currentRotation: rotation + idleRotation, showLines: true)
                    .rotationEffect(.degrees(rotation + idleRotation))
                    .gesture(spinGesture(center: CGPoint(x: proxy.size.width / 2,
                                                         y: proxy.size.height / 2)))

                // Fixed while the dial turns beneath it.
                Pointer()
                    .fill(Color.spindarePrimary(scheme))
                    .frame(width: 20, height: 30)
                    .offset(y: -radius + 4)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .sensoryFeedback(.selection, trigger: lastTick)
        }
        .aspectRatio(1, contentMode: .fit)
        .onAppear(perform: startIdleDriftIfNeeded)
        .onChange(of: canSpin) { _, _ in startIdleDriftIfNeeded() }
        .onDisappear { spinTask?.cancel() }
    }

    // MARK: Dial

    private func dial(radius: CGFloat, currentRotation: Double, showLines: Bool = true) -> some View {
        Canvas { context, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = min(size.width, size.height) / 2

            context.fill(
                Path(ellipseIn: CGRect(x: c.x - r + 2, y: c.y - r + 2,
                                       width: (r - 2) * 2, height: (r - 2) * 2)),
                with: .color(scheme == .dark ? Spindare.Palette.inkDark : .white)
            )

            for i in 0..<WheelGeometry.tickCount {
                let isAccent = i % WheelGeometry.accentEvery == 0
                // When dial lines are hidden, only the four accent (cardinal)
                // ticks draw — the wheel stays navigable without revealing
                // category boundaries.
                guard showLines || isAccent else { continue }

                let angle = Angle.degrees(Double(i) * WheelGeometry.tickAngle - 90).radians
                let outer = r - 2
                let inner = r - 20
                var tick = Path()
                tick.move(to: CGPoint(x: c.x + cos(angle) * outer, y: c.y + sin(angle) * outer))
                tick.addLine(to: CGPoint(x: c.x + cos(angle) * inner, y: c.y + sin(angle) * inner))

                context.stroke(
                    tick,
                    with: .color(isAccent
                                 ? Spindare.Palette.accent
                                 : Spindare.Hairline.color(scheme)),
                    lineWidth: isAccent ? 2 : 1
                )
            }

            // Hub and inner ring.
            // Pulse the hub based on rotation mapping to tick boundaries.
            let tickProgress = currentRotation.truncatingRemainder(dividingBy: WheelGeometry.tickAngle) / WheelGeometry.tickAngle
            let pulse = sin(tickProgress * .pi) // 0 -> 1 -> 0 per tick
            
            let hub = r * 0.3 + (r * 0.015 * pulse)
            context.fill(
                Path(ellipseIn: CGRect(x: c.x - hub, y: c.y - hub, width: hub * 2, height: hub * 2)),
                with: .color(scheme == .dark ? Spindare.Palette.surfaceDark : .white)
            )
            context.stroke(
                Path(ellipseIn: CGRect(x: c.x - hub, y: c.y - hub, width: hub * 2, height: hub * 2)),
                with: .color(Color.spindarePrimary(scheme)),
                lineWidth: 1
            )
            let ring = r * 0.25
            context.stroke(
                Path(ellipseIn: CGRect(x: c.x - ring, y: c.y - ring, width: ring * 2, height: ring * 2)),
                with: .color(Spindare.Hairline.color(scheme)),
                lineWidth: 1
            )
        }
        .frame(width: radius * 2, height: radius * 2)
    }

    // MARK: Gesture

    private func spinGesture(center: CGPoint) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard canSpin, !isSpinning else { return }
                let angle = angleOf(value.location, around: center)
                defer { dragAngle = angle }
                guard let previous = dragAngle else { return }
                // Seam-corrected so crossing 0/360 doesn't snap a whole turn.
                rotation += previous.angleDelta(to: angle)
                emitDetentIfCrossed()
            }
            .onEnded { value in
                defer { dragAngle = nil }
                guard canSpin, !isSpinning else { return }

                let speed = WheelPhysics.velocityMagnitude(
                    vx: value.velocity.width,
                    vy: value.velocity.height
                )
                guard speed >= WheelPhysics.tapVelocityThreshold else {
                    onTap?()
                    return
                }
                coast(initialVelocity: speed * 12)
            }
    }

    private func angleOf(_ point: CGPoint, around center: CGPoint) -> Double {
        atan2(point.y - center.y, point.x - center.x) * 180 / .pi
    }

    // MARK: Coast
    //
    // Integrated per frame rather than handed to a spring, because the detent
    // haptic has to fire on every 7.5° crossed during the coast — an animation
    // that only reports its end can't do that.

    private func coast(initialVelocity: Double) {
        isSpinning = true
        prepareHaptics()

        spinTask?.cancel()
        spinTask = Task { @MainActor in
            var velocity = initialVelocity
            let step = 1.0 / 60.0

            while velocity > WheelPhysics.restingVelocity, !Task.isCancelled {
                rotation += velocity * step
                emitDetentIfCrossed()
                velocity = WheelPhysics.decayed(velocity, over: step)
                try? await Task.sleep(for: .seconds(step))
            }

            guard !Task.isCancelled else { return }
            isSpinning = false
            land()
        }
    }

    private func land() {
        let index = geometry.landedIndex(atRotation: rotation)
        guard options.indices.contains(index) else { return }

        // Spring settle to the exact center of the segment
        let target = geometry.snapRotation(forRotation: rotation)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
            rotation = target
        }

        // A two-beat thunk: heavy, then medium 80ms later.
        impact(.heavy)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            impact(.medium)
        }

        onSpinEnd(options[index])
    }

    // MARK: Idle drift
    //
    // When the wheel can't be spun it turns slowly on its own — one revolution
    // every 30 seconds, perfectly linear. An attract loop, not an animation.

    private func startIdleDriftIfNeeded() {
        guard !canSpin else {
            withAnimation(.linear(duration: 0.3)) { idleRotation = 0 }
            return
        }
        withAnimation(.linear(duration: 30).repeatForever(autoreverses: false)) {
            idleRotation = 360
        }
    }

    // MARK: Haptics

    private func emitDetentIfCrossed() {
        let tick = geometry.tickIndex(atRotation: rotation)
        guard tick != lastTick else { return }
        lastTick = tick
        selectionTick()
    }

    private func prepareHaptics() {
        #if canImport(UIKit)
        // Without prepare() the first few detents arrive late and the wheel
        // feels like it starts loose.
        UISelectionFeedbackGenerator().prepare()
        #endif
    }

    private func selectionTick() {
        #if canImport(UIKit)
        UISelectionFeedbackGenerator().selectionChanged()
        #endif
    }

    private func impact(_ style: ImpactStyle) {
        #if canImport(UIKit)
        let generator: UIImpactFeedbackGenerator
        switch style {
        case .heavy: generator = UIImpactFeedbackGenerator(style: .heavy)
        case .medium: generator = UIImpactFeedbackGenerator(style: .medium)
        }
        generator.impactOccurred()
        #endif
    }

    private enum ImpactStyle { case heavy, medium }
}

// MARK: - Pointer

/// A downward kite rather than a triangle — it reads as pointing *into* the
/// dial instead of sitting on top of it.
struct Pointer: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height / 3))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + rect.height / 3))
        path.closeSubpath()
        return path
    }
}
