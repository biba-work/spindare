import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Pressable, Animated, Switch, Platform, TextInput, ImageBackground, PanResponder, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserProfile, AIService } from '../services/AIService';
import { PostService } from '../services/PostService';
import { AuthService } from '../services/AuthService';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Post } from '../services/PostService';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';

const { width, height } = Dimensions.get('window');

// Icons
const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const SettingsIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="3" />
        <Path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
    </Svg>
);

const GridIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="7" height="7" />
        <Rect x="14" y="3" width="7" height="7" />
        <Rect x="14" y="14" width="7" height="7" />
        <Rect x="3" y="14" width="7" height="7" />
    </Svg>
);

const ListIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
);

const SpinnerIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </Svg>
);

// SPIND-style action icons
const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const ChevronRightIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 18l6-6-6-6" />
    </Svg>
);

interface ProfileScreenProps {
    userId: string;
    onBack: () => void;
    onLogout: () => void;
    spinsLeft: number;
    setSpinsLeft: (count: number) => void;
    activeChallenge: string | null;
    onChallengeReceived: (challenge: string) => void;
    userProfile: UserProfile;
    onUpdateProfile: (updates: Partial<UserProfile>) => void;
    onShare?: () => void;
    onOpenCamera?: () => void;
    onSaveChallenge?: (challenge: string) => void;
}

import { useTheme } from '../contexts/ThemeContext';

