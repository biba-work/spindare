# Spindare - Expo React Native App

## Overview
Spindare is a social challenge/feed mobile application built with Expo and React Native. It features a main feed screen with challenges, social interactions, chat, and user profiles.

## Architecture
- **Framework**: Expo (React Native) with TypeScript
- **Entry Point**: `index.ts` → `App.tsx`
- **Main Screens**: `src/screens/`
- **Services**: `src/services/` (Firebase, AI, Auth, Chat, etc.)
- **Config**: `src/config/AppConfig.ts`
- **Theme**: `src/contexts/ThemeContext.tsx`

## Key Dependencies
- Expo SDK ~55
- React Native 0.83.1
- Firebase 12.x (backend/auth)
- stream-chat-expo (chat)
- @google/generative-ai (AI features)
- expo-camera, expo-image-picker

## Development
- **Workflow**: "Start application" runs `npx expo start --web --port 5000`
- **Port**: 5000 (web mode)
- **Host**: 0.0.0.0 (for Replit proxy)

## Deployment
- **Target**: Static
- **Build**: `npx expo export --platform web --output-dir dist`
- **Public Dir**: `dist`
