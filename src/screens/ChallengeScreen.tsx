import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Platform, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { useToast } from '../contexts/ToastContext';
import { ReactionButton } from '../components/atoms/ReactionButton';
import { AIService, UserProfile } from '../services/AIService';
import { Post, PostService } from '../services/PostService';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Wheel display segments (visual only — what the spinning wheel shows)
const WHEEL_SEGMENTS = [
    "Photograph silence", "Write the unsaid", "Ask a stranger",
    "Walk screenless", "Draw your mood", "Chase a shadow",
    "Fix something broken", "Watch the sky", "Write the unsent",
    "Eat undistracted", "Sit in silence", "Touch textures",
    "Ignore the mirror", "Spot the unnoticed", "Just listen",
    "Do it now", "Change your route", "Be present",
    "Create something", "Move your body",
];

// Full local challenge pool — spin picks from here instantly (no AI call)
const LOCAL_CHALLENGES = [
    // ── Observation ──────────────────────────────────────────────────────────
    "Photograph something that reminds you of silence.",
    "Photograph something that no one else would notice.",
    "Find the most interesting texture within 10 steps of you.",
    "Stare at the sky for exactly 60 seconds.",
    "Watch people pass by for 5 minutes without touching your phone.",
    "Find a shadow and trace its outline with your finger.",
    "Look for something beautiful you'd normally walk straight past.",
    "Spot one thing in your environment that doesn't belong.",
    "Find the oldest object within 5 metres of you.",
    "Notice 5 sounds you've never paid attention to before.",
    "Find something that's been in the same place for years.",
    "Look at a familiar place as if it's your first time seeing it.",
    "Find the most ordinary object near you and make it interesting.",
    "Photograph your shadow at this exact moment.",
    "Find something that's perfectly symmetrical.",
    "Look up. What's above you that you never notice?",
    "Find the most forgotten thing in the room.",
    "Spot something that's been broken but still being used.",
    "Find a colour you haven't seen today until now.",
    "Photograph something that moves but isn't alive.",
    // ── Reflection ───────────────────────────────────────────────────────────
    "Write one thing you've never told anyone.",
    "Write a letter you'll never send.",
    "Write 3 things you're genuinely proud of this week.",
    "Write down what you were thinking about before you picked up your phone.",
    "Write your current mood as a weather report.",
    "Write the name of one person who made you better.",
    "Write what you'd say to yourself a year ago.",
    "Write one honest thing about today.",
    "Write down a fear you've never said out loud.",
    "Write one goal. Give it a deadline. Put it somewhere you'll see it.",
    "Write what you want more of. Write what you want less of.",
    "Think about someone you've been meaning to contact. Do it now.",
    "Identify one thing you're avoiding. Decide if today's the day.",
    "Think of your last 24 hours. What's one moment worth keeping?",
    "What's one belief you hold that you've never questioned?",
    "Reflect on a mistake you made. What would you do differently?",
    "Name 3 things that are going right that you haven't appreciated.",
    "Think of the last time you felt genuinely proud. What caused it?",
    "What would you do today if you knew no one was watching?",
    "Write your ideal day. Every hour. In detail.",
    // ── Social ───────────────────────────────────────────────────────────────
    "Ask a stranger what their favourite memory is.",
    "Compliment someone in a way that's specific, not generic.",
    "Start a conversation with someone you usually only nod at.",
    "Text someone you haven't spoken to in over a month.",
    "Call someone instead of texting them today.",
    "Tell someone something you appreciate about them — out loud.",
    "Ask someone what they're most excited about right now.",
    "Listen to someone for 5 minutes without interrupting once.",
    "Help someone with something without being asked.",
    "Make someone laugh today. It counts even if it's small.",
    "Say yes to a social plan you'd normally decline.",
    "Ask an older person about their biggest lesson in life.",
    "Do something kind anonymously.",
    "Ask someone about their weekend — and actually listen.",
    "Introduce yourself to someone you've seen around but never spoken to.",
    "Send a voice note instead of a text today.",
    "Tell someone how much they mean to you. Actually tell them.",
    "Ask someone what they're struggling with right now.",
    "Smile first at the next 5 people you see.",
    "Write a review for someone's work or business who deserves it.",
    // ── Movement ─────────────────────────────────────────────────────────────
    "Walk 10 minutes without looking at any screen.",
    "Take a completely different route to somewhere familiar.",
    "Walk somewhere with no destination for 15 minutes.",
    "Go outside right now. No reason needed.",
    "Do 20 pushups before you do anything else.",
    "Hold a plank for 1 minute.",
    "Stretch every part of your body for 5 minutes.",
    "Run for 5 minutes at a pace you haven't tried before.",
    "Do 30 squats.",
    "Walk to the furthest point you can see, then keep going.",
    "Take the stairs instead of the lift all day.",
    "Do 10 jumping jacks every hour for the rest of the day.",
    "Find a hill. Walk up it.",
    "Stand somewhere unfamiliar for 5 minutes and just exist there.",
    "Walk somewhere without headphones. Notice what changes.",
    "Do a 10-minute stretch. Actually 10 minutes.",
    "Walk somewhere you've never been in your neighbourhood.",
    "Explore a part of your city you've driven through but never walked.",
    "Sit on the floor. Stretch. Think.",
    "Move your body right now for exactly 2 minutes.",
    // ── Creativity ───────────────────────────────────────────────────────────
    "Draw how you feel using only circles.",
    "Eat your next meal with zero distractions.",
    "Draw something you can see in under 3 minutes.",
    "Write 10 ideas — any ideas. Quantity over quality.",
    "Make something with whatever is within arm's reach.",
    "Write a poem. It doesn't need to be good.",
    "Build something. Anything. With anything nearby.",
    "Sketch your current view in 90 seconds.",
    "Create a playlist that matches your exact mood right now.",
    "Take 10 photos that tell a story without words.",
    "Design your dream space. Describe it in detail.",
    "Write a short story in under 5 minutes. Go.",
    "Draw your day so far as a map.",
    "Find an object and give it a backstory.",
    "Rearrange something around you. Notice how it changes the feel.",
    "Write the opening line of a book you'd actually read.",
    "Invent a simple rule for your day and follow it.",
    "Take one great photo. Only one. Make it count.",
    "Write 5 questions you've never thought to ask.",
    "Describe yourself in exactly 6 words.",
    // ── Presence ─────────────────────────────────────────────────────────────
    "Touch 5 different textures in the next 5 minutes.",
    "Close your eyes for 3 minutes and just listen.",
    "Spend 2 hours in complete silence.",
    "Go the whole day without checking how you look.",
    "Sit somewhere quietly for 10 minutes. No phone. No music.",
    "Put your phone face down for the next 30 minutes.",
    "Avoid social media entirely until after 6pm.",
    "Eat your next meal without any screen in sight.",
    "Stay off your phone for the first hour after waking up.",
    "Be still for 5 minutes. Just breathe.",
    "Stop multitasking for the next hour. One thing at a time.",
    "Notice 3 things you can feel right now. Focus on each for 30 seconds.",
    "Notice 3 things you can hear. Focus on each for 30 seconds.",
    "Take 10 deep breaths. Actually slow ones.",
    "Sit in natural light for 10 minutes and do nothing.",
    "Go one hour with all notifications off.",
    "Meditate for 5 minutes. No app needed.",
    "Finish your next meal before picking up your phone.",
    "Stay present for one full conversation. No distraction.",
    "Observe one thing in your environment changing in real time.",
    // ── Challenge ────────────────────────────────────────────────────────────
    "Do the hardest thing on your to-do list first.",
    "Finish something you've been putting off for a week.",
    "Say no to the next thing you want to say yes to out of obligation.",
    "Do one thing today that slightly scares you.",
    "Start something you've been 'about to start' for a month.",
    "Fix something broken in your space that you've been ignoring.",
    "Delete something on your phone you haven't used in 3 months.",
    "Clean one space you've been avoiding.",
    "Have a conversation you've been putting off.",
    "Do one thing without checking if it's perfect first.",
    "Wake up earlier than usual tomorrow. Decide now what you'll do with that time.",
    "Choose one screen to turn off for the day.",
    "Set one boundary you've been meaning to set.",
    "Ask for something you need but haven't asked for.",
    "Do something for future-you that present-you doesn't feel like doing.",
    "Commit to one habit for the next 7 days. Write it down.",
    "Spend 30 minutes on something creative, not productive.",
    "Take a full break — no guilt — for 20 minutes.",
    "Pick one thing to stop doing. Decide right now.",
    "Do something that has no ROI except making you feel alive.",
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
import { SoundService } from '../services/SoundService';
import { SocialService } from '../services/SocialService';
import { useTheme } from '../contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export const ChallengeScreen = () => {
    const { darkMode } = useTheme();
    const { showToast } = useToast();
    const [challenge, setChallenge] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    // ... rest of state
    const [isFeedVisible, setIsFeedVisible] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);
    const [isAIChallenge, setIsAIChallenge] = useState(false);
    const [proofMode, setProofMode] = useState(false);
    const [lastRejectTimestamp, setLastRejectTimestamp] = useState<number | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);

    // ... mocked user profile logic ...
    const { isLoaded, userId, isSignedIn } = useAuth();
    const { user: clerkUser } = useUser();

    // Sync clerk user data to a local profile object for AIService compatibility
    const userProfile: UserProfile = {
        username: clerkUser?.username || clerkUser?.firstName || "User",
        email: clerkUser?.primaryEmailAddress?.emailAddress || "",
        hobbies: ["Photography", "Gaming", "Art"], // These could be fetched from Supabase later
        studyFields: ["Computer Science"],
        photoURL: clerkUser?.imageUrl,
        xp: 248,
        level: 3
    };

    if (!isLoaded || !isSignedIn) {
        return null; // App.tsx handles SignedOut state
    }


    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const cardScale = useRef(new Animated.Value(0.92)).current;
    const actionBtnAnim1 = useRef(new Animated.Value(0)).current;
    const actionBtnAnim2 = useRef(new Animated.Value(0)).current;
    const proofIconAnim1 = useRef(new Animated.Value(0)).current;
    const proofIconAnim2 = useRef(new Animated.Value(0)).current;
    const proofIconAnim3 = useRef(new Animated.Value(0)).current;

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
        SoundService.tap();
        setReaction(type);

        if (type === 'camera') {
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showToast('Permission to access camera is required to take photos.', { type: 'error' });
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
                showToast('Permission to access gallery is required to select photos.', { type: 'error' });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
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
                    userId || 'guest',
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
                {isAIChallenge && (
                    <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>✦ AI</Text>
                    </View>
                )}
            </View>

            <Text style={styles.challengeText}>
                {challenge}
            </Text>

            {!proofMode && !isAIChallenge && (
                <Pressable
                    onPress={handleAIPersonalise}
                    disabled={isAILoading}
                    style={styles.personaliseBtn}
                >
                    {isAILoading ? (
                        <Text style={styles.personaliseBtnText}>Personalising...</Text>
                    ) : (
                        <Text style={styles.personaliseBtnText}>✦ Personalise with AI</Text>
                    )}
                </Pressable>
            )}

            {!proofMode ? (
                <View style={styles.actionRow}>
                    <Animated.View
                        style={[
                            styles.actionBtnWrapper,
                            {
                                opacity: actionBtnAnim1,
                                transform: [
                                    { translateY: actionBtnAnim1.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                                ],
                            }
                        ]}
                        renderToHardwareTextureAndroid={true}
                    >
                        <Pressable style={styles.actionBtn} onPress={showShare}>
                            <ShareIcon color="#8E8E93" />
                            <Text style={styles.actionBtnText}>SEND</Text>
                        </Pressable>
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.actionBtnWrapper,
                            {
                                opacity: actionBtnAnim2,
                                transform: [
                                    { translateY: actionBtnAnim2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                                ],
                            }
                        ]}
                        renderToHardwareTextureAndroid={true}
                    >
                        <Pressable style={[styles.actionBtn, styles.primaryActionBtn]} onPress={() => setProofMode(true)}>
                            <CheckIcon color="#FAF9F6" />
                            <Text style={[styles.actionBtnText, { color: '#FAF9F6' }]}>DO IT</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            ) : (
                <View style={styles.proofContainer}>
                    <View style={styles.proofIconsRow}>
                        <Animated.View
                            style={[
                                {
                                    opacity: proofIconAnim1,
                                    transform: [
                                        { scale: proofIconAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                                        { translateY: proofIconAnim1.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                                    ],
                                }
                            ]}
                            renderToHardwareTextureAndroid={true}
                        >
                            <Pressable
                                style={styles.proofIconBtn}
                                onPressIn={() => {
                                    Animated.spring(proofIconAnim1, {
                                        toValue: 0.88,
                                        useNativeDriver: true,
                                        friction: 3,
                                        tension: 180,
                                    }).start();
                                }}
                                onPressOut={() => {
                                    Animated.sequence([
                                        Animated.spring(proofIconAnim1, {
                                            toValue: 1.1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                        Animated.spring(proofIconAnim1, {
                                            toValue: 1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                    ]).start();
                                }}
                                onPress={() => handleMediaAction('camera')}
                            >
                                <CameraIcon color="#FAF9F6" />
                            </Pressable>
                        </Animated.View>
                        <Animated.View
                            style={[
                                {
                                    opacity: proofIconAnim2,
                                    transform: [
                                        { scale: proofIconAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                                        { translateY: proofIconAnim2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                                    ],
                                }
                            ]}
                            renderToHardwareTextureAndroid={true}
                        >
                            <Pressable
                                style={styles.proofIconBtn}
                                onPressIn={() => {
                                    Animated.spring(proofIconAnim2, {
                                        toValue: 0.88,
                                        useNativeDriver: true,
                                        friction: 3,
                                        tension: 180,
                                    }).start();
                                }}
                                onPressOut={() => {
                                    Animated.sequence([
                                        Animated.spring(proofIconAnim2, {
                                            toValue: 1.1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                        Animated.spring(proofIconAnim2, {
                                            toValue: 1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                    ]).start();
                                }}
                                onPress={() => handleMediaAction('gallery')}
                            >
                                <GalleryIcon color="#FAF9F6" />
                            </Pressable>
                        </Animated.View>
                        <Animated.View
                            style={[
                                {
                                    opacity: proofIconAnim3,
                                    transform: [
                                        { scale: proofIconAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                                        { translateY: proofIconAnim3.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                                    ],
                                }
                            ]}
                            renderToHardwareTextureAndroid={true}
                        >
                            <Pressable
                                style={styles.proofIconBtn}
                                onPressIn={() => {
                                    Animated.spring(proofIconAnim3, {
                                        toValue: 0.88,
                                        useNativeDriver: true,
                                        friction: 3,
                                        tension: 180,
                                    }).start();
                                }}
                                onPressOut={() => {
                                    Animated.sequence([
                                        Animated.spring(proofIconAnim3, {
                                            toValue: 1.1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                        Animated.spring(proofIconAnim3, {
                                            toValue: 1,
                                            useNativeDriver: true,
                                            friction: 3,
                                            tension: 180,
                                        }),
                                    ]).start();
                                }}
                                onPress={() => handleMediaAction('text')}
                            >
                                <TextIcon color="#FAF9F6" />
                            </Pressable>
                        </Animated.View>
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
                Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 50 })
            ]).start();
            setTimeout(() => {
                Animated.stagger(80, [
                    Animated.spring(actionBtnAnim1, { toValue: 1, useNativeDriver: true, friction: 6, tension: 40 }),
                    Animated.spring(actionBtnAnim2, { toValue: 1, useNativeDriver: true, friction: 6, tension: 40 }),
                ]).start();
            }, 300);
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(20);
            cardScale.setValue(0.92);
            actionBtnAnim1.setValue(0);
            actionBtnAnim2.setValue(0);
        }
    }, [challenge]);

    const handleSpinEnd = () => {
        // Instant local pick — no AI call, no loading state
        const random = LOCAL_CHALLENGES[Math.floor(Math.random() * LOCAL_CHALLENGES.length)];
        setChallenge(random);
        setReaction(null);
        setIsAIChallenge(false);
        SoundService.spinLand();
    };

    const handleAIPersonalise = async () => {
        if (isAILoading) return;
        setIsAILoading(true);
        SoundService.tap();
        try {
            const aiChallenge = await AIService.generateChallenge({
                ...userProfile,
                userId: userId || 'anonymous',
            });
            setChallenge(aiChallenge);
            setIsAIChallenge(true);
            SoundService.challengeDone();
        } catch (err) {
            console.error("AI personalise error:", err);
            showToast('Could not personalise the challenge right now.', { type: 'error' });
        } finally {
            setIsAILoading(false);
        }
    };

    const canRejectAgain = () => {
        return !lastRejectTimestamp || Date.now() - lastRejectTimestamp > 5 * 60 * 1000;
    };

    const handleSaveForLater = async () => {
        if (!challenge) return;

        if (userId) {
            try {
                await SocialService.saveChallenge(userId, challenge);
                showToast('Saved challenge for later');
            } catch (err) {
                console.warn('Save for later failed:', err);
                showToast('Could not save challenge right now.', { type: 'error' });
            }
        }

        setChallenge(null);
        setProofMode(false);
        setReaction(null);
    };

    const handleRejectChallenge = async () => {
        if (!canRejectAgain() || isAILoading) return;

        setIsAILoading(true);
        SoundService.tap();

        try {
            const aiChallenge = await AIService.generateChallenge({
                ...userProfile,
                userId: userId || 'anonymous',
            });
            setChallenge(aiChallenge);
            setIsAIChallenge(true);
            setLastRejectTimestamp(Date.now());
            SoundService.challengeDone();
        } catch (err) {
            console.error('Challenge reroll failed:', err);
            showToast('Could not get a new challenge. Try again later.', { type: 'error' });
        } finally {
            setIsAILoading(false);
        }
    };

    const renderChallengeControls = () => {
        if (!challenge || proofMode) return null;

        return (
            <View style={styles.bottomControls}>
                <Pressable style={styles.saveLaterBtn} onPress={handleSaveForLater}>
                    <ClockIcon color="#AEAEB2" />
                    <Text style={styles.saveLaterText}>Save for later</Text>
                </Pressable>
                <Pressable
                    style={[styles.rejectBtn, !canRejectAgain() && styles.disabledButton]}
                    onPress={handleRejectChallenge}
                    disabled={!canRejectAgain() || isAILoading}
                >
                    <Text style={[styles.saveLaterText, !canRejectAgain() && { color: '#8E8E93' }]}> 
                        {isAILoading ? 'Generating...' : 'Not this one'}
                    </Text>
                </Pressable>
                {!canRejectAgain() && (
                    <Text style={styles.saveLaterHint}>One retry every 5 minutes</Text>
                )}
            </View>
        );
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
                                <SpinWheel
                                    options={WHEEL_SEGMENTS}
                                    onSpinEnd={handleSpinEnd}
                                    onSpinStart={SoundService.spinStart}
                                    canSpin={!isGenerating}
                                />
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
                                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: cardScale }] }
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

                                {renderChallengeControls()}

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
                        currentUserId={userId || undefined}
                        currentUsername={userProfile.username}
                        currentAvatar={userProfile.photoURL || null}
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
                        currentUserId={userId || ''}
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
    headerText: { color: '#4A4A4A', fontSize: 13, fontWeight: '500', letterSpacing: 6, textTransform: 'uppercase', paddingRight: Platform.OS === 'android' ? 6 : 0 },
    centerSection: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    wheelWrapper: { alignItems: 'center' },
    instructionContainer: { marginTop: 60, alignItems: 'center' },
    instructionText: { color: '#8E8E93', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, paddingRight: Platform.OS === 'android' ? 6 : 0 },
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
    cardHeader: { alignItems: 'center', marginBottom: 24, flexDirection: 'row', justifyContent: 'center', gap: 8 },
    cardLine: { width: 40, height: 1.5, backgroundColor: 'rgba(0,0,0,0.03)' },
    aiBadge: {
        backgroundColor: 'rgba(88, 86, 214, 0.12)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    aiBadgeText: {
        color: '#5856D6',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    personaliseBtn: {
        alignSelf: 'center',
        marginTop: -24,
        marginBottom: 20,
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(88, 86, 214, 0.3)',
        backgroundColor: 'rgba(88, 86, 214, 0.06)',
    },
    personaliseBtnText: {
        color: '#5856D6',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
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
    actionBtnText: { color: '#8E8E93', fontSize: 14, fontWeight: '600', letterSpacing: 1.5, paddingRight: Platform.OS === 'android' ? 6 : 0 },
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
    saveLaterBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: '#E9EFF5',
        borderWidth: 1,
        borderColor: '#D1D1D6',
        marginTop: 16,
    },
    saveLaterText: { color: '#2D3A4B', fontSize: 14, fontWeight: '600' },
    bottomControls: { marginTop: 16, width: '100%' },
    rejectBtn: {
        width: '100%',
        marginTop: 10,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: '#DDE3EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: { opacity: 0.55 },
    saveLaterHint: { marginTop: 8, color: '#7E8D9D', fontSize: 12, textAlign: 'center' },
    resetButton: { marginTop: 48, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    resetText: { color: '#AEAEB2', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 2, paddingRight: Platform.OS === 'android' ? 6 : 0 },
    footer: { alignItems: 'center', paddingBottom: 20 },
    footerText: { color: '#AEAEB2', fontSize: 9, fontWeight: '400', letterSpacing: 2 },
    swipeIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 24 },
    feedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    postOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
    shareOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
    mediaOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 },
    containerDark: { backgroundColor: '#1C1C1E' },
});
