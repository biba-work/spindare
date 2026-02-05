import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Image as NativeImage } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile } from '../../services/AIService';
import { Notification } from '../../services/NotificationService';
import { AppButton } from '../atoms/AppButton';

const NotificationIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
);

interface MiniHeaderProps {
    userProfile: UserProfile;
    miniHeaderVisible: Animated.Value;
    onProfilePress: (userId: string, username: string, avatar: string) => void;
    onMyProfilePress: () => void;
    notifications: Notification[];
    onShowOverlay: (type: 'saved' | 'notifications') => void;
}

export const MiniHeader = ({ userProfile, miniHeaderVisible, onProfilePress, onMyProfilePress, notifications, onShowOverlay }: MiniHeaderProps) => {
    const { darkMode } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Animated.View style={[styles.miniHeader, { opacity: miniHeaderVisible, transform: [{ translateY: miniHeaderVisible.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }] }]}>
            <BlurView intensity={80} tint={darkMode ? "dark" : "light"} style={[styles.miniBlurWrapper, { paddingTop: insets.top }, darkMode && { borderBottomColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={styles.miniHeaderContent}>
                    <View style={styles.leftContent}>
                        <Pressable onPress={onMyProfilePress} style={styles.miniPfpWrapper}>
                            <Image source={{ uri: (userProfile.username === 'rashica07' || userProfile.username === 'example' || !userProfile.photoURL) ? NativeImage.resolveAssetSource(require('../../../assets/rashica_pfp.jpg')).uri : userProfile.photoURL }} style={styles.miniPfp} contentFit="cover" />
                        </Pressable>
                        <Text style={[styles.miniUsername, darkMode && styles.textDark]}>@{userProfile.username}</Text>
                    </View>

                    <AppButton type="icon" onPress={() => onShowOverlay('notifications')} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                        <NotificationIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                        {notifications.some(n => !n.read) && (
                            <View style={[styles.badge]}>
                                <Text style={styles.badgeText}>{notifications.filter(n => !n.read).length}</Text>
                            </View>
                        )}
                    </AppButton>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    miniHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3000, overflow: 'hidden' },
    miniBlurWrapper: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(167, 187, 199, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    miniHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
    leftContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    miniPfpWrapper: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    miniPfp: { width: '100%', height: '100%' },
    miniUsername: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: -0.2 },
    textDark: { color: '#FFF' },
    navBtn: { width: 40, height: 40, backgroundColor: 'transparent' },
    badge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#A7BBC7', width: 12, height: 12, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FAF9F6', fontSize: 7, fontWeight: '500' },
});
