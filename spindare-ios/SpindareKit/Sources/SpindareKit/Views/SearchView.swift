import SwiftUI

// The results dropdown that falls out of the header's search field.
//
// Search is a state of the header, not a destination — so this is an overlay
// capped in height, not a pushed layer. Tapping outside it closes search
// entirely rather than only dismissing the keyboard.

public struct SearchView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(AppRouter.self) private var router

    @Binding var query: String
    /// Set false to close search from a tap outside the panel.
    @Binding var isSearching: Bool

    @State private var vm = SearchViewModel()

    /// Capped so results never swallow the whole feed behind them.
    private let maxPanelHeight: CGFloat = 380

    public init(query: Binding<String>, isSearching: Binding<Bool> = .constant(true)) {
        self._query = query
        self._isSearching = isSearching
    }

    public var body: some View {
        ZStack(alignment: .top) {
            Color.black.opacity(0.28)
                .ignoresSafeArea()
                .onTapGesture {
                    // Dismisses search, not just the keyboard. Resigning first
                    // responder alone left the dimmed backdrop up with no
                    // obvious way out.
                    query = ""
                    vm.clear()
                    withAnimation(Spindare.Motion.enter) { isSearching = false }
                }

            panel
                .background {
                    RoundedRectangle(cornerRadius: Spindare.Radius.card, style: .continuous)
                        .fill(Color.spindareSurface(scheme))
                }
                .spindareElevation(.floating)
                .padding(.horizontal, Spindare.Spacing.md)
                .padding(.top, Spindare.Spacing.sm)
        }
        .onChange(of: query) { _, newValue in
            vm.query(newValue)
        }
        .onDisappear { vm.clear() }
    }

    @ViewBuilder
    private var panel: some View {
        switch vm.state {
        case .idle:
            message(
                query.isEmpty
                    ? "Search people and challenges"
                    : "Keep typing…"
            )

        case .loading:
            // The same row shape the results use, so nothing jumps when they
            // land — a spinner here would collapse and reflow the panel.
            RowSkeleton(count: 4)
                .padding(Spindare.Spacing.md)

        case .empty:
            message("No results for “\(query)”")

        case .failed(let reason):
            message(reason)

        case .results(let users, let challenges):
            results(users: users, challenges: challenges)
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(Spindare.Typography.body)
            .foregroundStyle(Color.spindareSecondary(scheme))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spindare.Spacing.xl)
    }

    private func results(users: [SearchUser], challenges: [Post]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if !users.isEmpty {
                    sectionHeader("PEOPLE")
                    ForEach(users) { user in
                        Button {
                            open(user)
                        } label: {
                            HStack(spacing: Spindare.Spacing.md) {
                                Avatar(url: user.photoURL, size: 36)
                                Text("@\(user.username)")
                                    .font(Spindare.Typography.body)
                                    .foregroundStyle(Color.spindarePrimary(scheme))
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, Spindare.Spacing.md)
                            .padding(.vertical, Spindare.Spacing.sm)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PressableStyle())
                    }
                }

                if !challenges.isEmpty {
                    sectionHeader("CHALLENGES")
                    ForEach(challenges) { post in
                        Button {
                            take(post.challenge)
                        } label: {
                            HStack(spacing: Spindare.Spacing.md) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.spindareSecondary(scheme))
                                Text(post.challenge)
                                    .font(Spindare.Typography.body)
                                    .foregroundStyle(Color.spindarePrimary(scheme))
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, Spindare.Spacing.md)
                            .padding(.vertical, Spindare.Spacing.sm)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
            .padding(.vertical, Spindare.Spacing.sm)
        }
        .scrollIndicators(.hidden)
        .frame(maxHeight: maxPanelHeight)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .spindareLabel(size: 10, weight: .bold, tracking: 2)
            .foregroundStyle(Color.spindareSecondary(scheme))
            .padding(.horizontal, Spindare.Spacing.md)
            .padding(.top, Spindare.Spacing.sm)
            .padding(.bottom, 4)
    }

    // MARK: - Actions
    //
    // Both close search first. Leaving the dropdown open over a newly pushed
    // layer was the single worst thing about the previous version.

    private func open(_ user: SearchUser) {
        dismissSearch()
        router.push(.userProfile(
            AppRouter.UserRef(id: user.id, username: user.username, avatarURL: user.photoURL)
        ))
    }

    private func take(_ challenge: String) {
        dismissSearch()
        router.startProof(for: challenge)
    }

    private func dismissSearch() {
        query = ""
        vm.clear()
        isSearching = false
    }
}
