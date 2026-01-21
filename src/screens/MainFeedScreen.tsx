import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Image, TextInput, Keyboard, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedScreen } from './FeedScreen';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { MediaSelectionScreen } from './MediaSelectionScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { ProfileScreen } from './ProfileScreen';
import { GenericOverlay } from '../components/organisms/GenericOverlay';
import { AppButton } from '../components/atoms/AppButton';
import { AIService, UserProfile, HobbyType, StudyFieldType } from '../services/AIService';
import { AuthService } from '../services/AuthService';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

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

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <Circle cx="8.5" cy="7" r="4" />
        <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const LockIcon = ({ color }: { color: string }) => (
    <Svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <Path d="M7 11V7a5 5 0 0110 0v4" />
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
    const [isMediaSelecting, setIsMediaSelecting] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [overlayType, setOverlayType] = useState<'saved' | 'notifications' | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Animations
    const searchExpandAnim = useRef(new Animated.Value(0)).current;
    const overlayAnim = useRef(new Animated.Value(height)).current;
    const badgeScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        AuthService.getSession().then(({ isAuthenticated: authed, userProfile: profile }) => {
            if (authed && profile) {
                setUserProfile(profile);
                setIsAuthenticated(true);
            }
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        if (savedChallenges.length > 0) {
            Animated.sequence([
                Animated.spring(badgeScale, { toValue: 1.2, useNativeDriver: true, bounciness: 20 }),
                Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true })
            ]).start();
        }
    }, [savedChallenges.length]);

    // Handlers
    const handleSpinEnd = useCallback(() => {
        const result = AIService.generateChallenge(userProfile);
        setChallenge(result);
        setSpinsLeft((prev) => Math.max(0, prev - 1));
    }, [userProfile]);

    const handleSaveLater = useCallback(() => {
        if (challenge) {
            setSavedChallenges(prev => [...prev, challenge]);
            setChallenge(null);
        }
    }, [challenge]);

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
        else setIsMediaSelecting(true);
    };

    const renderHeader = useMemo(() => (
        <View style={styles.spinSection}>
            <View style={styles.usernameContainer}>
                <Text style={styles.username}>@{userProfile.username}</Text>
            </View>

            <View style={styles.spinHeaderInfo}>
                <Text style={styles.spinTitle}>{spinsLeft > 0 ? "STREAK ACTIVE" : "LOCKOUT PHASE"}</Text>
                <Text style={styles.spinCount}>{spinsLeft > 0 ? `${spinsLeft} SPINS` : "LOCKED"}</Text>
            </View>

            <View style={styles.wheelWrapper}>
                <SpinWheel
                    options={["DARE", "QUEST", "TRUTH", "RISK"]}
                    onSpinEnd={handleSpinEnd}
                    canSpin={spinsLeft > 0}
                />
            </View>

            {challenge && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.revealWrapper}
                >
                    <View style={styles.revealPost}>
                        <View style={styles.postHeader}>
                            <Image source={{ uri: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80" }} style={styles.postAvatarSmall} />
                            <View style={styles.postHeaderText}>
                                <Text style={styles.postAuthor}>{userProfile.username}</Text>
                                <Text style={styles.postTime}>ACTIVE REVEAL</Text>
                            </View>
                        </View>
                        <Text style={styles.postContent}>{challenge}</Text>
                        <View style={styles.postActionsRow}>
                            <AppButton type="icon" onPress={() => setIsSharing(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <SendIcon color="rgba(255,255,255,0.4)" />
                            </AppButton>
                            <AppButton onPress={() => setIsMediaSelecting(true)} style={styles.snapBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <CameraIcon color="#000" />
                                <Text style={styles.snapText}>SNAP PIC</Text>
                            </AppButton>
                            <AppButton type="icon" onPress={handleSaveLater} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <SavedIcon color="rgba(255,255,255,0.4)" />
                            </AppButton>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            )}
        </View>
    ), [userProfile.username, spinsLeft, challenge, handleSpinEnd, handleSaveLater]);

    if (isLoading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#FFF' }}>LOADING...</Text></View>;

    if (!isAuthenticated) return (
        <OnboardingScreen
            onComplete={async (h, s) => {
                const newProfile = { ...userProfile, hobbies: h, studyFields: s };
                await AuthService.login(newProfile);
                setUserProfile(newProfile);
                setIsAuthenticated(true);
            }}
        />
    );

    return (
        <View style={styles.container}>
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
                        {!isSearching && <AppButton type="icon" onPress={() => setIsProfileVisible(true)} style={styles.navBtn}><UserIcon color="#FFF" /></AppButton>}
                        {!isSearching && <AppButton type="icon" onPress={() => showOverlay('notifications')} style={styles.navBtn}><NotificationIcon color="#FFF" /></AppButton>}
                    </View>
                </View>
            </SafeAreaView>

            <View style={styles.content}>
                {hasPostedToday || spinsLeft === 0 ? (
                    <FeedScreen ListHeaderComponent={renderHeader} />
                ) : (
                    <ScrollView contentContainerStyle={[styles.lockedContainer, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
                        {renderHeader}
                        <View style={styles.lockedSection}>
                            <Text style={styles.lockedSmallText}>POST TO UNLOCK COMMUNITY FEED AND REACTIONS</Text>
                        </View>
                    </ScrollView>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.versionText}>SPINDARE V0.37.1 (PRE-ALPHA TESTING)</Text>
            </View>

            <GenericOverlay
                visible={!!overlayType}
                type={overlayType || 'saved'}
                onClose={hideOverlay}
                data={savedChallenges}
                onAction={handleOverlayAction}
                animation={overlayAnim}
            />

            {isMediaSelecting && <View style={styles.fullOverlay}><MediaSelectionScreen challenge={challenge || ''} onClose={() => setIsMediaSelecting(false)} onSelect={(t, uri) => { setSelectedImage(uri || null); setIsMediaSelecting(false); setTimeout(() => setIsPosting(true), 400); }} /></View>}
            {isPosting && (
                <View style={styles.fullOverlay}>
                    <PostCreationScreen
                        challenge={challenge || ''}
                        imageUri={selectedImage}
                        onClose={() => setIsPosting(false)}
                        onPost={(c, img, target) => {
                            setIsPosting(false);
                            if (target === 'friend') {
                                setTimeout(() => setIsSharing(true), 400);
                            } else {
                                setChallenge(null);
                                setHasPostedToday(true);
                            }
                        }}
                    />
                </View>
            )}
            {isSharing && <View style={styles.fullOverlay}><FriendsListScreen challenge={challenge || ''} onClose={() => setIsSharing(true)} /></View>}
            {isProfileVisible && (
                <View style={styles.fullOverlay}>
                    <ProfileScreen
                        onBack={() => setIsProfileVisible(false)}
                        onLogout={handleLogout}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
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
    lockedContainer: { flexGrow: 1 },
    lockedSection: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    lockedSmallText: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
    },
    revealWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    spinSection: { paddingTop: 24, paddingBottom: 24, alignItems: 'center' },
    usernameContainer: { backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    username: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    spinHeaderInfo: { alignItems: 'center', marginBottom: 24 },
    spinTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '900', letterSpacing: 4, marginBottom: 4 },
    spinCount: { color: '#FFF', fontSize: 24, fontWeight: '900' },
    wheelWrapper: { marginBottom: 32 },
    revealPost: { width: width - 32, padding: 24, borderRadius: 32, backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    postAvatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    postHeaderText: { justifyContent: 'center' },
    postAuthor: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    postTime: { color: '#FF3B30', fontSize: 10, fontWeight: '900' },
    postContent: { color: '#FFF', fontSize: 16, lineHeight: 24, marginBottom: 24, fontWeight: '500' },
    postActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    snapBtn: { flex: 1, height: 56, borderRadius: 28 },
    snapText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    footer: { paddingVertical: 16, alignItems: 'center' },
    versionText: { color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000 },
});
