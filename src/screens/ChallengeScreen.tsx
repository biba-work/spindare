import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { ReactionButton } from '../components/atoms/ReactionButton';
import { AIService, UserProfile } from '../services/AIService';
import { Post, PostService } from '../services/PostService';
import { auth } from '../services/firebaseConfig';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favorite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
];

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const ShareIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <Path d="M16 6l-4-4-4 4" />
        <Path d="M12 2v13" />
    </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M20 6L9 17l-5-5" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const ClockIcon = ({ color }: { color: string }) => (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="10" />
        <Path d="M12 6v6l4 2" />
    </Svg>
);

import { FeedScreen } from './FeedScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { FriendsListScreen } from './FriendsListScreen';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export const ChallengeScreen = () => {
    const { darkMode } = useTheme();
    const [challenge, setChallenge] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    // ... rest of state
    const [isFeedVisible, setIsFeedVisible] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [proofMode, setProofMode] = useState(false);
    const [posts, setPosts] = useState<Post[]>([]);

    // ... mocked user profile logic ...
    const userProfile: UserProfile = {
        username: "bibovic",
        email: "bibovic@example.com",
        hobbies: ["Photography", "Gaming", "Art"],
        studyFields: ["Computer Science"],
        xp: 248,
        level: 3
    };


    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    // Animations for transitions
    const feedTransitionAnim = useRef(new Animated.Value(height)).current;
    const postTransitionAnim = useRef(new Animated.Value(height)).current;
    const shareTransitionAnim = useRef(new Animated.Value(height)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy < -50 && !isFeedVisible && !isPosting && !isSharing;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -100) {
                    showFeed();
                }
            },
        })
    ).current;

    const feedPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Return to main screen on either swipe up (dy < -50) or swipe down (dy > 50)
                return Math.abs(gestureState.dy) > 50 && isFeedVisible;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (Math.abs(gestureState.dy) > 100) {
                    hideFeed();
                }
            },
        })
    ).current;

    const showFeed = () => {
        setIsFeedVisible(true);
        Animated.spring(feedTransitionAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const hideFeed = () => {
        Animated.timing(feedTransitionAnim, {
            toValue: height,
            duration: 400,
            useNativeDriver: true,
        }).start(() => setIsFeedVisible(false));
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

    const showShare = () => {
        setIsSharing(true);
        Animated.spring(shareTransitionAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const hideShare = () => {
        Animated.timing(shareTransitionAnim, {
            toValue: height,
            duration: 400,
            useNativeDriver: true,
        }).start(() => setIsSharing(false));
    };



    const handleMediaAction = async (type: 'camera' | 'gallery' | 'text') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setReaction(type);

        if (type === 'camera') {
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access camera is required to take photos.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                setSelectedImage(result.assets[0].uri);
                showPostCreator();
            }
        } else if (type === 'gallery') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access gallery is required to select photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                setSelectedImage(result.assets[0].uri);
                showPostCreator();
            }
        } else {
            setSelectedImage(null);
            showPostCreator();
        }
    };

    // ... existing code ...

    const handlePostSubmit = async (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => {
        console.log('Post submitted:', content, imageUri, target);
        hidePostCreator();

        if (target === 'feed') {
            try {
                await PostService.createPost(
                    userProfile.username,
                    userProfile.photoURL || '',
                    challenge || 'Daily Spin',
                    content,
                    imageUri || null
                );
            } catch (err) {
                console.error("Error creating post from Challenge Screen:", err);
            }

            setTimeout(() => {
                showFeed();
            }, 500);
        } else if (target === 'friend') {
            setTimeout(() => {
                showShare();
            }, 500);
        }
    };

    const renderChallengeCardContent = () => (
        <>
            <View style={styles.cardHeader}>
                <View style={styles.cardLine} />
            </View>

            <Text style={styles.challengeText}>
                {challenge}
            </Text>

            {!proofMode ? (
                <View style={styles.actionRow}>
                    <Pressable style={styles.actionBtn} onPress={showShare}>
                        <ShareIcon color="#8E8E93" />
                        <Text style={styles.actionBtnText}>SEND</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.primaryActionBtn]} onPress={() => setProofMode(true)}>
                        <CheckIcon color="#FAF9F6" />
                        <Text style={[styles.actionBtnText, { color: '#FAF9F6' }]}>DO IT</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.proofContainer}>
                    <View style={styles.proofIconsRow}>
                        <Pressable style={styles.proofIconBtn} onPress={() => handleMediaAction('camera')}>
                            <CameraIcon color="#FAF9F6" />
                        </Pressable>
                        <Pressable style={styles.proofIconBtn} onPress={() => handleMediaAction('gallery')}>
                            <GalleryIcon color="#FAF9F6" />
                        </Pressable>
                        <Pressable style={styles.proofIconBtn} onPress={() => handleMediaAction('text')}>
                            <TextIcon color="#FAF9F6" />
                        </Pressable>
                    </View>
                    <Pressable style={styles.saveLaterBtn} onPress={() => { setChallenge(null); setProofMode(false); }}>
                        <ClockIcon color="#AEAEB2" />
                        <Text style={styles.saveLaterText}>Save for later</Text>
                    </Pressable>
                </View>
            )}
        </>
    );

    useEffect(() => {
        const unsubscribe = PostService.subscribeToFeed((updatedPosts) => {
            setPosts(updatedPosts);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (challenge) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(20);
        }
    }, [challenge]);

    const handleSpinEnd = async () => {
        setIsGenerating(true);
        try {
            const newChallenge = await AIService.generateChallenge(userProfile);
            setChallenge(newChallenge);
            setReaction(null);
        } catch (error) {
            console.error("Spin Error:", error);
            setChallenge("Take a photo of something that reminds you of silence.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <View style={[styles.container, darkMode && styles.containerDark]}>
            <StatusBar style={darkMode ? "light" : "dark"} />
            <SafeAreaView
                style={styles.safeArea}
                {...panResponder.panHandlers}
                renderToHardwareTextureAndroid={true}
            >
                <View style={styles.mainContainer}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerText}>SPINDARE</Text>
                    </View>

                    {/* Central Content */}
                    <View style={styles.centerSection}>
                        {!challenge ? (
                            <View style={styles.wheelWrapper}>
                                <SpinWheel options={CHALLENGES} onSpinEnd={handleSpinEnd} canSpin={!isGenerating} />
                                <View style={styles.instructionContainer}>
                                    <View style={styles.swipeIndicator} />
                                    <Text style={styles.instructionText}>
                                        {isGenerating ? "Consulting the AI..." : "Spin the wheel"}
                                    </Text>
                                    <Text style={styles.instructionSubtext}>or swipe up for feed</Text>
                                </View>
                            </View>
                        ) : (
                            <Animated.View
                                style={[
                                    styles.challengeContainer,
                                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                                ]}
                            >
                                {Platform.OS === 'ios' ? (
                                    <BlurView
                                        intensity={40}
                                        tint={darkMode ? "dark" : "light"}
                                        style={styles.blurCard}
                                    >
                                        <View style={styles.cardGradient}>
                                            {renderChallengeCardContent()}
                                        </View>
                                    </BlurView>
                                ) : (
                                    <View style={[styles.blurCard, { backgroundColor: darkMode ? '#1C1C1E' : '#FFF' }]}>
                                        <View style={styles.cardGradient}>
                                            {renderChallengeCardContent()}
                                        </View>
                                    </View>
                                )}

                                <Pressable
                                    onPress={() => setChallenge(null)}
                                    style={({ pressed }) => [
                                        styles.resetButton,
                                        { opacity: pressed ? 0.5 : 1 }
                                    ]}
                                >
                                    <Text style={styles.resetText}>New Challenge</Text>
                                </Pressable>
                            </Animated.View>
                        )}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Swipe up for community • {new Date().toLocaleDateString()}</Text>
                    </View>

                </View>
            </SafeAreaView>

            {/* Feed Overlay */}
            <Animated.View
                style={[
                    styles.feedOverlay,
                    { transform: [{ translateY: feedTransitionAnim }] }
                ]}
                {...feedPanResponder.panHandlers}
                renderToHardwareTextureAndroid={true}
                pointerEvents={isFeedVisible ? 'auto' : 'none'}
            >
                {isFeedVisible && (
                    <FeedScreen
                        posts={posts}
                        currentUserId={auth.currentUser?.uid}
                    />
                )}
            </Animated.View>

            {/* Post Creator Overlay */}
            <Animated.View
                style={[
                    styles.postOverlay,
                    { transform: [{ translateY: postTransitionAnim }] }
                ]}
                renderToHardwareTextureAndroid={true}
                pointerEvents={isPosting ? 'auto' : 'none'}
            >
                {isPosting && (
                    <PostCreationScreen
                        challenge={challenge || ''}
                        imageUri={selectedImage}
                        onClose={hidePostCreator}
                        onPost={handlePostSubmit}
                    />
                )}
            </Animated.View>

            {/* Share Overlay */}
            <Animated.View
                style={[
                    styles.shareOverlay,
                    { transform: [{ translateY: shareTransitionAnim }] }
                ]}
                pointerEvents={isSharing ? 'auto' : 'none'}
            >
                {isSharing && (
                    <FriendsListScreen
                        challenge={challenge || ''}
                        onClose={hideShare}
                    />
                )}
            </Animated.View>


        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
    mainContainer: { flex: 1, paddingHorizontal: 32, justifyContent: 'space-between', paddingVertical: height * 0.05 },
    header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    headerText: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: 6, textTransform: 'uppercase' },
    centerSection: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    wheelWrapper: { alignItems: 'center' },
    instructionContainer: { marginTop: 60, alignItems: 'center' },
    instructionText: { color: '#8E8E93', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 },
    instructionSubtext: { color: '#AEAEB2', fontSize: 12, fontWeight: '400' },
    challengeContainer: { width: '100%', alignItems: 'center' },
    blurCard: {
        padding: 36,
        borderRadius: 48,
        borderWidth: 2,
        borderColor: 'rgba(167, 187, 199, 0.2)',
        width: '100%',
        overflow: 'hidden',
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    cardGradient: {
        width: '100%',
    },
    cardHeader: { alignItems: 'center', marginBottom: 24 },
    cardLine: { width: 40, height: 1.5, backgroundColor: 'rgba(0,0,0,0.03)' },
    challengeText: {
        color: '#2C2C2C',
        fontSize: 26,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 38,
        marginBottom: 40,
        minHeight: 140,
        textAlignVertical: 'center',
        letterSpacing: -0.5,
    },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 10, width: '100%' },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FAF9F6',
        gap: 10,
        borderWidth: 2,
        borderColor: '#D1D1D1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    primaryActionBtn: {
        backgroundColor: '#4A4A4A',
        borderColor: '#4A4A4A',
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    actionBtnText: { color: '#8E8E93', fontSize: 14, fontWeight: '600', letterSpacing: 1.5 },
    proofContainer: { marginTop: 10, width: '100%', alignItems: 'center' },
    proofIconsRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
    proofIconBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.1)',
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    saveLaterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
    saveLaterText: { color: '#A7BBC7', fontSize: 13, fontWeight: '500' },
    resetButton: { marginTop: 48, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    resetText: { color: '#AEAEB2', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 2 },
    footer: { alignItems: 'center', paddingBottom: 20 },
    footerText: { color: '#AEAEB2', fontSize: 9, fontWeight: '400', letterSpacing: 2 },
    swipeIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 24 },
    feedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    postOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
    shareOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
    mediaOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 },
    containerDark: { backgroundColor: '#1C1C1E' },
});
