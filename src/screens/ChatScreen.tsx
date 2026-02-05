import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ImageBackground, Platform, ActivityIndicator, Pressable, Image, KeyboardAvoidingView } from 'react-native';
import { GiftedChat, IMessage, Bubble, InputToolbar, Send, Time, Composer, BubbleProps, InputToolbarProps, SendProps, TimeProps, ComposerProps } from 'react-native-gifted-chat';
import { collection, addDoc, orderBy, query, onSnapshot, serverTimestamp, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { SocialService } from '../services/SocialService';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

// --- Icons ---
const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const OptionsIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="1" />
        <Circle cx="12" cy="5" r="1" />
        <Circle cx="12" cy="19" r="1" />
    </Svg>
);

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

// --- Types ---
export interface UserProfileChat {
    _id: string; // Using _id to match GiftedChat requirement
    name: string;
    avatar: string;
}

export interface ChatScreenProps {
    otherUser: UserProfileChat;
    currentUser: UserProfileChat;
    onBack: () => void;
}

export const ChatScreen = ({ otherUser, currentUser, onBack }: ChatScreenProps) => {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const { darkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [isLoading, setIsLoading] = useState(true);
    const [isGhosted, setIsGhosted] = useState(false);
    const [iHaveGhosted, setIHaveGhosted] = useState(false);

    // Generate Conversation ID: uid1_uid2 sorted alphabetically
    const conversationId = [currentUser._id, otherUser._id].sort().join('_');

    useLayoutEffect(() => {
        setIsLoading(true);
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMessages = snapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamp to Date
                const createdAt = data.createdAt instanceof Timestamp
                    ? data.createdAt.toDate()
                    : new Date(); // Fallback for pending writes

                return {
                    _id: doc.id,
                    text: data.text,
                    createdAt: createdAt,
                    user: data.user,
                } as IMessage;
            });
            setMessages(loadedMessages);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [conversationId]);

    useEffect(() => {
        checkGhostStatus();
    }, []);

    const checkGhostStatus = async () => {
        const ghostedByMe = await SocialService.checkIsGhosted(otherUser._id);
        const ghostedByThem = await SocialService.checkIsGhostedBy(otherUser._id);
        setIHaveGhosted(ghostedByMe);
        setIsGhosted(ghostedByThem);
    };

    const handleGhostPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            "Ghost User?",
            "Once you ghost someone, it will not be possible to contact you anymore.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Ghost",
                    style: "destructive",
                    onPress: async () => {
                        await SocialService.ghostUser(otherUser._id);
                        setIHaveGhosted(true);
                        // Optionally navigate back or show confirmation
                        onBack();
                    }
                }
            ]
        );
    };

    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        const msg = newMessages[0];
        if (!msg) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // 1. Add to sub-collection
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        await addDoc(messagesRef, {
            text: msg.text,
            createdAt: serverTimestamp(),
            user: msg.user,
        });

        // 2. Update conversation metadata
        const conversationRef = doc(db, 'conversations', conversationId);
        await setDoc(conversationRef, {
            participants: [currentUser._id, otherUser._id],
            lastMessage: msg.text,
            lastMessageTimestamp: serverTimestamp(),
            users: {
                [currentUser._id]: currentUser,
                [otherUser._id]: otherUser
            }
        }, { merge: true });

    }, [conversationId, currentUser, otherUser]);

    // --- Custom UI Renderers for Glassmorphism ---

    const renderBubble = useCallback((props: BubbleProps<IMessage>) => {
        const { ...rest } = props;
        return (
            <Bubble
                {...rest}
                wrapperStyle={{
                    left: {
                        backgroundColor: darkMode ? '#2C2C2E' : '#E5E5EA',
                        borderRadius: 18,
                        padding: 4,
                        borderBottomLeftRadius: 4,
                        maxWidth: '80%', // Limit width
                    },
                    right: {
                        backgroundColor: '#4A4A4A',
                        borderRadius: 18,
                        padding: 4,
                        borderBottomRightRadius: 4,
                        maxWidth: '80%', // Limit width
                        // Fix for dark mode dark bubble
                        ...(darkMode ? { backgroundColor: '#3A3A3C' } : {})
                    },
                }}
                textStyle={{
                    left: {
                        color: darkMode ? '#FFF' : '#1C1C1E',
                    },
                    right: {
                        color: '#FFF',
                    }
                }}
            />
        );
    }, [darkMode]);

    const renderInputToolbar = useCallback((props: InputToolbarProps<IMessage>) => {
        const { ...rest } = props;
        return (
            <InputToolbar
                {...rest}
                containerStyle={{
                    backgroundColor: darkMode ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.9)',
                    borderTopWidth: 1,
                    borderTopColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    paddingTop: 8,
                    paddingBottom: insets.bottom + 8, // Handle safe area manually
                }}
                primaryStyle={{ alignItems: 'center' }}
            />
        );
    }, [darkMode, insets.bottom]);

    const renderComposer = useCallback((props: ComposerProps) => {
        const { ...rest } = props;
        return (
            <Composer
                {...rest}
                textInputStyle={{
                    color: darkMode ? '#FFF' : '#1C1C1E',
                    backgroundColor: darkMode ? '#2C2C2E' : '#F2F2F7',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    paddingBottom: 8,
                    marginRight: 10,
                    marginLeft: 10,
                }}
                placeholderTextColor={darkMode ? "#8E8E93" : "#AEAEB2"}
            />
        );
    }, [darkMode]);

    const renderSend = useCallback((props: SendProps<IMessage>) => {
        const { ...rest } = props;
        return (
            <Send
                {...rest}
                containerStyle={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                    marginBottom: 0,
                    alignSelf: 'center'
                }}
            >
                <View style={[styles.sendBtn, (!props.text || props.text.trim().length === 0) && styles.sendBtnDisabled]}>
                    <SendIcon color="#FFF" />
                </View>
            </Send>
        );
    }, []);

    const renderTime = useCallback((props: TimeProps<IMessage>) => {
        const { ...rest } = props;
        return (
            <Time
                {...rest}
                timeTextStyle={{
                    left: { color: 'rgba(0,0,0,0.4)' },
                    right: { color: 'rgba(255,255,255,0.6)' },
                }}
            />
        );
    }, []);

    return (
        <View style={styles.container}>
            {/* Background */}
            <ImageBackground
                source={require('../../assets/guest_1.jpg')}
                style={StyleSheet.absoluteFill}
                blurRadius={Platform.OS === 'ios' ? 40 : 10}
            >
                <LinearGradient
                    colors={darkMode ? ['rgba(28,28,30,0.85)', 'rgba(28,28,30,0.95)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.95)']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Custom Header */}
                <View style={[styles.header, { marginTop: insets.top }, darkMode && styles.headerDark]}>
                    <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
                        <BackIcon color={darkMode ? "#FFF" : "#1C1C1E"} />
                    </Pressable>
                    <View style={styles.headerCenter}>
                        <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
                        <Text style={[styles.headerName, darkMode && styles.textDark]} numberOfLines={1}>
                            {otherUser.name}
                        </Text>
                    </View>
                    <Pressable onPress={handleGhostPress} style={styles.backBtn} hitSlop={10}>
                        <OptionsIcon color={darkMode ? "#FFF" : "#1C1C1E"} />
                    </Pressable>
                </View>

                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={darkMode ? "#FFF" : "#4A4A4A"} />
                    </View>
                )}

                {/* Gifted Chat wrapped in KeyboardAvoidingView for robustness */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                    enabled
                >
                    <GiftedChat
                        messages={messages}
                        onSend={messages => onSend(messages)}
                        user={{
                            _id: currentUser._id,
                            name: currentUser.name,
                            avatar: currentUser.avatar,
                        }}
                        renderBubble={renderBubble}
                        renderInputToolbar={renderInputToolbar}
                        renderComposer={renderComposer}
                        renderSend={renderSend}
                        renderTime={renderTime}
                        showAvatarForEveryMessage={false}
                        showUserAvatar={false}
                        alwaysShowSend
                        scrollToBottom
                        maxInputLength={500}
                        alignTop={false}
                        bottomOffset={insets.bottom > 0 ? -insets.bottom : 0}
                    />
                    {iHaveGhosted && (
                        <View style={[styles.ghostBanner, darkMode && styles.ghostBannerDark]}>
                            <Text style={styles.ghostText}>You have ghosted this user.</Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        zIndex: 10,
    },
    headerDark: {
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backBtn: {
        padding: 4,
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: 16,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    textDark: {
        color: '#FFF',
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#4A4A4A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.5,
        backgroundColor: '#AEAEB2'
    },
    ghostBanner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F2F2F7',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    ghostBannerDark: {
        backgroundColor: '#1C1C1E',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    ghostText: {
        color: '#8E8E93',
        fontWeight: '600',
    }
});
