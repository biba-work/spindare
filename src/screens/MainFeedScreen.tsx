import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Dimensions, Animated, Pressable,
    Image, TextInput, Keyboard, ScrollView, Platform, KeyboardAvoidingView
} from 'react-native';
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
import { SoundService } from '../services/SoundService';
import * as ImagePicker from 'expo-image-picker';
import { PostCreationScreen } from './PostCreationScreen';
import { UserProfileView } from './UserProfileView';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { SearchService } from '../services/SearchService';
import { NotificationService } from '../services/NotificationService';
import { useAuth, useUser, useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../services/supabaseConfig';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG icons
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Path d="M21 21l-4.3-4.3" />
    </Svg>
);

const BellIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
);

const BookmarkIcon = ({ color, size = 20 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const MainFeedScreen = () => {
    const insets = useSafeAreaInsets();
    const { darkMode } = useTheme();

    const { isLoaded, userId, isSignedIn } = useAuth();
    const { user } = useUser();
    const { signOut } = useClerk();

    // ── State ────────────────────────────────────────────────────────────────
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
    const [searchResults, setSearchResults] = useState<{ users: (UserProfile & { uid?: string })[], posts: Post[] }>({ users: [], posts: [] });
    const [isMessagesVisible, setIsMessagesVisible] = useState(false);
    const [activeChat, setActiveChat] = useState<{ conversationId: string; otherUsername: string; otherAvatar: string } | null>(null);
    const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
    const [spinsLeft, setSpinsLeft] = useState(2);

    const { showToast } = useToast();

    const handleVersionTap = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Spindare v1.1.0', { type: 'info' });
    };

    // ── Animations ───────────────────────────────────────────────────────────
    const overlayAnim = useRef(new Animated.Value(height)).current;
    const postTransitionAnim = useRef(new Animated.Value(height)).current;
    const feedFadeAnim = useRef(new Animated.Value(0)).current;
    const badgeScale = useRef(new Animated.Value(0)).current;
    const badgePulse = useRef(new Animated.Value(1)).current;
    const searchExpandAnim = useRef(new Animated.Value(0)).current;

    // Header hide/show on scroll
    const headerTranslate = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);
    const headerHidden = useRef(false);

    // ── Data loading ─────────────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = PostService.subscribeToFeed((updater) => setPosts(updater));
        if (__DEV__) PostService.seedFakeData();
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!userId) return;
        SocialService.getSavedChallenges(userId)
            .then(challenges => { if (challenges.length > 0) setSavedChallenges(challenges); })
            .catch(e => console.warn('Failed to load saved challenges:', e));
    }, [userId]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (isLoaded && isSignedIn && userId) {
                try {
                    let profile = await AuthService.getProfile(userId);
                    if (!profile && user) {
                        profile = await AuthService.createProfile(userId, {
                            email: user.primaryEmailAddress?.emailAddress || "",
                            username: user.username || user.firstName || "User",
                            hobbies: [],
                            studyFields: []
                        });
                    }
                    if (profile) setUserProfile(profile);
                    NotificationService.registerPushToken(userId).catch(e => console.warn("Push token registration failed:", e));
                } catch (err) {
                    console.error("Error loading user profile:", err);
                } finally {
                    setIsLoading(false);
                }
            } else if (isLoaded && !isSignedIn) {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [isLoaded, isSignedIn, userId, user]);

    // Badge animation
    useEffect(() => {
        if (savedChallenges.length > 0) {
            Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start(() => {
                Animated.loop(Animated.sequence([
                    Animated.timing(badgePulse, { toValue: 1.2, duration: 900, useNativeDriver: true }),
                    Animated.timing(badgePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
                ])).start();
            });
        } else {
            badgePulse.setValue(1);
            Animated.spring(badgeScale, { toValue: 0, useNativeDriver: true, friction: 5, tension: 80 }).start();
        }
    }, [savedChallenges.length]);

    // Feed fade in
    useEffect(() => {
        Animated.spring(feedFadeAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 30 }).start();
    }, []);

    // Profile listener
    useEffect(() => {
        if (!userId) return;
        const unsubscribe = AuthService.onProfileChange(userId, (profile) => { if (profile) setUserProfile(profile); });
        return unsubscribe;
    }, [userId]);

    // Search debounce
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

    // ── Scroll handler ───────────────────────────────────────────────────────
    const onScroll = useCallback((event: any) => {
        if (isSearching) return;
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        // Hide header when scrolling down past 80px
        if (diff > 8 && currentY > 80 && !headerHidden.current) {
            headerHidden.current = true;
            Animated.spring(headerTranslate, { toValue: -80, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
        // Show header when scrolling back up
        else if (diff < -6 && headerHidden.current) {
            headerHidden.current = false;
            Animated.spring(headerTranslate, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }

        lastScrollY.current = currentY;
    }, [isSearching]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const updateSpins = async (newCount: number) => {
        if (!userId) return;
        setSpinsLeft(newCount);
        try {
            const timestamp = userProfile.lastSpinTimestamp || Date.now();
            await AuthService.updateSpinnerState(userId, newCount, timestamp);
            setUserProfile(prev => ({ ...prev, spinsLeft: newCount, lastSpinTimestamp: timestamp }));
        } catch (e) { console.error("Error saving spinner state", e); }
    };

    const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        if (!userId) return;
        setUserProfile(prev => {
            const newProfile = { ...prev, ...updates };
            if (updates.photoURL) AuthService.updateProfilePicture(userId, updates.photoURL);
            return newProfile;
        });
    };

    const showOverlay = (type: 'saved' | 'notifications') => {
        if (type === 'notifications') setHasUnreadNotifs(false);
        setOverlayType(type);
        Animated.spring(overlayAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    };

    const hideOverlay = () => {
        Animated.timing(overlayAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setOverlayType(null));
    };

    const handleLogout = async () => {
        try { await signOut(); setIsProfileVisible(false); }
        catch (err) { console.error("Logout error:", err); }
    };

    const toggleSearch = (show: boolean) => {
        if (show) {
            setIsSearching(true);
            Animated.spring(searchExpandAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 10 }).start();
        } else {
            Keyboard.dismiss();
            Animated.timing(searchExpandAnim, { toValue: 0, duration: 250, useNativeDriver: false })
                .start(() => { setIsSearching(false); setSearchQuery(''); });
        }
    };

    const showPostCreator = () => {
        setIsPosting(true);
        Animated.spring(postTransitionAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    };

    const hidePostCreator = () => {
        Animated.timing(postTransitionAnim, { toValue: height, duration: 400, useNativeDriver: true })
            .start(() => setIsPosting(false));
    };

    const handleMediaAction = async (type: 'camera' | 'gallery' | 'text', itemChallenge: string) => {
        SoundService.tap();
        setChallenge(itemChallenge);
        if (type === 'camera') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images', 'videos'],
                allowsEditing: true,
                quality: 0.85
            });
            if (!result.canceled) { setSelectedImage(result.assets[0].uri); showPostCreator(); }
        } else if (type === 'gallery') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.85,
                videoMaxDuration: 60
            });
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
            await PostService.createPost(
                userId, userProfile.username, userProfile.photoURL || '',
                challenge || 'Inbox Challenge', content, imageUri || null
            );
        } catch (err) {
            console.error(err);
            throw err;
        } finally {
            setIsSubmittingPost(false);
        }
    };

    const handleOverlayAction = (itemChallenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => {
        if (action === 'send') { setChallenge(itemChallenge); hideOverlay(); setIsSharing(true); }
        else { hideOverlay(); handleMediaAction(action, itemChallenge); }
    };

    const handleProfilePress = (uid: string, username: string, avatar: string) => {
        setViewingProfile({ userId: uid, username, avatar });
    };

    const headerHeight = 56 + insets.top;

    const renderHeader = useMemo(() => <View style={{ height: 8 }} />, []);

    // ── Loading splash ───────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[s.container, darkMode && s.containerDark, { justifyContent: 'center', alignItems: 'center' }]}>
                <Image source={require('../../assets/logo.png')} style={{ width: 72, height: 72, opacity: 0.7 }} resizeMode="contain" />
            </View>
        );
    }

    // ── Computed values for search bar animation ─────────────────────────────
    const searchBarWidth = searchExpandAnim.interpolate({ inputRange: [0, 1], outputRange: [44, width - 100] });

    return (
        <View style={[s.container, darkMode && s.containerDark]}>
            <StatusBar style={darkMode ? 'light' : 'dark'} />

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <Animated.View
                style={[
                    s.topBar,
                    darkMode && s.topBarDark,
                    { transform: [{ translateY: headerTranslate }], paddingTop: insets.top }
                ]}
            >
                <View style={s.topBarInner}>

                    {/* Left: avatar + saved */}
                    {!isSearching && (
                        <View style={s.topLeft}>
                            <Pressable
                                onPress={() => setIsProfileVisible(true)}
                                style={({ pressed }) => [s.pfpBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Image
                                    source={{ uri: userProfile.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri }}
                                    style={s.pfp}
                                />
                                <View style={s.onlineDot} />
                            </Pressable>
                            <Pressable
                                onPress={() => showOverlay('saved')}
                                style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
                                hitSlop={6}
                            >
                                <BookmarkIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={20} />
                                {savedChallenges.length > 0 && (
                                    <Animated.View style={[s.badge, { transform: [{ scale: Animated.multiply(badgeScale, badgePulse) }] }]}>
                                        <Text style={s.badgeText}>{savedChallenges.length > 9 ? '9+' : savedChallenges.length}</Text>
                                    </Animated.View>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/* Center: logo */}
                    {!isSearching && (
                        <Text style={[s.logo, darkMode && s.logoDark]}>SPINDARE</Text>
                    )}

                    {/* Right: search + saved + bell */}
                    <View style={[s.topRight, isSearching && { flex: 1 }]}>

                        {/* Search — expands to fill bar */}
                        <Animated.View style={[s.searchWrap, { width: searchBarWidth }]}>
                            {isSearching ? (
                                <View style={[s.searchBar, darkMode && s.searchBarDark]}>
                                    <Ionicons name="search-outline" size={16} color={darkMode ? '#8E8E93' : '#AEAEB2'} style={{ marginRight: 6 }} />
                                    <TextInput
                                        autoFocus
                                        placeholder="Search people, challenges…"
                                        placeholderTextColor={darkMode ? '#636366' : '#C5C5C7'}
                                        style={[s.searchInput, darkMode && s.searchInputDark]}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        returnKeyType="search"
                                    />
                                    <Pressable onPress={() => toggleSearch(false)} hitSlop={10}>
                                        <Text style={[s.cancelText, darkMode && { color: '#8E8E93' }]}>Cancel</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable
                                    onPress={() => toggleSearch(true)}
                                    style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
                                    hitSlop={6}
                                >
                                    <SearchIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={20} />
                                </Pressable>
                            )}
                        </Animated.View>

                        {/* Notifications */}
                        {!isSearching && (
                            <Pressable
                                onPress={() => showOverlay('notifications')}
                                style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.5 }]}
                                hitSlop={6}
                            >
                                <BellIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={20} />
                                {hasUnreadNotifs && <View style={s.notifDot} />}
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Search results dropdown */}
                {isSearching && searchQuery.length >= 2 &&
                    (searchResults.users.length > 0 || searchResults.posts.length > 0) && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={[s.searchResults, darkMode && s.searchResultsDark]}>
                            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                {searchResults.users.length > 0 && (
                                    <View style={s.resultSection}>
                                        <Text style={[s.resultSectionLabel, darkMode && { color: '#636366' }]}>PEOPLE</Text>
                                        {searchResults.users.map(u => (
                                            <Pressable
                                                key={u.username}
                                                onPress={() => { toggleSearch(false); handleProfilePress(u.uid || '', u.username, u.photoURL || ''); }}
                                                style={({ pressed }) => [s.resultRow, pressed && { opacity: 0.6 }]}
                                            >
                                                <Image source={{ uri: u.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri }} style={s.resultAvatar} />
                                                <Text style={[s.resultName, darkMode && { color: '#E5E5EA' }]}>@{u.username}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                                {searchResults.posts.length > 0 && (
                                    <View style={s.resultSection}>
                                        <Text style={[s.resultSectionLabel, darkMode && { color: '#636366' }]}>CHALLENGES</Text>
                                        {searchResults.posts.map(p => (
                                            <Pressable
                                                key={p.id}
                                                onPress={() => { toggleSearch(false); setChallenge(p.challenge); showPostCreator(); }}
                                                style={({ pressed }) => [s.resultRow, pressed && { opacity: 0.6 }]}
                                            >
                                                <View style={s.resultChallengeIcon}>
                                                    <Ionicons name="flash-outline" size={14} color={darkMode ? '#8E8E93' : '#AEAEB2'} />
                                                </View>
                                                <Text style={[s.resultName, darkMode && { color: '#E5E5EA' }]} numberOfLines={1}>{p.challenge}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </Animated.View>

            {/* ── Feed ─────────────────────────────────────────────────────── */}
            <Animated.View style={[s.feedWrap, { opacity: feedFadeAnim }]} renderToHardwareTextureAndroid>
                <FeedScreen
                    posts={posts}
                    currentUserId={userId || undefined}
                    currentUsername={userProfile.username}
                    currentAvatar={userProfile.photoURL || null}
                    ListHeaderComponent={renderHeader}
                    onScroll={onScroll}
                    contentContainerStyle={{ paddingTop: headerHeight + 8 }}
                    onProfilePress={handleProfilePress}
                    onChallengeAction={(chal, action) => {
                        if (action === 'send') { setChallenge(chal); setIsSharing(true); }
                        else handleMediaAction(action, chal);
                    }}
                    onSaveChallenge={(c) => {
                        setSavedChallenges(prev => prev.includes(c) ? prev : [...prev, c]);
                        if (userId) SocialService.saveChallenge(userId, c).catch(e => console.warn('Save failed:', e));
                    }}
                />
            </Animated.View>

            {/* ── Version footer ───────────────────────────────────────────── */}
            <View style={[s.footer, { paddingBottom: (insets.bottom || 0) + 12 }]}>
                <Pressable onPress={handleVersionTap} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
                    <Text style={s.versionText}>SPINDARE V1.1.0 (PRE-ALPHA)</Text>
                </Pressable>
            </View>

            {/* ── Overlays ─────────────────────────────────────────────────── */}

            {isProfileVisible && (
                <View style={s.fullOverlay}>
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
                            if (userId) SocialService.saveChallenge(userId, c).catch(e => console.warn('Failed to persist saved challenge:', e));
                        }}
                    />
                </View>
            )}

            {isSharing && (
                <View style={[s.fullOverlay, { zIndex: 6000 }]}>
                    <FriendsListScreen challenge={challenge || ''} currentUserId={userId || ''} onClose={() => setIsSharing(false)} />
                </View>
            )}

            <Animated.View style={[s.fullOverlay, { transform: [{ translateY: postTransitionAnim }] }]}>
                {isPosting && (
                    <PostCreationScreen
                        challenge={challenge || ''}
                        imageUri={selectedImage}
                        onClose={hidePostCreator}
                        onPost={handlePostSubmit}
                        isSubmitting={isSubmittingPost}
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
                userId={userId || undefined}
                onOpenMessages={() => { hideOverlay(); setIsMessagesVisible(true); }}
                onViewProfile={(uid, username, avatar) => { hideOverlay(); handleProfilePress(uid, username, avatar); }}
            />

            {isMessagesVisible && (
                <View style={s.fullOverlay}>
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

            {activeChat && (
                <View style={s.fullOverlay}>
                    <ChatScreen
                        conversationId={activeChat.conversationId}
                        currentUserId={userId || ''}
                        otherUsername={activeChat.otherUsername}
                        otherAvatar={activeChat.otherAvatar}
                        onBack={() => setActiveChat(null)}
                    />
                </View>
            )}

            {viewingProfile && (
                <View style={s.fullOverlay}>
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
                                const conversationId = await ChatService.getOrCreateConversation(userId, viewingProfile.userId);
                                setViewingProfile(null);
                                setActiveChat({ conversationId, otherUsername: viewingProfile.username, otherAvatar: viewingProfile.avatar });
                            } catch (err) { console.error('Failed to start chat:', err); }
                        }}
                    />
                </View>
            )}
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F3' },
    containerDark: { backgroundColor: '#0A0A0A' },

    // ── Top bar ───────────────────────────────────────────────────────────
    topBar: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 2000,
        backgroundColor: '#F5F5F3',
    },
    topBarDark: {
        backgroundColor: '#0A0A0A',
    },
    topBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,           // taller — more thumb room
        paddingHorizontal: 12,
    },

    // Left section
    topLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,               // clear space between avatar and bookmark
        marginRight: 8,
    },
    pfpBtn: {
        position: 'relative',
        padding: 4,           // extra tap area around the avatar
    },
    pfp: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E0E0E0',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 4,       // offset matches the padding on pfpBtn
        right: 4,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#30D158',
        borderWidth: 1.5,
        borderColor: '#F5F5F3',
    },

    // Logo
    logo: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#1A1A1A',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 5,
        zIndex: -1,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    logoDark: { color: '#F0F0F0' },

    // Right section
    topRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,              // icons slightly apart so thumbs don't mis-tap
        marginLeft: 'auto' as any,
    },
    iconBtn: {
        width: 44,           // Apple HIG minimum tap target
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 15,
        height: 15,
        borderRadius: 7.5,
        backgroundColor: '#A7BBC7',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 8,
        fontWeight: '700',
    },
    notifDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#FF3B30',
    },

    // ── Search bar ────────────────────────────────────────────────────────
    searchWrap: {
        height: 36,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBEBEB',
        borderRadius: 18,
        paddingHorizontal: 12,
        height: 36,
    },
    searchBarDark: {
        backgroundColor: '#2C2C2E',
    },
    searchInput: {
        flex: 1,
        color: '#1A1A1A',
        fontSize: 14,
        paddingVertical: 0,
    },
    searchInputDark: { color: '#F0F0F0' },
    cancelText: {
        color: '#3A3A3C',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 8,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },

    // ── Search results dropdown ────────────────────────────────────────────
    searchResults: {
        backgroundColor: '#F5F5F3',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.04)',
        maxHeight: 380,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    searchResultsDark: {
        backgroundColor: '#0A0A0A',
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    resultSection: { marginTop: 14 },
    resultSectionLabel: {
        fontSize: 10,
        color: '#AEAEB2',
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
    },
    resultAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
        backgroundColor: '#DDD',
    },
    resultChallengeIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    resultName: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '500',
        flex: 1,
    },

    // ── Feed ──────────────────────────────────────────────────────────────
    feedWrap: { flex: 1 },

    // ── Footer ────────────────────────────────────────────────────────────
    footer: {
        alignItems: 'center',
        paddingTop: 8,
    },
    versionText: {
        color: '#C7C7CC',
        fontSize: 9,
        fontWeight: '400',
        letterSpacing: 2,
    },

    // ── Shared overlay ────────────────────────────────────────────────────
    fullOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4000,
    },
});
