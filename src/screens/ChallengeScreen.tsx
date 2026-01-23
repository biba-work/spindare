import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { ReactionButton } from '../components/atoms/ReactionButton';
import { AIService, UserProfile } from '../services/AIService';

const { width, height } = Dimensions.get('window');

const CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favorite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
];

import { FeedScreen } from './FeedScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { FriendsListScreen } from './FriendsListScreen';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';

export const ChallengeScreen = () => {
    const [challenge, setChallenge] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    const [isFeedVisible, setIsFeedVisible] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Mock user profile for now
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

    const handlePostSubmit = (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => {
        console.log('Post submitted:', content, imageUri, target);
        hidePostCreator();

        if (target === 'friend') {
            setTimeout(() => {
                showShare();
            }, 500);
        } else {
            // In a real app, you'd save it to a database/local state here
            setTimeout(() => {
                showFeed(); // Show the feed after posting
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

            <View style={styles.reactionsRow}>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="text"
                        label="send text"
                        selected={reaction === 'text'}
                        onPress={() => handleMediaAction('text')}
                    />
                </View>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="camera"
                        label="camera"
                        selected={reaction === 'camera'}
                        onPress={() => handleMediaAction('camera')}
                    />
                </View>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="gallery"
                        label="gallery"
                        selected={reaction === 'gallery'}
                        onPress={() => handleMediaAction('gallery')}
                    />
                </View>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="send"
                        label="send"
                        selected={reaction === 'send'}
                        onPress={() => {
                            setReaction('send');
                            showShare();
                        }}
                    />
                </View>
            </View>
        </>
    );

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
        <View style={styles.container}>
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
                                        intensity={30}
                                        tint="dark"
                                        style={styles.blurCard}
                                    >
                                        {renderChallengeCardContent()}
                                    </BlurView>
                                ) : (
                                    <View style={[styles.blurCard, { backgroundColor: '#1a1a1c' }]}>
                                        {renderChallengeCardContent()}
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
                {isFeedVisible && <FeedScreen />}
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
    safeArea: {
        flex: 1,
        backgroundColor: '#0c0c0e', // Very dark gray/black
    },
    mainContainer: {
        flex: 1,
        paddingHorizontal: 24, // Reduced from 32 for better 14 Pro fit
        justifyContent: 'space-between',
        paddingVertical: height * 0.05,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 4,
        fontFamily: 'Inter_400Regular',
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 12,
    },
    headerSubtext: {
        color: '#FFFFFF',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
        opacity: 0.4,
    },
    centerSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    wheelWrapper: {
        alignItems: 'center',
    },
    instructionContainer: {
        marginTop: 60,
        alignItems: 'center',
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 3,
        fontFamily: 'Inter_400Regular',
        marginBottom: 8,
    },
    instructionSubtext: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    challengeContainer: {
        width: '100%',
        alignItems: 'center',
    },
    blurCard: {
        padding: 24, // Reduced from 40 for better fit on 14 Pro
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        width: '100%',
        overflow: 'hidden',
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    cardLine: {
        width: 40,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    challengeText: {
        color: '#FFFFFF',
        fontSize: 26, // Reduced from 30
        fontFamily: 'Montserrat_400Regular',
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 40,
        minHeight: 120,
        textAlignVertical: 'center',
    },
    reactionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Changed to between for better distribution
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        paddingTop: 20,
        width: '100%',
    },
    reactionItem: {
        flex: 1,
        alignItems: 'center',
    },
    resetButton: {
        marginTop: 40,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    resetText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
    },
    container: {
        flex: 1,
        backgroundColor: '#0c0c0e',
    },
    swipeIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    feedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
    postOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
    },
    shareOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
    },
    mediaOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
    },
});
