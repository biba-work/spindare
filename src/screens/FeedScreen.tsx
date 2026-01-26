import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Image, Pressable } from 'react-native';
import { ReactionItem } from '../components/molecules/ReactionItem';
import { Post, PostService } from '../services/PostService';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface PostItemProps {
    post: Post;
    isOwner?: boolean;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
}

const PostItem = ({ post, isOwner, onProfilePress }: PostItemProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [isReacted, setIsReacted] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleSelect = (type: 'felt' | 'thought' | 'intrigued') => {
        if (isReacted || fadeOut) return;

        if (selected === type) {
            setSelected(null);
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        setSelected(type);
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            setFadeOut(true);
            try {
                await PostService.addReaction(post.id, type);
            } catch (err) {
                console.error("Firebase Reaction Error:", err);
            }

            setTimeout(() => {
                setIsReacted(true);
                setFadeOut(false);
            }, 800);
        }, 3000);
    };

    const handleProfilePress = () => {
        if (!isOwner && onProfilePress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onProfilePress(post.userId, post.author, post.avatar);
        }
    };

    const renderReactions = () => (
        <>
            <ReactionItem
                type="felt"
                count={post.reactions.felt + (selected === 'felt' ? 1 : 0)}
                active={selected === 'felt'}
                onSelect={() => handleSelect('felt')}
                isOwner={isOwner}
                fadeOut={fadeOut || isReacted}
            />
            <ReactionItem
                type="thought"
                count={post.reactions.thought + (selected === 'thought' ? 1 : 0)}
                active={selected === 'thought'}
                onSelect={() => handleSelect('thought')}
                isOwner={isOwner}
                fadeOut={fadeOut || isReacted}
            />
            <ReactionItem
                type="intrigued"
                count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)}
                active={selected === 'intrigued'}
                onSelect={() => handleSelect('intrigued')}
                isOwner={isOwner}
                fadeOut={fadeOut || isReacted}
            />
        </>
    );

    return (
        <View style={styles.postCard}>
            <View style={styles.header}>
                <Pressable
                    onPress={handleProfilePress}
                    style={styles.avatarContainer}
                    disabled={isOwner}
                >
                    <Image
                        source={{
                            uri: (post.author === 'rashica07' || post.author === 'example')
                                ? Image.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri
                                : (post.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80')
                        }}
                        style={styles.avatar}
                    />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Pressable onPress={handleProfilePress} disabled={isOwner}>
                        <Text style={styles.author}>
                            @{post.author} {isOwner && <Text style={styles.youLabel}>(You)</Text>}
                        </Text>
                    </Pressable>
                    <Text style={styles.time}>just now</Text>
                </View>
            </View>

            {post.media && post.media.trim() !== '' ? (
                <View style={styles.mediaContainer}>
                    <Image source={{ uri: post.media }} style={styles.media} resizeMode="cover" />
                    <View style={[styles.reactionOverlay, isReacted && { opacity: 0 }]}>
                        {renderReactions()}
                    </View>
                    <View style={[styles.textOverlay, isReacted && { paddingRight: 24 }]}>
                        {post.challenge && <Text style={styles.challengeLabel}>{post.challenge}</Text>}
                        <Text style={styles.contentText} numberOfLines={3}>{post.content}</Text>
                    </View>
                </View>
            ) : (
                <View style={[styles.textOnlyPost, isReacted && { opacity: 0.6 }]}>
                    <View style={styles.textOnlyBody}>
                        {post.challenge && <Text style={[styles.challengeLabel, { marginBottom: 8 }]}>{post.challenge}</Text>}
                        <Text style={styles.textOnlyContent}>{post.content}</Text>
                    </View>
                    {!isReacted && (
                        <View style={styles.horizontalReactions}>
                            {renderReactions()}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

interface FeedScreenProps {
    posts: Post[];
    currentUserId?: string;
    ListHeaderComponent?: React.ReactElement;
    onScroll?: (event: any) => void;
    contentContainerStyle?: any;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
}

export const FeedScreen = ({
    posts,
    currentUserId,
    ListHeaderComponent,
    onScroll,
    contentContainerStyle,
    onProfilePress
}: FeedScreenProps) => {
    return (
        <View style={styles.container}>
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <PostItem
                        post={item}
                        isOwner={item.userId === currentUserId}
                        onProfilePress={onProfilePress}
                    />
                )}
                contentContainerStyle={[styles.list, contentContainerStyle]}
                ListHeaderComponent={ListHeaderComponent}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    list: { paddingBottom: 100 },
    postCard: {
        marginBottom: 32,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        gap: 12,
    },
    avatarContainer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E5E5E5',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    headerInfo: {
        flex: 1,
    },
    author: {
        color: '#2C2C2C',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    youLabel: {
        color: '#A7BBC7',
        fontWeight: '500',
        fontSize: 13,
    },
    time: {
        color: '#AEAEB2',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    mediaContainer: {
        width: width,
        height: width * 1.25,
        backgroundColor: '#F0F0F0',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    reactionOverlay: {
        position: 'absolute',
        right: 16,
        top: '15%',
        zIndex: 10,
    },
    textOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingRight: 80,
        backgroundColor: 'rgba(250, 249, 246, 0.92)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    challengeLabel: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    contentText: {
        color: '#2C2C2C',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    textOnlyPost: {
        marginHorizontal: 20,
        paddingVertical: 4,
    },
    textOnlyBody: {
        marginBottom: 24,
    },
    textOnlyContent: {
        color: '#2C2C2C',
        fontSize: 20,
        fontWeight: '400',
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    horizontalReactions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
        marginHorizontal: -4,
    },
});
