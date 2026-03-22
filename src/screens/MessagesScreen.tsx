import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { ChatService, Conversation } from '../services/ChatService';
import Svg, { Path } from 'react-native-svg';
import { formatDistanceToNow } from 'date-fns';

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
    userId: string;
    onBack: () => void;
    onOpenChat: (conversationId: string, otherUsername: string, otherAvatar: string) => void;
}

export const MessagesScreen = ({ userId, onBack, onOpenChat }: MessagesScreenProps) => {
    const { darkMode } = useTheme();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        const unsub = ChatService.subscribeToConversations(userId, (convos) => {
            setConversations(convos);
            setLoading(false);
        });
        return unsub;
    }, [userId]);

    const renderItem = ({ item }: { item: Conversation }) => (
        <Pressable
            style={[styles.channelItem, darkMode && styles.channelItemDark]}
            onPress={() => onOpenChat(item.id, item.otherUsername, item.otherAvatar)}
        >
            <Image
                source={{ uri: item.otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.otherUsername)}&background=random` }}
                style={styles.avatar}
            />
            <View style={styles.channelInfo}>
                <View style={styles.channelHeader}>
                    <Text style={[styles.channelName, darkMode && styles.textDark]} numberOfLines={1}>
                        @{item.otherUsername}
                    </Text>
                    {item.lastMessageAt && (
                        <Text style={styles.timeText}>
                            {formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true })}
                        </Text>
                    )}
                </View>
                <Text style={[styles.lastMessage, darkMode && styles.lastMessageDark]} numberOfLines={1}>
                    {item.lastMessage || 'No messages yet'}
                </Text>
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
                </View>
            ) : conversations.length === 0 ? (
                <View style={styles.centerContent}>
                    <MessageIcon color={darkMode ? "#555" : "#D1D1D1"} />
                    <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>No messages yet</Text>
                    <Text style={styles.emptySubtitle}>Send a challenge to a friend to start chatting!</Text>
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    containerDark: { backgroundColor: '#1C1C1E' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    headerDark: { borderBottomColor: 'rgba(255,255,255,0.1)' },
    backBtn: { padding: 4 },
    title: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#4A4A4A', paddingRight: Platform.OS === 'android' ? 6 : 0 },
    titleDark: { color: '#FFF' },
    placeholder: { width: 32 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#4A4A4A', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
    listContent: { paddingVertical: 8 },
    channelItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    channelItemDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5E5EA' },
    channelInfo: { flex: 1, marginLeft: 14 },
    channelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    channelName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1 },
    textDark: { color: '#FFF' },
    timeText: { fontSize: 12, color: '#8E8E93', marginLeft: 8 },
    lastMessage: { fontSize: 14, color: '#8E8E93', flex: 1 },
    lastMessageDark: { color: '#AEAEB2' },
});
