import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Image as NativeImage
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';
import { SocialService } from '../../services/SocialService';
import { NotificationService } from '../../services/NotificationService';
import { SearchService } from '../../services/SearchService';
import { auth } from '../../services/firebaseConfig';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { ChatService } from '../../services/ChatService';
import { PostService } from '../../services/PostService';

const { width, height } = Dimensions.get('window');

// Icons
const SearchIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Path d="M21 21L16.65 16.65" />
    </Svg>
);

const CloseIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
);

interface Friend {
    id: string;
    username: string;
    name: string;
    photoURL?: string;
}

interface ChallengeShareOverlayProps {
    visible: boolean;
    onClose: () => void;
    challenge: string;
    postId?: string;
    onSent?: () => void;
}

export const ChallengeShareOverlay = ({ visible, onClose, challenge, postId, onSent }: ChallengeShareOverlayProps) => {
    const { darkMode } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            loadFriends();
        } else {
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [visible]);

    const loadFriends = async () => {
        setLoading(true);
        try {
            const userFriends = await SocialService.getFriends();
            setFriends(userFriends.map(f => ({
                id: f.id,
                username: f.username.replace('@', ''),
                name: f.name,
                photoURL: f.photoURL
            })));
        } catch (error) {
            console.error("Error loading friends:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleSearch = async () => {
            if (searchQuery.length > 1) {
                const results = await SearchService.searchUsers(searchQuery);
                setSearchResults(results.map(u => ({
                    id: u.uid || '',
                    username: u.username,
                    name: u.username,
                    photoURL: u.photoURL
                })));
            } else {
                setSearchResults([]);
            }
        };
        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSend = async (friend: Friend) => {
        if (sendingId) return;
        setSendingId(friend.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // 1. Send Direct Message (Chat)
            await ChatService.sendMessage({
                _id: friend.id,
                name: friend.name,
                avatar: friend.photoURL || ''
            }, `🃏 SENT YOU A CHALLENGE: ${challenge}`);

            // 2. Send Notification
            await NotificationService.sendNotification(
                friend.id,
                'challenge',
                `sent you a challenge: ${challenge}`,
                challenge
            );

            // 3. Record to Spind (Sent) Section
            if (auth.currentUser && postId) {
                await PostService.recordSpindChallenge(auth.currentUser.uid, postId, challenge);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (onSent) onSent();
            onClose();
        } catch (error) {
            console.error("Error sending challenge:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSendingId(null);
        }
    };

    const displayData = searchQuery.length > 0 ? searchResults : friends;

    const renderFriendItem = ({ item }: { item: Friend }) => (
        <Pressable
            style={({ pressed }) => [styles.friendItem, pressed && { opacity: 0.7 }]}
            onPress={() => handleSend(item)}
            disabled={!!sendingId}
        >
            <View style={styles.avatarContainer}>
                <Image
                    source={{
                        uri: (item.username === 'rashica07' || !item.photoURL)
                            ? NativeImage.resolveAssetSource(require('../../../assets/rashica_pfp.jpg')).uri
                            : item.photoURL
                    }}
                    style={styles.avatar}
                />
            </View>
            <View style={styles.friendInfo}>
                <Text style={[styles.friendName, darkMode && styles.textDark]}>{item.name}</Text>
                <Text style={styles.friendUsername}>@{item.username}</Text>
            </View>
            <View style={[styles.sendPill, sendingId === item.id && styles.sendPillActive]}>
                {sendingId === item.id ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <Text style={styles.sendText}>Send</Text>
                )}
            </View>
        </Pressable>
    );

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    <BlurView intensity={80} tint={darkMode ? 'dark' : 'light'} style={styles.modalContent}>
                        <View style={styles.header}>
                            <View style={styles.dragHandle} />
                            <Text style={[styles.title, darkMode && styles.textDark]}>Pass this Challenge to a friend</Text>
                            <Text style={styles.subtitle} numberOfLines={1}>{challenge}</Text>
                        </View>

                        <View style={[styles.searchContainer, darkMode && styles.searchContainerDark]}>
                            <SearchIcon color={darkMode ? "#8E8E93" : "#A0A0A0"} />
                            <TextInput
                                placeholder="Search friends..."
                                placeholderTextColor={darkMode ? "#666" : "#A0A0A0"}
                                style={[styles.searchInput, darkMode && styles.textDark]}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <CloseIcon color={darkMode ? "#8E8E93" : "#A0A0A0"} />
                                </Pressable>
                            )}
                        </View>

                        {loading && searchQuery.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color={darkMode ? "#FFF" : "#4A4A4A"} />
                            </View>
                        ) : (
                            <FlatList
                                data={displayData}
                                renderItem={renderFriendItem}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>
                                            {searchQuery.length > 0 ? "No users found" : "No friends found yet"}
                                        </Text>
                                    </View>
                                }
                            />
                        )}
                    </BlurView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        width: '100%',
        maxHeight: height * 0.8,
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1C1C1E',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 4,
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginHorizontal: 20,
        marginVertical: 16,
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 12,
    },
    searchContainerDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#1C1C1E',
    },
    listContent: {
        paddingHorizontal: 20,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#EEE',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    friendUsername: {
        fontSize: 13,
        color: '#8E8E93',
    },
    sendPill: {
        backgroundColor: '#4A4A4A',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    sendPillActive: {
        backgroundColor: '#8E8E93',
    },
    sendText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    textDark: {
        color: '#FFF',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 15,
    }
});
