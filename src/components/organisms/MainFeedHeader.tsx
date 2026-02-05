import React, { useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Image as NativeImage } from 'react-native'; // For resolveAssetSource
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppButton } from '../atoms/AppButton';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile } from '../../services/AIService';
import { Post } from '../../services/PostService';
import { Notification } from '../../services/NotificationService';

const { width } = Dimensions.get('window');

// Icons
const SavedIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </Svg>
);

const NotificationIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
);

const SearchIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Path d="M21 21L16.65 16.65" />
    </Svg>
);

const SpindIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const MessageIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
);

interface MainFeedHeaderProps {
    userProfile: UserProfile;
    isSearching: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    toggleSearch: () => void;
    searchExpandAnim: Animated.Value;
    headerVisible: Animated.Value;
    notifications: Notification[];
    keptChallenges: { id: string, challenge: string, postId: string }[];
    spindChallenges: { id: string, challenge: string, postId: string }[];
    onProfilePress: (userId: string, username: string, avatar: string) => void;
    onMyProfilePress: () => void;
    onShowOverlay: (type: 'saved' | 'notifications' | 'spind') => void;
}

export const MainFeedHeader = ({
    userProfile,
    isSearching,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    searchExpandAnim,
    headerVisible,
    notifications,
    keptChallenges,
    spindChallenges,
    onProfilePress,
    onMyProfilePress,
    onShowOverlay
}: MainFeedHeaderProps) => {
    const { darkMode } = useTheme();

    return (
        <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerVisible.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }]}>
            <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <SafeAreaView edges={['top']}>
                <View style={styles.header}>
                    {!isSearching && (
                        <View style={styles.leftActions}>
                            <Pressable onPress={onMyProfilePress} style={styles.topBarPfpContainer}>
                                <Image source={{ uri: (userProfile.username === 'rashica07' || userProfile.username === 'example' || !userProfile.photoURL) ? NativeImage.resolveAssetSource(require('../../../assets/rashica_pfp.jpg')).uri : userProfile.photoURL }} style={styles.topBarPfp} contentFit="cover" />
                            </Pressable>
                            <AppButton type="icon" onPress={() => onShowOverlay('saved')} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                <SavedIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                {keptChallenges.length > 0 && (
                                    <View style={[styles.badge]}>
                                        <Text style={styles.badgeText}>{keptChallenges.length}</Text>
                                    </View>
                                )}
                            </AppButton>
                        </View>
                    )}

                    {!isSearching && <Text style={[styles.logo, darkMode && styles.logoDark]}>SPINDARE</Text>}

                    <View style={[styles.rightActions, isSearching && { flex: 1, justifyContent: 'center' }]}>
                        <Animated.View style={[styles.searchOuter, { width: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [48, width - 32] }) }]}>
                            {isSearching ? (
                                <View style={[styles.searchInner, darkMode && styles.searchInnerDark]}>
                                    <TextInput
                                        autoFocus
                                        placeholder="Search"
                                        placeholderTextColor={darkMode ? "#777" : "#C5C5C5"}
                                        style={[styles.searchInput, darkMode && styles.searchInputDark]}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                    <Pressable onPress={toggleSearch} style={styles.cancelBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <AppButton type="icon" onPress={toggleSearch} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                    <SearchIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                </AppButton>
                            )}
                        </Animated.View>

                        {!isSearching && (
                            <AppButton type="icon" onPress={() => onShowOverlay('notifications')} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                <NotificationIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                {notifications.some(n => !n.read) && (
                                    <View style={[styles.badge]}>
                                        <Text style={styles.badgeText}>{notifications.filter(n => !n.read).length}</Text>
                                    </View>
                                )}
                            </AppButton>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBarPfpContainer: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    topBarPfp: { width: '100%', height: '100%' },
    logo: { color: '#4A4A4A', fontSize: 13, fontWeight: '700', letterSpacing: 4, textAlign: 'center', flex: 1 },
    logoDark: { color: '#FFF' },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtn: { width: 48, height: 48, backgroundColor: 'transparent' },
    badge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#A7BBC7', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FAF9F6', fontSize: 8, fontWeight: '500' },
    searchOuter: { height: 48, justifyContent: 'center', overflow: 'hidden' },
    searchInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 24, paddingLeft: 16, paddingRight: 8, flex: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    searchInnerDark: { backgroundColor: '#2C2C2E', borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, color: '#4A4A4A', fontSize: 14, paddingVertical: 0 },
    searchInputDark: { color: '#FFF' },
    cancelBtn: { paddingHorizontal: 12 },
    cancelText: { color: '#8E8E93', fontSize: 12, fontWeight: '500' },
});
