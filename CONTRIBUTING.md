# Contributing to Spindare 🌀

First off, thanks for wanting to help turn scrolling into real-world action! Spindare is a mission-driven project, and we want every line of code to reflect our "Anti-Scroll" philosophy.

## 🛠 Our Tech Standards

To keep the app stable, all contributors must follow these rules:

*   **Auth:** We use **Clerk**. Never use Supabase Auth for new features. All `userId` fields must be `TEXT` to match Clerk IDs.
*   **Database:** Use **camelCase** for column names and wrap them in double quotes in SQL (e.g., `"userId"`, `"spinCount"`).
*   **Animations:** Use the **React Native Animated API** only. Do NOT install `react-native-reanimated` without approval.
*   **Haptics:** Every major interaction (spinning, reacting, posting) should use `expo-haptics`.

## 🚀 How to Help

### 1. Reporting Bugs
If you find a bug (especially one that lets people "scroll-hole" or bypass a challenge):
*   Check the existing Issues to see if it’s already known.
*   If not, open a new Issue describing what happened and your device (Android/iOS).

### 2. Suggesting Challenges
Spindare thrives on great challenges! If you have ideas for the **Offline Challenges** list:
*   Ensure they are safe, legal, and encourage real-world interaction.
*   Format them for the AI or add them to the local JSON data.

### 3. Code Contributions
1. **Fork** the repo and create your branch: `git checkout -b feature/cool-new-animation`.
2. **Follow the Structure:** Use the Atomic Design folders (`src/components/atoms`, `molecules`, `organisms`).
3. **Reuse Components:** Use `AppButton.tsx` and `ReactionButton.tsx` instead of creating new ones.
4. **Test:** Ensure your code works on the Expo Go tunnel before submitting.

## 🎨 UI & UX Guidelines

*   **Active Reveal:** Content should only be visible after taking action.
*   **The "Feel":** Reactions (Felt, Thought, Intrigued) must include the ripple + glow effect.
*   **No Clutter:** If a feature encourages mindless scrolling, it doesn't belong in Spindare.

## 🔒 Security & Privacy

*   **DNA Data:** Never log user interests or habits to the console.
*   **API Keys:** Always use `.env` files. Never hardcode keys in your components.

---
**Questions?** Reach out to Biba (Logic), Daniel (IT), or Kristian (UI) on the private Discord.

*Stay active. Stay private. Keep spinning.* 🎡
