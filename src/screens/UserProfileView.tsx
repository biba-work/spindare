import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, PostService } from '../services/PostService';
import { FeedScreen } from './FeedScreen';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

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

interface UserProfileViewProps {
    userId: string;
    username: string;
    avatar: string;
    onBack: () => void;
}

export const UserProfileView = ({ userId, username, avatar, onBack }: UserProfileViewProps) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const unsubscribe = PostService.subscribeToUserPosts(userId, (userPosts) => {
            setPosts(userPosts);
        });
        return () => unsubscribe();
    }, [userId]);

    const handleConnect = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsConnected(!isConnected);
        // TODO: Implement Firebase connection logic
    };

    const totalReactions = posts.reduce((sum, post) =>
        sum + post.reactions.felt + post.reactions.thought + post.reactions.intrigued, 0
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <Pressable onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <BackIcon color="#4A4A4A" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.profileSection}>
                        <View style={styles.pfpContainer}>
                            <Image source={{ uri: avatar }} style={styles.pfp} />
                        </View>
                        <Text style={styles.username}>@{username}</Text>

                        <Pressable
                            onPress={handleConnect}
                            style={[styles.connectBtn, isConnected && styles.connectedBtn]}
                        >
                            {!isConnected && <UserPlusIcon color="#FAF9F6" />}
                            <Text style={[styles.connectBtnText, isConnected && styles.connectedBtnText]}>
                                {isConnected ? 'CONNECTED' : 'CONNECT'}
                            </Text>
                        </Pressable>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{totalReactions}</Text>
                                <Text style={styles.statLabel}>Reactions</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.postsSection}>
                        <Text style={styles.sectionTitle}>POSTS</Text>
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <View key={post.id} style={styles.postPreview}>
                                    {post.media ? (
                                        <Image source={{ uri: post.media }} style={styles.postImage} />
                                    ) : null}
                                    <View style={styles.postContent}>
                                        {post.challenge && <Text style={styles.postChallenge}>{post.challenge}</Text>}
                                        <Text style={styles.postText} numberOfLines={3}>{post.content}</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No posts yet</Text>
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
    backBtn: { padding: 4 },
    headerTitle: {
        color: '#4A4A4A',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    placeholder: { width: 32 },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    pfpContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        backgroundColor: '#FAF9F6',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.06)',
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
        marginBottom: 20,
        letterSpacing: -0.5,
    },
    connectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 24,
        backgroundColor: '#4A4A4A',
        marginBottom: 32,
        shadowColor: '#4A4A4A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    connectedBtn: {
        backgroundColor: '#FAF9F6',
        borderWidth: 2,
        borderColor: '#4A4A4A',
        shadowOpacity: 0,
    },
    connectBtnText: {
        color: '#FAF9F6',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    connectedBtnText: {
        color: '#4A4A4A',
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
        fontSize: 24,
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
