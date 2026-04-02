import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform, FlatList,
    TextInput, KeyboardAvoidingView, Keyboard, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { ChatService, Message } from '../services/ChatService';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SoundService } from '../services/SoundService';

const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

interface ChatScreenProps {
    conversationId: string;
    currentUserId: string;
    otherUsername: string;
    otherAvatar: string;
    onBack: () => void;
}

const formatTime = (date: Date | number | string) => {
    const d = new Date(date);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
};

const MessageBubble = ({
    msg,
    isMe,
    darkMode,
}: {
    msg: Message;
    isMe: boolean;
    darkMode: boolean;
}) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.bubbleRow,
                isMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
                { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
        >
            <View style={[
                styles.bubble,
                isMe ? styles.bubbleSent : (darkMode ? styles.bubbleReceivedDark : styles.bubbleReceived),
            ]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextSent : (darkMode ? styles.bubbleTextReceivedDark : styles.bubbleTextReceived)]}>
                    {msg.text}
                </Text>
                <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeSent : styles.bubbleTimeReceived]}>
                    {formatTime(msg.createdAt)}
                </Text>
            </View>
        </Animated.View>
    );
};

export const ChatScreen = ({ conversationId, currentUserId, otherUsername, otherAvatar, onBack }: ChatScreenProps) => {
    const { darkMode } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<FlatList>(null);
    const sendBtnScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const unsub = ChatService.subscribeToMessages(conversationId, (msgs: Message[]) => {
            setMessages(msgs);
            // Scroll to bottom after slight delay for layout
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        });
        return unsub;
    }, [conversationId]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setText('');
        setSending(true);
        SoundService.messageSent();
        try {
            await ChatService.sendMessage(conversationId, currentUserId, trimmed);
        } catch (e) {
            console.error('Send message error:', e);
        } finally {
            setSending(false);
        }
    };

    const onPressSend = () => {
        Animated.sequence([
            Animated.spring(sendBtnScale, { toValue: 0.88, useNativeDriver: true, friction: 10, tension: 200 }),
            Animated.spring(sendBtnScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }),
        ]).start();
        handleSend();
    };

    return (
        <SafeAreaView style={[styles.container, darkMode && styles.containerDark]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, darkMode && styles.headerDark]}>
                <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
                    <BackIcon color={darkMode ? '#FAF9F6' : '#1C1C1E'} />
                </Pressable>
                <Text style={[styles.headerName, darkMode && styles.textDark]}>
                    @{otherUsername}
                </Text>
                <View style={styles.placeholder} />
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
            >
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <MessageBubble
                            msg={item}
                            isMe={item.user._id === currentUserId}
                            darkMode={darkMode}
                        />
                    )}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                                Say hi 👋
                            </Text>
                        </View>
                    }
                />

                {/* Input bar */}
                <View style={[styles.inputBar, darkMode && styles.inputBarDark]}>
                    <TextInput
                        style={[styles.input, darkMode && styles.inputDark]}
                        value={text}
                        onChangeText={setText}
                        placeholder="Message..."
                        placeholderTextColor={darkMode ? '#666' : '#AEAEB2'}
                        multiline
                        maxLength={1000}
                        returnKeyType="default"
                        blurOnSubmit={false}
                    />
                    <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
                        <Pressable
                            onPress={onPressSend}
                            disabled={!text.trim() || sending}
                            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                        >
                            <SendIcon color="#FAF9F6" />
                        </Pressable>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    containerDark: { backgroundColor: '#1C1C1E' },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
    backBtn: { padding: 4 },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1C1C1E',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    textDark: { color: '#FAF9F6' },
    placeholder: { width: 32 },

    messageList: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },

    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    bubbleRowRight: { justifyContent: 'flex-end' },
    bubbleRowLeft: { justifyContent: 'flex-start' },

    bubble: {
        maxWidth: '78%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    bubbleSent: {
        backgroundColor: '#4A4A4A',
        borderBottomRightRadius: 5,
    },
    bubbleReceived: {
        backgroundColor: '#F0F0F0',
        borderBottomLeftRadius: 5,
    },
    bubbleReceivedDark: {
        backgroundColor: '#2C2C2E',
        borderBottomLeftRadius: 5,
    },

    bubbleText: {
        fontSize: 15,
        lineHeight: 21,
    },
    bubbleTextSent: { color: '#FAF9F6' },
    bubbleTextReceived: { color: '#1C1C1E' },
    bubbleTextReceivedDark: { color: '#E5E5EA' },

    bubbleTime: {
        fontSize: 10,
        marginTop: 3,
        alignSelf: 'flex-end',
    },
    bubbleTimeSent: { color: 'rgba(250,249,246,0.5)' },
    bubbleTimeReceived: { color: '#AEAEB2' },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
    emptyText: { fontSize: 16, color: '#AEAEB2', fontWeight: '500' },
    emptyTextDark: { color: '#636366' },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: '#FAF9F6',
        gap: 8,
    },
    inputBarDark: {
        borderTopColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#1C1C1E',
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        backgroundColor: '#F0F0F0',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 15,
        color: '#1C1C1E',
        lineHeight: 20,
    },
    inputDark: {
        backgroundColor: '#2C2C2E',
        color: '#FAF9F6',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4A4A4A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.35,
    },
});
