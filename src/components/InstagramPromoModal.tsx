/**
 * InstagramPromoModal Component
 * Beautiful popup modal that appears randomly to promote Instagram follow
 * Matches modern app design with rounded corners, gray overlay, and smooth animations
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Linking,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface InstagramPromoModalProps {
  onClose?: () => void;
  showProbability?: number; // Probability (0-1) that modal shows on app open
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  instagramIcon: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E1306C',
  },
  instagramIconText: {
    fontSize: 60,
    color: '#E1306C',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 8,
  },
  openButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

/**
 * InstagramPromoModal Component
 * Shows a beautiful modal prompting users to follow @spindare.app on Instagram
 * 
 * Features:
 * - Modern design matching app theme
 * - Rounded corners with shadow
 * - Smooth animations
 * - Random appearance (configurable probability)
 * - Gray overlay background
 * - Instagram icon with brand color
 * 
 * @example
 * <InstagramPromoModal 
 *   showProbability={0.3}
 *   onClose={() => console.log('Modal closed')}
 * />
 */
export const InstagramPromoModal: React.FC<InstagramPromoModalProps> = ({
  onClose,
  showProbability = 0.25, // 25% chance to show on app open
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Randomly decide whether to show modal
    const shouldShow = Math.random() < showProbability;
    if (shouldShow) {
      setVisible(true);
    }
  }, [showProbability]);

  const handleOpenInstagram = async () => {
    try {
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
    setVisible(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Instagram Icon Section */}
          <View style={styles.imageContainer}>
            <LinearGradient
              colors={['rgba(14, 16, 66, 0.3)', 'rgba(40, 10, 40, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientOverlay}
            />
            <View style={styles.instagramIcon}>
              <Text style={styles.instagramIconText}>📸</Text>
            </View>
          </View>

          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Follow Us on Instagram</Text>
            <Text style={styles.subtitle}>
              Join our community @spindare.app for exclusive challenges, behind-the-scenes content, and real moments from our users.
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <LinearGradient
                colors={['#E1306C', '#C13584']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.openButton}
              >
                <TouchableOpacity
                  style={styles.openButton}
                  onPress={handleOpenInstagram}
                  activeOpacity={0.8}
                >
                  <Text style={styles.openButtonText}>Open Instagram</Text>
                </TouchableOpacity>
              </LinearGradient>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default InstagramPromoModal;
