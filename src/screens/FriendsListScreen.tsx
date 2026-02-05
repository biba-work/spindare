import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, ActivityIndicator, ImageBackground, Modal, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SocialService } from '../services/SocialService';
import { NotificationService } from '../services/NotificationService';
import { auth, db } from '../services/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { SearchService } from '../services/SearchService';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';

// Icons
const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const SearchIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="11" cy="11" r="8" />
        <Path d="M21 21L16.65 16.65" />
    </Svg>
);

import { Circle } from 'react-native-svg';

interface Friend {
    id: string; // Firestore UID
    username: string; // @username
    name: string; // Display Name
    photoURL?: string; // Avatar
}

interface FriendsListScreenProps {
    onBack: () => void;
    challenge?: string; // If present, we are in "Challenge Mode"
}

export const FriendsListScreen = ({ onBack, challenge }: FriendsListScreenProps) => {
    const { darkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<'friends' | 'all'>('friends');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [allUsers, setAllUsers] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'friends') {
                const userFriends = await SocialService.getFriends();
                // Map to Friend interface
                const mappedFriends = userFriends.map(u => ({
                    id: u.id,
                    username: u.username.replace('@', ''), // Remove @ if present from service
                    name: u.name,
                    photoURL: u.photoURL
                }));
                setFriends(mappedFriends);
            } else {
                const users = await SearchService.searchUsers(''); // Empty query gets initial/top users
                const mappedUsers = users.map(u => ({
                    id: u.uid || '',
                    username: u.username,
                    name: u.username,
                    photoURL: u.photoURL
                }));
                setAllUsers(mappedUsers);
            }
        } catch (error) {
            console.error("Failed to load users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendToFriend = async (friend: Friend) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return false;

        try {
            // 1. Send to Friend
            await NotificationService.sendNotification(
                friend.id,
                'challenge',
                `sent you a challenge: ${challenge}`,
                challenge
            );

            // 2. Add to My Notifications (Sent History)
            // We manually add it because NotificationService blocks sending to self
            await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                type: 'challenge',
                fromUserId: currentUser.uid,
                fromUsername: 'You',
                fromAvatar: currentUser.photoURL || null,
                content: `sent a challenge to @${friend.username}: ${challenge}`,
                targetId: challenge,
                read: true, // Auto-read since I sent it
                timestamp: serverTimestamp()
            });

            console.log(`✅ Challenge sent to friend ${friend.username}`);
            return true;

        } catch (error) {
            console.error("❌ Failed to send challenge:", error);
            Alert.alert("Error", "Could not send challenge. Please try again.");
            return false;
        }
    };

    const handleSendToMultiple = async () => {
        if (selectedFriends.length === 0) return;

        setSending(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const targets = activeTab === 'friends' ? friends : allUsers;
        const selectedTargets = targets.filter(t => selectedFriends.includes(t.id));

        let successCount = 0;

        // Parallel sending for better UX
        await Promise.all(selectedTargets.map(async (friend) => {
            const result = await handleSendToFriend(friend);
            if (result) successCount++;
        }));

        setSending(false);

        if (successCount > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                "Sent!",
                `Challenge sent to ${successCount} friend${successCount !== 1 ? 's' : ''}.`,
                [{ text: "OK", onPress: onBack }]
            );
        } else {
            Alert.alert("Error", "Could not send challenge.");
        }
    };

    const onUserPress = (friend: Friend) => {
        if (challenge) {
            if (activeTab === 'friends') Haptics.selectionAsync();

            setSelectedFriends(prev => {
                if (prev.includes(friend.id)) {
                    return prev.filter(id => id !== friend.id);
                } else {
                    return [...prev, friend.id];
                }
            });
        } else {
            // View Profile logic could go here
            console.log("View profile:", friend.username);
        }
    }

    const renderItem = ({ item }: { item: Friend }) => (
        <Pressable
            style={({ pressed }) => [
                styles.friendItem,
                darkMode && styles.friendItemDark,
                pressed && { opacity: 0.7 }
            ]}
            onPress={() => onUserPress(item)}
            disabled={!!sending}
        >
            <Image
                source={{
                    uri: (item.username === 'rashica07' || item.username === 'example' || !item.photoURL)
                        ? Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri
                        : item.photoURL
                }}
                style={styles.avatar}
            />
            <View style={styles.friendInfo}>
                <Text style={[styles.friendName, darkMode && styles.textDark]}>{item.name}</Text>
                <Text style={styles.friendUsername}>@{item.username}</Text>
            </View>

            {challenge && (
                <View style={[styles.checkbox, selectedFriends.includes(item.id) && styles.checkboxSelected]}>
                    {selectedFriends.includes(item.id) && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
            )}
        </Pressable>
    );

    const data = activeTab === 'friends' ? friends : allUsers;

    return (
        <View style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/guest_2.jpg')} // Different background for variety
                style={StyleSheet.absoluteFill}
                blurRadius={Platform.OS === 'ios' ? 60 : 20}
            >
                <View style={[styles.overlay, darkMode && styles.overlayDark]} />
                <SafeAreaView style={styles.container} edges={['top']}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
                            <BackIcon color={darkMode ? "#FFF" : "#1C1C1E"} />
                        </Pressable>
                        <Text style={[styles.title, darkMode && styles.textDark]}>
                            {challenge ? 'SEND TO FRIEND' : 'FRIENDS'}
                        </Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabsContainer}>
                        <Pressable
                            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText, darkMode && styles.textDark]}>
                                Following
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                            onPress={() => setActiveTab('all')}
                        >
                            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText, darkMode && styles.textDark]}>
                                All Users
                            </Text>
                        </Pressable>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={darkMode ? "#FFF" : "#4A4A4A"} />
                        </View>
                    ) : (
                        <FlatList
                            data={data}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyText, darkMode && styles.textDark]}>
                                        {activeTab === 'friends' ? "You aren't following anyone yet." : "No users found."}
                                    </Text>
                                </View>
                            }
                        />
                    )}
                    {challenge && selectedFriends.length > 0 && (
                        <View style={styles.footer}>
                            <Pressable
                                onPress={handleSendToMultiple}
                                style={[styles.sendButton, darkMode && styles.sendButtonDark]}
                                disabled={sending}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.sendButtonText}>
                                        SEND TO {selectedFriends.length} FRIEND{selectedFriends.length !== 1 ? 'S' : ''}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    )}
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    overlayDark: {
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backBtn: {
        padding: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
        color: '#1C1C1E',
    },
    textDark: {
        color: '#FFF',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    tab: {
        marginRight: 20,
        paddingVertical: 10,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#1C1C1E', // or primary color
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8E8E93',
    },
    activeTabText: {
        color: '#1C1C1E',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        padding: 12,
        borderRadius: 16,
    },
    friendItemDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: '#CCC',
    },
    friendInfo: {
        flex: 1,
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
    actionBtn: {
        backgroundColor: '#4A4A4A', // or brand color
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    actionBtnLoading: {
        opacity: 0.8,
        minWidth: 60,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
    },
    // New Styles for Multi-Select
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#C7C7CC',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    checkboxSelected: {
        backgroundColor: '#007AFF', // iOS blue or brand color
        borderColor: '#007AFF',
    },
    footer: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    sendButton: {
        backgroundColor: '#1C1C1E',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    sendButtonDark: {
        backgroundColor: '#FFF',
    },
    sendButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
    },
});
