import SwiftUI

// Port of src/screens/OnboardingScreen.tsx (704 LOC).
//
// Five steps: welcome → login | signup → traits → verify.
// Uses the design tokens from DesignTokens.swift and the view model for all
// form logic. Clerk auth calls are stubbed in the VM — this view is pure UI.

public struct OnboardingView: View {
    @State private var vm = OnboardingViewModel()
    var onAuthenticated: ((String, String, String?, String?) -> Void)?

    public init(onAuthenticated: ((String, String, String?, String?) -> Void)? = nil) {
        self.onAuthenticated = onAuthenticated
    }

    public var body: some View {
        ZStack {
            // Background — blurred gradient, matching the RN ImageBackground + LinearGradient
            backgroundGradient

            // Content — fades between steps
            Group {
                switch vm.step {
                case .welcome:  welcomeView
                case .login:    loginView
                case .signup:   signupView
                case .traits:   traitsView
                case .verify:   verifyView
                }
            }
            .opacity(vm.isTransitioning ? 0 : 1)
        }
        .ignoresSafeArea(.container, edges: .top)
        .onAppear {
            vm.onAuthenticated = onAuthenticated
        }
    }

    // MARK: - Background

    private var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Spindare.Palette.cream.opacity(0.95),
                Spindare.Palette.cream
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .spindareBlurredArtworkBackground(variant: 1, opacity: 0.26, blurRadius: 85)
        .ignoresSafeArea()
    }

    // MARK: - Welcome

    private var welcomeView: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo tile
            RoundedRectangle(cornerRadius: 30)
                .fill(.white)
                .frame(width: 100, height: 100)
                .spindareShadow(.card)
                .overlay {
                    LogoImage(.mark)
                        .frame(width: 62, height: 62)
                }
                .rotationEffect(.degrees(-5))
                .padding(.bottom, Spindare.Spacing.lg)

            // Brand
            LogoImage(.wordmark)
                .frame(height: 42)
                .padding(.bottom, Spindare.Spacing.sm)

            Text("Dare to be creative.")
                .font(Spindare.Typography.bodyLarge)
                .fontWeight(.medium)
                .foregroundStyle(Spindare.Palette.ink)
                .padding(.bottom, 60)

            // Action buttons
            VStack(spacing: Spindare.Spacing.md) {
                // Google
                socialButton(
                    icon: "globe",
                    label: "Continue with Google",
                    style: .light
                ) {
                    vm.handleGoogleAuth()
                }

                // Apple
                socialButton(
                    icon: "apple.logo",
                    label: "Continue with Apple",
                    style: .dark
                ) {
                    vm.handleAppleAuth()
                }

                // Divider
                HStack(spacing: 12) {
                    Rectangle().fill(Color.black.opacity(0.1)).frame(height: 1)
                    Text("OR")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.black.opacity(0.4))
                    Rectangle().fill(Color.black.opacity(0.1)).frame(height: 1)
                }
                .padding(.vertical, Spindare.Spacing.sm)

                // Log In
                primaryButton("Log In") {
                    vm.navigate(to: .login)
                }

                // Create Account link
                Button {
                    vm.navigate(to: .signup)
                } label: {
                    Group {
                        Text("Don't have an account? ")
                            .foregroundStyle(Color.black.opacity(0.6))
                        + Text("Create Account")
                            .fontWeight(.bold)
                            .foregroundStyle(Spindare.Palette.ink)
                    }
                    .font(.system(size: 14))
                }
                .padding(.vertical, 12)
            }
            .padding(.horizontal, Spindare.Spacing.lg)

            Spacer()
                .frame(height: 40)
        }
    }

    // MARK: - Login

    private var loginView: some View {
        VStack(alignment: .leading, spacing: 0) {
            backButton { vm.navigate(to: .welcome) }

            headerSection(title: "Welcome Back", subtitle: "Sign in to continue your streak.")

            VStack(spacing: Spindare.Spacing.md) {
                inputField("Email", text: $vm.email, keyboardType: .emailAddress)
                inputField("Password", text: $vm.password, isSecure: true)
                errorLabel
            }

            Spacer()

            VStack(spacing: Spindare.Spacing.md) {
                primaryButton("Log In", isLoading: vm.isSubmitting) {
                    vm.handleLogin()
                }
            }
            .padding(.bottom, 40)
        }
        .padding(.horizontal, Spindare.Spacing.lg)
        .padding(.top, 60)
    }

    // MARK: - Signup

    private var signupView: some View {
        VStack(alignment: .leading, spacing: 0) {
            backButton { vm.navigate(to: .welcome) }

            headerSection(title: "Create Account", subtitle: "Join the creative revolution.")

            VStack(spacing: Spindare.Spacing.md) {
                inputField("Username", text: $vm.username)
                inputField("Email", text: $vm.email, keyboardType: .emailAddress)
                inputField("Password", text: $vm.password, isSecure: true)
                errorLabel
            }

            Spacer()

            VStack(spacing: Spindare.Spacing.md) {
                primaryButton("Continue", isLoading: vm.isSubmitting) {
                    vm.handleSignupContinue()
                }
            }
            .padding(.bottom, 40)
        }
        .padding(.horizontal, Spindare.Spacing.lg)
        .padding(.top, 60)
    }

    // MARK: - Traits

    private var traitsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // An OAuth sign-up has no signup step behind it — back returns to
            // the welcome screen (and drops the half-finished Clerk session).
            backButton { vm.cancelTraits() }

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    headerSection(title: "Personalize", subtitle: "Select what interests you.")

                    // OAuth users arrive here without having chosen a username
                    // (the signup form is where the email path collects it).
                    if vm.isOAuthCompletion {
                        sectionLabel("USERNAME")
                        inputField("Username", text: $vm.username)
                            .padding(.bottom, Spindare.Spacing.lg)
                    }

                    sectionLabel("HOBBIES")
                    chipGrid(
                        items: OnboardingViewModel.hobbies,
                        selected: vm.selectedHobbies,
                        toggle: vm.toggleHobby
                    )

                    sectionLabel("FIELDS OF STUDY")
                        .padding(.top, Spindare.Spacing.lg)
                    chipGrid(
                        items: OnboardingViewModel.fields,
                        selected: vm.selectedFields,
                        toggle: vm.toggleField
                    )

                    errorLabel
                        .padding(.top, Spindare.Spacing.md)

                    primaryButton("Finish Setup", isLoading: vm.isSubmitting) {
                        vm.handleFinalSignup()
                    }
                    .padding(.top, 40)
                    .disabled(vm.selectedHobbies.isEmpty)
                    .opacity(vm.selectedHobbies.isEmpty ? 0.5 : 1)
                }
                .padding(.bottom, 100)
            }
        }
        .padding(.horizontal, Spindare.Spacing.lg)
        .padding(.top, 60)
    }

    // MARK: - Verify

    private var verifyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            backButton { vm.navigate(to: .traits) }

            headerSection(
                title: "Verify Email",
                subtitle: "An email was sent to \(vm.email). Enter the 6-digit code below."
            )

            VStack(spacing: Spindare.Spacing.md) {
                inputField("6-digit Code", text: $vm.verificationCode, keyboardType: .numberPad)
                errorLabel
            }

            Spacer()

            VStack(spacing: Spindare.Spacing.md) {
                primaryButton("Verify Account", isLoading: vm.isSubmitting) {
                    vm.handleVerify()
                }

                Button {
                    // TODO: Clerk — resend verification code
                } label: {
                    Group {
                        Text("Didn't get a code? ")
                            .foregroundStyle(Color.black.opacity(0.6))
                        + Text("Resend")
                            .fontWeight(.bold)
                            .foregroundStyle(Spindare.Palette.ink)
                    }
                    .font(.system(size: 14))
                }
                .padding(.vertical, 12)
            }
            .padding(.bottom, 40)
        }
        .padding(.horizontal, Spindare.Spacing.lg)
        .padding(.top, 60)
    }

    // MARK: - Reusable components

    private func backButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "arrow.left")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Spindare.Palette.ink)
                .frame(width: 40, height: 40)
                .background(Color.white.opacity(0.8))
                .clipShape(Circle())
        }
        .padding(.bottom, Spindare.Spacing.lg)
    }

    private func headerSection(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: Spindare.Spacing.sm) {
            Text(title)
                .font(Spindare.Typography.title)
                .fontWeight(.heavy)
                .tracking(Spindare.Typography.titleTracking)
                .foregroundStyle(Spindare.Palette.ink)

            Text(subtitle)
                .font(.system(size: 16))
                .foregroundStyle(Color.black.opacity(0.5))
        }
        .padding(.bottom, Spindare.Spacing.xl)
    }

    enum CustomKeyboardType { case `default`, emailAddress, numberPad }

    private func inputField(
        _ placeholder: String,
        text: Binding<String>,
        isSecure: Bool = false,
        keyboardType: CustomKeyboardType = .default
    ) -> some View {
        let field: AnyView
        if isSecure {
            #if os(iOS)
            field = AnyView(SecureField(placeholder, text: text).textContentType(.password))
            #else
            field = AnyView(SecureField(placeholder, text: text))
            #endif
        } else {
            #if os(iOS)
            let uiKeyboardType: UIKeyboardType = {
                switch keyboardType {
                case .emailAddress: return .emailAddress
                case .numberPad: return .numberPad
                default: return .default
                }
            }()
            field = AnyView(TextField(placeholder, text: text)
                .keyboardType(uiKeyboardType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled())
            #else
            field = AnyView(TextField(placeholder, text: text)
                .autocorrectionDisabled())
            #endif
        }
        
        return field
        .font(.system(size: 16))
        .foregroundStyle(Spindare.Palette.ink)
        .padding(.horizontal, 20)
        .frame(height: 56)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Spindare.Radius.card)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var errorLabel: some View {
        if let error = vm.error {
            Text(error)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Spindare.Palette.danger)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, Spindare.Spacing.md)
                .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    private func primaryButton(
        _ label: String,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(label)
                        .font(.system(size: 16, weight: .bold))
                        .tracking(0.5)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Spindare.Palette.ink)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.card))
            .spindareShadow(Spindare.Shadow(
                color: .black.opacity(0.2),
                radius: 10,
                y: 4
            ))
        }
        .disabled(isLoading)
        .buttonStyle(.plain)
    }

    private enum SocialButtonStyle { case light, dark }

    private func socialButton(
        icon: String,
        label: String,
        style: SocialButtonStyle,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                Text(label)
                    .font(.system(size: 16, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(style == .dark ? Spindare.Palette.ink : Color.white)
            .foregroundStyle(style == .dark ? Color.white : Spindare.Palette.ink)
            .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.card))
            .spindareShadow(style == .dark
                ? Spindare.Shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                : .card
            )
        }
        .buttonStyle(.plain)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .tracking(2)
            .foregroundStyle(Spindare.Palette.ink.opacity(0.6))
            .padding(.bottom, Spindare.Spacing.md)
    }

    private func chipGrid(
        items: [String],
        selected: Set<String>,
        toggle: @escaping (String) -> Void
    ) -> some View {
        // Using a custom flow layout since SwiftUI's LazyVGrid doesn't wrap well
        // for variable-width chips
        WrappingHStack(spacing: 10) {
            ForEach(items, id: \.self) { item in
                let isSelected = selected.contains(item)
                Button {
                    toggle(item)
                } label: {
                    Text(item)
                        .font(.system(size: 14, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(isSelected ? Color.white : Color.black.opacity(0.6))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(isSelected ? Spindare.Palette.ink : Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: Spindare.Radius.control))
                        .overlay(
                            RoundedRectangle(cornerRadius: Spindare.Radius.control)
                                .stroke(isSelected ? Spindare.Palette.ink : Color.black.opacity(0.05), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .animation(Spindare.Motion.pop, value: isSelected)
            }
        }
    }
}

// MARK: - Wrapping HStack (flow layout)

/// Lays out children horizontally, wrapping to the next line when the row
/// exceeds the available width. SwiftUI doesn't have this built-in prior to
/// the Layout protocol, so here's a minimal one.
struct WrappingHStack: Layout {
    var spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let result = layout(subviews: subviews, width: proposal.width ?? .infinity)
        return result.size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(subviews: subviews, width: bounds.width)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func layout(subviews: Subviews, width: CGFloat) -> (size: CGSize, positions: [CGPoint]) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxWidth = max(maxWidth, x)
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), positions)
    }
}

// MARK: - Preview

// Previews require Xcode — they'll live in the app target once the project exists.
// #Preview("Onboarding") { OnboardingView() }
