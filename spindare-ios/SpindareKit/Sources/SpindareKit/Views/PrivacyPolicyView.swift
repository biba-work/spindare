import SwiftUI

/// In-app Apple App Store Review-compliant Privacy Policy view.
public struct PrivacyPolicyView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spindare.Spacing.lg) {
                    Group {
                        Text("Spindare Privacy Policy")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Color.spindarePrimary(scheme))

                        Text("Last updated: July 2026")
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }

                    section(
                        title: "1. Information We Collect",
                        content: """
                        We collect minimal information necessary to deliver Spindare's daily challenges, video Speedys, and Zone location features:
                        • Account Information: Username, email, and authentication details managed via Clerk.
                        • User Content: Video posts (Speedys), photos, challenge completions, captions, and reactions (felt, thought, intrigued).
                        • Location Data: Approximate location when using the Zone map feature to display local sponsored venues. Location is processed only while using the app and is never tracked continuously in the background.
                        • Device & Usage Data: Technical logs and performance metrics used internally to optimize app stability.
                        """
                    )

                    section(
                        title: "2. How We Use Your Data",
                        content: """
                        Your data is strictly utilized for core app functionality:
                        • Displaying your posts and challenge completions to authorized friends or the public feed.
                        • Processing daily streaks, level progression, and SPIND challenge inbox notifications.
                        • Filtering content according to your privacy settings (e.g. Friends Only mode).
                        • We DO NOT sell your personal information, track you across third-party apps, or share data with advertising brokers.
                        """
                    )

                    section(
                        title: "3. Internal Performance Logging",
                        content: """
                        Spindare includes an internal analytics system. This data is strictly private and used exclusively by our automated systems and core team to monitor feature usage, generate FAQs, and improve app stability. You can opt out at any time in Settings → Account & Security.
                        """
                    )

                    section(
                        title: "4. Data Storage & Security",
                        content: """
                        All communication between Spindare and server endpoints is encrypted via TLS/HTTPS. Media uploads are stored securely on Cloudflare R2 / AWS S3 storage infrastructure. User account authentication is protected by industry-standard encryption and optional TOTP 2FA.
                        """
                    )

                    section(
                        title: "5. Your Rights & Account Deletion",
                        content: """
                        You hold full control over your data:
                        • You may unsend messages, edit your profile, or update privacy settings at any time.
                        • You can permanently delete your account and all associated posts, reactions, and media directly within Settings → Delete Account.
                        """
                    )

                    section(
                        title: "6. Contact Us",
                        content: "For privacy inquiries or data requests, contact our privacy team at privacy@spindare.app."
                    )
                }
                .padding(Spindare.Spacing.lg)
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Spindare.Palette.accent)
                }
            }
        }
    }

    private func section(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.xs) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.spindarePrimary(scheme))

            Text(content)
                .font(Spindare.Typography.body)
                .lineSpacing(4)
                .foregroundStyle(Color.spindareSecondary(scheme))
        }
        .padding(Spindare.Spacing.md)
        .background {
            RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                .fill(Color.spindareSurface(scheme))
        }
    }
}
