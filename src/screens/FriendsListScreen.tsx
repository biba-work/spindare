import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Pressable, Platform, Image, ActivityIndicator, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SocialService } from '../services/SocialService';
import { ChatService } from '../services/ChatService';
import { SearchService } from '../services/SearchService';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface Friend {
    id: string;
    name: string;
    username: string;
    photoURL?: string;
}

export const FriendsListScreen = ({ onClose, challenge }: { onClose: () => void, challenge: string }) => {
    const { darkMode } = useTheme();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Initial animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();

        // Fetch real friends
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        setLoading(true);
        try {
            const realFriends = await SocialService.getFriends();
            setFriends(realFriends);
        } catch (error) {
            console.error("Failed to fetch friends:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (text: string) => {
        setSearchQuery(text);
        if (text.length >= 2) {
            setSearching(true);
            try {
                const results = await SearchService.searchUsers(text);
                setSearchResults(results.map(u => ({
                    id: u.uid || '',
                    name: u.username || 'User',
                    username: `@${u.username}`,
                    photoURL: u.photoURL
                })));
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSendToFriend = async (friend: Friend) => {
        try {
            await ChatService.sendChallengeToUser(friend.id, friend.name, challenge, friend.photoURL);
            console.log(`✅ Challenge sent to friend ${friend.username}: ${challenge}`);
            return true;
        } catch (error) {
            console.error("❌ Failed to send challenge:", error);
            return false;
        }
    };

    const displayData = searchQuery.length >= 2 ? searchResults : friends;

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(250, 249, 246, 0.95)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <Animated.View style={[
                    styles.container,
                    darkMode && styles.containerDark,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <View style={styles.header}>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Text style={[styles.closeText, darkMode && styles.closeTextDark]}>Close</Text>
                        </Pressable>
                        <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>CHALLENGE A FRIEND</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={[styles.challengePreview, darkMode && styles.challengePreviewDark]}>
                        <Text style={styles.previewLabel}>SENDING CHALLENGE</Text>
                        <Text style={[styles.previewText, darkMode && styles.previewTextDark]} numberOfLines={2}>"{challenge}"</Text>
                    </View>

                    {/* Search Bar */}
                    <View style={[styles.searchContainer, darkMode && styles.searchContainerDark]}>
                        <Ionicons name="search" size={18} color={darkMode ? "#777" : "#C5C5C5"} style={styles.searchIcon} />
                        <TextInput
                            placeholder="Find users..."
                            placeholderTextColor={darkMode ? "#777" : "#C5C5C5"}
                            style={[styles.searchInput, darkMode && styles.searchInputDark]}
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => handleSearch('')}>
                                <Ionicons name="close-circle" size={18} color={darkMode ? "#777" : "#C5C5C5"} />
                            </Pressable>
                        )}
                    </View>

                    {loading && searchQuery.length < 2 ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={darkMode ? "#FFF" : "#A7BBC7"} />
                        </View>
                    ) : searching ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="small" color={darkMode ? "#FFF" : "#A7BBC7"} />
                        </View>
                    ) : displayData.length === 0 ? (
                        <View style={styles.centerContent}>
                            <Ionicons name="people-outline" size={48} color={darkMode ? "#444" : "#DDD"} />
                            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>
                                {searchQuery.length >= 2 ? "No users found" : "You aren't following anyone yet."}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {searchQuery.length >= 2 ? "Try a different search" : "Search for users to challenge them!"}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={displayData}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <FriendItem friend={item} onSend={() => handleSendToFriend(item)} darkMode={darkMode} />
                            )}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};

interface FriendItemProps {
    friend: Friend;
    onSend: () => Promise<boolean>;
    darkMode: boolean;
}

const FriendItem = ({ friend, onSend, darkMode }: FriendItemProps) => {
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!sent && !sending) {
            setSending(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const success = await onSend();
            setSending(false);
            if (success) {
                setSent(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
    };

    return (
        <View style={styles.friendRow}>
            <View style={styles.friendInfo}>
                <View style={styles.avatarContainer}>
                    {friend.photoURL ? (
                        <Image source={{ uri: friend.photoURL }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.nameContainer}>
                    <Text style={[styles.nameText, darkMode && styles.nameTextDark]} numberOfLines={1}>{friend.name}</Text>
                    <Text style={styles.usernameText} numberOfLines={1}>{friend.username}</Text>
                </View>
            </View>
            <Pressable
                onPress={handleSend}
                disabled={sent || sending}
                style={({ pressed }) => [
                    styles.sendButton,
                    darkMode && styles.sendButtonDark,
                    sent && (darkMode ? styles.sentButtonDark : styles.sentButton),
                    (pressed || sending) && !sent && { opacity: 0.7 }
                ]}
            >
                {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <Text style={[
                        styles.sendButtonText,
                        darkMode && styles.sendButtonTextDark,
                        sent && (darkMode ? styles.sentButtonTextDark : styles.sentButtonText)
                    ]}>
                        {sent ? 'SENT' : 'SEND'}
                    </Text>
                )}
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: 'transparent' },
    safeArea: { flex: 1 },
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    containerDark: { backgroundColor: '#1C1C1E' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
    headerTitle: { color: '#8E8E93', fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3 },
    headerTitleDark: { color: '#FFF' },

    closeButton: { padding: 4 },
    closeText: { color: '#A7BBC7', fontSize: 13, fontWeight: '500' },
    closeTextDark: { color: '#FFF' },

    challengePreview: {
        marginHorizontal: 24,
        padding: 16,
        backgroundColor: '#FFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
    },
    challengePreviewDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.05)',
    },

    previewLabel: { color: '#A7BBC7', fontSize: 8, fontWeight: '500', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' },
    previewText: { color: '#4A4A4A', fontSize: 14, lineHeight: 20, fontWeight: '400' },
    previewTextDark: { color: '#E5E5EA' },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 24,
        marginBottom: 20,
        paddingHorizontal: 16,
        height: 48,
        backgroundColor: '#F0F0F0',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    searchContainerDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#4A4A4A', fontSize: 15 },
    searchInputDark: { color: '#FFF' },

    listContent: { paddingHorizontal: 24, paddingBottom: 40 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyText: { color: '#4A4A4A', fontSize: 16, fontWeight: '500', textAlign: 'center', marginTop: 16 },
    emptyTextDark: { color: '#FFF' },
    emptySubtext: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginTop: 8 },

    friendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    friendInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
    avatarContainer: { marginRight: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: '#E5E5E5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
    avatarText: { color: '#4A4A4A', fontSize: 14, fontWeight: '600' },
    nameContainer: { flex: 1 },
    nameText: { color: '#4A4A4A', fontSize: 14, fontWeight: '600' },
    nameTextDark: { color: '#FFF' },

    usernameText: { color: '#AEAEB2', fontSize: 12, fontWeight: '400', marginTop: 1 },

    sendButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#4A4A4A', minWidth: 80, height: 36, justifyContent: 'center', alignItems: 'center' },
    sendButtonDark: { backgroundColor: '#3A3A3C' },

    sentButton: { backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#D1D1D1' },
    sentButtonDark: { backgroundColor: 'transparent', borderColor: '#48484A' },

    sendButtonText: { color: '#FAF9F6', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
    sendButtonTextDark: { color: '#FFF' },

    sentButtonText: { color: '#8E8E93' },
    sentButtonTextDark: { color: '#8E8E93' },
});