export const ProfileScreen = ({
    userId,
    onBack,
    onLogout,
    spinsLeft,
    setSpinsLeft,
    activeChallenge,
    onChallengeReceived,
    userProfile,
    onUpdateProfile,
    onShare,
    onOpenCamera,
    onSaveChallenge,
}: ProfileScreenProps) => {
    const [mode, setMode] = useState<'list' | 'grid'>('grid');
    const [showSettings, setShowSettings] = useState(false);

    // Global Theme
    const { darkMode, toggleTheme } = useTheme();
    const { showToast } = useToast();

    const [soundEffects, setSoundEffects] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [privateAccount, setPrivateAccount] = useState(false);
    const [activityStatus, setActivityStatus] = useState(true);
    const [settingsPage, setSettingsPage] = useState<'main' | 'privacy' | 'help'>('main'); // kept for compat but no longer used
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const streak = userProfile.streak ?? 0;

    const [showSpinner, setShowSpinner] = useState(false);
    const [spinResult, setSpinResult] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const settingsAnim = useRef(new Animated.Value(height)).current;
    const spinnerAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const settingsPan = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => { if (gs.dy > 0) settingsAnim.setValue(gs.dy); },
        onPanResponderRelease: (_, gs) => {
            if (gs.dy > 100 || gs.vy > 0.7) {
                Animated.timing(settingsAnim, { toValue: height, duration: 300, useNativeDriver: true })
                    .start(() => setShowSettings(false));
            } else {
                Animated.spring(settingsAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
            }
        },
    })).current;

    const SPIN_REWARDS = [
        'Read 10 pages of a book 📚',
        'Take a photo of something red 📸',
        'Write a poem about rain ✍️',
        'Do 10 pushups immediately 💪',
        'Cook a healthy meal 🍳',
        'Draw a self-portrait 🎨',
        'Meditate for 5 minutes 🧘',
        'Compliment a stranger 🤝',
    ];

    const [submissionStep, setSubmissionStep] = useState<'idle' | 'result' | 'choose' | 'preview_media' | 'input_text'>('idle');
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [mediaFromCamera, setMediaFromCamera] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [mediaAspectRatio, setMediaAspectRatio] = useState(1);
    const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

    const [editUsername, setEditUsername] = useState(userProfile.username);

    useEffect(() => {
        setEditUsername(userProfile.username);
    }, [userProfile.username]);

    const handleSaveUsername = async () => {
        const newUsername = editUsername.trim();
        if (newUsername.length < 1) return;

        try {
            // Update in Supabase (profile + all posts)
            await AuthService.updateUsername(userId, newUsername);

            // Update locally in parent component
            onUpdateProfile({ username: newUsername });

            if (soundEffects) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Username updated! It may take a moment for changes to appear everywhere.", { type: 'success' });
        } catch (error: any) {
            console.error("Username update failed:", error);
            showToast(`Could not update username: ${error.message || 'Unknown error'}`, { type: 'error' });
            setEditUsername(userProfile.username); // Revert on error
        }
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        if (userId) {
            const unsub = PostService.subscribeToUserPosts(userId, (posts) => {
                setUserPosts(posts);
            });
            return () => unsub();
        }
    }, [userId]);

    const openSpinner = () => {
        if (soundEffects) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowSpinner(true);
        setSpinResult(null);
        setSubmissionStep('idle');
        setMediaUri(null);
        setTextContent('');
        Animated.spring(spinnerAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const closeSpinner = () => {
        Animated.timing(spinnerAnim, {
            toValue: height,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setShowSpinner(false);
            setSpinResult(null);
            setSubmissionStep('idle');
        });
    };

    const handleSpinEnd = (result: string) => {
        if (soundEffects) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // No limit check
        // if (spinsLeft > 0) setSpinsLeft(spinsLeft - 1);

        setSpinResult(result);
        setSubmissionStep('result');
        onChallengeReceived(result);

        // Haptic success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleRetryWithAI = async () => {
        if (isRetrying) return;
        setIsRetrying(true);
        try {
            const newChallenge = await AIService.generateChallenge(userProfile);
            setSpinResult(newChallenge);
            onChallengeReceived(newChallenge);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            showToast('Could not generate a new challenge. Try again.', { type: 'error' });
        } finally {
            setIsRetrying(false);
        }
    };

    const handleActionChoose = () => {
        setSubmissionStep('choose');
        // Layout animation for smoothness
        // LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const handleCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            showToast('Camera access is required.', { type: 'error' });
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], // Photo only as requested
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaFromCamera(true);
            setMediaAspectRatio(result.assets[0].width / result.assets[0].height);
            setSubmissionStep('preview_media');
        }
    };

    const handleGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showToast('Gallery access is required.', { type: 'error' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaFromCamera(false);
            setMediaAspectRatio(result.assets[0].width / result.assets[0].height);
            setSubmissionStep('preview_media');
        }
    };

    const handleTextAction = () => {
        setSubmissionStep('input_text');
    };

    const submitChallenge = async () => {
        if (!spinResult || isSubmittingChallenge) return;

        setIsSubmittingChallenge(true);
        try {
            // Submit to Supabase
            await PostService.createPost(
                userId,
                userProfile.username,
                userProfile.photoURL || '',
                spinResult,
                textContent || 'Challenge completed! 🎯',
                mediaUri,
                undefined,
                mediaFromCamera
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Your challenge has been shared with the community!", { type: 'success' });
            closeSpinner();
        } catch (error: any) {
            console.error("Post submission error:", error);
            showToast("Could not post your challenge. Please try again.", { type: 'error' });
        } finally {
            setIsSubmittingChallenge(false);
        }
    };

    const openSettings = () => {
        setShowSettings(true);
        setSettingsPage('main');
        Animated.spring(settingsAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const closeSettings = () => {
        Animated.timing(settingsAnim, {
            toValue: height,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setShowSettings(false));
    };

    const openSupportEmail = async (subject: string) => {
        const url = `mailto:support@spindare.app?subject=${encodeURIComponent(subject)}`;
        try {
            await Linking.openURL(url);
        } catch (error) {
            showToast('Unable to open email. Please make sure your device can send email.', { type: 'error' });
        }
    };

    const handleSettingsOption = (option: string) => {
        switch (option) {
            case 'email':
                return openSupportEmail('Update email address');
            case 'security':
                return openSupportEmail('Security support');
            case 'linkedAccounts':
                return openSupportEmail('Linked accounts');
            case 'language':
                return showToast('Language support will be available soon.', { type: 'info' });
            case 'accessibility':
                return showToast('Accessibility options will arrive in a future release.', { type: 'info' });
            case 'messages':
                return showToast('Control message preferences from your notification settings.', { type: 'info' });
            case 'blockedAccounts':
                return showToast('No blocked users yet.', { type: 'info' });
            case 'downloadData':
                return openSupportEmail('Data export request');
            case 'helpCenter':
                return openSupportEmail('Help Center');
            case 'contactUs':
                return openSupportEmail('Contact Us');
            case 'reportProblem':
                return openSupportEmail('Report a Problem');
            case 'about':
                return showToast('Spindare is an anti-scroll social experiment built to help you try physical world challenges.', { type: 'info' });
            case 'terms':
                return Linking.openURL('https://spindare.app/terms').catch(() => showToast('Unable to open link. Please try again later.', { type: 'error' }));
            case 'privacy':
                return Linking.openURL('https://spindare.app/privacy').catch(() => showToast('Unable to open link. Please try again later.', { type: 'error' }));
            case 'guidelines':
                return Linking.openURL('https://spindare.app/guidelines').catch(() => showToast('Unable to open link. Please try again later.', { type: 'error' }));
            default:
                return showToast('This action is not available yet.', { type: 'info' });
        }
    };

    const handleUpdatePfp = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showToast('Gallery access is required.', { type: 'error' });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) {
            try {
                const storageUrl = await PostService.uploadImage(result.assets[0].uri);
                onUpdateProfile({ photoURL: storageUrl });
                if (soundEffects) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
                console.error("Error uploading PFP:", err);
                showToast("Could not upload profile picture.", { type: 'error' });
            }
        }
    };

    const totalReactions = userPosts.reduce((sum, post) =>
        sum + post.reactions.felt + post.reactions.thought + post.reactions.intrigued, 0
    );

    return (
        <View style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/guest_1.jpg')}
                style={[styles.container, darkMode && styles.containerDark]}
                blurRadius={40}
            >
                <LinearGradient
                    colors={darkMode ? ['rgba(28,28,30,0.8)', 'rgba(28,28,30,0.95)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.95)']}
                    style={StyleSheet.absoluteFill}
                />
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    {/* Header */}
                    <View style={[styles.header, darkMode && styles.headerDark]}>
                        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <BackIcon color={darkMode ? "#FAF9F6" : "#4A4A4A"} />
                        </Pressable>
                        <Text style={[styles.headerTitle, darkMode && styles.textDark]}>Profile</Text>
                        <Pressable onPress={openSettings} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <SettingsIcon color={darkMode ? "#FAF9F6" : "#4A4A4A"} />
                        </Pressable>
                    </View>

                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ opacity: fadeAnim }}
                    >
                        {/* Profile Section */}
                        <View style={[styles.profileSection, darkMode && styles.sectionDark]}>
                            <Pressable onPress={handleUpdatePfp} style={styles.pfpContainer}>
                                <Image
                                    source={{
                                        uri: userProfile.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri
                                    }}
                                    style={styles.pfp}
                                />
                                <View style={styles.editBadge}>
                                    <Text style={styles.editBadgeText}>✎</Text>
                                </View>
                            </Pressable>

                            <Text style={[styles.username, darkMode && styles.textDark]}>@{userProfile.username}</Text>
                            <Text style={[styles.bio, darkMode && styles.bioDark]}>Creative Explorer</Text>

                            <Pressable onPress={openSpinner} style={styles.spinBtn}>
                                <SpinnerIcon color="#FAF9F6" />
                                <Text style={styles.spinBtnText}>SPIN WHEEL</Text>
                            </Pressable>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, darkMode && styles.textDark]}>{userPosts.length}</Text>
                                    <Text style={[styles.statLabel, darkMode && styles.bioDark]}>Posts</Text>
                                </View>
                                <View style={[styles.statDivider, darkMode && styles.dividerDark]} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, darkMode && styles.textDark]}>{totalReactions}</Text>
                                    <Text style={[styles.statLabel, darkMode && styles.bioDark]}>Reactions</Text>
                                </View>
                            </View>

                            {/* Streak — below stats */}
                            <View style={[styles.streakChip, darkMode && styles.streakChipDark]}>
                                <Text style={[styles.streakChipText, darkMode && styles.streakChipTextDark]}>
                                    {streak > 0 ? `🔥 ${streak}-day streak` : '🔥 Start your first streak'}
                                </Text>
                            </View>
                        </View>

                        {/* View Toggle */}
                        <View style={styles.viewToggle}>
                            <Pressable
                                onPress={() => { if (soundEffects) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('grid'); }}
                                style={[styles.toggleBtn, mode === 'grid' && styles.toggleBtnActive, darkMode && styles.toggleBtnDark]}
                            >
                                <GridIcon color={mode === 'grid' ? (darkMode ? '#FAF9F6' : '#4A4A4A') : '#AEAEB2'} />
                            </Pressable>
                            <Pressable
                                onPress={() => { if (soundEffects) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('list'); }}
                                style={[styles.toggleBtn, mode === 'list' && styles.toggleBtnActive, darkMode && styles.toggleBtnDark]}
                            >
                                <ListIcon color={mode === 'list' ? (darkMode ? '#FAF9F6' : '#4A4A4A') : '#AEAEB2'} />
                            </Pressable>
                        </View>

                        {/* Posts Grid/List */}
                        <View style={styles.postsContainer}>
                            {userPosts.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <SpinnerIcon color="#D1D1D1" />
                                    <Text style={styles.emptyText}>No posts yet</Text>
                                    <Text style={styles.emptySubtext}>Spin the wheel to start your journey!</Text>
                                </View>
                            ) : mode === 'grid' ? (
                                <View style={styles.gridContainer}>
                                    {userPosts.map(post => (
                                        <View key={post.id} style={styles.gridItem}>
                                            {post.media ? (
                                                <Image source={{ uri: post.media }} style={styles.gridImage} />
                                            ) : (
                                                <View style={[styles.gridImage, styles.gridTextOnly]}>
                                                    <Text style={styles.gridTextContent} numberOfLines={4}>{post.content}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.listContainer}>
                                    {userPosts.map(post => (
                                        <View key={post.id} style={[styles.listItem, darkMode && styles.listItemDark]}>
                                            {post.media && <Image source={{ uri: post.media }} style={styles.listImage} />}
                                            <View style={styles.listContent}>
                                                {post.challenge && <Text style={styles.listChallenge}>{post.challenge}</Text>}
                                                <Text style={[styles.listText, darkMode && styles.textDark]}>{post.content}</Text>
                                                <View style={styles.listReactions}>
                                                    <Text style={styles.reactionCount}>❤️ {post.reactions.felt}</Text>
                                                    <Text style={styles.reactionCount}>💭 {post.reactions.thought}</Text>
                                                    <Text style={styles.reactionCount}>✨ {post.reactions.intrigued}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </Animated.ScrollView>
                </SafeAreaView>

                {/* ── SETTINGS ─────────────────────────────────────────── */}
                {showSettings && (
                    <Animated.View style={[styles.modalOverlay, { transform: [{ translateY: settingsAnim }] }]}>
                        <View style={[styles.stBg, darkMode && styles.stBgDark]} />

                        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

                            {/* drag handle — swipe down to close */}
                            <View style={styles.stHandle} {...settingsPan.panHandlers}>
                                <View style={[styles.stHandlePill, darkMode && { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
                            </View>

                            {/* header row */}
                            <View style={[styles.stHeader, darkMode && styles.stHeaderDark]}>
                                <Text style={[styles.stHeaderTitle, darkMode && { color: '#FFF' }]}>Settings</Text>
                                <Pressable onPress={closeSettings} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                                    <Ionicons name="close" size={22} color={darkMode ? '#8E8E93' : '#AEAEB2'} />
                                </Pressable>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

                                {/* ─── PROFILE BLOCK ──────────────────────────── */}
                                <Pressable
                                    onPress={handleUpdatePfp}
                                    style={({ pressed }) => [styles.stProfileBlock, darkMode && styles.stProfileBlockDark, pressed && { opacity: 0.8 }]}
                                >
                                    <Image
                                        source={{
                                            uri: userProfile.photoURL || Image.resolveAssetSource(require('../../assets/icon.png')).uri
                                        }}
                                        style={styles.stAvatar}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.stProfileName, darkMode && { color: '#FFF' }]}>{userProfile.username}</Text>
                                        <Text style={styles.stProfileSub}>{userPosts.length} posts · {totalReactions} reactions</Text>
                                    </View>
                                    <View style={[styles.stCamBadge, darkMode && { borderColor: '#1C1C1E' }]}>
                                        <Ionicons name="camera" size={13} color="#FFF" />
                                    </View>
                                </Pressable>

                                {/* ─── USERNAME EDIT ──────────────────────────── */}
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="at" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Username</Text>
                                            <TextInput
                                                style={[styles.stInlineInput, darkMode && styles.stInlineInputDk]}
                                                value={editUsername}
                                                onChangeText={setEditUsername}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                placeholder="your_username"
                                                placeholderTextColor={darkMode ? '#555' : '#C7C7CC'}
                                                returnKeyType="done"
                                                onSubmitEditing={handleSaveUsername}
                                            />
                                        </View>
                                        <Pressable
                                            onPress={handleSaveUsername}
                                            disabled={editUsername.trim().length < 1}
                                            style={[styles.stSaveBtn, { opacity: editUsername.trim().length < 1 ? 0.3 : 1 }]}
                                        >
                                            <Text style={styles.stSaveTxt}>Save</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                {/* ─── ACCOUNT ────────────────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Account</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <Pressable onPress={() => handleSettingsOption('email')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="mail" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Email address</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('security')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="key" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Security</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('linkedAccounts')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="shield-checkmark" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Linked accounts</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── CONTENT & DISPLAY ──────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Content & Display</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name={darkMode ? 'moon' : 'sunny'} size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Dark mode</Text>
                                        <Switch
                                            value={darkMode}
                                            onValueChange={toggleTheme}
                                            trackColor={{ false: '#E5E5EA', true: '#5856D6' }}
                                            thumbColor="#FFF"
                                        />
                                    </View>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('language')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="language" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Language</Text>
                                        <Text style={styles.stValue}>English</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('accessibility')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="accessibility" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Accessibility</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── NOTIFICATIONS ──────────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Notifications</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="notifications" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Push notifications</Text>
                                        <Switch
                                            value={notifications}
                                            onValueChange={setNotifications}
                                            trackColor={{ false: '#E5E5EA', true: '#FF3B30' }}
                                            thumbColor="#FFF"
                                        />
                                    </View>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="musical-notes" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Sounds & haptics</Text>
                                        <Switch
                                            value={soundEffects}
                                            onValueChange={setSoundEffects}
                                            trackColor={{ false: '#E5E5EA', true: '#30D158' }}
                                            thumbColor="#FFF"
                                        />
                                    </View>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('messages')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="mail-unread" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>In-app messages</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── PRIVACY ────────────────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Privacy</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="lock-closed" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Private account</Text>
                                            <Text style={styles.stSublabel}>Only followers see your posts</Text>
                                        </View>
                                        <Switch value={privateAccount} onValueChange={setPrivateAccount} trackColor={{ false: '#E5E5EA', true: '#007AFF' }} thumbColor="#FFF" />
                                    </View>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <View style={[styles.stRow, darkMode && styles.stRowDark]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="radio" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Activity status</Text>
                                            <Text style={styles.stSublabel}>Others can see when you're active</Text>
                                        </View>
                                        <Switch value={activityStatus} onValueChange={setActivityStatus} trackColor={{ false: '#E5E5EA', true: '#34C759' }} thumbColor="#FFF" />
                                    </View>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('blockedAccounts')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="ban" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Blocked accounts</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('downloadData')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="download" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Download my data</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── SUPPORT & ABOUT ────────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Support & About</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <Pressable onPress={() => handleSettingsOption('helpCenter')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="help-circle" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Help Center</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('contactUs')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="chatbubble-ellipses" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Contact us</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('reportProblem')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="flag" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Report a problem</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('about')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="information-circle" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>About Spindare</Text>
                                        <Text style={styles.stValue}>V1.1.0</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── LEGAL ──────────────────────────────────── */}
                                <Text style={[styles.stSecLabel, darkMode && styles.stSecLabelDk]}>Legal</Text>
                                <View style={[styles.stSection, darkMode && styles.stSectionDark]}>
                                    <Pressable onPress={() => handleSettingsOption('terms')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="document-text" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Terms of service</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('privacy')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="eye" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Privacy policy</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                    <View style={[styles.stDivider, darkMode && styles.stDividerDk]} />
                                    <Pressable onPress={() => handleSettingsOption('guidelines')} style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}>
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="people" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, darkMode && styles.stLabelDk]}>Community guidelines</Text>
                                        <Ionicons name="chevron-forward" size={16} color={darkMode ? '#3A3A3C' : '#C7C7CC'} />
                                    </Pressable>
                                </View>

                                {/* ─── LOG OUT ────────────────────────────────── */}
                                <View style={[styles.stSection, darkMode && styles.stSectionDark, { marginBottom: 0 }]}>
                                    <Pressable
                                        onPress={onLogout}
                                        style={({ pressed }) => [styles.stRow, darkMode && styles.stRowDark, pressed && { opacity: 0.5 }]}
                                    >
                                        <View style={[styles.stIco, darkMode && styles.stIcoDark]}>
                                            <Ionicons name="log-out" size={15} color={darkMode ? '#D1D1D6' : '#3A3A3C'} />
                                        </View>
                                        <Text style={[styles.stLabel, { color: '#FF3B30' }]}>Log out</Text>
                                    </Pressable>
                                </View>

                                {/* ─── FOOTER ─────────────────────────────────── */}
                                <Text style={styles.stFooter}>SPINDARE · V1.1.0 · PRE-ALPHA</Text>

                            </ScrollView>
                        </SafeAreaView>
                    </Animated.View>
                )}

                {/* Spinner Modal */}
                {showSpinner && (
                    <Animated.View style={[styles.modalOverlay, { transform: [{ translateY: spinnerAnim }] }]}>
                        <Pressable style={styles.spinnerModalBg} onPress={closeSpinner}>
                            <BlurView intensity={90} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill}>
                                <SafeAreaView style={styles.spinnerModalContainer}>
                                    <View style={[styles.spinnerModal, darkMode && styles.cardDark]}>
                                        {submissionStep === 'idle' && (
                                            <View style={styles.spinWheelContainer}>
                                                <SpinWheel
                                                    options={SPIN_REWARDS}
                                                    onSpinEnd={handleSpinEnd}
                                                    canSpin={true}
                                                />
                                            </View>
                                        )}

                                        {submissionStep === 'result' && spinResult && (
                                            <Animated.View style={styles.resultContainer}>
                                                <Text style={styles.resultLabel}>CHALLENGE UNLOCKED</Text>
                                                <Text style={[styles.resultText, darkMode && styles.textDark]}>{spinResult}</Text>

                                                {/* Primary row: Share + Do It */}
                                                <View style={styles.actionRow}>
                                                    <Pressable onPress={() => { onShare?.(); }} style={[styles.actionBtnSecondary, darkMode && styles.secondaryBtnDark]}>
                                                        <Ionicons name="share-outline" size={24} color={darkMode ? "#FFF" : "#1C1C1E"} />
                                                        <Text style={[styles.actionBtnTextSecondary, darkMode && styles.textDark]}>Share</Text>
                                                    </Pressable>
                                                    <Pressable onPress={handleActionChoose} style={styles.actionBtnPrimary}>
                                                        <Ionicons name="camera-outline" size={24} color="#FFF" />
                                                        <Text style={styles.actionBtnTextPrimary}>Do It</Text>
                                                    </Pressable>
                                                </View>

                                                {/* Secondary row: Save + Retry with AI */}
                                                <View style={styles.actionRowSecondary}>
                                                    <Pressable
                                                        onPress={() => {
                                                            if (spinResult && onSaveChallenge) {
                                                                onSaveChallenge(spinResult);
                                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                                showToast('Challenge saved! You have 2 days to complete it.', { type: 'success' });
                                                            }
                                                        }}
                                                        style={[styles.actionBtnGhost, darkMode && styles.actionBtnGhostDark]}
                                                    >
                                                        <Ionicons name="bookmark-outline" size={18} color={darkMode ? '#E5E5EA' : '#3A3A3C'} />
                                                        <Text style={[styles.actionBtnGhostText, darkMode && styles.actionBtnGhostTextDark]}>Save</Text>
                                                    </Pressable>
                                                    <Pressable
                                                        onPress={handleRetryWithAI}
                                                        disabled={isRetrying}
                                                        style={[styles.actionBtnGhost, darkMode && styles.actionBtnGhostDark, isRetrying && { opacity: 0.5 }]}
                                                    >
                                                        <Ionicons name="sparkles-outline" size={18} color={darkMode ? '#E5E5EA' : '#3A3A3C'} />
                                                        <Text style={[styles.actionBtnGhostText, darkMode && styles.actionBtnGhostTextDark]}>
                                                            {isRetrying ? 'Thinking...' : 'Retry with AI'}
                                                        </Text>
                                                    </Pressable>
                                                </View>
                                            </Animated.View>
                                        )}

                                        {submissionStep === 'choose' && (
                                            <View style={styles.chooseContainer}>
                                                <Text style={[styles.miniChallengeText, darkMode && styles.textDark]}>{spinResult}</Text>

                                                <View style={styles.proofActionsRow}>
                                                    <Pressable onPress={handleCamera} style={[styles.proofActionBtn, darkMode && styles.proofActionBtnDark]}>
                                                        <CameraIcon color="#FAF9F6" />
                                                    </Pressable>
                                                    <Pressable onPress={handleGallery} style={[styles.proofActionBtn, darkMode && styles.proofActionBtnDark]}>
                                                        <GalleryIcon color="#FAF9F6" />
                                                    </Pressable>
                                                    <Pressable onPress={handleTextAction} style={[styles.proofActionBtn, darkMode && styles.proofActionBtnDark]}>
                                                        <TextIcon color="#FAF9F6" />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        )}

                                        {submissionStep === 'preview_media' && mediaUri && (
                                            <View style={styles.mediaPreviewContainer}>
                                                <Image
                                                    source={{ uri: mediaUri }}
                                                    style={[styles.mediaPreview, { aspectRatio: mediaAspectRatio }]}
                                                    resizeMode="contain"
                                                />
                                                <TextInput
                                                    style={[styles.textInputArea, darkMode && { backgroundColor: '#2C2C2E', color: '#FFF' }]}
                                                    placeholder="Add a caption..."
                                                    placeholderTextColor={darkMode ? "#8E8E93" : "#AEAEB2"}
                                                    value={textContent}
                                                    onChangeText={setTextContent}
                                                    multiline
                                                />
                                                <Pressable onPress={submitChallenge} style={[styles.submitBtn, isSubmittingChallenge && { opacity: 0.5 }]} disabled={isSubmittingChallenge}>
                                                    <Text style={styles.submitBtnText}>{isSubmittingChallenge ? 'Posting...' : 'Post Challenge'}</Text>
                                                </Pressable>
                                            </View>
                                        )}


                                        {submissionStep === 'input_text' && (
                                            <View style={{ width: '100%' }}>
                                                <TextInput
                                                    style={[styles.textInputArea, darkMode && { backgroundColor: '#2C2C2E', color: '#FFF' }]}
                                                    multiline
                                                    placeholder="Write your response..."
                                                    placeholderTextColor={darkMode ? "#8E8E93" : "#AEAEB2"}
                                                    value={textContent}
                                                    onChangeText={setTextContent}
                                                    autoFocus
                                                />
                                                <Pressable onPress={submitChallenge} style={[styles.submitBtn, isSubmittingChallenge && { opacity: 0.5 }]} disabled={isSubmittingChallenge}>
                                                    <Text style={styles.submitBtnText}>{isSubmittingChallenge ? 'Posting...' : 'Post Challenge'}</Text>
                                                </Pressable>
                                            </View>
                                        )}


                                    </View>
                                </SafeAreaView>
                            </BlurView>
                        </Pressable>
                    </Animated.View>
                )}
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    containerDark: { backgroundColor: '#1C1C1E' },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerDark: {
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerBtn: { padding: 4 },
    headerTitle: {
        color: '#2C2C2C',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: -0.4,
    },
    textDark: { color: '#FAF9F6' },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    sectionDark: {
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    pfpContainer: {
        width: 110,
        height: 110,
        borderRadius: 55,
        marginBottom: 20,
        position: 'relative',
    },
    pfp: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FAF9F6',
    },
    editBadgeText: {
        color: '#FAF9F6',
        fontSize: 14,
    },
    username: {
        color: '#2C2C2C',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
        letterSpacing: -0.6,
    },
    bio: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 24,
    },
    bioDark: { color: '#AEAEB2' },
    spinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 28,
        backgroundColor: '#4A4A4A',
        marginBottom: 32,
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    spinBtnText: {
        color: '#FAF9F6',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    spinBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#A7BBC7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinBadgeText: {
        color: '#FAF9F6',
        fontSize: 11,
        fontWeight: '700',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#2C2C2C',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    streakChip: {
        alignSelf: 'center',
        marginTop: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,159,10,0.14)',
    },
    streakChipDark: {
        backgroundColor: 'rgba(255,159,10,0.22)',
    },
    streakChipText: {
        color: '#FF9F0A',
        fontSize: 12,
        fontWeight: '700',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    streakChipTextDark: {
        color: '#FFD60A',
    },
    streakRow: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: 'rgba(118,84,255,0.08)',
    },
    streakRowDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    streakText: {
        color: '#5E34FF',
        textAlign: 'center',
        fontWeight: '700',
    },
    streakTextDark: {
        color: '#E7E7FF',
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    dividerDark: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    viewToggle: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    toggleBtnActive: {
        backgroundColor: '#FFF',
        borderColor: 'rgba(0,0,0,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    toggleBtnDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    postsContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    gridItem: {
        width: (width - 64) / 3,
        height: (width - 64) / 3,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    gridTextOnly: {
        backgroundColor: '#F0F0F0',
        padding: 8,
        justifyContent: 'center',
    },
    gridTextContent: {
        color: '#4A4A4A',
        fontSize: 9,
        fontWeight: '500',
        lineHeight: 12,
    },
    listContainer: {
        gap: 16,
    },
    listItem: {
        borderRadius: 20,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    listItemDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    listImage: {
        width: '100%',
        height: width - 48,
        backgroundColor: '#F0F0F0',
    },
    listContent: {
        padding: 20,
    },
    listChallenge: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    listText: {
        color: '#2C2C2C',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
        marginBottom: 12,
        letterSpacing: -0.2,
    },
    listReactions: {
        flexDirection: 'row',
        gap: 16,
    },
    reactionCount: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
    },
    emptyText: {
        color: '#AEAEB2',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#D1D1D1',
        fontSize: 13,
        fontWeight: '400',
        marginTop: 6,
    },
    spinnerModalBg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerModal: {
        width: width - 32, // Wider modal
        backgroundColor: '#FFF',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
    },
    spinnerTitle: {
        display: 'none', // Hidden
    },
    spinnerSubtitle: {
        display: 'none', // Hidden
    },
    spinWheelContainer: {
        width: '100%',
        aspectRatio: 1,
        marginBottom: 20,
        transform: [{ scale: 0.85 }] // Make it smaller
    },
    spinnerCloseBtn: {
        paddingVertical: 12,
    },
    spinnerCloseBtnText: {
        color: '#8E8E93',
        fontSize: 16,
        fontWeight: '500',
    },
    resultContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 10,
    },
    resultLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#AEAEB2',
        letterSpacing: 2,
        marginBottom: 8,
    },
    resultText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1C1C1E',
        textAlign: 'center',
        marginBottom: 24,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    actionBtnPrimary: {
        flex: 1,
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    actionBtnSecondary: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 20,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    actionBtnTextPrimary: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    actionBtnTextSecondary: {
        color: '#1C1C1E',
        fontSize: 16,
        fontWeight: '600',
    },
    // New Styles for Submission Flow
    navBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    chooseContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
    },
    proofActionsRow: { flexDirection: 'row', gap: 20, justifyContent: 'center', marginTop: 16 },
    proofActionBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proofActionBtnDark: { backgroundColor: '#2C2C2E' },
    miniChallengeText: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 32,
        textAlign: 'center',
        fontWeight: '500',
    },
    iconRow: {
        flexDirection: 'row',
        gap: 32,
        justifyContent: 'center',
        width: '100%',
    },
    iconBtn: {
        alignItems: 'center',
        gap: 8,
    },
    iconBtnText: {
        fontSize: 12,
        color: '#1C1C1E',
        fontWeight: '600',
    },
    mediaPreviewContainer: {
        width: '100%',
        alignItems: 'center',
    },
    mediaPreview: {
        width: '100%',
        borderRadius: 16,
        backgroundColor: '#F0F0F0',
        marginBottom: 20,
    },
    textInputArea: {
        width: '100%',
        minHeight: 120,
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1C1C1E',
        marginBottom: 20,
        textAlignVertical: 'top',
    },
    submitBtn: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    cardDark: { backgroundColor: '#2C2C2E' },
    secondaryBtnDark: { backgroundColor: '#3A3A3C' },
    actionRowSecondary: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginTop: 10,
    },
    actionBtnGhost: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 13,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.07)',
    },
    actionBtnGhostDark: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionBtnGhostText: {
        color: '#3A3A3C',
        fontSize: 14,
        fontWeight: '600',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    actionBtnGhostTextDark: {
        color: '#E5E5EA',
    },

    // ── Settings v3 — TikTok-style flat (st* prefix) ──────────────────────
    stBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F2F2F7' },
    stBgDark: { backgroundColor: '#0A0A0F' },
    stHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
    stHandlePill: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
    stHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    stHeaderDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
    stHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#0A0A0F', letterSpacing: -0.5 },
    stProfileBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 16,
        gap: 14,
    },
    stProfileBlockDark: { backgroundColor: '#1C1C1E' },
    stAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0E0E0' },
    stCamBadge: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    stProfileName: { fontSize: 16, fontWeight: '700', color: '#0A0A0F', letterSpacing: -0.3, marginBottom: 2 },
    stProfileSub: { fontSize: 13, color: '#8E8E93' },
    stSecLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        letterSpacing: 0.6,
        marginLeft: 32,
        marginTop: 20,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    stSecLabelDk: { color: '#636366' },
    stSection: { marginHorizontal: 16, backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
    stSectionDark: { backgroundColor: '#1C1C1E' },
    stRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 13, minHeight: 56 },
    stRowDark: {},
    stIco: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    stIcoDark: { backgroundColor: '#2C2C2E' },
    stDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 60 },
    stDividerDk: { backgroundColor: 'rgba(255,255,255,0.06)' },
    stLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: '#0A0A0F', letterSpacing: -0.2 },
    stLabelDk: { color: '#F0F0F0' },
    stSublabel: { fontSize: 12, color: '#AEAEB2', marginTop: 2 },
    stValue: { fontSize: 14, color: '#AEAEB2', marginRight: 4 },
    stInlineInput: { fontSize: 14, color: '#0A0A0F', paddingVertical: 0, marginTop: 2 },
    stInlineInputDk: { color: '#AEAEB2' },
    stSaveBtn: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
    stSaveTxt: { color: '#FFF', fontSize: 13, fontWeight: '600' },
    stFooter: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#C7C7CC', letterSpacing: 2, paddingVertical: 28 },

    // ── Compat stubs (spinner modal + non-settings refs) ──────────────────
    solidModalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FAF9F6' },
    solidModalBgDark: { backgroundColor: '#0A0A0F' },
    modalContainer: { flex: 1 },
    modalOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 5000 },
    versionInfo: { alignItems: 'center', paddingVertical: 32 },
    versionText: { color: '#2C2C2C', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    versionSubtext: { color: '#AEAEB2', fontSize: 12 },
});