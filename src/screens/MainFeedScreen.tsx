import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Image, TextInput, Keyboard, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedScreen } from './FeedScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { ProfileScreen } from './ProfileScreen';
import { MessagesScreen } from './MessagesScreen';
import { ChatScreen } from './ChatScreen';
import { GenericOverlay } from '../components/organisms/GenericOverlay';
import { AppButton } from '../components/atoms/AppButton';

import { UserProfile, HobbyType, StudyFieldType } from '../services/AIService';
import { AuthService } from '../services/AuthService';
import { Post, PostService } from '../services/PostService';

import { ChatService } from '../services/ChatService';
import { SocialService } from '../services/SocialService';
import Svg, { Path, Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { PostCreationScreen } from './PostCreationScreen';
import { UserProfileView } from './UserProfileView';
import { LogViewerScreen } from './LogViewerScreen';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { SearchService } from '../services/SearchService';
import { NotificationService } from '../services/NotificationService';
import { useAuth, useUser, useClerk } from '@clerk/clerk-expo';

import { supabase } from '../services/supabaseConfig';

const { width, height } = Dimensions.get('window');

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
    const { darkMode } = useTheme();
    
    const { isLoaded, userId, isSignedIn } = useAuth();
    const { user } = useUser();
    const { signOut } = useClerk();
    
    // State
    const [isLoading, setIsLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile>({
        email: "",
        username: "Guest",
        hobbies: [],
        studyFields: [],
        xp: 0,
        level: 1
    });

    const [challenge, setChallenge] = useState<string | null>(null);
    const [spinsLeft, setSpinsLeft] = useState(2);
    const [savedChallenges, setSavedChallenges] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [overlayType, setOverlayType] = useState<'saved' | 'notifications' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [isPosting, setIsPosting] = useState(false);

    // Wire up real-time feed; seed mock posts in dev if DB is empty
    useEffect(() => {
        const unsubscribe = PostService.subscribeToFeed((updater) => setPosts(updater));
        if (__DEV__) PostService.seedFakeData();
        return unsubscribe;
    }, []);

    // Load saved challenges from DB when user is ready (filter expired ones)
    useEffect(() => {
        if (!userId) return;
        SocialService.getSavedChallenges(userId)
            .then(challenges => { if (challenges.length > 0) setSavedChallenges(challenges); })
            .catch(e => console.warn('Failed to load saved challenges:', e));
    }, [userId]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [viewingProfile, setViewingProfile] = useState<{ userId: string; username: string; avatar: string } | null>(null);
    const [searchResults, setSearchResults] = useState<{ users: (UserProfile & { uid?: string })[], posts: Post[] }>({ users: [], posts: [] });

    // Chat/Messages state
    const [isMessagesVisible, setIsMessagesVisible] = useState(false);
    const [activeChat, setActiveChat] = useState<{ conversationId: string; otherUsername: string; otherAvatar: string } | null>(null);

    // Hidden log viewer (5-tap on version footer)
    const [isLogViewerVisible, setIsLogViewerVisible] = useState(false);
    const versionTapCount = useRef(0);
    const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleVersionTap = () => {
        versionTapCount.current += 1;
        if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
        versionTapTimer.current = setTimeout(() => { versionTapCount.current = 0; }, 2000);
        if (versionTapCount.current >= 5) {
            versionTapCount.current = 0;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsLogViewerVisible(true);
        }
    };


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
    const isMiniActive = useRef(false);       // tracks whether Compact Bar is currently showing
    const searchFromMini = useRef(false);     // tracks if search was opened from Compact Bar


    useEffect(() => {
        const loadInitialData = async () => {
            if (isLoaded && isSignedIn && userId) {
                try {
                    console.log("MainFeedScreen session check. isSignedIn:", isSignedIn, "userId:", userId);
                    
                    // Fetch profile from Supabase using Clerk ID
                    let profile = await AuthService.getProfile(userId);
                    if (!profile && user) {
                        // Auto-create if missing (e.g. first social login)
                        profile = await AuthService.createProfile(userId, {
                            email: user.primaryEmailAddress?.emailAddress || "",
                            username: user.username || user.firstName || "User",
                            hobbies: [],
                            studyFields: []
                        });
                    }
                    if (profile) setUserProfile(profile);

                    // Register push notification token (non-blocking)
                    NotificationService.registerPushToken(userId).catch(e =>
                        console.warn("Push token registration failed:", e)
                    );
                } catch (err) {
                    console.error("Error loading user profile:", err);
                } finally {
                    setIsLoading(false);
                }
            } else if (isLoaded && !isSignedIn) {
                console.log("Running as guest/rashica07");
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, [isLoaded, isSignedIn, userId, user]);

    // Badge animation: pop in when a challenge is saved, shrink out when empty
    const badgePulse = useRef(new Animated.Value(1)).current;
    const feedFadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (savedChallenges.length > 0) {
            Animated.spring(badgeScale, {
                toValue: 1,
                useNativeDriver: true,
                friction: 5,
                tension: 80,
            }).start(() => {
                Animated.loop(Animated.sequence([
                    Animated.timing(badgePulse, { toValue: 1.18, duration: 900, useNativeDriver: true }),
                    Animated.timing(badgePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
                ])).start();
            });
        } else {
            badgePulse.setValue(1);
            Animated.spring(badgeScale, { toValue: 0, useNativeDriver: true, friction: 5, tension: 80 }).start();
        }
    }, [savedChallenges.length]);

    // Feed mount animation
    useEffect(() => {
        Animated.spring(feedFadeAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 30 }).start();
    }, []);

    // Profile Listener
    useEffect(() => {
        if (!userId) return;
        const unsubscribe = AuthService.onProfileChange(userId, (profile) => {
            if (profile) setUserProfile(profile);
        });
        return unsubscribe;
    }, [userId]);

    // Search Effect
    useEffect(() => {
        const delay = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                const [u, p] = await Promise.all([
                    SearchService.searchUsers(searchQuery),
                    SearchService.searchChallenges(searchQuery)
                ]);
                setSearchResults({ users: u, posts: p });
            } else {
                setSearchResults({ users: [], posts: [] });
            }
        }, 500);
        return () => clearTimeout(delay);
    }, [searchQuery]);

    const updateSpins = async (newCount: number) => {
        if (!userId) return;
        setSpinsLeft(newCount);
        try {
            const timestamp = userProfile.lastSpinTimestamp || Date.now();
            await AuthService.updateSpinnerState(userId, newCount, timestamp);
            setUserProfile(prev => ({ ...prev, spinsLeft: newCount, lastSpinTimestamp: timestamp }));
        } catch (e) {
            console.error("Error saving spinner state", e);
        }
    };

    const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        if (!userId) return;
        setUserProfile(prev => {
            const newProfile = { ...prev, ...updates };
            if (updates.photoURL) {
                AuthService.updateProfilePicture(userId, updates.photoURL);
            }
            return newProfile;
        });
    };

    const showOverlay = (type: 'saved' | 'notifications') => {
        setOverlayType(type);
        Animated.spring(overlayAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    };

    const hideOverlay = () => {
        Animated.timing(overlayAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setOverlayType(null));
    };

    const handleLogout = async () => {
        try {
            await signOut();
            setIsProfileVisible(false);
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    const toggleSearch = (show: boolean) => {
        if (show) {
            setIsSearching(true);
            // If Compact Bar is active, slide Top Bar down so the search input is visible
            if (isMiniActive.current) {
                searchFromMini.current = true;
                Animated.parallel([
                    Animated.spring(headerVisible, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
                    Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
                ]).start();
            }
            Animated.spring(searchExpandAnim, { toValue: 1, useNativeDriver: false }).start();
        } else {
            Keyboard.dismiss();
            Animated.timing(searchExpandAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
                setIsSearching(false);
                // Restore Compact Bar if search was opened from it
                if (searchFromMini.current) {
                    searchFromMini.current = false;
                    isMiniActive.current = true;
                    Animated.parallel([
                        Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
                        Animated.spring(miniHeaderVisible, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
                    ]).start();
                }
            });
        }
    };

    const showPostCreator = () => {
        setIsPosting(true);
        Animated.spring(postTransitionAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    };

    const hidePostCreator = () => {
        Animated.timing(postTransitionAnim, { toValue: height, duration: 400, useNativeDriver: true }).start(() => setIsPosting(false));
    };

    const handleMediaAction = async (type: 'camera' | 'gallery' | 'text', itemChallenge: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setChallenge(itemChallenge);
        if (type === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled) { setSelectedImage(result.assets[0].uri); showPostCreator(); }
        } else if (type === 'gallery') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
            if (!result.canceled) { setSelectedImage(result.assets[0].uri); showPostCreator(); }
        } else {
            setSelectedImage(null); showPostCreator();
        }
    };

    const [isSubmittingPost, setIsSubmittingPost] = useState(false);

    const handlePostSubmit = async (content: string, imageUri?: string | null) => {
        if (isSubmittingPost) return;
        setIsSubmittingPost(true);
        try {
            if (!userId) throw new Error("User ID not available");
            await PostService.createPost(userId, userProfile.username, userProfile.photoURL || '', challenge || 'Inbox Challenge', content, imageUri || null);
            // PostCreationScreen closes itself after its success animation — don't call hidePostCreator here
        } catch (err) {
            console.error(err);
            throw err; // re-throw so PostCreationScreen can reset its loading state
        } finally {
            setIsSubmittingPost(false);
        }
    };

    const handleOverlayAction = (itemChallenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => {
        if (action === 'send') { setChallenge(itemChallenge); hideOverlay(); setIsSharing(true); }
        else { hideOverlay(); handleMediaAction(action, itemChallenge); }
    };

    const handleProfilePress = (userId: string, username: string, avatar: string) => {
        setViewingProfile({ userId, username, avatar });
    };

    const onScroll = (event: any) => {
        // Don't move headers while search is open — keep Top Bar visible
        if (isSearching) return;

        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;
        if (diff > 10) {
            Animated.parallel([
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 })
            ]).start();
            isMiniActive.current = false;
            isMiniHeaderHapticTriggered.current = false;
        } else if (diff < -5) {
            if (currentY < 500) {
                Animated.spring(headerVisible, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                isMiniActive.current = false;
                isMiniHeaderHapticTriggered.current = false;
            } else if (diff < -10) {
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }).start();
                isMiniActive.current = true;
                if (!isMiniHeaderHapticTriggered.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); isMiniHeaderHapticTriggered.current = true; }
            }
        }
        lastScrollY.current = currentY;
    };

    const renderHeader = useMemo(() => (<View style={styles.spinSection} />), []);

    if (isLoading) return (<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Image source={require('../../assets/logo.png')} style={{ width: 80, height: 80 }} resizeMode="contain" /></View>);

    return (
        <View style={[styles.container, darkMode && styles.containerDark]}>
            <StatusBar style={darkMode ? "light" : "dark"} />
            <Animated.View style={[styles.headerContainer, darkMode && styles.headerContainerDark, { transform: [{ translateY: headerVisible.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }]}>
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    <View style={styles.header}>
                        {!isSearching && (
                            <View style={styles.leftActions}>
                                <Pressable onPress={() => setIsProfileVisible(true)} style={styles.topBarPfpContainer}>
                                    <Image source={{ uri: userProfile.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri }} style={styles.topBarPfp} />
                                </Pressable>
                                <AppButton type="icon" onPress={() => showOverlay('saved')} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                    <SavedIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                    {savedChallenges.length > 0 && (
                                        <Animated.View style={[styles.badge, { transform: [{ scale: Animated.multiply(badgeScale, badgePulse) }] }]}>
                                            <Text style={styles.badgeText}>{savedChallenges.length}</Text>
                                        </Animated.View>
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
                                        <Pressable onPress={() => toggleSearch(false)} style={styles.cancelBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <AppButton type="icon" onPress={() => toggleSearch(true)} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                        <SearchIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                    </AppButton>
                                )}
                            </Animated.View>

                            {!isSearching && (
                                <AppButton type="icon" onPress={() => showOverlay('notifications')} style={[styles.navBtn, darkMode && { backgroundColor: 'transparent' }]}>
                                    <NotificationIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                </AppButton>
                            )}
                        </View>
                    </View>

                    {/* Search Results — keyboard-aware so results don't hide behind keyboard */}
                    {isSearching && searchQuery.length >= 2 && (searchResults.users.length > 0 || searchResults.posts.length > 0) && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={0}
                        >
                            <View style={[styles.searchResultsContainer, darkMode && styles.searchResultsContainerDark]}>
                                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                    {searchResults.users.length > 0 && (
                                        <View style={styles.resultSection}>
                                            <Text style={[styles.resultSectionTitle, darkMode && styles.textDark]}>USERS</Text>
                                            {searchResults.users.map(u => (
                                                <Pressable key={u.username} onPress={() => handleProfilePress(u.uid || '', u.username, u.photoURL || '')} style={styles.resultItem}>
                                                    <Image source={{ uri: u.photoURL || Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri }} style={styles.resultAvatar} />
                                                    <Text style={[styles.resultText, darkMode && styles.textDark]}>@{u.username}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                    {searchResults.posts.length > 0 && (
                                        <View style={styles.resultSection}>
                                            <Text style={[styles.resultSectionTitle, darkMode && styles.textDark]}>CHALLENGES</Text>
                                            {searchResults.posts.map(p => (
                                                <Pressable key={p.id} onPress={() => { setChallenge(p.challenge); showPostCreator(); }} style={styles.resultItem}>
                                                    <Text style={[styles.resultText, darkMode && styles.textDark]} numberOfLines={1}>{p.challenge}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        </KeyboardAvoidingView>
                    )}
                </SafeAreaView>
            </Animated.View>

            {/* Mini Header — compact: pfp+name LEFT, search+notifs RIGHT */}
            <Animated.View style={[styles.miniHeader, { opacity: miniHeaderVisible, transform: [{ translateY: miniHeaderVisible.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }] }]}>
                <BlurView intensity={90} tint={darkMode ? "dark" : "extraLight"} style={[styles.miniBlurWrapper, { paddingTop: insets.top }, darkMode && { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
                    <View style={styles.miniHeaderContent}>
                        {/* Left: avatar + username */}
                        <Pressable onPress={() => setIsProfileVisible(true)} style={styles.miniLeft} hitSlop={8}>
                            <View style={styles.miniPfpWrapper}>
                                <Image source={{ uri: userProfile.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri }} style={styles.miniPfp} />
                            </View>
                            <Text style={[styles.miniUsername, darkMode && styles.textDark]} numberOfLines={1}>@{userProfile.username}</Text>
                        </Pressable>
                        {/* Right: search + notifications */}
                        <View style={styles.miniRight}>
                            <Pressable onPress={() => toggleSearch(true)} hitSlop={10} style={styles.miniIconBtn}>
                                <SearchIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} />
                            </Pressable>
                            <Pressable onPress={() => showOverlay('notifications')} hitSlop={10} style={styles.miniIconBtn}>
                                <NotificationIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} />
                            </Pressable>
                        </View>
                    </View>
                </BlurView>
            </Animated.View>

            <View style={styles.content}>
                <Animated.View style={{ flex: 1, opacity: feedFadeAnim }} renderToHardwareTextureAndroid={true}>
                    <FeedScreen
                        posts={posts}
                        currentUserId={userId || undefined}
                        currentUsername={userProfile.username}
                        currentAvatar={userProfile.photoURL || null}
                        ListHeaderComponent={renderHeader}
                        onScroll={onScroll}
                        contentContainerStyle={{ paddingTop: 60 + insets.top }}
                        onProfilePress={handleProfilePress}
                        onChallengeAction={(challenge, action) => {
                            // Route to existing media handling
                            if (action === 'send') {
                                setChallenge(challenge);
                                setIsSharing(true);
                            } else {
                                handleMediaAction(action, challenge);
                            }
                        }}
                    />
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <Pressable onPress={handleVersionTap} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
                    <Text style={styles.versionText}>SPINDARE V0.61.64 (PRE-ALPHA TESTING)</Text>
                </Pressable>
            </View>

            {isProfileVisible && (
                <View style={styles.fullOverlay}>
                    <ProfileScreen
                        userId={userId || ''}
                        onBack={() => setIsProfileVisible(false)}
                        onLogout={handleLogout}
                        spinsLeft={spinsLeft}
                        setSpinsLeft={updateSpins}
                        activeChallenge={challenge}
                        onChallengeReceived={setChallenge}
                        userProfile={userProfile}
                        onUpdateProfile={handleUpdateProfile}
                        onShare={() => setIsSharing(true)}
                        onOpenCamera={() => { setIsProfileVisible(false); handleMediaAction('camera', challenge || ''); }}
                        onSaveChallenge={(c) => {
                            setSavedChallenges(prev => [...prev, c]);
                            if (userId) {
                                SocialService.saveChallenge(userId, c)
                                    .catch(e => console.warn('Failed to persist saved challenge:', e));
                            }
                        }}
                    />
                </View>
            )}
            {isSharing && <View style={[styles.fullOverlay, { zIndex: 6000 }]}><FriendsListScreen challenge={challenge || ''} currentUserId={userId || ''} onClose={() => setIsSharing(false)} /></View>}

            <Animated.View style={[styles.fullOverlay, { transform: [{ translateY: postTransitionAnim }] }]}>
                {isPosting && <PostCreationScreen challenge={challenge || ''} imageUri={selectedImage} onClose={hidePostCreator} onPost={handlePostSubmit} isSubmitting={isSubmittingPost} />}
            </Animated.View>

            <GenericOverlay
                visible={overlayType !== null}
                type={overlayType || 'saved'}
                onClose={hideOverlay}
                data={overlayType === 'saved' ? savedChallenges : []}
                onAction={handleOverlayAction}
                animation={overlayAnim}
                userId={userId || undefined}
                onOpenMessages={() => {
                    hideOverlay();
                    setIsMessagesVisible(true);
                }}
                onViewProfile={(uid, username, avatar) => {
                    hideOverlay();
                    handleProfilePress(uid, username, avatar);
                }}
            />

            {/* Messages Screen */}
            {isMessagesVisible && (
                <View style={styles.fullOverlay}>
                    <MessagesScreen
                        userId={userId || ''}
                        onBack={() => setIsMessagesVisible(false)}
                        onOpenChat={(conversationId, otherUsername, otherAvatar) => {
                            setActiveChat({ conversationId, otherUsername, otherAvatar });
                            setIsMessagesVisible(false);
                        }}
                    />
                </View>
            )}

            {/* Chat Screen */}
            {activeChat && (
                <View style={styles.fullOverlay}>
                    <ChatScreen
                        conversationId={activeChat.conversationId}
                        currentUserId={userId || ''}
                        otherUsername={activeChat.otherUsername}
                        otherAvatar={activeChat.otherAvatar}
                        onBack={() => setActiveChat(null)}
                    />
                </View>
            )}

            {/* Hidden Dev Log Viewer — open by tapping version text 5 times */}
            {isLogViewerVisible && (
                <LogViewerScreen onClose={() => setIsLogViewerVisible(false)} />
            )}

            {viewingProfile && (
                <View style={styles.fullOverlay}>
                    <UserProfileView
                        userId={viewingProfile.userId}
                        username={viewingProfile.username}
                        avatar={viewingProfile.avatar}
                        currentUserId={userId || ''}
                        currentUsername={userProfile.username}
                        currentAvatar={userProfile.photoURL || null}
                        onBack={() => setViewingProfile(null)}
                        onStartChat={async () => {
                            if (!userId) return;
                            try {
                                const conversationId = await ChatService.getOrCreateConversation(
                                    userId,
                                    viewingProfile.userId
                                );
                                setViewingProfile(null);
                                setActiveChat({
                                    conversationId,
                                    otherUsername: viewingProfile.username,
                                    otherAvatar: viewingProfile.avatar,
                                });
                            } catch (err) {
                                console.error('Failed to start chat:', err);
                            }
                        }}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    containerDark: { backgroundColor: '#1C1C1E' },
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000, backgroundColor: '#FAF9F6' },
    headerContainerDark: { backgroundColor: '#1C1C1E', borderBottomColor: 'rgba(255,255,255,0.1)' },
    safeArea: { zIndex: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBarPfpContainer: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    topBarPfp: { width: '100%', height: '100%' },
    logo: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: 6, textAlign: 'center', position: 'absolute', left: 0, right: 0, zIndex: -1, paddingRight: Platform.OS === 'android' ? 6 : 0 },
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
    content: { flex: 1 },
    miniHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3000 },
    miniUsername: { color: '#3A3A3C', fontSize: 13, fontWeight: '600', letterSpacing: -0.3, flex: 1 },
    textDark: { color: '#FFF' },
    spinSection: { paddingTop: 20, paddingBottom: 24, alignItems: 'center' },
    footer: { paddingVertical: 24, alignItems: 'center' },
    versionText: { color: '#8E8E93', fontSize: 9, fontWeight: '400', letterSpacing: 2 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 4000 },
    miniBlurWrapper: {
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    miniHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        paddingHorizontal: 16,
    },
    miniLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
    },
    miniRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    miniIconBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 18,
    },
    miniPfpWrapper: {
        width: 30,
        height: 30,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    miniPfp: { width: '100%', height: '100%' },
    searchResultsContainer: { backgroundColor: '#FAF9F6', maxHeight: 400, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 16, paddingBottom: 20 },
    searchResultsContainerDark: { backgroundColor: '#1C1C1E', borderTopColor: 'rgba(255,255,255,0.1)' },
    resultSection: { marginTop: 16 },
    resultSectionTitle: { fontSize: 10, color: '#8E8E93', fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    resultAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: '#DDD' },
    resultText: { fontSize: 14, color: '#4A4A4A', fontWeight: '500' },
});
