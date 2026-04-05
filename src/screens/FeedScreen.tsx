import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Image, Pressable, Modal, Platform, Share, Alert, PanResponder } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ChatService } from '../services/ChatService';
import { ReactionItem } from '../components/molecules/ReactionItem';
import { ImageViewer } from '../components/molecules/MediaViewer';
import { Post, PostService } from '../services/PostService';
import * as Haptics from 'expo-haptics';
import { SoundService } from '../services/SoundService';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

// ── Minimal SVG icons ─────────────────────────────────────────────────────────
const SendIcon = ({ color, size = 18 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const CameraIcon = ({ color, size = 18 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color, size = 18 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color, size = 18 }: { color: string; size?: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const isVideoUrl = (url?: string | null): boolean =>
    !!url && /\.(mp4|mov|avi|webm|3gp)/i.test(url);

// ── Spin badge icon ───────────────────────────────────────────────────────────
const SpinIcon = ({ color }: { color: string }) => (
    <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 4v6h-6" />
        <Path d="M1 20v-6h6" />
        <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </Svg>
);

// ── Video player ──────────────────────────────────────────────────────────────
const VideoPost = memo(({ uri }: { uri: string }) => {
    const player = useVideoPlayer(uri, p => {
        p.loop = false;
        p.pause();
    });
    return (
        <View style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: '#000', borderRadius: 2, overflow: 'hidden' }}>
            <VideoView
                player={player}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                nativeControls
            />
        </View>
    );
});

// ── Time formatting ───────────────────────────────────────────────────────────
const formatRelativeTime = (dateStr?: string | null): string => {
    if (!dateStr) return 'now';
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60)    return 'now';
    if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
    return `${Math.floor(diffSec / 604800)}w`;
};

// ── Post item ─────────────────────────────────────────────────────────────────

interface PostItemProps {
    post: Post;
    isOwner?: boolean;
    currentUserId?: string;
    currentUsername?: string;
    currentAvatar?: string | null;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
    onChallengeAction?: (challenge: string, action: 'send' | 'camera' | 'gallery' | 'text') => void;
    onSaveChallenge?: (challenge: string) => void;
    savedChallenges?: { challenge: string; expiresAt: string }[];
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
    onSaveChallenge,
    savedChallenges,
    darkMode,
    delay
}: PostItemProps) => {
    const { showToast } = useToast();
    const isSaved = !!(post.challenge && savedChallenges?.some(s => s.challenge === post.challenge));
    const [selected, setSelected] = useState<string | null>(null);
    const [showChallengeMenu, setShowChallengeMenu] = useState(false);
    const [showDotsMenu, setShowDotsMenu] = useState(false);
    const [challengeExpanded, setChallengeExpanded] = useState(false);
    const [reactionsGone, setReactionsGone] = useState(false);
    const reactedFade = useRef(new Animated.Value(1)).current;
    const isDBReaction = useRef(false);

    const entranceAnim = useRef(new Animated.Value(0)).current;
    const reactionScale = useRef(new Animated.Value(1)).current;

    // ── Sheet slide animations ─────────────────────────────────────────────
    const dotsSheetY = useRef(new Animated.Value(600)).current;
    const challengeSheetY = useRef(new Animated.Value(600)).current;

    const dotsPan = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => { if (gs.dy > 0) dotsSheetY.setValue(gs.dy); },
        onPanResponderRelease: (_, gs) => {
            if (gs.dy > 90 || gs.vy > 0.6) {
                Animated.timing(dotsSheetY, { toValue: 600, duration: 250, useNativeDriver: true })
                    .start(() => setShowDotsMenu(false));
            } else {
                Animated.spring(dotsSheetY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start();
            }
        },
    })).current;

    const challengePan = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => { if (gs.dy > 0) challengeSheetY.setValue(gs.dy); },
        onPanResponderRelease: (_, gs) => {
            if (gs.dy > 90 || gs.vy > 0.6) {
                Animated.timing(challengeSheetY, { toValue: 600, duration: 250, useNativeDriver: true })
                    .start(() => setShowChallengeMenu(false));
            } else {
                Animated.spring(challengeSheetY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start();
            }
        },
    })).current;

    // Load persisted reaction
    useEffect(() => {
        if (!currentUserId || isOwner) return;
        PostService.getUserReaction(currentUserId, post.id)
            .then(r => { if (r) { isDBReaction.current = true; setSelected(r); } })
            .catch(() => {});
    }, [post.id, currentUserId]);

    // Fade reactions after user taps
    const [justReacted, setJustReacted] = useState(false);
    useEffect(() => {
        if (isOwner || !justReacted) return;
        const timer = setTimeout(() => {
            Animated.timing(reactedFade, { toValue: 0, duration: 600, useNativeDriver: true })
                .start(() => setReactionsGone(true));
        }, 1500);
        return () => clearTimeout(timer);
    }, [justReacted]);

    // Entrance animation
    useEffect(() => {
        Animated.spring(entranceAnim, {
            toValue: 1, delay: delay || 0, useNativeDriver: true, friction: 8, tension: 40,
        }).start();
    }, []);

    const handleSelect = async (type: 'felt' | 'thought' | 'intrigued') => {
        if (isOwner) return;
        isDBReaction.current = false;
        setJustReacted(true);

        if (selected === type) {
            setSelected(null);
            SoundService.unreaction();
            Animated.spring(reactionScale, { toValue: 0.95, useNativeDriver: true, friction: 5, tension: 80 }).start(() => {
                Animated.spring(reactionScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }).start();
            });
            try { if (currentUserId) await PostService.toggleReaction(currentUserId, currentUsername || 'Anonymous', currentAvatar || null, post.id, type); } catch (e) {}
            return;
        }

        setSelected(type);
        SoundService.reaction();
        reactionScale.setValue(0.85);
        Animated.spring(reactionScale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 180 }).start();

        try {
            if (currentUserId) await PostService.toggleReaction(currentUserId, currentUsername || 'Anonymous', currentAvatar || null, post.id, type);
        } catch (err) { console.error("Reaction Error:", err); }
    };

    const handleProfilePress = () => {
        if (!isOwner && onProfilePress) {
            SoundService.tap();
            onProfilePress(post.userId, post.author, post.avatar);
        }
    };

    const handleChallengeAction = (action: 'send' | 'camera' | 'gallery' | 'text') => {
        SoundService.tap();
        closeChallengeMenu(() => {
            if (currentUserId && post.userId && currentUserId !== post.userId && post.challenge) {
                ChatService.sendChallengeToUser(currentUserId, post.userId, post.author, post.challenge, post.avatar)
                    .catch(e => console.warn('Challenge DM error:', e));
            }
            if (onChallengeAction && post.challenge) onChallengeAction(post.challenge, action);
        });
    };

    const openChallengeMenu = () => {
        SoundService.tap();
        challengeSheetY.setValue(600);
        setShowChallengeMenu(true);
        Animated.spring(challengeSheetY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 55 }).start();
    };

    const closeChallengeMenu = (cb?: () => void) => {
        Animated.timing(challengeSheetY, { toValue: 600, duration: 260, useNativeDriver: true })
            .start(() => { setShowChallengeMenu(false); cb?.(); });
    };

    const handleDotsMenu = () => {
        SoundService.tap();
        dotsSheetY.setValue(600);
        setShowDotsMenu(true);
        Animated.spring(dotsSheetY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 55 }).start();
    };

    const closeDotsMenu = (cb?: () => void) => {
        Animated.timing(dotsSheetY, { toValue: 600, duration: 260, useNativeDriver: true })
            .start(() => { setShowDotsMenu(false); cb?.(); });
    };

    const handleSaveChallenge = () => {
        closeDotsMenu(() => {
            if (post.challenge && onSaveChallenge) {
                SoundService.save?.();
                onSaveChallenge(post.challenge);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        });
    };

    const handleSharePost = () => {
        closeDotsMenu(async () => {
            try {
                await Share.share({
                    message: post.challenge
                        ? `"${post.challenge}" — completed by @${post.author} on Spindare`
                        : `Check out @${post.author}'s post on Spindare`,
                    title: 'Spindare Challenge',
                });
            } catch (e) {}
        });
    };

    const hasMedia = post.media && post.media.trim() !== '';
    const isVideo = isVideoUrl(post.media);
    const totalReactions = post.reactions.felt + post.reactions.thought + post.reactions.intrigued;

    // ── Reaction row (shared across post types) ───────────────────────────────
    const renderReactionRow = () => {
        if (isOwner) return null;
        if (reactionsGone) return null;
        return (
            <Animated.View style={[s.reactionRow, { opacity: reactedFade, transform: [{ scale: reactionScale }] }]}>
                <ReactionItem type="felt" count={post.reactions.felt + (selected === 'felt' ? 1 : 0)} active={selected === 'felt'} onSelect={() => handleSelect('felt')} isOwner={isOwner} fadeOut={false} />
                <ReactionItem type="thought" count={post.reactions.thought + (selected === 'thought' ? 1 : 0)} active={selected === 'thought'} onSelect={() => handleSelect('thought')} isOwner={isOwner} fadeOut={false} />
                <ReactionItem type="intrigued" count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)} active={selected === 'intrigued'} onSelect={() => handleSelect('intrigued')} isOwner={isOwner} fadeOut={false} />
            </Animated.View>
        );
    };

    // ── Owner reaction summary ────────────────────────────────────────────────
    const renderOwnerReactions = () => {
        if (!isOwner || totalReactions === 0) return null;
        return (
            <View style={s.ownerReactionRow}>
                {post.reactions.felt > 0 && (
                    <View style={[s.ownerChip, darkMode && s.ownerChipDark]}>
                        <View style={[s.reactionDot, { backgroundColor: '#007AFF' }]} />
                        <Text style={[s.ownerChipCount, darkMode && { color: '#E5E5EA' }]}>{post.reactions.felt}</Text>
                    </View>
                )}
                {post.reactions.thought > 0 && (
                    <View style={[s.ownerChip, darkMode && s.ownerChipDark]}>
                        <View style={[s.reactionDot, { backgroundColor: '#FFD60A' }]} />
                        <Text style={[s.ownerChipCount, darkMode && { color: '#E5E5EA' }]}>{post.reactions.thought}</Text>
                    </View>
                )}
                {post.reactions.intrigued > 0 && (
                    <View style={[s.ownerChip, darkMode && s.ownerChipDark]}>
                        <View style={[s.reactionDot, { backgroundColor: '#5856D6' }]} />
                        <Text style={[s.ownerChipCount, darkMode && { color: '#E5E5EA' }]}>{post.reactions.intrigued}</Text>
                    </View>
                )}
                <Text style={[s.ownerTotal, darkMode && { color: '#636366' }]}>{totalReactions}</Text>
            </View>
        );
    };

    return (
        <Animated.View
            renderToHardwareTextureAndroid
            style={{
                opacity: entranceAnim,
                transform: [
                    { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                    { scale: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                ],
            }}
        >
            <View style={[s.card, darkMode && s.cardDark]}>

                {/* ── Author row ─────────────────────────────────────── */}
                <View style={s.authorRow}>
                    <Pressable onPress={handleProfilePress} disabled={isOwner} style={s.avatarWrap}>
                        <Image
                            source={{
                                uri: post.avatar || Image.resolveAssetSource(require('../../assets/icon.png')).uri
                            }}
                            style={s.avatar}
                        />
                    </Pressable>
                    <View style={s.authorMeta}>
                        <Pressable onPress={handleProfilePress} disabled={isOwner}>
                            <Text style={[s.authorName, darkMode && s.authorNameDark]} numberOfLines={1}>
                                {post.author}{isOwner ? <Text style={s.youTag}> · you</Text> : ''}
                            </Text>
                        </Pressable>
                        <Text style={s.timestamp}>{formatRelativeTime(post.timestamp || (post as any).created_at)}</Text>
                    </View>

                    {/* Spin count badge */}
                    {(post as any).spinCount > 0 && (
                        <View style={[s.spinBadge, darkMode && s.spinBadgeDark]}>
                            <SpinIcon color={darkMode ? '#A7BBC7' : '#6B8A99'} />
                            <Text style={[s.spinBadgeText, darkMode && s.spinBadgeTextDark]}>
                                {(post as any).spinCount}
                            </Text>
                        </View>
                    )}

                    {/* Three-dot menu — useful actions */}
                    {post.challenge && (
                        <Pressable
                            onPress={handleDotsMenu}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={({ pressed }) => [s.moreBtn, pressed && { opacity: 0.5 }]}
                        >
                            <Ionicons name="ellipsis-horizontal" size={18} color={darkMode ? '#8E8E93' : '#AEAEB2'} />
                        </Pressable>
                    )}
                </View>

                {/* ── Challenge pill — tap to expand full text ────────── */}
                {post.challenge && (
                    <Pressable
                        onPress={() => { setChallengeExpanded(e => !e); SoundService.tap(); }}
                        style={s.challengePillWrap}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                        <View style={[s.challengePill, darkMode && s.challengePillDark]}>
                            <Ionicons name="flash" size={10} color={darkMode ? '#A7BBC7' : '#6B8A99'} />
                            <Text
                                style={[s.challengePillText, darkMode && s.challengePillTextDark]}
                                numberOfLines={challengeExpanded ? undefined : 1}
                            >
                                {post.challenge}
                            </Text>
                            {/* Chevron hint when text is truncated */}
                            <Ionicons
                                name={challengeExpanded ? 'chevron-up' : 'chevron-down'}
                                size={10}
                                color={darkMode ? '#A7BBC7' : '#6B8A99'}
                            />
                        </View>
                    </Pressable>
                )}

                {/* ── Media ──────────────────────────────────────────── */}
                {hasMedia ? (
                    isVideo ? (
                        <View style={s.mediaWrap}>
                            <VideoPost uri={post.media!} />
                        </View>
                    ) : (
                        <View style={s.mediaWrap}>
                            <ImageViewer imageUri={post.media!}>
                                {/* Reactions float on image — onImage gives them a dark backing */}
                                {!isOwner && !reactionsGone && (
                                    <Animated.View style={[s.imageReactions, { opacity: reactedFade, transform: [{ scale: reactionScale }] }]}>
                                        <ReactionItem type="felt" count={post.reactions.felt + (selected === 'felt' ? 1 : 0)} active={selected === 'felt'} onSelect={() => handleSelect('felt')} isOwner={isOwner} fadeOut={false} onImage />
                                        <ReactionItem type="thought" count={post.reactions.thought + (selected === 'thought' ? 1 : 0)} active={selected === 'thought'} onSelect={() => handleSelect('thought')} isOwner={isOwner} fadeOut={false} onImage />
                                        <ReactionItem type="intrigued" count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)} active={selected === 'intrigued'} onSelect={() => handleSelect('intrigued')} isOwner={isOwner} fadeOut={false} onImage />
                                    </Animated.View>
                                )}
                                {/* Text overlay on image */}
                                {post.content ? (
                                    <View style={[s.imageTextOverlay, darkMode && s.imageTextOverlayDark]}>
                                        <Text style={[s.imageContentText, darkMode && { color: '#E5E5EA' }]} numberOfLines={3}>{post.content}</Text>
                                    </View>
                                ) : null}
                            </ImageViewer>
                        </View>
                    )
                ) : null}

                {/* ── Text content (always shown for text-only, or below video) ─ */}
                {(!hasMedia || isVideo) && post.content ? (
                    <View style={s.textBody}>
                        <Text style={[s.bodyText, darkMode && s.bodyTextDark]}>{post.content}</Text>
                    </View>
                ) : null}

                {/* ── Reactions (text-only + video posts) ────────────── */}
                {(!hasMedia || isVideo) && renderReactionRow()}

                {/* ── Owner reaction summary ─────────────────────────── */}
                {renderOwnerReactions()}

                {/* ── Bottom action row ──────────────────────────────── */}
                {!isOwner && post.challenge && (
                    <View style={s.challengeActions}>
                        <Pressable
                            onPress={openChallengeMenu}
                            style={({ pressed }) => [s.challengeBtn, s.challengeBtnFlex, darkMode && s.challengeBtnDark, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="flash" size={14} color={darkMode ? '#E5E5EA' : '#3A3A3C'} />
                            <Text style={[s.challengeBtnText, darkMode && s.challengeBtnTextDark]}>Try this challenge</Text>
                        </Pressable>
                        {onSaveChallenge && (
                            <Pressable
                                onPress={() => {
                                    if (post.challenge && onSaveChallenge && !isSaved) {
                                        onSaveChallenge(post.challenge);
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        SoundService.save?.();
                                        showToast('Saved! 🔖', { type: 'success' });
                                    }
                                }}
                                style={({ pressed }) => [
                                    s.saveInlineBtn,
                                    darkMode && s.saveInlineBtnDark,
                                    isSaved && s.saveInlineBtnSaved,
                                    isSaved && darkMode && s.saveInlineBtnSavedDark,
                                    pressed && !isSaved && { opacity: 0.7 },
                                ]}
                            >
                                <Ionicons
                                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                                    size={14}
                                    color={isSaved ? '#fff' : (darkMode ? '#8E8E93' : '#AEAEB2')}
                                />
                                <Text style={[
                                    s.saveInlineBtnText,
                                    darkMode && s.saveInlineBtnTextDark,
                                    isSaved && s.saveInlineBtnTextSaved,
                                ]}>
                                    {isSaved ? 'Saved' : 'Save'}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </View>

            {/* ── Dots context menu ─────────────────────────────────────── */}
            <Modal visible={showDotsMenu} transparent animationType="none" onRequestClose={() => closeDotsMenu()}>
                <Pressable style={s.sheetOverlay} onPress={() => closeDotsMenu()}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={60} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]} />
                    )}
                    <Animated.View
                        style={[s.sheet, s.dotsSheet, darkMode && s.sheetDark, { transform: [{ translateY: dotsSheetY }] }]}
                        {...dotsPan.panHandlers}
                    >
                        <View style={s.sheetHandle} />

                        {/* Save challenge */}
                        {!isOwner && post.challenge && onSaveChallenge && (
                            <Pressable
                                onPress={handleSaveChallenge}
                                style={({ pressed }) => [s.dotsRow, darkMode && s.dotsRowDark, pressed && { opacity: 0.6 }]}
                            >
                                <View style={[s.dotsIconCircle, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                                    <Ionicons name="bookmark-outline" size={18} color="#30D158" />
                                </View>
                                <View style={s.dotsText}>
                                    <Text style={[s.dotsLabel, darkMode && { color: '#F0F0F0' }]}>Save challenge</Text>
                                    <Text style={s.dotsSub}>Add to your saved list</Text>
                                </View>
                            </Pressable>
                        )}

                        {/* Share */}
                        <Pressable
                            onPress={handleSharePost}
                            style={({ pressed }) => [s.dotsRow, darkMode && s.dotsRowDark, pressed && { opacity: 0.6 }]}
                        >
                            <View style={[s.dotsIconCircle, { backgroundColor: 'rgba(0,122,255,0.12)' }]}>
                                <Ionicons name="share-outline" size={18} color="#007AFF" />
                            </View>
                            <View style={s.dotsText}>
                                <Text style={[s.dotsLabel, darkMode && { color: '#F0F0F0' }]}>Share post</Text>
                                <Text style={s.dotsSub}>Send to friends or apps</Text>
                            </View>
                        </Pressable>

                        {/* Try this challenge — opens action sheet */}
                        {!isOwner && post.challenge && (
                            <Pressable
                                onPress={() => closeDotsMenu(() => openChallengeMenu())}
                                style={({ pressed }) => [s.dotsRow, darkMode && s.dotsRowDark, pressed && { opacity: 0.6 }]}
                            >
                                <View style={[s.dotsIconCircle, { backgroundColor: 'rgba(255,159,10,0.12)' }]}>
                                    <Ionicons name="flash-outline" size={18} color="#FF9F0A" />
                                </View>
                                <View style={s.dotsText}>
                                    <Text style={[s.dotsLabel, darkMode && { color: '#F0F0F0' }]}>Try this challenge</Text>
                                    <Text style={s.dotsSub}>Camera, gallery, or text</Text>
                                </View>
                            </Pressable>
                        )}

                        <Pressable onPress={() => closeDotsMenu()} style={[s.sheetCancel, darkMode && s.sheetCancelDark, { marginTop: 4 }]}>
                            <Text style={s.sheetCancelText}>Cancel</Text>
                        </Pressable>
                    </Animated.View>
                </Pressable>
            </Modal>

            {/* ── Challenge action sheet ────────────────────────────────── */}
            <Modal visible={showChallengeMenu} transparent animationType="none" onRequestClose={() => closeChallengeMenu()}>
                <Pressable style={s.sheetOverlay} onPress={() => closeChallengeMenu()}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={60} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]} />
                    )}
                    <Animated.View
                        style={[s.sheet, darkMode && s.sheetDark, { transform: [{ translateY: challengeSheetY }] }]}
                        {...challengePan.panHandlers}
                    >
                        <View style={s.sheetHandle} />
                        <Text style={[s.sheetTitle, darkMode && { color: '#F2F2F7' }]} numberOfLines={2}>"{post.challenge}"</Text>
                        <Text style={s.sheetSubtitle}>What do you want to do?</Text>

                        <View style={s.sheetActions}>
                            <Pressable onPress={() => handleChallengeAction('send')} style={({ pressed }) => [s.sheetAction, darkMode && s.sheetActionDark, pressed && { transform: [{ scale: 0.95 }] }]}>
                                <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(167,187,199,0.15)' }]}>
                                    <SendIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={16} />
                                </View>
                                <Text style={[s.sheetActionLabel, darkMode && { color: '#E5E5EA' }]}>Send</Text>
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('camera')} style={({ pressed }) => [s.sheetAction, darkMode && s.sheetActionDark, pressed && { transform: [{ scale: 0.95 }] }]}>
                                <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(167,187,199,0.15)' }]}>
                                    <CameraIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={16} />
                                </View>
                                <Text style={[s.sheetActionLabel, darkMode && { color: '#E5E5EA' }]}>Camera</Text>
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('gallery')} style={({ pressed }) => [s.sheetAction, darkMode && s.sheetActionDark, pressed && { transform: [{ scale: 0.95 }] }]}>
                                <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(167,187,199,0.15)' }]}>
                                    <GalleryIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={16} />
                                </View>
                                <Text style={[s.sheetActionLabel, darkMode && { color: '#E5E5EA' }]}>Gallery</Text>
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('text')} style={({ pressed }) => [s.sheetAction, darkMode && s.sheetActionDark, pressed && { transform: [{ scale: 0.95 }] }]}>
                                <View style={[s.sheetIconCircle, { backgroundColor: 'rgba(167,187,199,0.15)' }]}>
                                    <TextIcon color={darkMode ? '#E5E5EA' : '#3A3A3C'} size={16} />
                                </View>
                                <Text style={[s.sheetActionLabel, darkMode && { color: '#E5E5EA' }]}>Write</Text>
                            </Pressable>
                        </View>

                        <Pressable onPress={() => closeChallengeMenu()} style={[s.sheetCancel, darkMode && s.sheetCancelDark]}>
                            <Text style={s.sheetCancelText}>Cancel</Text>
                        </Pressable>
                    </Animated.View>
                </Pressable>
            </Modal>
        </Animated.View>
    );
});

