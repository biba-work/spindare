import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
    ImageBackground
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../services/firebaseConfig';
import { Channel as StreamChannel, MessageResponse, Event } from 'stream-chat';
import Svg, { Path } from 'react-native-svg';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';

// Icons
const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

interface ChatScreenProps {
    channel: StreamChannel;
    onBack: () => void;
}

interface MessageItem {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userImage: string;
    createdAt: Date;
    isOwn: boolean;
    isChallenge: boolean;
    challenge?: string;
}

export const ChatScreen = ({ channel, onBack }: ChatScreenProps) => {
    const { darkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const currentUserId = auth.currentUser?.uid;

    // Get other user's info for header
    const members = Object.values(channel.state.members);
    const otherMember = members.find(m => m.user_id !== currentUserId);
    const chatName = otherMember?.user?.name || (channel.data as any)?.name || 'Chat';
    const chatAvatar = otherMember?.user?.image as string || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatName)}&background=random`;

    useEffect(() => {
        // Load initial messages
        loadMessages();

        // Listen for new messages
        const handleNewMessage = (event: Event) => {
            if (event.message) {
                const msg = event.message;
                const newMessage: MessageItem = {
                    id: msg.id,
                    text: msg.text || '',
                    userId: msg.user?.id || '',
                    userName: msg.user?.name || 'Unknown',
                    userImage: msg.user?.image as string || '',
                    createdAt: new Date(msg.created_at || Date.now()),
                    isOwn: msg.user?.id === currentUserId,
                    isChallenge: msg.attachments?.some(a => a.type === 'challenge') || false,
                    challenge: (msg.attachments?.find(a => a.type === 'challenge') as any)?.challenge,
                };
                setMessages(prev => [...prev, newMessage]);

                // Scroll to bottom
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        };

        channel.on('message.new', handleNewMessage);

        // Mark as read
        channel.markRead();

        return () => {
            channel.off('message.new', handleNewMessage);
        };
    }, [channel]);

    const loadMessages = async () => {
        try {
            setLoading(true);

            const response = await channel.query({
                messages: { limit: 50 },
            });

            const loadedMessages: MessageItem[] = (response.messages || []).map((msg: MessageResponse) => ({
                id: msg.id,
                text: msg.text || '',
                userId: msg.user?.id || '',
                userName: msg.user?.name || 'Unknown',
                userImage: msg.user?.image as string || '',
                createdAt: new Date(msg.created_at || Date.now()),
                isOwn: msg.user?.id === currentUserId,
                isChallenge: msg.attachments?.some(a => a.type === 'challenge') || false,
                challenge: (msg.attachments?.find(a => a.type === 'challenge') as any)?.challenge as string | undefined,
            }));

            setMessages(loadedMessages);

            // Scroll to bottom after loading
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim() || sending) return;

        try {
            setSending(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            await channel.sendMessage({
                text: inputText.trim(),
            });

            setInputText('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item, index }: { item: MessageItem; index: number }) => {
        const showAvatar = !item.isOwn && (index === 0 || messages[index - 1]?.userId !== item.userId);

        return (
            <View style={[
                styles.messageContainer,
                item.isOwn ? styles.ownMessage : styles.otherMessage,
            ]}>
                {!item.isOwn && showAvatar && (
                    <Image source={{ uri: item.userImage || chatAvatar }} style={styles.messageAvatar} />
                )}
                {!item.isOwn && !showAvatar && <View style={styles.avatarPlaceholder} />}

                <View style={[
                    styles.messageBubble,
                    item.isOwn
                        ? [styles.ownBubble, darkMode && styles.ownBubbleDark]
                        : [styles.otherBubble, darkMode && styles.otherBubbleDark],
                    item.isChallenge && styles.challengeBubble,
                ]}>
                    {item.isChallenge && (
                        <View style={styles.challengeHeader}>
                            <Text style={styles.challengeLabel}>🎯 CHALLENGE</Text>
                        </View>
                    )}
                    <Text style={[
                        styles.messageText,
                        item.isOwn ? styles.ownMessageText : [styles.otherMessageText, darkMode && styles.otherMessageTextDark],
                    ]}>
                        {item.text}
                    </Text>
                    <Text style={[styles.messageTime, item.isOwn && styles.ownMessageTime]}>
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/guest_1.jpg')}
                style={StyleSheet.absoluteFill}
                blurRadius={Platform.OS === 'ios' ? 40 : 10}
            >
                <LinearGradient
                    colors={darkMode ? ['rgba(28,28,30,0.85)', 'rgba(28,28,30,0.95)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.95)']}
                    style={StyleSheet.absoluteFill}
                />
                <SafeAreaView style={styles.container} edges={['top']}>
                    {/* Header */}
                    <View style={[styles.header, darkMode && styles.headerDark]}>
                        <Pressable onPress={onBack} style={styles.backBtn}>
                            <BackIcon color={darkMode ? "#FFF" : "#1C1C1E"} />
                        </Pressable>
                        <View style={styles.headerCenter}>
                            <Image source={{ uri: chatAvatar }} style={styles.headerAvatar} />
                            <Text style={[styles.headerName, darkMode && styles.textDark]} numberOfLines={1}>
                                {chatName}
                            </Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>

                    {/* Messages */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={darkMode ? "#FFF" : "#4A4A4A"} />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={[styles.messagesContent, { paddingBottom: 16 }]}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        />
                    )}

                    {/* Input */}
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={0}
                    >
                        <View style={[styles.inputContainer, darkMode && styles.inputContainerDark, { paddingBottom: insets.bottom + 8 }]}>
                            <TextInput
                                style={[styles.input, darkMode && styles.inputDark]}
                                placeholder="Type a message..."
                                placeholderTextColor={darkMode ? "#8E8E93" : "#AEAEB2"}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={500}
                            />
                            <Pressable
                                onPress={sendMessage}
                                style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
                                disabled={!inputText.trim() || sending}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <SendIcon color="#FFF" />
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    containerDark: {
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-end',
    },
    ownMessage: {
        justifyContent: 'flex-end',
    },
    otherMessage: {
        justifyContent: 'flex-start',
    },
    messageAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
    },
    avatarPlaceholder: {
        width: 36,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    ownBubble: {
        backgroundColor: '#4A4A4A',
        borderBottomRightRadius: 4,
    },
    ownBubbleDark: {
        backgroundColor: '#3A3A3C',
    },
    otherBubble: {
        backgroundColor: '#E5E5EA',
        borderBottomLeftRadius: 4,
    },
    otherBubbleDark: {
        backgroundColor: '#2C2C2E',
    },
    challengeBubble: {
        backgroundColor: '#007AFF',
    },
    challengeHeader: {
        marginBottom: 6,
    },
    challengeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    ownMessageText: {
        color: '#FFF',
    },
    otherMessageText: {
        color: '#1C1C1E',
    },
    otherMessageTextDark: {
        color: '#FFF',
    },
    messageTime: {
        fontSize: 10,
        color: 'rgba(0,0,0,0.4)',
        marginTop: 4,
        textAlign: 'right',
    },
    ownMessageTime: {
        color: 'rgba(255,255,255,0.6)',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    inputContainerDark: {
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(28,28,30,0.95)',
    },
    input: {
        flex: 1,
        backgroundColor: '#F2F2F7',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 100,
        color: '#1C1C1E',
    },
    inputDark: {
        backgroundColor: '#2C2C2E',
        color: '#FFF',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4A4A4A',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
});
