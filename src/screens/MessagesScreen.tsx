import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, ActivityIndicator, ImageBackground, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { auth, db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import Svg, { Path } from 'react-native-svg';
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

interface ChatUser {
    _id: string;
    name: string;
    avatar: string;
}

interface MessagesScreenProps {
    onBack: () => void;
    onOpenChat: (user: ChatUser) => void;
}

interface ConversationPreview {
    id: string;
    otherUser: ChatUser;
    lastMessage: string;
    lastMessageTime: Date;
}

export const MessagesScreen = ({ onBack, onOpenChat }: MessagesScreenProps) => {
    const { darkMode } = useTheme();
    const [conversations, setConversations] = useState<ConversationPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;

        // Query conversations where current user is a participant
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedConversations: ConversationPreview[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const users = data.users || {};

                // Find the "other" user
                const otherUserId = data.participants.find((uid: string) => uid !== currentUser.uid);
                const otherUserProfile = users[otherUserId];

                if (otherUserProfile) {
                    loadedConversations.push({
                        id: doc.id,
                        otherUser: {
                            _id: otherUserId,
                            name: otherUserProfile.name || 'Unknown',
                            avatar: otherUserProfile.avatar || ''
                        },
                        lastMessage: data.lastMessage || 'Sent an attachment',
                        lastMessageTime: data.lastMessageTimestamp instanceof Timestamp
                            ? data.lastMessageTimestamp.toDate()
                            : new Date()
                    });
                }
            });

            // Sort client-side to avoid needing a composite index immediately
            loadedConversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
            setConversations(loadedConversations);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching conversations:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const renderItem = useCallback(({ item }: { item: ConversationPreview }) => (
        <ConversationItem
            item={item}
            onPress={() => onOpenChat(item.otherUser)}
            darkMode={darkMode}
        />
    ), [darkMode, onOpenChat]);

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
                            <Text style={styles.emptySubtitle}>
                                Send a challenge to a friend to start chatting!
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={conversations}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={10}
                            windowSize={5}
                            maxToRenderPerBatch={10}
                        />
                    )}
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
};

const ConversationItem = React.memo(({ item, onPress, darkMode }: { item: ConversationPreview, onPress: () => void, darkMode: boolean }) => (
    <Pressable
        style={[styles.channelItem, darkMode && styles.channelItemDark]}
        onPress={onPress}
    >
        <Image
            source={{ uri: item.otherUser.avatar || `https://ui-avatars.com/api/?name=${item.otherUser.name}` }}
            style={styles.avatar}
        />
        <View style={styles.channelInfo}>
            <View style={styles.channelHeader}>
                <Text style={[styles.channelName, darkMode && styles.textDark]} numberOfLines={1}>
                    {item.otherUser.name}
                </Text>
                <Text style={styles.timeText}>
                    {formatDistanceToNow(item.lastMessageTime, { addSuffix: true })}
                </Text>
            </View>
            <View style={styles.messageRow}>
                <Text style={[styles.lastMessage, darkMode && styles.lastMessageDark]} numberOfLines={1}>
                    {item.lastMessage}
                </Text>
            </View>
        </View>
    </Pressable>
));

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerDark: { borderBottomColor: 'rgba(255,255,255,0.1)' },
    backBtn: { padding: 4 },
    title: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
        color: '#4A4A4A',
    },
    titleDark: { color: '#FFF' },
    placeholder: { width: 32 },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4A4A4A',
        marginTop: 16,
    },
    textDark: { color: '#FFF' },
    emptySubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 8,
        textAlign: 'center',
    },
    listContent: { paddingVertical: 8 },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    channelItemDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
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
    lastMessageDark: { color: '#AEAEB2' },
});