// ── Feed container ────────────────────────────────────────────────────────────

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
    onSaveChallenge?: (challenge: string) => void;
    savedChallenges?: { challenge: string; expiresAt: string }[];
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
    onChallengeAction,
    onSaveChallenge,
    savedChallenges,
}: FeedScreenProps) => {
    const { darkMode } = useTheme();

    return (
        <View style={[s.container, darkMode && s.containerDark]}>
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
                        onSaveChallenge={onSaveChallenge}
                        savedChallenges={savedChallenges}
                        darkMode={darkMode}
                        delay={index * 70}
                    />
                )}
                contentContainerStyle={[s.list, contentContainerStyle]}
                ListHeaderComponent={ListHeaderComponent}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            />
        </View>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F3' },
    containerDark: { backgroundColor: '#0A0A0A' },
    list: { paddingBottom: 100, paddingTop: 4 },

    // ── Card ──────────────────────────────────────────────────────────────
    card: {
        marginHorizontal: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    cardDark: {
        backgroundColor: '#1A1A1C',
        shadowOpacity: 0.2,
    },

    // ── Author row ────────────────────────────────────────────────────────
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 8,
    },
    avatarWrap: {
        marginRight: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8E8E8',
    },
    authorMeta: {
        flex: 1,
    },
    authorName: {
        color: '#1A1A1A',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    authorNameDark: { color: '#F0F0F0' },
    youTag: {
        color: '#AEAEB2',
        fontWeight: '400',
        fontSize: 13,
    },
    timestamp: {
        color: '#AEAEB2',
        fontSize: 12,
        fontWeight: '400',
        marginTop: 1,
    },
    moreBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Spin badge ────────────────────────────────────────────────────────
    spinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(107,138,153,0.1)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(107,138,153,0.2)',
        marginRight: 4,
    },
    spinBadgeDark: {
        backgroundColor: 'rgba(167,187,199,0.1)',
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

    // ── Challenge pill ────────────────────────────────────────────────────
    challengePillWrap: {
        paddingHorizontal: 14,
        paddingBottom: 10,
    },
    challengePill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        backgroundColor: 'rgba(107,138,153,0.12)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        // no border — cleaner look
    },
    challengePillDark: {
        backgroundColor: 'rgba(167,187,199,0.1)',
    },
    challengePillText: {
        color: '#6B8A99',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
        maxWidth: width - 100,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    challengePillTextDark: {
        color: '#A7BBC7',
    },

    // ── Media ─────────────────────────────────────────────────────────────
    mediaWrap: {
        width: '100%',
    },

    // ── Image overlay reactions ───────────────────────────────────────────
    imageReactions: {
        position: 'absolute',
        right: 6,
        top: '5%',
        zIndex: 10,
        gap: 4,
    },
    imageTextOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.92)',
    },
    imageTextOverlayDark: {
        backgroundColor: 'rgba(20,20,22,0.92)',
    },
    imageContentText: {
        color: '#1A1A1A',
        fontSize: 16,
        lineHeight: 23,
        fontWeight: '400',
    },

    // ── Text body (no-media posts & video captions) ──────────────────────
    textBody: {
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    bodyText: {
        color: '#1A1A1A',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
    },
    bodyTextDark: { color: '#F0F0F0' },

    // ── Reaction row (text/video posts) ──────────────────────────────────
    reactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingBottom: 10,
        paddingTop: 4,
    },

    // ── Owner reaction chips ─────────────────────────────────────────────
    ownerReactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        gap: 8,
    },
    ownerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    ownerChipDark: {
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    reactionDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    ownerChipCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3C3C43',
    },
    ownerTotal: {
        fontSize: 11,
        color: '#AEAEB2',
        marginLeft: 'auto' as any,
    },

    // ── Challenge button ─────────────────────────────────────────────────
    challengeActions: {
        flexDirection: 'row',
        marginHorizontal: 14,
        marginBottom: 14,
        gap: 8,
    },
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        gap: 6,
    },
    challengeBtnFlex: { flex: 1 },
    challengeBtnDark: {
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    challengeBtnText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#3A3A3C',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    challengeBtnTextDark: { color: '#E5E5EA' },
    saveInlineBtnSaved: {
        backgroundColor: '#1C1C1E',
    },
    saveInlineBtnSavedDark: {
        backgroundColor: '#000',
    },
    saveInlineBtnTextSaved: {
        color: '#fff',
        fontWeight: '600',
    },
    saveInlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        gap: 5,
    },
    saveInlineBtnDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
    saveInlineBtnText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#AEAEB2',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    saveInlineBtnTextDark: { color: '#636366' },

    // ── Dots context menu rows ────────────────────────────────────────────
    dotsSheet: {
        paddingHorizontal: 20,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    dotsRowDark: {
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    dotsIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotsText: {
        flex: 1,
        gap: 2,
    },
    dotsLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    dotsSub: {
        fontSize: 12,
        color: '#8E8E93',
    },

    // ── Action sheet (challenge menu) ────────────────────────────────────
    sheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 12,
    },
    sheetDark: {
        backgroundColor: '#1C1C1E',
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.12)',
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 4,
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    sheetSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 20,
    },
    sheetActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    sheetAction: {
        alignItems: 'center',
        gap: 8,
    },
    sheetActionDark: {},
    sheetIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sheetActionLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3A3A3C',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
    sheetCancel: {
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
    },
    sheetCancelDark: {
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    sheetCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FF3B30',
        paddingRight: Platform.OS === 'android' ? 6 : 0,
    },
});
