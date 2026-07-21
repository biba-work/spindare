import SwiftUI

// Brief confirmation of something that already happened.
//
// Not an alert: an alert asks a question and blocks until answered, which is
// the wrong shape for "that worked". This says what happened, doesn't ask
// anything, and leaves on its own — a swipe-delete needs an acknowledgement,
// but not one that interrupts the next swipe.

public struct Toast: Equatable, Identifiable, Sendable {
    public let id: UUID
    public let message: String
    public let icon: String

    public init(_ message: String, icon: String = "checkmark") {
        self.id = UUID()
        self.message = message
        self.icon = icon
    }
}

public extension View {
    /// Presents `toast` over this view and clears it after a beat.
    func toast(_ toast: Binding<Toast?>) -> some View {
        modifier(ToastModifier(toast: toast))
    }
}

private struct ToastModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    @Binding var toast: Toast?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let toast {
                    ToastView(toast: toast)
                        .padding(.bottom, 90)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        // Keyed to the toast's identity, so a second toast
                        // arriving while the first is up restarts the timer
                        // rather than inheriting the remainder of it.
                        .task(id: toast.id) {
                            try? await Task.sleep(for: .milliseconds(1900))
                            withAnimation(Spindare.Motion.settle) { self.toast = nil }
                        }
                }
            }
            .animation(Spindare.Motion.settle, value: toast)
    }
}

private struct ToastView: View {
    @Environment(\.colorScheme) private var scheme
    let toast: Toast

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: toast.icon)
                .font(.system(size: 12, weight: .bold))
            Text(toast.message)
                .font(.system(size: 13, weight: .medium))
        }
        .foregroundStyle(scheme == .dark ? Color.black : Color.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background {
            Capsule().fill(scheme == .dark ? Color.white : Spindare.Palette.ink)
        }
        .spindareElevation(.floating)
        // The confirmation is for the user, not for the pointer — it must never
        // swallow a tap on whatever is underneath it.
        .allowsHitTesting(false)
    }
}
