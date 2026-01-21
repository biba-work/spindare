
# Security Policy: Spindare `v0.37.1`

## 🛡 Vision on Data & Privacy

Spindare is built on a "DNA" profile (Interests, Character, and Habits). Because we are building a "never-seen-before" social experience, the security of our users' personal "vibe" data and the integrity of our reaction algorithm are our top priorities.

## 🚧 Status: Closed Pre-Alpha

As of version **0.37.1**, the app is in a closed testing phase.

* **Native Transition:** We are migrating away from the Expo Go sandbox to standalone builds. This allows us to implement tighter control over API endpoints and device-level security.
* **Environment:** All testing is currently performed in a controlled environment. Access is restricted to the core development team and authorized testers.

## 🔒 Security Measures

### 1. The Reaction Algorithm (Intellectual Property)

Our "Felt, Thought, Intrigued" logic and the Daily Spin generator are the "Brains" of the operation.

* **Protection:** API keys and sensitive logic are being moved to environment variables and server-side execution to prevent reverse engineering of the React Native bundle.

### 2. User DNA & Privacy

We collect character traits and interests to optimize "Spins."

* **Data Minimization:** During Pre-Alpha, we only store what is essential for the algorithm to function.
* **Storage:** We are implementing encrypted local storage for any sensitive user tokens as we move to native builds.

### 3. Reporting a Vulnerability

Since this is a private project between the three of us (The Brains, The IT Lead, and The Lead Dev), we don't have a public disclosure program yet.

If you find a bug or a security flaw:

1. **Do not post it in the community feed.**
2. **Contact the "Brains" or the Lead Developer directly via our private Discord/Communication channel.**
3. Include a brief description of the vulnerability and the version number (`v0.37.1`).

## 📅 Security Roadmap

* [ ] **Auth Hardening:** Transitioning from simple login to secure JWT-based authentication as we leave Expo Go.
* [ ] **Media Sanitization:** Ensuring all "Snap Pic" challenges are stripped of sensitive EXIF metadata before being shared to the feed.
* [ ] **Animation Integrity:** Ensuring custom reaction animations cannot be triggered maliciously to lag the UI.

---

### Why this is important for your team:

1. **Protecting the "Brains":** Since your uncle is the architect, the `SECURITY.md` acknowledges that his algorithm is a secret that needs guarding.
2. **Professionalism:** Having this file makes your GitHub repo look like a professional-grade startup, which is great for the "Masters in IT" uncle to see.
3. **Media Security:** Since your app revolves around taking photos (the "Snap Pic" feature), the roadmap item about stripping EXIF data is a real-world security step you'll eventually need.
