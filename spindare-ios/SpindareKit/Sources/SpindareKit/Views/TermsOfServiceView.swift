import SwiftUI

/// In-app Apple App Store Review-compliant Terms of Service view.
public struct TermsOfServiceView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spindare.Spacing.lg) {
                    Group {
                        Text("Spindare Terms of Service")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Color.spindarePrimary(scheme))

                        Text("Last updated: July 2026")
                            .font(Spindare.Typography.timestamp)
                            .foregroundStyle(Color.spindareSecondary(scheme))
                    }

                    section(
                        title: "1. Acceptance of Terms",
                        content: """
                        By creating an account or using Spindare, you agree to comply with these Terms of Service. If you do not agree to all terms, you may not access or use the application.
                        """
                    )

                    section(
                        title: "2. User Conduct & Community Guidelines",
                        content: """
                        Spindare is built for positive, real-world physical challenges and creative expression:
                        • You agree not to upload content that is illegal, abusive, sexually explicit, hate speech, or dangerous.
                        • Harassment, bullying, or spamming other users with unwanted SPIND challenges is strictly prohibited.
                        • Violation of community guidelines will result in account suspension or termination.
                        """
                    )

                    section(
                        title: "3. Content Ownership & License",
                        content: """
                        You retain ownership of the photos, videos, and captions you post to Spindare. By posting, you grant Spindare a non-exclusive, worldwide, royalty-free license to host, display, and distribute your content within the service according to your privacy preferences.
                        """
                    )

                    section(
                        title: "4. Sponsored Venue & Zone Features",
                        content: """
                        Zone map features display local venues and partner challenges. Challenge completions at sponsored venues are subject to community guidelines and safety verification. Users must exercise personal judgment and safety when attempting physical challenges in public or private spaces.
                        """
                    )

                    section(
                        title: "5. Termination & Service Modifications",
                        content: """
                        Spindare reserves the right to suspend or terminate accounts that violate our terms or pose safety risks. We may modify or update service features at any time.
                        """
                    )

                    section(
                        title: "6. Disclaimer & Limitation of Liability",
                        content: """
                        Spindare is provided "as is" without warranties of any kind. Spindare and its creators are not liable for any physical injury, property damage, or loss incurred while participating in user or sponsored challenges.
                        """
                    )
                }
                .padding(Spindare.Spacing.lg)
            }
            .background(Color.spindareBackground(scheme).ignoresSafeArea())
            .navigationTitle("Terms of Service")
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
