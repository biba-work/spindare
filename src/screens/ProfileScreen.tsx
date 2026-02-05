import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Pressable, Animated, Alert, Switch, Platform, TextInput, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserProfile } from '../services/AIService';
import { PostService } from '../services/PostService';
import { AuthService } from '../services/AuthService';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Post } from '../services/PostService';
import { auth } from '../services/firebaseConfig';
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

interface ProfileScreenProps {
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
}

import { useTheme } from '../contexts/ThemeContext';

export const ProfileScreen = ({
    onBack,
    onLogout,
    spinsLeft,
    setSpinsLeft,
    activeChallenge,
    onChallengeReceived,

    userProfile,
    onUpdateProfile,
    onShare,
    onOpenCamera
}: ProfileScreenProps) => {
    const [mode, setMode] = useState<'list' | 'grid'>('grid');
    const [showSettings, setShowSettings] = useState(false);

    // Global Theme
    const { darkMode, toggleTheme } = useTheme();

    const [soundEffects, setSoundEffects] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [settingsPage, setSettingsPage] = useState<'main' | 'privacy' | 'help'>('main');
    const [userPosts, setUserPosts] = useState<Post[]>([]);

    const [showSpinner, setShowSpinner] = useState(false);
    const [spinResult, setSpinResult] = useState<string | null>(null);

    const settingsAnim = useRef(new Animated.Value(height)).current;
    const spinnerAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

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
    const [textContent, setTextContent] = useState('');
    const [mediaAspectRatio, setMediaAspectRatio] = useState(1);

    const [editUsername, setEditUsername] = useState(userProfile.username);

    useEffect(() => {
        setEditUsername(userProfile.username);
    }, [userProfile.username]);

    const handleSaveUsername = async () => {
        const newUsername = editUsername.trim();
        if (newUsername.length < 1) return;

        try {
            // Update in Firestore (profile + all posts)
            await AuthService.updateUsername(newUsername);

            // Update locally in parent component
            onUpdateProfile({ username: newUsername });

            if (soundEffects) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Username updated! It may take a moment for changes to appear everywhere.");
        } catch (error: any) {
            console.error("Username update failed:", error);
            Alert.alert("Error", `Could not update username: ${error.message || 'Unknown error'}`);
            setEditUsername(userProfile.username); // Revert on error
        }
    };

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        const uid = auth.currentUser?.uid;
        if (uid) {
            const unsub = PostService.subscribeToUserPosts(uid, (posts) => {
                setUserPosts(posts);
            });
            return () => unsub();
        }
    }, []);

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

    const handleActionChoose = () => {
        setSubmissionStep('choose');
        // Layout animation for smoothness
        // LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const handleCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], // Photo only as requested
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaAspectRatio(result.assets[0].width / result.assets[0].height);
            setSubmissionStep('preview_media');
        }
    };

    const handleGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery access is required.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaAspectRatio(result.assets[0].width / result.assets[0].height);
            setSubmissionStep('preview_media');
        }
    };

    const handleTextAction = () => {
        setSubmissionStep('input_text');
    };

    const submitChallenge = async () => {
        if (!spinResult) return;

        try {
            // Submit to Firestore
            await PostService.createPost(
                userProfile.username,
                userProfile.photoURL || '',
                spinResult,
                textContent || 'Challenge completed! 🎯',
                mediaUri
            );

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Posted! 🎉", "Your challenge has been shared with the community!");
            closeSpinner();
        } catch (error: any) {
            console.error("Post submission error:", error);
            Alert.alert("Error", "Could not post your challenge. Please try again.");
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

    const handleUpdatePfp = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery access is required.');
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
                Alert.alert("Error", "Could not upload profile picture.");
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
                                        uri: (userProfile.username === 'rashica07' || userProfile.username === 'example' || !userProfile.photoURL)
                                            ? Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri
                                            : userProfile.photoURL
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

                {/* Settings Modal */}
                {showSettings && (
                    <Animated.View style={[styles.modalOverlay, { transform: [{ translateY: settingsAnim }] }]}>
                        <View style={[styles.solidModalBg, darkMode && styles.solidModalBgDark]} />
                        <BlurView intensity={40} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill}>
                            <SafeAreaView style={styles.modalContainer}>
                                <View style={[styles.modalHeader, darkMode && styles.modalHeaderDark]}>
                                    {settingsPage !== 'main' && (
                                        <Pressable onPress={() => setSettingsPage('main')} style={styles.backBtn}>
                                            <BackIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                        </Pressable>
                                    )}
                                    <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                                        {settingsPage === 'main' ? 'Settings' : settingsPage === 'privacy' ? 'Privacy & Security' : 'Help & Support'}
                                    </Text>
                                    <Pressable onPress={closeSettings} style={styles.closeBtn}>
                                        <Text style={[styles.closeBtnText, darkMode && styles.closeBtnTextDark]}>Done</Text>
                                    </Pressable>
                                </View>

                                <ScrollView style={styles.settingsContent}>
                                    {settingsPage === 'main' && (
                                        <>
                                            <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Dark Mode</Text>
                                                <Switch value={darkMode} onValueChange={toggleTheme} />
                                            </View>
                                            <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Notifications</Text>
                                                <Switch value={notifications} onValueChange={setNotifications} />
                                            </View>
                                            <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Sound Effects</Text>
                                                <Switch value={soundEffects} onValueChange={setSoundEffects} />
                                            </View>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <View style={[styles.settingGroup, { paddingHorizontal: 0 }]}>
                                                <Text style={[styles.sectionHeader, darkMode && styles.textDark, { paddingHorizontal: 20, marginBottom: 8 }]}>CHANGE USERNAME</Text>
                                                <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10 }}>
                                                    <TextInput
                                                        style={[styles.usernameInput, darkMode && styles.usernameInputDark]}
                                                        placeholder="New username"
                                                        placeholderTextColor={darkMode ? "#777" : "#CCC"}
                                                        value={editUsername}
                                                        onChangeText={setEditUsername}
                                                        autoCapitalize="none"
                                                    />
                                                    <Pressable
                                                        style={[styles.saveBtn, { opacity: editUsername.length < 1 ? 0.5 : 1 }]}
                                                        disabled={editUsername.length < 1}
                                                        onPress={handleSaveUsername}
                                                    >
                                                        <Text style={styles.saveBtnText}>Save</Text>
                                                    </Pressable>
                                                </View>
                                            </View>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <Pressable onPress={() => setSettingsPage('privacy')} style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Privacy & Security</Text>
                                            </Pressable>
                                            <Pressable onPress={() => setSettingsPage('help')} style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Help & Support</Text>
                                            </Pressable>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <Pressable onPress={onLogout} style={[styles.logoutButton, darkMode && styles.logoutButtonDark]}>
                                                <Text style={styles.logoutButtonText}>Log Out</Text>
                                            </Pressable>
                                        </>
                                    )}

                                    {settingsPage === 'privacy' && (
                                        <>
                                            <Text style={[styles.pageDescription, darkMode && styles.pageDescriptionDark]}>Manage your privacy and security settings</Text>

                                            <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Private Account</Text>
                                                <Switch value={false} onValueChange={() => { }} />
                                            </View>
                                            <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingLabel, darkMode && styles.settingLabelDark]}>Show Activity Status</Text>
                                                <Switch value={true} onValueChange={() => { }} />
                                            </View>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Blocked Users</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Data & Storage</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Account Security</Text>
                                            </Pressable>
                                        </>
                                    )}

                                    {settingsPage === 'help' && (
                                        <>
                                            <Text style={[styles.pageDescription, darkMode && styles.pageDescriptionDark]}>Get help and support</Text>

                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>FAQs</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Contact Support</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Report a Problem</Text>
                                            </Pressable>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Terms of Service</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Privacy Policy</Text>
                                            </Pressable>
                                            <Pressable style={[styles.settingButton, darkMode && styles.settingItemDark]}>
                                                <Text style={[styles.settingButtonText, darkMode && styles.settingButtonTextDark]}>Community Guidelines</Text>
                                            </Pressable>

                                            <View style={[styles.settingsDivider, darkMode && styles.settingsDividerDark]} />

                                            <View style={styles.versionInfo}>
                                                <Text style={[styles.versionText, darkMode && styles.textDark]}>Spindare v0.61.59</Text>
                                                <Text style={styles.versionSubtext}>Pre-Alpha Testing</Text>
                                            </View>
                                        </>
                                    )}
                                </ScrollView>
                            </SafeAreaView>
                        </BlurView>
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
                                                <Pressable onPress={submitChallenge} style={styles.submitBtn}>
                                                    <Text style={styles.submitBtnText}>Post Challenge</Text>
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
                                                <Pressable onPress={submitChallenge} style={styles.submitBtn}>
                                                    <Text style={styles.submitBtnText}>Post Challenge</Text>
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
    container: { flex: 1 },
    containerDark: {},
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
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
        backgroundColor: 'rgba(255,255,255,0.6)',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    listItemDark: {
        backgroundColor: 'rgba(28,28,30,0.6)',
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
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5000,
    },
    solidModalBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FAF9F6',
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backBtn: {
        padding: 4,
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    modalTitle: {
        color: '#2C2C2C',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.4,
        flex: 1,
        textAlign: 'center',
    },
    closeBtn: {
        padding: 4,
    },
    closeBtnText: {
        color: '#4A4A4A',
        fontSize: 15,
        fontWeight: '600',
    },
    settingsContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    pageDescription: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 24,
        lineHeight: 20,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    settingLabel: {
        color: '#2C2C2C',
        fontSize: 16,
        fontWeight: '500',
    },
    settingsDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginVertical: 24,
    },
    settingButton: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    settingButtonText: {
        color: '#4A4A4A',
        fontSize: 16,
        fontWeight: '500',
    },
    logoutButton: {
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: '#FFF',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    logoutButtonText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '700',
    },
    versionInfo: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    versionText: {
        color: '#2C2C2C',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    versionSubtext: {
        color: '#AEAEB2',
        fontSize: 12,
        fontWeight: '500',
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
    // Dark Mode for Settings
    solidModalBgDark: { backgroundColor: '#1C1C1E' },
    modalTitleDark: { color: '#FFF' },
    closeBtnTextDark: { color: '#FFF' },
    modalHeaderDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
    settingLabelDark: { color: '#FFF' },
    settingButtonTextDark: { color: '#FFF' },
    settingsDividerDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
    settingItemDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
    logoutButtonDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pageDescriptionDark: { color: '#8E8E93' },
    cardDark: { backgroundColor: '#2C2C2E' },
    secondaryBtnDark: { backgroundColor: '#3A3A3C' },
    // Username Edit
    settingGroup: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8E8E93',
        marginBottom: 12,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    usernameInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#F2F2F7',
        borderRadius: 10,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1C1C1E',
    },
    usernameInputDark: {
        backgroundColor: '#2C2C2E',
        color: '#FFF',
    },
    saveBtn: {
        backgroundColor: '#007AFF',
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    // Icon circle for spinner action buttons
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    chooseSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 20,
        marginTop: -8,
    },
    // SPIND-style proof action buttons
    proofActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    proofActionBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proofActionBtnDark: {
        backgroundColor: '#3A3A3C',
    },
});
