import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Image, TextInput, Keyboard, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedScreen } from './FeedScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { ProfileScreen } from './ProfileScreen';
import { GenericOverlay } from '../components/organisms/GenericOverlay';
import { AppButton } from '../components/atoms/AppButton';
import { UserProfile, HobbyType, StudyFieldType } from '../services/AIService';
import { AuthService } from '../services/AuthService';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const ChevronLeftIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

// Optimized Icons
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
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Path d="M21 21l-4.3-4.3" />
    </Svg>
);

const UserIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <Circle cx="12" cy="7" r="4" />
    </Svg>
);

export const MainFeedScreen = () => {
    const insets = useSafeAreaInsets();
    // ... rest of the code stays the same ...
    // State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile>({
        email: "example@spindare.com",
        username: "example",
        hobbies: [],
        studyFields: [],
        xp: 0,
        level: 1
    });

    const [challenge, setChallenge] = useState<string | null>(null);
    const [spinsLeft, setSpinsLeft] = useState(2);
    const [hasPostedToday, setHasPostedToday] = useState(false);
    const [savedChallenges, setSavedChallenges] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [overlayType, setOverlayType] = useState<'saved' | 'notifications' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Animations
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const overlayAnim = useRef(new Animated.Value(height)).current;
    const badgeScale = useRef(new Animated.Value(0)).current;

    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const headerVisible = useRef(new Animated.Value(1)).current;
    const miniHeaderVisible = useRef(new Animated.Value(0)).current;
    const isMiniHeaderHapticTriggered = useRef(false);

    useEffect(() => {
        AuthService.getSession().then(({ isAuthenticated: authed, userProfile: profile }) => {
            if (authed && profile) {
                setUserProfile(profile);
                setIsAuthenticated(true);

                // Handle Spinner State from Firebase
                const now = Date.now();
                const lastTs = profile.lastSpinTimestamp || 0;
                const hoursPassed = (now - lastTs) / (1000 * 60 * 60);

                if (hoursPassed >= 24) {
                    setSpinsLeft(2);
                    AuthService.updateSpinnerState(2, profile.lastSpinTimestamp || 0);
                } else if (profile.spinsLeft !== undefined) {
                    setSpinsLeft(profile.spinsLeft);
                }
            }
            setIsLoading(false);
        });
    }, []);

    const updateSpins = async (newCount: number) => {
        setSpinsLeft(newCount);
        try {
            const timestamp = userProfile.lastSpinTimestamp || Date.now();
            await AuthService.updateSpinnerState(newCount, timestamp);
            setUserProfile(prev => ({ ...prev, spinsLeft: newCount, lastSpinTimestamp: timestamp }));
        } catch (e) {
            console.error("Error saving spinner state to Firebase", e);
        }
    };

    const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        setUserProfile(prev => {
            const newProfile = { ...prev, ...updates };
            if (updates.photoURL) {
                AuthService.updateProfilePicture(updates.photoURL);
            }
            return newProfile;
        });
    };

    useEffect(() => {
        if (savedChallenges.length > 0) {
            Animated.sequence([
                Animated.spring(badgeScale, { toValue: 1.2, useNativeDriver: true, bounciness: 20 }),
                Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true })
            ]).start();
        }
    }, [savedChallenges.length]);

    // Handlers


    const showOverlay = (type: 'saved' | 'notifications') => {
        setOverlayType(type);
        Animated.spring(overlayAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    };

    const hideOverlay = () => {
        Animated.timing(overlayAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setOverlayType(null));
    };

    const handleLogout = async () => {
        await AuthService.logout();
        setIsAuthenticated(false);
        setIsProfileVisible(false);
    };

    const toggleSearch = (show: boolean) => {
        if (show) {
            setIsSearching(true);
            Animated.spring(searchExpandAnim, { toValue: 1, useNativeDriver: false }).start();
        } else {
            Keyboard.dismiss();
            Animated.timing(searchExpandAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => setIsSearching(false));
        }
    };

    const handleOverlayAction = (item: string, action: 'send' | 'snap') => {
        setChallenge(item);
        hideOverlay();
        if (action === 'send') setIsSharing(true);
    };

    const onScroll = (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        // Unified Visibility Logic
        if (diff > 10) {
            // HIDE ALL on scroll-down
            Animated.parallel([
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 })
            ]).start();
            isMiniHeaderHapticTriggered.current = false;
        } else if (diff < -5) {
            // REVEAL logic on scroll-up
            if (currentY < 500) {
                // Near top: Show Branding, ensure Mini is hidden
                Animated.spring(headerVisible, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                isMiniHeaderHapticTriggered.current = false;
            } else if (diff < -10) {
                // Deep scroll: Show Mini context, hide Branding
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }).start();

                if (!isMiniHeaderHapticTriggered.current) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    isMiniHeaderHapticTriggered.current = true;
                }
            }
        }

        lastScrollY.current = currentY;
    };

    const renderHeader = useMemo(() => (
        <View style={styles.spinSection}>
            <Pressable onPress={() => setIsProfileVisible(true)} style={styles.pfpContainer}>
                <Image
                    source={{ uri: userProfile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80" }}
                    style={styles.mainPfp}
                />
            </Pressable>
            <Text style={styles.mainUsername}>@{userProfile.username}</Text>
        </View>
    ), [userProfile.username]);

    if (isLoading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#FFF' }}>LOADING...</Text></View>;

    if (!isAuthenticated) return (
        <OnboardingScreen
            onComplete={async (email: string, pass: string, username: string, h: HobbyType[], s: StudyFieldType[], isSignup: boolean) => {
                if (isSignup) {
                    const profile = await AuthService.signUp(email, pass, {
                        email,
                        username,
                        hobbies: h,
                        studyFields: s
                    });
                    setUserProfile(profile);
                } else {
                    const profile = await AuthService.login(email, pass);
                    setUserProfile(profile);
                }
                setIsAuthenticated(true);
            }}
        />
    );

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerVisible.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }]}>
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    <View style={styles.header}>
                        <AppButton type="icon" onPress={() => showOverlay('saved')} style={styles.navBtn}>
                            <SavedIcon color="#FFF" />
                            {savedChallenges.length > 0 && (
                                <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                                    <Text style={styles.badgeText}>{savedChallenges.length}</Text>
                                </Animated.View>
                            )}
                        </AppButton>
                        {!isSearching && <Text style={styles.logo}>SPINDARE</Text>}
                        <View style={styles.rightActions}>
                            <Animated.View style={[styles.searchOuter, { width: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [48, width - 24] }) }]}>
                                {isSearching ? (
                                    <View style={styles.searchInner}>
                                        <TextInput autoFocus placeholder="Search" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
                                        <Pressable
                                            onPress={() => toggleSearch(false)}
                                            style={styles.cancelBtn}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <AppButton type="icon" onPress={() => toggleSearch(true)} style={styles.navBtn}><SearchIcon color="#FFF" /></AppButton>
                                )}
                            </Animated.View>
                            {!isSearching && <AppButton type="icon" onPress={() => showOverlay('notifications')} style={styles.navBtn}><NotificationIcon color="#FFF" /></AppButton>}
                        </View>
                    </View>
                </SafeAreaView>
            </Animated.View>

            {/* Mini Slide Popup Header */}
            <Animated.View style={[styles.miniHeader, { top: 0, transform: [{ translateY: miniHeaderVisible.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) }] }]}>
                <BlurView intensity={40} tint="dark" style={[styles.miniBlurWrapper, { paddingTop: insets.top }]}>
                    <View style={styles.miniHeaderContent}>
                        <Pressable onPress={() => setIsProfileVisible(true)} style={styles.miniPfpWrapper}>
                            <Image source={{ uri: userProfile.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80" }} style={styles.miniPfp} />
                        </Pressable>
                        <Text style={styles.miniUsername}>@{userProfile.username}</Text>
                    </View>
                </BlurView>
            </Animated.View>

            <View style={styles.content}>
                <FeedScreen
                    ListHeaderComponent={renderHeader}
                    onScroll={onScroll}
                    contentContainerStyle={{ paddingTop: 60 + insets.top }}
                />
            </View>

            <View style={styles.footer}>
                <Text style={styles.versionText}>SPINDARE V0.45.5 (PRE-ALPHA TESTING)</Text>
            </View>

            {isSharing && <View style={styles.fullOverlay}><FriendsListScreen challenge={challenge || ''} onClose={() => setIsSharing(false)} /></View>}
            {isProfileVisible && (
                <View style={styles.fullOverlay}>
                    <ProfileScreen
                        onBack={() => setIsProfileVisible(false)}
                        onLogout={handleLogout}
                        spinsLeft={spinsLeft}
                        setSpinsLeft={updateSpins}
                        activeChallenge={challenge}
                        onChallengeReceived={setChallenge}
                        userProfile={userProfile}
                        onUpdateProfile={handleUpdateProfile}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000, overflow: 'hidden', backgroundColor: '#000' },
    safeArea: { zIndex: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    logo: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 6, textAlign: 'center', position: 'absolute', left: 0, right: 0, zIndex: -1 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtn: { width: 48, height: 48, backgroundColor: 'transparent' },
    badge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FF3B30', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
    searchOuter: { height: 48, justifyContent: 'center', overflow: 'hidden' },
    searchInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 24, paddingLeft: 16, paddingRight: 8, flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    searchInput: { flex: 1, color: '#FFF', fontSize: 14, paddingVertical: 0 },
    cancelBtn: { paddingHorizontal: 12 },
    cancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
    content: { flex: 1 },
    spinSection: { paddingTop: 40, paddingBottom: 24, alignItems: 'center' },
    pfpContainer: { width: 120, height: 120, borderRadius: 60, padding: 4, backgroundColor: '#111', marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
    mainPfp: { width: 112, height: 112, borderRadius: 56 },
    mainUsername: { color: '#FFF', fontSize: 18, fontWeight: '900', marginBottom: 40 },
    revealWrapper: { width: '100%', alignItems: 'center' },
    revealPost: { width: width - 32, padding: 24, borderRadius: 32, backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    postAvatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    postHeaderText: { justifyContent: 'center' },
    postAuthor: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    postTime: { color: '#FF3B30', fontSize: 10, fontWeight: '900' },
    postContent: { color: '#FFF', fontSize: 16, lineHeight: 24, marginBottom: 24, fontWeight: '500' },
    postActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12 },
    reactionItem: { flex: 1, alignItems: 'center' },
    snapBtn: { flex: 1, height: 56, borderRadius: 28 },
    snapText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    footer: { paddingVertical: 16, alignItems: 'center' },
    versionText: { color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000 },
    miniHeader: { position: 'absolute', left: 0, right: 0, zIndex: 1500, overflow: 'hidden' },
    miniBlurWrapper: { paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
    miniHeaderContent: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    miniPfpWrapper: { width: 50, height: 50, borderRadius: 25, marginBottom: 4 },
    miniPfp: { width: 50, height: 50, borderRadius: 25 },
    miniUsername: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
