import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { ReactionButton } from '../components/atoms/ReactionButton';

const { width, height } = Dimensions.get('window');

const CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favorite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
];

import { PanResponder } from 'react-native';
import { FeedScreen } from './FeedScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { MediaSelectionScreen } from './MediaSelectionScreen';

export const ChallengeScreen = () => {
    const [challenge, setChallenge] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    const [isFeedVisible, setIsFeedVisible] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isMediaSelecting, setIsMediaSelecting] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    // Animations for transitions
    const feedTransitionAnim = useRef(new Animated.Value(height)).current;
    const postTransitionAnim = useRef(new Animated.Value(height)).current;
    const shareTransitionAnim = useRef(new Animated.Value(height)).current;
    const mediaTransitionAnim = useRef(new Animated.Value(height)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Set pan responder if swiping up significantly and not in sub-screens
                return gestureState.dy < -50 && !isFeedVisible && !isPosting && !isSharing && !isMediaSelecting;
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

    const showMediaSelector = () => {
        setIsMediaSelecting(true);
        Animated.spring(mediaTransitionAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    };

    const hideMediaSelector = () => {
        Animated.timing(mediaTransitionAnim, {
            toValue: height,
            duration: 400,
            useNativeDriver: true,
        }).start(() => setIsMediaSelecting(false));
    };

    const handleMediaSelect = (type: 'camera' | 'gallery' | 'text', imageUri?: string) => {
        console.log('Media selected:', type, imageUri);
        setSelectedImage(imageUri || null);
        hideMediaSelector();
        // Delay opening the post creator for a smoother transition
        setTimeout(() => {
            showPostCreator();
        }, 400);
    };

    const handlePostSubmit = (content: string) => {
        console.log('Post submitted:', content);
        hidePostCreator();
        // In a real app, you'd save it to a database/local state here
        setTimeout(() => {
            showFeed(); // Show the feed after posting
        }, 500);
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
                        type="send"
                        label="send to a friend"
                        selected={reaction === 'send'}
                        onPress={() => {
                            setReaction('send');
                            showShare();
                        }}
                    />
                </View>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="do"
                        label="do it now"
                        selected={reaction === 'do'}
                        onPress={() => {
                            setReaction('do');
                            showMediaSelector();
                        }}
                    />
                </View>
                <View style={styles.reactionItem}>
                    <ReactionButton
                        type="save"
                        label="save for later"
                        selected={reaction === 'save'}
                        onPress={() => setReaction('save')}
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

    const handleSpinEnd = () => {
        const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        setChallenge(randomChallenge);
        setReaction(null);
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
                                <SpinWheel options={CHALLENGES} onSpinEnd={handleSpinEnd} canSpin={true} />
                                <View style={styles.instructionContainer}>
                                    <View style={styles.swipeIndicator} />
                                    <Text style={styles.instructionText}>Spin the wheel</Text>
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

            {/* Media Selector Overlay */}
            <Animated.View
                style={[
                    styles.mediaOverlay,
                    { transform: [{ translateY: mediaTransitionAnim }] }
                ]}
                pointerEvents={isMediaSelecting ? 'auto' : 'none'}
            >
                {isMediaSelecting && (
                    <MediaSelectionScreen
                        challenge={challenge || ''}
                        onClose={hideMediaSelector}
                        onSelect={handleMediaSelect}
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
