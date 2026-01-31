import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { ChatService, chatClient } from '../services/ChatService';
import { auth } from '../services/firebaseConfig';
import Svg, { Path, Circle } from 'react-native-svg';
import { Channel as StreamChannel } from 'stream-chat';
import { formatDistanceToNow } from 'date-fns';

// Icons
const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const MessageIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
);

interface MessagesScreenProps {
    onBack: () => void;
    onOpenChat: (channel: StreamChannel) => void;
}

interface ChannelPreview {
    id: string;
    channel: StreamChannel;
    name: string;
    avatar: string;
    lastMessage: string;
    lastMessageTime: Date | null;
    unreadCount: number;
}

export const MessagesScreen = ({ onBack, onOpenChat }: MessagesScreenProps) => {
    const { darkMode } = useTheme();
    const [channels, setChannels] = useState<ChannelPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            setLoading(true);
            setError(null);

            const userChannels = await ChatService.getUserChannels();
            const currentUserId = auth.currentUser?.uid;

            const channelPreviews: ChannelPreview[] = userChannels.map(channel => {
                // Get the other member's info for DM channels
                const members = Object.values(channel.state.members);
                const otherMember = members.find(m => m.user_id !== currentUserId);

                const lastMessage = channel.state.messages[channel.state.messages.length - 1];

                return {
                    id: channel.id || channel.cid,
                    channel: channel,
                    name: otherMember?.user?.name || (channel.data as any)?.name || 'Chat',
                    avatar: otherMember?.user?.image as string || `https://ui-avatars.com/api/?name=Chat&background=random`,
                    lastMessage: lastMessage?.text || 'No messages yet',
                    lastMessageTime: lastMessage?.created_at ? new Date(lastMessage.created_at) : null,
                    unreadCount: channel.countUnread(),
                };
            });

            setChannels(channelPreviews);
        } catch (err: any) {
            console.error('Error loading channels:', err);
            setError(err.message || 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const renderChannelItem = ({ item }: { item: ChannelPreview }) => (
        <Pressable
            style={[styles.channelItem, darkMode && styles.channelItemDark]}
            onPress={() => onOpenChat(item.channel)}
        >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.channelInfo}>
                <View style={styles.channelHeader}>
                    <Text style={[styles.channelName, darkMode && styles.textDark]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.lastMessageTime && (
                        <Text style={styles.timeText}>
                            {formatDistanceToNow(item.lastMessageTime, { addSuffix: true })}
                        </Text>
                    )}
                </View>
                <View style={styles.messageRow}>
                    <Text style={[styles.lastMessage, darkMode && styles.lastMessageDark]} numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                    {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={[styles.container, darkMode && styles.containerDark]} edges={['top']}>
            <View style={[styles.header, darkMode && styles.headerDark]}>
                <Pressable onPress={onBack} style={styles.backBtn}>
                    <BackIcon color={darkMode ? "#FFF" : "#1C1C1E"} />
                </Pressable>
                <Text style={[styles.title, darkMode && styles.titleDark]}>MESSAGES</Text>
                <View style={styles.placeholder} />
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={darkMode ? "#FFF" : "#4A4A4A"} />
                    <Text style={[styles.loadingText, darkMode && styles.textDark]}>Loading messages...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContent}>
                    <Text style={[styles.errorText, darkMode && styles.textDark]}>{error}</Text>
                    <Pressable onPress={loadChannels} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                </View>
            ) : channels.length === 0 ? (
                <View style={styles.centerContent}>
                    <MessageIcon color={darkMode ? "#555" : "#D1D1D1"} />
                    <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>No messages yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Send a challenge to a friend to start chatting!
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={channels}
                    renderItem={renderChannelItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    containerDark: {
        backgroundColor: '#1C1C1E',
    },
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
    backBtn: {
        padding: 4,
    },
    title: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
        color: '#4A4A4A',
    },
    titleDark: {
        color: '#FFF',
    },
    placeholder: {
        width: 32,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#8E8E93',
    },
    errorText: {
        fontSize: 14,
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#4A4A4A',
        borderRadius: 20,
    },
    retryText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4A4A4A',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 8,
        textAlign: 'center',
    },
    listContent: {
        paddingVertical: 8,
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    channelItemDark: {
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E5E5EA',
    },
    channelInfo: {
        flex: 1,
        marginLeft: 14,
    },
    channelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    channelName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1C1C1E',
        flex: 1,
    },
    textDark: {
        color: '#FFF',
    },
    timeText: {
        fontSize: 12,
        color: '#8E8E93',
        marginLeft: 8,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 14,
        color: '#8E8E93',
        flex: 1,
    },
    lastMessageDark: {
        color: '#AEAEB2',
    },
    unreadBadge: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    unreadText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
