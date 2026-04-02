import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Image, Pressable, Modal, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ChatService } from '../services/ChatService';
import { ReactionItem } from '../components/molecules/ReactionItem';
import { ImageViewer } from '../components/molecules/MediaViewer';
import { Post, PostService } from '../services/PostService';
import * as Haptics from 'expo-haptics';
import { SoundService } from '../services/SoundService';
import { useTheme } from '../contexts/ThemeContext';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

// SPIND-style action icons
const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const ChallengeIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const SpinIcon = ({ color }: { color: string }) => (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 4v6h-6" />
        <Path d="M1 20v-6h6" />
        <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </Svg>
);

const isVideoUrl = (url?: string | null): boolean =>
    !!url && /\.(mp4|mov|avi|webm|3gp)/i.test(url);

// Inline video player for feed cards — uses expo-video (installed in SDK 55)
const VideoPost = memo(({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, p => {
        p.loop = false;
        p.pause();
    });
    return (
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
            <VideoView
                player={player}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                nativeControls
            />
        </View>
    );
});

const formatRelativeTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'just now';
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60)   return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return `${Math.floor(diffSec / 604800)}w ago`;
};

const ClockIcon = ({ color }: { color: string }) => (
    <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="10" />
        <Path d="M12 6v6l4 2" />
    </Svg>
);

interface PostItemProps {
    post: Post;
    isOwner?: boolean;
    currentUserId?: string;
    currentUsername?: string;
    currentAvatar?: string | null;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
    onChallengeAction?: (challenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => void;
    darkMode: boolean;
    delay?: number;
}

const PostItem = memo(({
    post,
    isOwner,
    currentUserId,
    currentUsername,
    currentAvatar,
    onProfilePress,
    onChallengeAction,
    darkMode,
    delay
}: PostItemProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [showChallengeMenu, setShowChallengeMenu] = useState(false);

    // After reacting, fade reactions out so the card compacts
    const [reactionsGone, setReactionsGone] = useState(false);
    const reactedFade = useRef(new Animated.Value(1)).current;
    // True while reaction was loaded from DB (don't auto-fade on mount)
    const isDBReaction = useRef(false);

    const entranceAnim = useRef(new Animated.Value(0)).current;
    const challengeBtnScale = useRef(new Animated.Value(1)).current;
    const reactionScale = useRef(new Animated.Value(1)).current;

    // Load persisted reaction from DB on mount — so you can't re-react after refresh
    useEffect(() => {
        if (!currentUserId || isOwner) return;
        PostService.getUserReaction(currentUserId, post.id)
            .then(r => {
                if (r) {
                    isDBReaction.current = true;
                    setSelected(r);
                }
            })
            .catch(() => {});
    }, [post.id, currentUserId]);

    // When the user actively taps a reaction, fade the whole row out after 1.5s
    // (NOT when reaction is just loaded from the DB)
    const [justReacted, setJustReacted] = useState(false);
    useEffect(() => {
        if (isOwner || !justReacted) return;
        const timer = setTimeout(() => {
            Animated.timing(reactedFade, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }).start(() => setReactionsGone(true));
        }, 1500);
        return () => clearTimeout(timer);
    }, [justReacted]);

    // Card entrance
    useEffect(() => {
        Animated.spring(entranceAnim, {
            toValue: 1,
            delay: delay || 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
        }).start();
    }, []);

    const handleSelect = async (type: 'felt' | 'thought' | 'intrigued') => {
        if (isOwner) return; // No self-reactions

        // User actively interacting — allow fade timer, clear DB flag
        isDBReaction.current = false;
        setJustReacted(true);

        if (selected === type) {
            setSelected(null);
            SoundService.unreaction();
            Animated.spring(reactionScale, { toValue: 0.95, useNativeDriver: true, friction: 5, tension: 80 }).start(() => {
                Animated.spring(reactionScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }).start();
            });
            try {
                if (currentUserId) await PostService.toggleReaction(currentUserId, currentUsername || 'Anonymous', currentAvatar || null, post.id, type);
            } catch (e) { }
            return;
        }

        setSelected(type);
        SoundService.reaction();
        reactionScale.setValue(0.85);
        Animated.spring(reactionScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 180 }).start();

