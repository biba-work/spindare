/**
 * InstagramPromoModal Component
 * Beautiful popup modal that appears ONCE to promote Instagram follow
 * Shows only once per user, then won't appear again for 15+ sessions
 * Matches Spindare's warm, minimal, soft design aesthetic
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Animated,
  Platform,
  AsyncStorage,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface InstagramPromoModalProps {
  onClose?: () => void;
  userId?: string;
}

const { width, height } = Dimensions.get('window');

const STORAGE_KEY = 'spindare_instagram_promo_shown';
const SESSION_COUNT_KEY = 'spindare_session_count';
const SESSIONS_BEFORE_RESHOW = 15;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#f5f1ed',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#f9f7f4',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeElement: {
    position: 'absolute',
    opacity: 0.15,
  },
  instagramIconContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instagramIcon: {
    width: 120,
    height: 120,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 8,
  },
  openButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#E08080',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  closeButtonText: {
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
});

// Instagram Icon SVG (line art style, matching Spindare aesthetic)
const InstagramIconSVG = () => (
  <Svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <Path
      d="M60 10C73.8 10 75.5 10.1 81.1 10.4C86.6 10.7 89.9 11.7 92.5 13C95.3 14.3 97.4 16 99.5 18.1C101.6 20.2 103.3 22.3 104.6 25.1C106 27.7 107 31 107.3 36.5C107.6 42.1 107.7 43.8 107.7 57.6C107.7 71.4 107.6 73.1 107.3 78.7C107 84.2 106 87.5 104.6 90.1C103.3 92.9 101.6 95 99.5 97.1C97.4 99.2 95.3 100.9 92.5 102.2C89.9 103.6 86.6 104.6 81.1 104.9C75.5 105.2 73.8 105.3 60 105.3C46.2 105.3 44.5 105.2 38.9 104.9C33.4 104.6 30.1 103.6 27.5 102.2C24.7 100.9 22.6 99.2 20.5 97.1C18.4 95 16.7 92.9 15.4 90.1C14 87.5 13 84.2 12.7 78.7C12.4 73.1 12.3 71.4 12.3 57.6C12.3 43.8 12.4 42.1 12.7 36.5C13 31 14 27.7 15.4 25.1C16.7 22.3 18.4 20.2 20.5 18.1C22.6 16 24.7 14.3 27.5 13C30.1 11.7 33.4 10.7 38.9 10.4C44.5 10.1 46.2 10 60 10Z"
      stroke="#E08080"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="60" cy="57.6" r="17.2" stroke="#E08080" strokeWidth="3.5" fill="none" />
    <Circle cx="85" cy="33" r="4" fill="#E08080" />
  </Svg>
);

/**
 * InstagramPromoModal Component
 * ONE-TIME popup that appears only once per user lifetime
 * Once shown, won't appear again for 15+ sessions
 * 
 * Features:
 * - Persists shown state to device storage
 * - Tracks session count
 * - Very low chance to reappear after 15 sessions
 * - Warm, minimal design matching Spindare aesthetic
 */
export const InstagramPromoModal: React.FC<InstagramPromoModalProps> = ({
  onClose,
  userId = 'default',
}) => {
  const [visible, setVisible] = useState(false);
  const modalScaleAnim = React.useRef(new Animated.Value(0.85)).current;
  const modalOpacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAndShowModal();
  }, [userId]);

  const checkAndShowModal = async () => {
    try {
      // Check if modal has been shown before
      const hasShown = await AsyncStorage.getItem(`${STORAGE_KEY}_${userId}`);
      
      if (hasShown === 'true') {
        // Modal was shown, check if enough sessions have passed
        const lastShownSessionCount = await AsyncStorage.getItem(
          `${SESSION_COUNT_KEY}_${userId}`
        );
        const currentSessionCount = await incrementSessionCount(userId);
        
        const sessionsPassed =
          currentSessionCount - parseInt(lastShownSessionCount || '0', 10);
        
        // Only 2% chance to show if 15+ sessions have passed
        if (sessionsPassed >= SESSIONS_BEFORE_RESHOW && Math.random() < 0.02) {
          displayModal();
        }
      } else {
        // First time - show the modal immediately
        await AsyncStorage.setItem(`${STORAGE_KEY}_${userId}`, 'true');
        await AsyncStorage.setItem(
          `${SESSION_COUNT_KEY}_${userId}`,
          '1'
        );
        displayModal();
      }
    } catch (error) {
      console.error('Error checking Instagram promo modal:', error);
    }
  };

  const incrementSessionCount = async (userId: string): Promise<number> => {
    try {
      const currentCount = await AsyncStorage.getItem(
        `${SESSION_COUNT_KEY}_${userId}`
      );
      const newCount = (parseInt(currentCount || '0', 10) + 1).toString();
      await AsyncStorage.setItem(`${SESSION_COUNT_KEY}_${userId}`, newCount);
      return parseInt(newCount, 10);
    } catch (error) {
      console.error('Error incrementing session count:', error);
      return 0;
    }
  };

  const displayModal = () => {
    setVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Smooth scale + fade in animation
    Animated.parallel([
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleOpenInstagram = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const instagramUrl = 'https://instagram.com/spindare.app';
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        await Linking.openURL(instagramUrl);
      }
    } catch (error) {
      console.error('Error opening Instagram:', error);
    }
    handleClose();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(modalScaleAnim, {
        toValue: 0.85,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (onClose) onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView intensity={40} style={styles.overlay}>
        <View style={styles.blurContainer}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: modalScaleAnim }],
                opacity: modalOpacityAnim,
              },
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, color: '#ccc' }}>✕</Text>
            </TouchableOpacity>

            {/* Image Section with Decorative Elements */}
            <View style={styles.imageContainer}>
              {/* Subtle decorative hearts */}
              <View
                style={[
                  styles.decorativeElement,
                  { top: 30, left: 25 },
                ]}
              >
                <Text style={{ fontSize: 32 }}>♡</Text>
              </View>
              <View
                style={[
                  styles.decorativeElement,
                  { bottom: 40, right: 30, opacity: 0.12 },
                ]}
              >
                <Text style={{ fontSize: 40 }}>♡</Text>
              </View>
              <View
                style={[
                  styles.decorativeElement,
                  { top: 60, right: 20 },
                ]}
              >
                <Text style={{ fontSize: 12 }}>✦</Text>
              </View>

              {/* Instagram Icon */}
              <View style={styles.instagramIconContainer}>
                <InstagramIconSVG />
              </View>
            </View>

            {/* Content Section */}
            <View style={styles.contentContainer}>
              <Text style={styles.title}>Follow Us on Instagram</Text>
              <Text style={styles.subtitle}>
                Join our community @spindare.app for exclusive challenges, behind-the-scenes
                content, and real moments from our users.
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.openButton}
                  onPress={handleOpenInstagram}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18 }}>📷</Text>
                  <Text style={styles.openButtonText}>Open Instagram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>Maybe Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default InstagramPromoModal;
