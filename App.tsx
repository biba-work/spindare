import React, { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { ChallengeScreen } from "./src/screens/ChallengeScreen";
import { MainFeedScreen } from "./src/screens/MainFeedScreen";
import { AppConfig } from "./src/config/AppConfig";
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

import { ThemeProvider } from "./src/contexts/ThemeContext";

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
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={styles.container} onLayout={onLayoutRootView}>
          <View style={styles.deadzone} />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" />
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </GestureHandlerRootView>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
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
  }
});
