// LogService MUST be the first import — it patches console.* immediately.
import "./src/services/LogService";
import { SoundService } from "./src/services/SoundService";
// Preload all sounds so first interactions feel instant
SoundService.preloadAll();
import React, { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { ClerkProvider, ClerkLoaded, SignedIn, SignedOut } from '@clerk/clerk-expo';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { ChallengeScreen } from "./src/screens/ChallengeScreen";
import { MainFeedScreen } from "./src/screens/MainFeedScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { AppConfig } from "./src/config/AppConfig";

SplashScreen.preventAutoHideAsync();

import { ThemeProvider } from "./src/contexts/ThemeContext";

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

const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing Publishable Key. Please set VITE_CLERK_PUBLISHABLE_KEY in your .env");
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  console.log('App starting. Fonts loaded:', fontsLoaded, 'Font error:', fontError);

  const onLayoutRootView = useCallback(async () => {
    console.log('onLayoutRootView triggered. fontsLoaded:', fontsLoaded);
    if (fontsLoaded || fontError) {
      // Small delay to ensure layout is ready before hiding splash
      setTimeout(async () => {
        console.log('Hiding splash screen');
        await SplashScreen.hideAsync();
      }, 50);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    console.log('Waiting for fonts...');
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ThemeProvider>
            <View style={styles.container} onLayout={onLayoutRootView}>
              <View style={styles.deadzone} />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style="light" />
                
                <SignedIn>
                  {AppConfig.useRestructuredLayout ? (
                    <MainFeedScreen />
                  ) : (
                    <ChallengeScreen />
                  )}
                </SignedIn>
                
                <SignedOut>
                  <OnboardingScreen onComplete={async () => {
                    // Logic is handled by Clerk hooks inside OnboardingScreen
                  }} />
                </SignedOut>
                
              </GestureHandlerRootView>
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
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
  }
});
