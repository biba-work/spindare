import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, PostService } from '../services/PostService';
import { FeedScreen } from './FeedScreen';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { SocialService } from '../services/SocialService';
import { auth } from '../services/firebaseConfig';

const { width } = Dimensions.get('window');

const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const UserPlusIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <Path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <Path d="M20 8v6M23 11h-6" />
    </Svg>
);

const ChatIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
);

interface UserProfileViewProps {
    userId: string;
    username: string;
    avatar: string;
    onBack: () => void;
    onStartChat: () => void;
}

export const UserProfileView = ({ userId, username, avatar, onBack, onStartChat }: UserProfileViewProps) => {
    const { darkMode } = useTheme();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isRequested, setIsRequested] = useState(false);
    const [stats, setStats] = useState({ followers: 0, following: 0 });

    useEffect(() => {
        const unsubscribe = PostService.subscribeToUserPosts(userId, (userPosts) => {
            setPosts(userPosts);
        });

        // Social Sync
        const syncSocial = async () => {
            const [isFollowing, isReq, s] = await Promise.all([
                SocialService.checkIsFollowing(userId),
                SocialService.checkIsRequested(userId),
                SocialService.getFollowStats(userId)
            ]);
            setIsConnected(isFollowing);
            setIsRequested(isReq);
            setStats(s);
        };
        syncSocial();

        return () => unsubscribe();
    }, [userId]);

    const handleConnect = async () => {
        if (!auth.currentUser) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isConnected || isRequested) {
            // Unfollow or Cancel Request
            setIsConnected(false);
            setIsRequested(false);
            if (isConnected) {
                setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
            }

            try {
                await SocialService.unfollowUser(userId);
            } catch (e) {
                console.error(e);
                // Revert
                if (isConnected) setIsConnected(true);
                if (isRequested) setIsRequested(true);
            }
        } else {
            // Attempt Connect
            try {
                const status = await SocialService.followUser(userId);
                if (status === 'connected') {
                    setIsConnected(true);
                    setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
                } else {
                    setIsRequested(true);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };



    const totalReactions = posts.reduce((sum, post) =>
        sum + post.reactions.felt + post.reactions.thought + post.reactions.intrigued, 0
    );

    const identityLabel = useMemo(() => {
        if (posts.length === 0) return "New Explorer";

        let felt = 0, thought = 0, intrigued = 0;
        posts.forEach(p => {
            felt += p.reactions.felt;
            thought += p.reactions.thought;
            intrigued += p.reactions.intrigued;
        });

        if (felt === 0 && thought === 0 && intrigued === 0) return "Creative Explorer";

        const max = Math.max(felt, thought, intrigued);
        if (felt === max && felt > thought + 2) return "The Empath";
        if (thought === max && thought > felt + 2) return "The Philosopher";
        if (intrigued === max && intrigued > felt + 2) return "The Absurdist";

        return "Balanced Soul";
    }, [posts]);

    return (
        <View style={[styles.container, darkMode && styles.containerDark]}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={[styles.header, darkMode && styles.headerDark]}>
                    <Pressable onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <BackIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                    </Pressable>
                    <Text style={[styles.headerTitle, darkMode && styles.textDark]}>Profile</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={[styles.profileSection, darkMode && styles.borderDark]}>
                        <View style={[styles.pfpContainer, darkMode && styles.pfpContainerDark]}>
                            <Image source={{ uri: avatar }} style={styles.pfp} />
                        </View>
                        <Text style={[styles.username, darkMode && styles.textDark]}>@{username}</Text>
                        <Text style={[styles.identityLabel, darkMode && styles.identityLabelDark]}>{identityLabel}</Text>

                        <View style={styles.actionButtons}>
                            {!isConnected && !isRequested ? (
                                <Pressable
                                    onPress={handleConnect}
                                    style={[
                                        styles.spinBtn,
                                        darkMode && styles.spinBtnDark
                                    ]}
                                >
                                    <UserPlusIcon color={darkMode ? "#1C1C1E" : "#FAF9F6"} />
                                    <Text style={[
                                        styles.spinBtnText,
                                        darkMode && styles.spinBtnTextDark
                                    ]}>
                                        CONNECT
                                    </Text>
                                </Pressable>
                            ) : isRequested ? (
                                <Pressable
                                    onPress={handleConnect}
                                    style={[
                                        styles.spinBtn,
                                        darkMode && styles.spinBtnDark,
                                        styles.connectedBtn,
                                        darkMode && styles.connectedBtnDark
                                    ]}
                                >
                                    <Text style={[
                                        styles.spinBtnText,
                                        darkMode && styles.spinBtnTextDark,
                                        styles.connectedBtnText,
                                        darkMode && styles.connectedBtnTextDark
                                    ]}>
                                        REQUESTED
                                    </Text>
                                </Pressable>
                            ) : (
                                <View
                                    style={[
                                        styles.spinBtn,
                                        darkMode && styles.spinBtnDark,
                                        styles.connectedBtn,
                                        darkMode && styles.connectedBtnDark,
                                        { paddingHorizontal: 20, justifyContent: 'space-between', gap: 0 }
                                    ]}
                                >
                                    <Pressable
                                        onPress={handleConnect}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Text style={[
                                            styles.spinBtnText,
                                            darkMode && styles.spinBtnTextDark,
                                            styles.connectedBtnText,
                                            darkMode && styles.connectedBtnTextDark
                                        ]}>
                                            CONNECTED
                                        </Text>
                                    </Pressable>

                                    <View style={{
                                        width: 1,
                                        height: 20,
                                        backgroundColor: darkMode ? '#FFF' : '#4A4A4A',
                                        marginHorizontal: 16,
                                        opacity: 0.2
                                    }} />

                                    <Pressable
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            onStartChat();
                                        }}
                                        hitSlop={15}
                                    >
                                        <ChatIcon color={darkMode ? "#FFF" : "#4A4A4A"} />
                                    </Pressable>
                                </View>
                            )}
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, darkMode && styles.textDark]}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                            <View style={[styles.statDivider, darkMode && styles.statDividerDark]} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, darkMode && styles.textDark]}>{totalReactions}</Text>
                                <Text style={styles.statLabel}>Reactions</Text>
                            </View>
                            {auth.currentUser?.uid === userId && (
                                <>
                                    <View style={[styles.statDivider, darkMode && styles.statDividerDark]} />
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statValue, darkMode && styles.textDark]}>{stats.followers}</Text>
                                        <Text style={styles.statLabel}>Followers</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.postsSection}>
                        <Text style={styles.sectionTitle}>POSTS</Text>
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <View key={post.id} style={[styles.postPreview, darkMode && styles.postPreviewDark]}>
                                    {post.media ? (
                                        <Image source={{ uri: post.media }} style={styles.postImage} />
                                    ) : null}
                                    <View style={styles.postContent}>
                                        {post.challenge && <Text style={styles.postChallenge}>{post.challenge}</Text>}
                                        <Text style={[styles.postText, darkMode && styles.textDark]} numberOfLines={3}>{post.content}</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={[styles.emptyText, darkMode && styles.textDark]}>No posts yet</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    containerDark: { backgroundColor: '#1C1C1E' },
    safeArea: { flex: 1 },
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
    headerTitle: {
        color: '#4A4A4A',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    textDark: { color: '#FFF' },
    placeholder: { width: 32 },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    borderDark: { borderBottomColor: 'rgba(255,255,255,0.05)' },
    pfpContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        backgroundColor: '#FAF9F6',
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    pfpContainerDark: {
        backgroundColor: '#1C1C1E',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pfp: {
        width: '100%',
        height: '100%',
        borderRadius: 47,
    },
    username: {
        color: '#2C2C2C',
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    identityLabel: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.5,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    identityLabelDark: { color: '#A7BBC7' },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    spinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 28,
        backgroundColor: '#4A4A4A',
        minWidth: 160,
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        flex: 1, // Allow it to flex
        maxWidth: 240, // Limit width like Spin Button
    },
    spinBtnDark: {
        backgroundColor: '#FFF',
    },
    spinBtnText: {
        color: '#FAF9F6',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    spinBtnTextDark: {
        color: '#1C1C1E',
    },
    connectedBtn: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#4A4A4A',
        shadowOpacity: 0,
    },
    connectedBtnDark: {
        backgroundColor: 'transparent',
        borderColor: '#FFF',
    },
    connectedBtnText: {
        color: '#4A4A4A',
    },
    connectedBtnTextDark: {
        color: '#FFF',
    },
    messageBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FAF9F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4A4A4A',
    },
    messageBtnDark: {
        backgroundColor: '#1C1C1E',
        borderColor: '#FFF',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 40,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#2C2C2C',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    statDividerDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
    postsSection: {
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 40,
    },
    sectionTitle: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 20,
    },
    postPreview: {
        marginBottom: 20,
        borderRadius: 20,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    postPreviewDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    postImage: {
        width: '100%',
        height: width - 48,
        backgroundColor: '#F0F0F0',
    },
    postContent: {
        padding: 20,
    },
    postChallenge: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    postText: {
        color: '#2C2C2C',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
        letterSpacing: -0.2,
    },
    emptyState: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: '#AEAEB2',
        fontSize: 15,
        fontWeight: '500',
    },
});
