
# Security Policy

## Supported Versions

Spindare is currently in active development. Security updates and fixes are only provided for the latest internal build.

| Version | Supported |
|----------|------------|
| 1.0.x    | ✅ |
| < 0.54.7    | ❌ |

---

# Overview

Spindare is a privacy-focused social platform built around real-world interaction, AI-generated challenges, and human connection.

Because the platform processes user-generated media, social interactions, authentication sessions, and personalized recommendation systems, security is treated as a core architectural requirement — not an afterthought.

This document outlines:

- How vulnerabilities should be reported
- Current security protections
- Infrastructure and authentication practices
- Known limitations during development
- Internal security roadmap

---

# Reporting a Vulnerability

If you discover a security vulnerability, privacy issue, authentication bypass, exposed secret, or any exploit affecting Spindare infrastructure or users:

- Do NOT disclose it publicly
- Do NOT post it in screenshots, social feeds, Discord channels, or GitHub issues
- Do NOT attempt to access data that does not belong to you

Instead, report it directly to the development team.

## Contact

Email: legal@spindare.it

Include:

- A clear description of the issue
- Steps to reproduce
- Affected platform/build
- Device information if relevant
- Screenshots or logs if available

We will investigate all legitimate reports as quickly as possible.

---

# Security Architecture

## Authentication

Spindare uses Clerk for authentication and account management.

Security measures include:

- Session-based authentication
- Secure token handling
- Protected user sessions
- Backend verification of authenticated requests

Supabase is used strictly as a database layer and NOT as an authentication provider.

All user identifiers stored in the database are Clerk-issued string IDs.

---

## API & Backend Protection

Sensitive operations and private logic are executed server-side whenever possible.

This includes:

- AI challenge generation
- Cooldown enforcement
- Anti-spam validation
- Challenge generation logic
- Protected environment variables

Secrets and API keys are never intentionally exposed inside the public mobile bundle.

---

## User Privacy

Spindare is designed with privacy-first principles.

### Data Minimization

We only store information required for core platform functionality.

Examples include:

- Authentication identifiers
- Profile information chosen by users
- Posts and challenge activity
- Social interaction metadata

### Media Handling

Uploaded photos and videos may be processed to:

- Remove unnecessary metadata
- Improve compatibility
- Prevent malformed uploads

Future builds may include additional EXIF stripping and upload sanitization.

---

## Platform Integrity

Spindare includes multiple protections intended to reduce abuse and automated manipulation.

Current protections include:

- Cooldown systems
- Double-post prevention
- Backend validation checks
- Persistent reaction limitations
- Rate limiting for AI challenge retries
- Server-side verification for protected actions

The platform is actively monitored during internal testing phases.

---

# Encryption & Storage

Sensitive credentials and tokens are handled using secure storage mechanisms supported by the operating system and authentication provider.

Infrastructure providers may include:

- Clerk
- Supabase
- Stream
- Google Gemini APIs

Spindare does not intentionally store plaintext passwords.

---

# Development Status

## Current Phase

Spindare is currently operating as an internal/private development project and limited testing platform.

Security controls are continuously evolving as infrastructure matures.

Some systems may still operate in development configurations while production architecture is finalized.

---

# Known Security Limitations

The following items are acknowledged and actively being improved:

- Development chat tokens are still used in certain internal environments
- Realtime infrastructure is still under hardening/testing
- Additional backend-side validation is being expanded
- Media moderation systems are still evolving
- Automated abuse detection is still limited during internal testing

These limitations are not considered production-ready.

---

# Security Roadmap

Planned improvements include:

- Production-grade JWT infrastructure
- Hardened backend APIs
- Advanced anti-bot systems
- Full media sanitization pipeline
- Expanded moderation tooling
- Improved abuse detection systems
- Device integrity validation
- Realtime infrastructure hardening
- Audit logging for sensitive actions
- Improved server-side rate limiting

---

# Responsible Disclosure

We appreciate responsible disclosure of security vulnerabilities.

Testing must not:

- Violate user privacy
- Access accounts without authorization
- Disrupt platform infrastructure
- Damage data integrity
- Abuse automated systems

Spindare reserves the right to restrict or terminate access for malicious activity.

---

# Legal

Unauthorized access, reverse engineering, exploitation attempts, data scraping, automated abuse, or malicious interference with Spindare systems may result in legal action.

All rights reserved.

Copyright © 2026 Spindare Inc.m to function.
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

