/**
 * InstagramSettingsButton Component
 * Settings screen button to follow @spindare.app on Instagram
 * Located at the bottom of settings with clean, minimal design
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InstagramSettingsButtonProps {
  onPress?: () => void;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  buttonPressed: {
    backgroundColor: '#2a2a2a',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E1306C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
  },
  arrowIcon: {
    color: '#666',
    marginLeft: 8,
  },
});

/**
 * InstagramSettingsButton Component
 * Clean button in settings that opens Instagram when tapped
 * 
 * Features:
 * - Instagram brand color icon
 * - Title and subtitle
 * - Arrow indicator
 * - Press feedback
 * 
 * @example
 * <InstagramSettingsButton 
 *   onPress={() => console.log('Instagram opened')}
 * />
 */
export const InstagramSettingsButton: React.FC<InstagramSettingsButtonProps> = ({
  onPress,
}) => {
  const handlePress = async () => {
    try {
      const instagramUrl = 'https://instagram.com/spindare.app';
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        await Linking.openURL(instagramUrl);
        if (onPress) onPress();
      } else {
        Alert.alert('Instagram', 'Instagram is not installed on your device.');
      }
    } catch (error) {
      console.error('Error opening Instagram:', error);
      Alert.alert('Error', 'Failed to open Instagram');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={styles.leftContent}>
          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 24 }}>📷</Text>
          </View>
          <View style={styles.textContent}>
            <Text style={styles.title}>Follow on Instagram</Text>
            <Text style={styles.subtitle}>@spindare.app</Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          style={styles.arrowIcon}
        />
      </TouchableOpacity>
    </View>
  );
};

export default InstagramSettingsButton;
