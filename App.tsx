// Gesture Handler must load before components that use native gestures (e.g. SpinWheel).
// Do not import react-native-reanimated here unless you use it in-app — on Expo Go it
// can boot the worklet runtime and trigger Hermes "Property 'require' doesn't exist".
import 'react-native-gesture-handler';

// LogService patches console.* — keep soon after native entry imports above.
import "./src/services/LogService";
import { SoundService } from "./src/services/SoundService";
// Preload all sounds so first interactions feel instant
SoundService.preloadAll();
import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { ClerkProvider, ClerkLoaded, ClerkLoading, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { setSupabaseToken } from './src/services/supabaseConfig';
import { ChallengeScreen } from "./src/screens/ChallengeScreen";
import { MainFeedScreen } from "./src/screens/MainFeedScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { AppConfig } from "./src/config/AppConfig";

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "https://placeholder@sentry.io/123",
  debug: false,
});

import { ThemeProvider } from "./src/contexts/ThemeContext";
import { ToastProvider } from "./src/contexts/ToastContext";

// Keeps the Supabase client's Authorization header in sync with the active
// Clerk session. This allows RLS owner-policies to work once you configure
// a Clerk JWT template named "supabase" in your Clerk dashboard pointing at
// your Supabase JWT secret (Settings → API → JWT Secret).
// If the template isn't set up yet, getToken() returns null and the client
// falls back to the anon key — the app keeps working either way.
const SupabaseAuthSync = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) { setSupabaseToken(null); return; }

    const sync = async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        setSupabaseToken(token);
      } catch {
        // Template not configured yet — silently fall back to anon key
        setSupabaseToken(null);
      }
    };

    sync();
    // Clerk JWTs expire after 60 min — refresh every 55 min
    const interval = setInterval(sync, 55 * 60 * 1000);
    return () => { clearInterval(interval); setSupabaseToken(null); };
  }, [isSignedIn, getToken]);

  return <>{children}</>;
};

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      } else {
        console.log("No values stored under key: " + key);
      }
      return item;
    } catch (error) {
      console.error("SecureStore get item error: ", error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const expoExtras = ((Constants as any).expoConfig?.extra ?? (Constants as any).manifest?.extra ?? {}) as Record<string, any>;
const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  || expoExtras.VITE_CLERK_PUBLISHABLE_KEY
  || expoExtras.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  || '';

function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  const splashHiddenRef = useRef(false);

  const hideSplash = useCallback(async () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    try {
      await SplashScreen.hideAsync();
      console.log('Splash screen hidden');
    } catch (e) {
      console.warn('SplashScreen.hideAsync failed', e);
    }
  }, []);

  // Hide native splash when fonts are done — do not wait for ClerkLoaded (it renders null until Clerk is ready).
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const t = setTimeout(() => void hideSplash(), 50);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError, hideSplash]);

  useEffect(() => {
    const t = setTimeout(() => void hideSplash(), 12000);
    return () => clearTimeout(t);
  }, [hideSplash]);

  console.log('App starting. Fonts loaded:', fontsLoaded, 'Font error:', fontError);

  if (!fontsLoaded && !fontError) {
    console.log('Waiting for fonts...');
    return null;
  }

  if (!publishableKey) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Missing Clerk publishable key</Text>
          <Text style={styles.errorText}>
            Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY in your Expo environment/app config.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <ToastProvider>
          <ThemeProvider>
            <View style={styles.container}>
              <View style={styles.deadzone} />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style="light" />
                <ClerkLoaded>
                  <SignedIn>
                    <SupabaseAuthSync>
                    {AppConfig.useRestructuredLayout ? (
                      <MainFeedScreen />
                    ) : (
                      <ChallengeScreen />
                    )}
                    </SupabaseAuthSync>
                  </SignedIn>
                  <SignedOut>
                    <OnboardingScreen onComplete={async () => {
                      // Logic is handled by Clerk hooks inside OnboardingScreen
                    }} />
                  </SignedOut>
                </ClerkLoaded>
                <ClerkLoading>
                  <View style={styles.clerkLoading}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                </ClerkLoading>
              </GestureHandlerRootView>
            </View>
          </ThemeProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 32, // 8mm deadzone
  },
  deadzone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: '#1C1C26', // Dark blue-grayish color
    zIndex: 9999,
  },
  authHeader: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#D1D1D6',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  clerkLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Sentry.wrap(App);
