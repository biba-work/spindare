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
import { Post, PostService } from '../services/PostService';
import { auth } from '../services/firebaseConfig';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { PostCreationScreen } from './PostCreationScreen';
import { UserProfileView } from './UserProfileView';

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
        email: "rashica07@spindare.com",
        username: "rashica07",
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
    const [posts, setPosts] = useState<Post[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [viewingProfile, setViewingProfile] = useState<{ userId: string; username: string; avatar: string } | null>(null);

    // Animations
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const overlayAnim = useRef(new Animated.Value(height)).current;
    const badgeScale = useRef(new Animated.Value(0)).current;
    const postTransitionAnim = useRef(new Animated.Value(height)).current;

    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const headerVisible = useRef(new Animated.Value(1)).current;
    const miniHeaderVisible = useRef(new Animated.Value(0)).current;
    const isMiniHeaderHapticTriggered = useRef(false);

    useEffect(() => {
        // Real-time session listener (The "Remember Me" logic)
        const unsubscribeAuth = AuthService.onSessionChange(async (user, profile) => {
            if (user && profile) {
                setUserProfile(profile);
                setIsAuthenticated(true);
                PostService.seedFakeData();

                // Handle Spinner State
                const now = Date.now();
                const lastTs = profile.lastSpinTimestamp || 0;
                const hoursPassed = (now - lastTs) / (1000 * 60 * 60);

                if (hoursPassed >= 24) {
                    setSpinsLeft(2);
                    AuthService.updateSpinnerState(2, profile.lastSpinTimestamp || 0);
                } else if (profile.spinsLeft !== undefined) {
                    setSpinsLeft(profile.spinsLeft);
                }
            } else {
                setIsAuthenticated(false);
            }
            setIsLoading(false);
        });

        const unsubscribeFeed = PostService.subscribeToFeed((updatedPosts) => {
            setPosts(updatedPosts);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeFeed();
        };
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

    const showPostCreator = () => {
        setIsPosting(true);
        Animated.spring(postTransitionAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const hidePostCreator = () => {
        Animated.timing(postTransitionAnim, {
            toValue: height,
            duration: 400,
            useNativeDriver: true,
        }).start(() => setIsPosting(false));
    };

    const handleMediaAction = async (type: 'camera' | 'gallery' | 'text', itemChallenge: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setChallenge(itemChallenge);

        if (type === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled) {
                setSelectedImage(result.assets[0].uri);
                showPostCreator();
            }
        } else if (type === 'gallery') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled) {
                setSelectedImage(result.assets[0].uri);
                showPostCreator();
            }
        } else {
            setSelectedImage(null);
            showPostCreator();
        }
    };

    const handlePostSubmit = async (content: string, imageUri?: string | null) => {
        hidePostCreator();
        try {
            await PostService.createPost(
                userProfile.username,
                userProfile.photoURL || '',
                challenge || 'Inbox Challenge',
                content,
                imageUri || null
            );
        } catch (err) {
            console.error("Error creating post from Inbox:", err);
        }
    };

    const handleOverlayAction = (itemChallenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => {
        if (action === 'send') {
            setChallenge(itemChallenge);
            hideOverlay();
            setIsSharing(true);
        } else {
            // It's a media action (camera/gallery/text)
            hideOverlay();
            handleMediaAction(action, itemChallenge);
        }
    };

    const handleProfilePress = (userId: string, username: string, avatar: string) => {
        setViewingProfile({ userId, username, avatar });
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
            {/* Profile picture and username removed - now in top bar */}
        </View>
    ), [userProfile.username]);

    if (isLoading) return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Image source={require('../../assets/logo.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
        </View>
    );

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
                        <View style={styles.leftActions}>
                            <Pressable onPress={() => setIsProfileVisible(true)} style={styles.topBarPfpContainer}>
                                <Image
                                    source={{ uri: (userProfile.username === 'rashica07' || userProfile.username === 'example' || !userProfile.photoURL) ? Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri : userProfile.photoURL }}
                                    style={styles.topBarPfp}
                                />
                            </Pressable>
                            <AppButton type="icon" onPress={() => showOverlay('saved')} style={styles.navBtn}>
                                <SavedIcon color="#4A4A4A" />
                                {savedChallenges.length > 0 && (
                                    <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                                        <Text style={styles.badgeText}>{savedChallenges.length}</Text>
                                    </Animated.View>
                                )}
                            </AppButton>
                        </View>
                        {!isSearching && <Text style={styles.logo}>SPINDARE</Text>}
                        <View style={styles.rightActions}>
                            <Animated.View style={[styles.searchOuter, { width: searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [48, width - 48] }) }]}>
                                {isSearching ? (
                                    <View style={styles.searchInner}>
                                        <TextInput autoFocus placeholder="Search" placeholderTextColor="#C5C5C5" style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
                                        <Pressable
                                            onPress={() => toggleSearch(false)}
                                            style={styles.cancelBtn}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <AppButton type="icon" onPress={() => toggleSearch(true)} style={styles.navBtn}><SearchIcon color="#4A4A4A" /></AppButton>
                                )}
                            </Animated.View>
                            {!isSearching && <AppButton type="icon" onPress={() => showOverlay('notifications')} style={styles.navBtn}><NotificationIcon color="#4A4A4A" /></AppButton>}
                        </View>
                    </View>
                </SafeAreaView>
            </Animated.View>

            {/* Mini Slide Popup Header */}
            <Animated.View style={[styles.miniHeader, {
                opacity: miniHeaderVisible,
                transform: [{
                    translateY: miniHeaderVisible.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-100, 0]
                    })
                }]
            }]}>
                <BlurView intensity={80} tint="light" style={[styles.miniBlurWrapper, { paddingTop: insets.top }]}>
                    <View style={styles.miniHeaderContent}>
                        <Pressable onPress={() => setIsProfileVisible(true)} style={styles.miniPfpWrapper}>
                            <Image source={{ uri: (userProfile.username === 'rashica07' || userProfile.username === 'example' || !userProfile.photoURL) ? Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri : userProfile.photoURL }} style={styles.miniPfp} />
                        </Pressable>
                        <Text style={styles.miniUsername}>@{userProfile.username}</Text>
                    </View>
                </BlurView>
            </Animated.View>

            <View style={styles.content}>
                <FeedScreen
                    posts={posts}
                    currentUserId={auth.currentUser?.uid}
                    ListHeaderComponent={renderHeader}
                    onScroll={onScroll}
                    contentContainerStyle={{ paddingTop: 60 + insets.top }}
                    onProfilePress={handleProfilePress}
                />
            </View>

            <View style={styles.footer}>
                <Text style={styles.versionText}>SPINDARE V0.61.30 (PRE-ALPHA TESTING)</Text>
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

            {/* In-Feed Post Creator (for Inbox) */}
            <Animated.View style={[styles.fullOverlay, { transform: [{ translateY: postTransitionAnim }] }]}>
                {isPosting && (
                    <PostCreationScreen
                        challenge={challenge || ''}
                        imageUri={selectedImage}
                        onClose={hidePostCreator}
                        onPost={handlePostSubmit}
                    />
                )}
            </Animated.View>

            <GenericOverlay
                visible={overlayType !== null}
                type={overlayType || 'saved'}
                onClose={hideOverlay}
                data={overlayType === 'saved' ? savedChallenges : []}
                onAction={handleOverlayAction}
                animation={overlayAnim}
            />

            {viewingProfile && (
                <View style={styles.fullOverlay}>
                    <UserProfileView
                        userId={viewingProfile.userId}
                        username={viewingProfile.username}
                        avatar={viewingProfile.avatar}
                        onBack={() => setViewingProfile(null)}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000, overflow: 'hidden', backgroundColor: '#FAF9F6' },
    safeArea: { zIndex: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBarPfpContainer: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    topBarPfp: { width: '100%', height: '100%' },
    logo: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: 6, textAlign: 'center', position: 'absolute', left: 0, right: 0, zIndex: -1 },
    rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtn: { width: 48, height: 48, backgroundColor: 'transparent' },
    badge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#A7BBC7', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FAF9F6', fontSize: 8, fontWeight: '500' },
    searchOuter: { height: 48, justifyContent: 'center', overflow: 'hidden' },
    searchInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 24, paddingLeft: 16, paddingRight: 8, flex: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    searchInput: { flex: 1, color: '#4A4A4A', fontSize: 14, paddingVertical: 0 },
    cancelBtn: { paddingHorizontal: 12 },
    cancelText: { color: '#8E8E93', fontSize: 12, fontWeight: '500' },
    content: { flex: 1 },
    miniHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3000,
        overflow: 'hidden',
    },
    miniUsername: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: -0.2 },
    spinSection: { paddingTop: 20, paddingBottom: 24, alignItems: 'center' },
    revealWrapper: { width: '100%', alignItems: 'center' },
    revealPost: { width: width - 32, padding: 24, borderRadius: 32, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 10 },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    postAvatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    postHeaderText: { justifyContent: 'center' },
    postAuthor: { color: '#4A4A4A', fontSize: 14, fontWeight: '500' },
    postTime: { color: '#A7BBC7', fontSize: 10, fontWeight: '400' },
    postContent: { color: '#333333', fontSize: 16, lineHeight: 24, marginBottom: 24, fontWeight: '400' },
    postActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12 },
    postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    postActionText: { color: '#8E8E93', fontSize: 12, fontWeight: '500' },
    snapBtnWrapper: { width: '100%', paddingHorizontal: 20, paddingBottom: 100 },
    snapBtn: { flex: 1, height: 56, borderRadius: 28, backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#D1D1D1' },
    footer: { paddingVertical: 24, alignItems: 'center' },
    versionText: { color: '#8E8E93', fontSize: 9, fontWeight: '400', letterSpacing: 2 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 4000 },
    navBar: {
        flexDirection: 'row',
        backgroundColor: '#FAF9F6',
        paddingTop: 12,
        paddingBottom: 28,
        paddingHorizontal: 30,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    navItem: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
    navItemActive: { opacity: 1 },
    navIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#A7BBC7',
    },
    miniBlurWrapper: {
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(167, 187, 199, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    miniHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 8, gap: 10 },
    miniPfpWrapper: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    miniPfp: { width: '100%', height: '100%' },
});
