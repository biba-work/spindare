import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Image as NativeImage, TextInput, Keyboard, ScrollView, Platform, ImageBackground } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedScreen } from './FeedScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { ProfileScreen } from './ProfileScreen';
import { MessagesScreen } from './MessagesScreen';
import { ChatScreen } from './ChatScreen';
import { MainFeedHeader } from '../components/organisms/MainFeedHeader';
import { MiniHeader } from '../components/organisms/MiniHeader';
import { GenericOverlay } from '../components/organisms/GenericOverlay';
import { ChallengeShareOverlay } from '../components/organisms/ChallengeShareOverlay';
import { AppButton } from '../components/atoms/AppButton';
import { UserProfile, HobbyType, StudyFieldType } from '../services/AIService';
import { AuthService } from '../services/AuthService';
import { Post, PostService } from '../services/PostService';
import { auth } from '../services/firebaseConfig';
import Svg, { Path, Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { PostCreationScreen } from './PostCreationScreen';
import { UserProfileView } from './UserProfileView';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { SearchService } from '../services/SearchService';
import { NotificationService, Notification } from '../services/NotificationService';
import { LinearGradient } from 'expo-linear-gradient';
import { SpindareLogo } from '../components/atoms/SpindareLogo';

const { width, height } = Dimensions.get('window');




import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

export const MainFeedScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const { darkMode } = useTheme();

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
    const [keptChallenges, setKeptChallenges] = useState<{ id: string, challenge: string, postId: string }[]>([]);
    const [spindChallenges, setSpindChallenges] = useState<{ id: string, challenge: string, postId: string }[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isShareOverlayVisible, setIsShareOverlayVisible] = useState(false);
    const [shareChallengeText, setShareChallengeText] = useState('');
    const [sharePostId, setSharePostId] = useState('');

    // Content State
    const [overlayType, setOverlayType] = useState<'saved' | 'notifications' | 'spind' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<{ users: (UserProfile & { uid?: string })[], posts: Post[] }>({ users: [], posts: [] });
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Navigation replacements
    // Removed: isProfileVisible, isMessagesVisible, activeChatUser, viewingProfile, isPosting


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
        // Content Subscriptions
        const unsubscribeFeed = PostService.subscribeToFeed((updatedPosts) => {
            console.log('Feed updated, post count:', updatedPosts.length);
            setPosts(updatedPosts);
        });

        // Track user-specific unsubscribes
        let unsubscribeUserRelated: (() => void)[] = [];

        console.log('MainFeedScreen useEffect starting auth listener...');
        const unsubscribeAuth = AuthService.onSessionChange(async (user, profile) => {
            console.log('Auth state changed. User:', user?.uid, 'Profile exists:', !!profile);

            // Cleanup previous user subscriptions if any
            unsubscribeUserRelated.forEach(unsub => unsub());
            unsubscribeUserRelated = [];

            if (user && profile) {
                setUserProfile(profile);
                setIsAuthenticated(true);
                PostService.seedFakeData();

                // 1. Notifications
                const unsubNotifs = NotificationService.subscribeToNotifications((updatedNotifs) => {
                    setNotifications(updatedNotifs);
                });
                unsubscribeUserRelated.push(unsubNotifs);

                // 2. Kept Challenges
                const unsubKept = PostService.subscribeToKeptChallenges(user.uid, (challenges) => {
                    console.log('Kept challenges updated:', challenges.length);
                    setKeptChallenges(challenges);
                });
                unsubscribeUserRelated.push(unsubKept);

                // 3. Spind (Sent) Challenges
                const unsubSpind = PostService.subscribeToSpindChallenges(user.uid, (challenges) => {
                    console.log('Spind challenges updated:', challenges.length);
                    setSpindChallenges(challenges);
                });
                unsubscribeUserRelated.push(unsubSpind);

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
                console.log('No user or profile found');
                setIsAuthenticated(false);
            }
            setIsLoading(false);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeFeed();
            unsubscribeUserRelated.forEach(unsub => unsub());
        };
    }, []);

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

    const toggleSearch = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSearching(prev => !prev);
        if (!isSearching) {
            // Expand
            Animated.timing(searchExpandAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
        } else {
            // Collapse
            setSearchQuery('');
            Animated.timing(searchExpandAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
        }
    };

    const updateSpins = async (newCount: number) => {
        setSpinsLeft(newCount);
        try {
            const timestamp = userProfile.lastSpinTimestamp || Date.now();
            await AuthService.updateSpinnerState(newCount, timestamp);
            setUserProfile(prev => ({ ...prev, spinsLeft: newCount, lastSpinTimestamp: timestamp }));
        } catch (e) {
            console.error("Error saving spinner state", e);
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

    const showOverlay = (type: 'saved' | 'notifications' | 'spind') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setOverlayType(type);
        if (type === 'notifications') {
            NotificationService.markAllAsRead();
            // Optimistically clear local count
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
        Animated.spring(overlayAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();

        // If opening notifications, mark them as read immediately
        if (type === 'notifications') {
            NotificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
    };

    const hideOverlay = () => {
        Animated.timing(overlayAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setOverlayType(null));
    };

    const handleLogout = async () => {
        await AuthService.logout();
        setIsAuthenticated(false);
    };

    const showPostCreator = () => {
        navigation.navigate('PostCreation', {
            challenge: challenge || '',
            imageUri: null,
            onPost: handlePostSubmit
        });
    };

    const handleMediaAction = async (type: string, itemChallenge: string) => {
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
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled) { setSelectedImage(result.assets[0].uri); showPostCreator(); }
        } else {
            setSelectedImage(null); showPostCreator();
        }
    };

    const handlePostSubmit = async (content: string, imageUri?: string | null) => {
        navigation.goBack();
        try {
            await PostService.createPost(userProfile.username, userProfile.photoURL || '', challenge || 'Inbox Challenge', content, imageUri || null);
        } catch (err) { console.error(err); }
    };

    const handleOverlayAction = (itemChallenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => {
        if (action === 'send') { setChallenge(itemChallenge); hideOverlay(); navigation.navigate('FriendsList', { challenge: itemChallenge }); }
        else { hideOverlay(); handleMediaAction(action, itemChallenge); }
    };

    const handleUserProfilePress = (userId: string, username: string, avatar: string) => {
        if (userId === auth.currentUser?.uid) {
            handleMyProfilePress();
            return;
        }
        navigation.navigate('UserProfile', {
            userId,
            username,
            avatar,
            onStartChat: () => navigation.navigate('Chat', {
                currentUser: { _id: auth.currentUser?.uid, name: userProfile.username, avatar: userProfile.photoURL },
                otherUser: { _id: userId, name: username, avatar: avatar }
            })
        });
    };

    const handleMyProfilePress = () => {
        navigation.navigate('Profile', {
            userProfile,
            spinsLeft,
            activeChallenge: challenge,
            onUpdateProfile: handleUpdateProfile,
            setSpinsLeft: updateSpins,
            onChallengeReceived: setChallenge,
            onShare: (text: string) => navigation.navigate('FriendsList', { challenge: text || challenge || '' }),
            onOpenCamera: () => handleMediaAction('camera', challenge || ''),
            onLogout: handleLogout
        });
    };

    const onScroll = (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;
        if (diff > 10) {
            Animated.parallel([
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 })
            ]).start();
            isMiniHeaderHapticTriggered.current = false;
        } else if (diff < -5) {
            if (currentY < 500) {
                Animated.spring(headerVisible, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                isMiniHeaderHapticTriggered.current = false;
            } else if (diff < -10) {
                Animated.spring(headerVisible, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
                Animated.spring(miniHeaderVisible, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }).start();
                if (!isMiniHeaderHapticTriggered.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); isMiniHeaderHapticTriggered.current = true; }
            }
        }
        lastScrollY.current = currentY;
    };

    const renderHeader = useMemo(() => (<View style={styles.spinSection} />), []);

    if (isLoading) return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#1C1C1E' : '#FFFFFF' }]}>
            <SpindareLogo size={100} darkMode={darkMode} />
        </View>
    );

    if (!isAuthenticated) return (
        <OnboardingScreen onComplete={async (email, pass, username, h, s, isSignup) => {
            if (isSignup) { const profile = await AuthService.signUp(email, pass, { email, username, hobbies: h, studyFields: s }); setUserProfile(profile); }
            else { const profile = await AuthService.login(email, pass); setUserProfile(profile); }
            setIsAuthenticated(true);
        }} />
    );

    return (
        <View style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/guest_1.jpg')}
                style={StyleSheet.absoluteFill}
                blurRadius={Platform.OS === 'ios' ? 40 : 10}
            >
                <LinearGradient
                    colors={darkMode ? ['rgba(28,28,30,0.85)', 'rgba(28,28,30,0.95)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.9)']}
                    style={StyleSheet.absoluteFill}
                />
                <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
                    <StatusBar style={darkMode ? "light" : "dark"} />
                    <MainFeedHeader
                        userProfile={userProfile}
                        isSearching={isSearching}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        toggleSearch={toggleSearch}
                        searchExpandAnim={searchExpandAnim}
                        headerVisible={headerVisible}
                        notifications={notifications}
                        keptChallenges={keptChallenges}
                        spindChallenges={spindChallenges}
                        onProfilePress={handleUserProfilePress}
                        onShowOverlay={showOverlay}
                        onMyProfilePress={handleMyProfilePress}
                    />

                    {isSearching && searchQuery.length >= 2 && (searchResults.users.length > 0 || searchResults.posts.length > 0) && (
                        <View style={[styles.searchResultsContainer, darkMode && styles.searchResultsContainerDark]}>
                            <ScrollView keyboardShouldPersistTaps="handled">
                                {searchResults.users.length > 0 && (
                                    <View style={styles.resultSection}>
                                        <Text style={[styles.resultSectionTitle, darkMode && styles.textDark]}>USERS</Text>
                                        {searchResults.users.map(u => (
                                            <Pressable key={u.username} onPress={() => handleUserProfilePress(u.uid || '', u.username, u.photoURL || '')} style={styles.resultItem}>
                                                <Image source={{ uri: u.photoURL || NativeImage.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri }} style={styles.resultAvatar} contentFit="cover" />
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
                    )}

                    <MiniHeader
                        userProfile={userProfile}
                        miniHeaderVisible={miniHeaderVisible}
                        onProfilePress={handleUserProfilePress}
                        onMyProfilePress={handleMyProfilePress}
                        notifications={notifications}
                        onShowOverlay={showOverlay}
                    />

                    <View style={styles.content}>
                        <FeedScreen
                            posts={posts}
                            currentUserId={auth.currentUser?.uid}
                            ListHeaderComponent={renderHeader}
                            onScroll={onScroll}
                            contentContainerStyle={{ paddingTop: 60 + insets.top }}
                            onProfilePress={handleUserProfilePress}
                            onChallengeAction={async (challenge, action, postId) => {
                                if (action === 'send') {
                                    setShareChallengeText(challenge);
                                    setSharePostId(postId || '');
                                    setIsShareOverlayVisible(true);
                                } else {
                                    handleMediaAction(action, challenge);
                                }
                            }}
                            isLoading={isLoading}
                            keptChallenges={keptChallenges}
                            onToggleKeep={async (challengeText, postId) => {
                                if (auth.currentUser) {
                                    await PostService.toggleKeptChallenge(auth.currentUser.uid, postId, challengeText);
                                }
                            }}
                        />
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.versionText}>SPINDARE V0.61.64 (PRE-ALPHA TESTING)</Text>
                    </View>

                    <GenericOverlay
                        visible={overlayType !== null}
                        type={overlayType || 'saved'}
                        onClose={hideOverlay}
                        data={overlayType === 'saved' ? keptChallenges.map(s => s.challenge)
                            : overlayType === 'spind' ? spindChallenges.map(s => s.challenge)
                                : notifications}
                        onAction={handleOverlayAction}
                        animation={overlayAnim}
                        onOpenMessages={() => {
                            hideOverlay();
                            navigation.navigate('Messages', {
                                onOpenChat: (user: any) => navigation.navigate('Chat', { currentUser: { _id: auth.currentUser?.uid, name: userProfile.username, avatar: userProfile.photoURL }, otherUser: user })
                            });
                        }}
                        onViewProfile={handleUserProfilePress}
                    />

                    <ChallengeShareOverlay
                        visible={isShareOverlayVisible}
                        onClose={() => setIsShareOverlayVisible(false)}
                        challenge={shareChallengeText}
                        postId={sharePostId}
                    />
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerDark: {},
    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000, overflow: 'hidden' },
    headerContainerDark: { borderBottomColor: 'rgba(255,255,255,0.1)' },
    safeArea: { zIndex: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    leftActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBarPfpContainer: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    topBarPfp: { width: '100%', height: '100%' },
    logo: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: 6, textAlign: 'center', position: 'absolute', left: 0, right: 0, zIndex: -1 },
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
    // Removed solid background from miniHeader
    miniHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3000, overflow: 'hidden' },
    miniUsername: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: -0.2 },
    textDark: { color: '#FFF' },
    spinSection: { paddingTop: 20, paddingBottom: 24, alignItems: 'center' },
    footer: { paddingVertical: 24, alignItems: 'center' },
    versionText: { color: '#8E8E93', fontSize: 9, fontWeight: '400', letterSpacing: 2 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 4000 },
    miniBlurWrapper: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(167, 187, 199, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    miniHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 8, gap: 10 },
    miniPfpWrapper: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)' },
    miniPfp: { width: '100%', height: '100%' },
    searchResultsContainer: { backgroundColor: 'rgba(255,255,255,0.95)', maxHeight: 400, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 16, paddingBottom: 20 },
    searchResultsContainerDark: { backgroundColor: 'rgba(28,28,30,0.95)', borderTopColor: 'rgba(255,255,255,0.1)' },
    resultSection: { marginTop: 16 },
    resultSectionTitle: { fontSize: 10, color: '#8E8E93', fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    resultAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: '#DDD' },
    resultText: { fontSize: 14, color: '#4A4A4A', fontWeight: '500' },
});