        try {
            if (currentUserId) await PostService.toggleReaction(currentUserId, currentUsername || 'Anonymous', currentAvatar || null, post.id, type);
        } catch (err) {
            console.error("Reaction Error:", err);
        }
    };

    const handleProfilePress = () => {
        if (!isOwner && onProfilePress) {
            SoundService.tap();
            onProfilePress(post.userId, post.author, post.avatar);
        }
    };

    const handleChallengeAction = (action: 'send' | 'camera' | 'gallery' | 'text') => {
        SoundService.tap();
        setShowChallengeMenu(false);

        // Notify the post author via DM that someone challenged them
        if (currentUserId && post.userId && currentUserId !== post.userId && post.challenge) {
            ChatService.sendChallengeToUser(
                currentUserId,
                post.userId,
                post.author,
                post.challenge,
                post.avatar
            ).catch(e => console.warn('Challenge DM error:', e));
        }

        if (onChallengeAction && post.challenge) {
            onChallengeAction(post.challenge, action);
        }
    };

    const openChallengeMenu = () => {
        SoundService.tap();
        setShowChallengeMenu(true);
    };

    const renderReactions = () => (
        <>
            <ReactionItem type="felt" count={post.reactions.felt + (selected === 'felt' ? 1 : 0)} active={selected === 'felt'} onSelect={() => handleSelect('felt')} isOwner={isOwner} fadeOut={false} />
            <ReactionItem type="thought" count={post.reactions.thought + (selected === 'thought' ? 1 : 0)} active={selected === 'thought'} onSelect={() => handleSelect('thought')} isOwner={isOwner} fadeOut={false} />
            <ReactionItem type="intrigued" count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)} active={selected === 'intrigued'} onSelect={() => handleSelect('intrigued')} isOwner={isOwner} fadeOut={false} />
        </>
    );

    const spinCount = (post as any).spinCount || 0;

    return (
        <Animated.View
            renderToHardwareTextureAndroid={true}
            style={{
                opacity: entranceAnim,
                transform: [
                    { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                    { scale: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ]
            }}
        >
        <View style={[styles.postCard, darkMode && styles.postCardDark, isOwner && styles.postCardOwner]}>
          <View style={styles.postCardInner}>

            {/* Author row */}
            <View style={styles.header}>
                <Pressable onPress={handleProfilePress} style={styles.avatarContainer} disabled={isOwner}>
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
                        <Text style={[styles.author, darkMode && styles.authorDark]}>
                            @{post.author} {isOwner && <Text style={styles.youLabel}>(You)</Text>}
                        </Text>
                    </Pressable>
                    <View style={styles.timeRow}>
                        <ClockIcon color="#AEAEB2" />
                        <Text style={styles.time}>{formatRelativeTime(post.timestamp || (post as any).created_at)}</Text>
                    </View>
                </View>
                {spinCount > 0 && (
                    <View style={[styles.spinBadge, darkMode && styles.spinBadgeDark]}>
                        <SpinIcon color={darkMode ? '#A7BBC7' : '#6B8A99'} />
                        <Text style={[styles.spinBadgeText, darkMode && styles.spinBadgeTextDark]}>
                            {spinCount}
                        </Text>
                    </View>
                )}
            </View>

            {/* Content */}
            {post.media && post.media.trim() !== '' ? (
                isVideoUrl(post.media) ? (
                    // ── Video post ──────────────────────────────────────────
                    <View>
                        <VideoPost uri={post.media} />
                        {post.challenge && (
                            <Text style={[styles.challengePillText, { paddingHorizontal: 16, paddingTop: 10 }, darkMode && styles.challengePillTextDark]} numberOfLines={1}>
                                {post.challenge}
                            </Text>
                        )}
                        {post.content ? (
                            <Text style={[styles.textOnlyContent, { paddingHorizontal: 16, paddingBottom: 12, fontSize: 15 }, darkMode && styles.textOnlyContentDark]} numberOfLines={3}>
                                {post.content}
                            </Text>
                        ) : null}
                        {!isOwner && !reactionsGone && (
                            <Animated.View style={[styles.horizontalReactions, { opacity: reactedFade, transform: [{ scale: reactionScale }] }]}>
                                {renderReactions()}
                            </Animated.View>
                        )}
                    </View>
                ) : (
                // ── Image post ───────────────────────────────────────────
                <ImageViewer imageUri={post.media}>
                    {/* Reactions on image — never for own posts; fade after tap for others */}
                    {!isOwner && !reactionsGone && (
                        <Animated.View style={[styles.reactionOverlay, { opacity: reactedFade, transform: [{ scale: reactionScale }] }]}>
                            {renderReactions()}
                        </Animated.View>
                    )}
                    <View style={[styles.textOverlay, darkMode && styles.textOverlayDark]}>
                        {post.challenge && <Text style={styles.challengeLabel}>{post.challenge}</Text>}
                        <Text style={[styles.contentText, darkMode && styles.contentTextDark]} numberOfLines={3}>{post.content}</Text>
                    </View>
                </ImageViewer>
                )
            ) : (
                <View style={styles.textOnlyPost}>
                    {post.challenge && (
                        <Text style={[styles.challengePillText, darkMode && styles.challengePillTextDark]} numberOfLines={1}>
                            {post.challenge}
                        </Text>
                    )}
                    <Text style={[styles.textOnlyContent, darkMode && styles.textOnlyContentDark]}>{post.content}</Text>
                    {/* Reactions: hidden for own posts; fade away after tapping for others */}
                    {!isOwner && !reactionsGone && (
                        <Animated.View style={[styles.horizontalReactions, { opacity: reactedFade, transform: [{ scale: reactionScale }] }]}>
                            {renderReactions()}
                        </Animated.View>
                    )}
                </View>
            )}

            {/* Compact reaction summary — shown on your own posts so you can see how many you got */}
            {isOwner && (post.reactions.felt + post.reactions.thought + post.reactions.intrigued) > 0 && (
                <View style={styles.reactionSummaryRow}>
                    {post.reactions.felt > 0 && (
                        <View style={styles.reactionSummaryChip}>
                            <View style={[styles.reactionDot, { backgroundColor: '#007AFF' }]} />
                            <Text style={[styles.reactionSummaryCount, darkMode && styles.reactionSummaryCountDark]}>{post.reactions.felt}</Text>
                        </View>
                    )}
                    {post.reactions.thought > 0 && (
                        <View style={styles.reactionSummaryChip}>
                            <View style={[styles.reactionDot, { backgroundColor: '#FFD60A' }]} />
                            <Text style={[styles.reactionSummaryCount, darkMode && styles.reactionSummaryCountDark]}>{post.reactions.thought}</Text>
                        </View>
                    )}
                    {post.reactions.intrigued > 0 && (
                        <View style={styles.reactionSummaryChip}>
                            <View style={[styles.reactionDot, { backgroundColor: '#5856D6' }]} />
                            <Text style={[styles.reactionSummaryCount, darkMode && styles.reactionSummaryCountDark]}>{post.reactions.intrigued}</Text>
                        </View>
                    )}
                    <Text style={[styles.reactionSummaryTotal, darkMode && styles.reactionSummaryTotalDark]}>
                        {post.reactions.felt + post.reactions.thought + post.reactions.intrigued} total
                    </Text>
                </View>
            )}

            {/* Challenge button — other users only */}
            {!isOwner && post.challenge && (
                <Pressable
                    onPress={openChallengeMenu}
                    onPressIn={() => Animated.spring(challengeBtnScale, { toValue: 0.94, useNativeDriver: true, friction: 10, tension: 200 }).start()}
                    onPressOut={() => Animated.spring(challengeBtnScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }).start()}
                    style={[styles.challengeBtn, darkMode && styles.challengeBtnDark]}
                >
                    <Animated.View style={{ transform: [{ scale: challengeBtnScale }] }}>
                        <ChallengeIcon color={darkMode ? '#FFF' : '#1C1C1E'} />
                    </Animated.View>
                    <Text style={[styles.challengeBtnText, darkMode && styles.challengeBtnTextDark]}>CHALLENGE</Text>
                </Pressable>
            )}

            {/* Challenge action modal */}
            <Modal visible={showChallengeMenu} transparent animationType="fade" onRequestClose={() => setShowChallengeMenu(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setShowChallengeMenu(false)}>
                    <BlurView intensity={80} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <View style={[styles.menuContainer, darkMode && styles.menuContainerDark]}>
                        <Text style={[styles.menuTitle, darkMode && { color: '#FFF' }]}>"{post.challenge}"</Text>
                        <View style={styles.menuActionsRow}>
                            <Pressable onPress={() => handleChallengeAction('send')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}><SendIcon color="#FAF9F6" /></Pressable>
                            <Pressable onPress={() => handleChallengeAction('camera')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}><CameraIcon color="#FAF9F6" /></Pressable>
                            <Pressable onPress={() => handleChallengeAction('gallery')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}><GalleryIcon color="#FAF9F6" /></Pressable>
                            <Pressable onPress={() => handleChallengeAction('text')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}><TextIcon color="#FAF9F6" /></Pressable>
                        </View>
                        <Pressable onPress={() => setShowChallengeMenu(false)} style={styles.menuCancelBtn}>
                            <Text style={styles.menuCancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
          </View>
        </View>
        </Animated.View>
    );
});

interface FeedScreenProps {
    posts: Post[];
    currentUserId?: string;
    currentUsername?: string;
    currentAvatar?: string | null;
    ListHeaderComponent?: React.ReactElement;
    onScroll?: (event: any) => void;
    contentContainerStyle?: any;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
    onChallengeAction?: (challenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => void;
}

export const FeedScreen = ({
    posts,
    currentUserId,
    currentUsername,
    currentAvatar,
    ListHeaderComponent,
    onScroll,
    contentContainerStyle,
    onProfilePress,
    onChallengeAction
}: FeedScreenProps) => {

    const { darkMode } = useTheme();

    return (
        <View style={[styles.container, darkMode && styles.containerDark]}>
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <PostItem
                        post={item}
                        isOwner={item.userId === currentUserId}
                        currentUserId={currentUserId}
                        currentUsername={currentUsername}
                        currentAvatar={currentAvatar}
                        onProfilePress={onProfilePress}
                        onChallengeAction={onChallengeAction}
                        darkMode={darkMode}
                        delay={index * 80}
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
    container: { flex: 1, backgroundColor: '#F2F1EE' },
    containerDark: { backgroundColor: '#111112' },
    list: { paddingBottom: 100, paddingTop: 8 },

    // ── Card (glassy) ─────────────────────────────────────────────────────────
    // Outer view: shadow only — no overflow so shadow renders on Android
    postCard: {
        marginHorizontal: 12,
        marginBottom: 14,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.78)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    // Inner view: clips content to rounded corners, no shadow
    postCardInner: {
        borderRadius: 22,
        overflow: 'hidden',
    },
    postCardDark: {
        backgroundColor: 'rgba(30,30,32,0.75)',
        shadowOpacity: 0.3,
    },
    postCardOwner: {
        marginBottom: 8,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        gap: 12,
    },
    avatarContainer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#E5E5E5',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    headerInfo: { flex: 1 },
    author: {
        color: '#1C1C1E',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.3,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    authorDark: { color: '#F2F2F7' },
    youLabel: { color: '#A7BBC7', fontWeight: '500', fontSize: 12 },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    time: {
        color: '#AEAEB2',
        fontSize: 11,
        fontWeight: '500',
    },

    // ── Spin badge (right side of header) ─────────────────────────────────────
    spinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(167,187,199,0.15)',
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(167,187,199,0.25)',
    },
    spinBadgeDark: {
        backgroundColor: 'rgba(167,187,199,0.12)',
        borderColor: 'rgba(167,187,199,0.18)',
    },
    spinBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B8A99',
    },
    spinBadgeTextDark: {
        color: '#A7BBC7',
    },

    // ── Image post overlays ───────────────────────────────────────────────────
    reactionOverlay: {
        position: 'absolute',
        right: 14,
        top: '8%',    // higher up — away from text overlay at bottom
        zIndex: 10,
    },
    textOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingRight: 20,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.5)',
    },
    textOverlayDark: {
        backgroundColor: 'rgba(30,30,32,0.85)',
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    challengeLabel: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    contentText: {
        color: '#1C1C1E',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
        letterSpacing: -0.2,
    },
    contentTextDark: { color: '#E5E5EA' },

    // ── Text-only post ────────────────────────────────────────────────────────
    textOnlyPost: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    challengePillText: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingRight: Platform.OS === 'android' ? 10 : 0,
    },
    challengePillTextDark: {
        color: '#636366',
    },
    textOnlyContent: {
        color: '#1C1C1E',
        fontSize: 19,
        fontWeight: '400',
        lineHeight: 28,
        // No letterSpacing — negative letterSpacing on Android clips emojis in post content
    },
    textOnlyContentDark: { color: '#F2F2F7' },
    horizontalReactions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
    },

    // ── Reaction summary (owner view) ─────────────────────────────────────────
    reactionSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 10,
    },
    reactionSummaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 5,
    },
    reactionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    reactionSummaryCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3C3C43',
    },
    reactionSummaryCountDark: { color: '#EBEBF5' },
    reactionSummaryTotal: {
        fontSize: 12,
        color: '#AEAEB2',
        marginLeft: 'auto' as any,
    },
    reactionSummaryTotalDark: { color: '#636366' },

    // ── Challenge button ──────────────────────────────────────────────────────
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 14,
        paddingVertical: 11,
        paddingHorizontal: 20,
        borderRadius: 14,
        backgroundColor: 'rgba(167,187,199,0.12)',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(167,187,199,0.25)',
    },
    challengeBtnDark: {
        backgroundColor: 'rgba(167,187,199,0.08)',
        borderColor: 'rgba(167,187,199,0.15)',
    },
    challengeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1C1C1E',
        letterSpacing: 0.5,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    challengeBtnTextDark: { color: '#F2F2F7' },

    // ── Challenge menu modal ──────────────────────────────────────────────────
    menuOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        width: width - 48,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    menuContainerDark: { backgroundColor: 'rgba(40,40,42,0.98)' },
    menuTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1C1C1E',
        textAlign: 'center',
        marginBottom: 4,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    menuActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    proofBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#3A3A3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proofBtnDark: { backgroundColor: '#2C2C2E' },
    menuCancelBtn: { paddingVertical: 12, paddingHorizontal: 32 },
    menuCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
});
