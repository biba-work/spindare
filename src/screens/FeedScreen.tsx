import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Image as NativeImage, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { ReactionItem } from '../components/molecules/ReactionItem';
import { ImageViewer } from '../components/molecules/MediaViewer';
import { Post, PostService } from '../services/PostService';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Skeleton } from '../components/atoms/Skeleton';

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

// Challenge button icon
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

const SpinLightningIcon = ({ color }: { color: string }) => (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Top Bolt */}
        <Path d="M15 5l2 4h-2l1 4" />
        {/* Bottom Bolt */}
        <Path d="M9 19l-2-4h2l-1-4" />
        {/* Connection arcs suggesting circle */}
        <Path d="M16 5a9 9 0 0 0-7 0" opacity="0.5" />
        <Path d="M8 19a9 9 0 0 0 7 0" opacity="0.5" />
    </Svg>
);

const KeepIcon = ({ color, filled }: { color: string, filled?: boolean }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={filled ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
        {/* Traditional Bookmark - 'Save', 'Classic' */}
        <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={filled ? color : "none"} fillOpacity={filled ? 1 : 0} />
    </Svg>
);

const PassIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Minimal Arrow Curve */}
        <Path d="M9 18l6-6-6-6" />
    </Svg>
);

interface PostItemProps {
    post: Post;
    isOwner?: boolean;
    onProfilePress?: (userId: string, username: string, avatar: string) => void;
    onChallengeAction?: (challenge: string, action: 'send' | 'camera' | 'gallery' | 'text', postId?: string) => void;
    darkMode: boolean;
    isKept?: boolean;
    onToggleKeep?: (challenge: string, postId: string) => void;
}



const PostSkeleton = ({ darkMode }: { darkMode: boolean }) => {
    return (
        <View style={[styles.postCard, darkMode && styles.postCardDark, { padding: 16 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
                <View>
                    <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
                    <Skeleton width={80} height={12} />
                </View>
            </View>
            {/* Body */}
            <Skeleton width="100%" height={250} borderRadius={16} style={{ marginBottom: 16 }} />
            {/* Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width={60} height={20} borderRadius={10} />
                <Skeleton width={60} height={20} borderRadius={10} />
                <Skeleton width={60} height={20} borderRadius={10} />
            </View>
        </View>
    );
};

const PostItem = ({ post, isOwner, onProfilePress, onChallengeAction, darkMode, isKept, onToggleKeep }: PostItemProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [isReacted, setIsReacted] = useState(false);
    const [showChallengeMenu, setShowChallengeMenu] = useState(false);
    const reactionAnim = useRef(new Animated.Value(1)).current;

    const formattedSpinCount = React.useMemo(() => {
        const count = post.spinCount || 0;
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }, [post.spinCount]);

    const handleSelect = async (type: 'felt' | 'thought' | 'intrigued') => {
        if (isReacted) return;

        if (selected === type) {
            // Deselect logic (undo)
            setSelected(null);
            try { await PostService.toggleReaction(post.id, type); } catch (e) { }
            return;
        }

        // Select Logic
        setSelected(type);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            await PostService.toggleReaction(post.id, type);

            // Wait 1.5s then fade out
            setTimeout(() => {
                Animated.timing(reactionAnim, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true
                }).start(() => {
                    setIsReacted(true);
                });
            }, 1500);

        } catch (err) {
            console.error("Reaction Error:", err);
        }
    };

    const handleProfilePress = () => {
        if (!isOwner && onProfilePress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onProfilePress(post.userId, post.author, post.avatar);
        }
    };

    const renderReactions = () => {
        const isImagePost = !!(post.media && post.media.trim() !== '');
        return (
            <>
                <ReactionItem
                    type="felt"
                    count={post.reactions.felt + (selected === 'felt' ? 1 : 0)}
                    active={selected === 'felt'}
                    onSelect={() => handleSelect('felt')}
                    isOwner={isOwner}
                    fadeOut={isReacted}
                    isImagePost={isImagePost}
                />
                <ReactionItem
                    type="thought"
                    count={post.reactions.thought + (selected === 'thought' ? 1 : 0)}
                    active={selected === 'thought'}
                    onSelect={() => handleSelect('thought')}
                    isOwner={isOwner}
                    fadeOut={isReacted}
                    isImagePost={isImagePost}
                />
                <ReactionItem
                    type="intrigued"
                    count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)}
                    active={selected === 'intrigued'}
                    onSelect={() => handleSelect('intrigued')}
                    isOwner={isOwner}
                    fadeOut={isReacted}
                    isImagePost={isImagePost}
                />
            </>
        );
    };

    const handleChallengeAction = (action: 'send' | 'camera' | 'gallery' | 'text') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowChallengeMenu(false);
        setShowChallengeMenu(false);
        if (onChallengeAction && post.challenge) {
            onChallengeAction(post.challenge, action, post.id);
        }
    };

    const openChallengeMenu = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowChallengeMenu(true);
    };

    return (
        <View style={[styles.postCard, darkMode && styles.postCardDark]}>
            <View style={styles.header}>
                <Pressable
                    onPress={handleProfilePress}
                    style={styles.avatarContainer}
                    disabled={isOwner}
                >
                    <Image
                        source={{
                            uri: (post.author === 'rashica07' || post.author === 'example')
                                ? NativeImage.resolveAssetSource(require('../../assets/rashica_pfp.jpg')).uri
                                : (post.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80')
                        }}
                        style={styles.avatar}
                        contentFit="cover"
                        transition={200}
                    />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Pressable onPress={handleProfilePress} disabled={isOwner}>
                        <Text style={[styles.author, darkMode && styles.authorDark]}>
                            @{post.author} {isOwner && <Text style={styles.youLabel}>(You)</Text>}
                        </Text>
                    </Pressable>
                    <Text style={styles.time}>just now</Text>
                </View>
            </View>

            {post.media && post.media.trim() !== '' ? (
                <ImageViewer imageUri={post.media}>
                    <Animated.View style={[styles.reactionOverlay, { opacity: reactionAnim }]}>
                        {renderReactions()}
                    </Animated.View>
                    <View style={[styles.textOverlay, darkMode && styles.textOverlayDark, isReacted && { paddingRight: 24 }]}>
                        {post.challenge && (
                            <View style={styles.challengeRow}>
                                <Text style={[styles.challengeLabel, { marginBottom: 0 }]}>{post.challenge}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SpinLightningIcon color="#8E8E93" />
                                    <Text style={[styles.challengeLabel, { marginBottom: 0 }]}>{formattedSpinCount} Spins</Text>
                                </View>
                            </View>
                        )}
                        <Text style={[styles.contentText, darkMode && styles.contentTextDark]} numberOfLines={3}>{post.content}</Text>
                    </View>
                </ImageViewer>
            ) : (
                <View style={[styles.textOnlyPost, isReacted && { opacity: 0.6 }]}>
                    <View style={styles.textOnlyBody}>
                        {post.challenge && (
                            <View style={styles.challengeRow}>
                                <Text style={[styles.challengeLabel, { marginBottom: 0 }]}>{post.challenge}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SpinLightningIcon color="#8E8E93" />
                                    <Text style={[styles.challengeLabel, { marginBottom: 0 }]}>{formattedSpinCount} Spins</Text>
                                </View>
                            </View>
                        )}
                        <Text style={[styles.textOnlyContent, darkMode && styles.textOnlyContentDark]}>{post.content}</Text>
                    </View>
                    {!isReacted && (
                        <View style={styles.horizontalReactions}>
                            {renderReactions()}
                        </View>
                    )}
                </View>
            )}

            {/* Challenge Footer with Single Contour */}
            {!isOwner && post.challenge && (
                <View style={styles.challengeActionRow}>
                    <View style={[styles.challengePillContainer, darkMode && styles.challengePillContainerDark]}>
                        {/* Keep Action */}
                        <Pressable
                            style={({ pressed }) => [styles.pillIconBtn, pressed && { opacity: 0.6 }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                if (onToggleKeep && post.challenge) {
                                    onToggleKeep(post.challenge, post.id);
                                }
                            }}
                        >
                            <KeepIcon color={darkMode ? (isKept ? "#FFF" : "#8E8E93") : (isKept ? "#1C1C1E" : "#A0A0A0")} filled={isKept} />
                        </Pressable>

                        <View style={[styles.pillSeparator, darkMode && styles.pillSeparatorDark]} />

                        {/* Main Challenge Button (Text) */}
                        <Pressable
                            onPress={openChallengeMenu}
                            style={({ pressed }) => [
                                styles.pillMainBtn,
                                pressed && { opacity: 0.6 }
                            ]}
                        >
                            <Text style={[styles.challengeBtnText, darkMode && styles.challengeBtnTextDark]}>CHALLENGE</Text>
                        </Pressable>

                        <View style={[styles.pillSeparator, darkMode && styles.pillSeparatorDark]} />

                        {/* Pass Action - triggers Send/Spind */}
                        <Pressable
                            style={({ pressed }) => [styles.pillIconBtn, pressed && { opacity: 0.6 }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                if (onChallengeAction && post.challenge) {
                                    onChallengeAction(post.challenge, 'send', post.id);
                                }
                            }}
                        >
                            <PassIcon color={darkMode ? "#8E8E93" : "#A0A0A0"} />
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Challenge Action Menu Modal */}
            <Modal
                visible={showChallengeMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowChallengeMenu(false)}
            >
                <Pressable style={styles.menuOverlay} onPress={() => setShowChallengeMenu(false)}>
                    <BlurView intensity={80} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    <View style={[styles.menuContainer, darkMode && styles.menuContainerDark]}>
                        <Text style={[styles.menuTitle, darkMode && { color: '#FFF' }]}>"{post.challenge}"</Text>

                        <View style={styles.menuActionsRow}>
                            <Pressable onPress={() => handleChallengeAction('send')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}>
                                <SendIcon color="#FAF9F6" />
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('camera')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}>
                                <CameraIcon color="#FAF9F6" />
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('gallery')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}>
                                <GalleryIcon color="#FAF9F6" />
                            </Pressable>
                            <Pressable onPress={() => handleChallengeAction('text')} style={[styles.proofBtn, darkMode && styles.proofBtnDark]}>
                                <TextIcon color="#FAF9F6" />
                            </Pressable>
                        </View>

                        <Pressable onPress={() => setShowChallengeMenu(false)} style={styles.menuCancelBtn}>
                            <Text style={styles.menuCancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
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
    onChallengeAction?: (challenge: string, action: 'send' | 'camera' | 'gallery' | 'text', postId?: string) => void;
    isLoading?: boolean;
    keptChallenges?: { id: string, challenge: string, postId: string }[];
    onToggleKeep?: (challenge: string, postId: string) => void;
}

export const FeedScreen = ({
    posts,
    currentUserId,
    ListHeaderComponent,
    onScroll,
    contentContainerStyle,
    onProfilePress,
    onChallengeAction,
    isLoading = false,
    keptChallenges = [],
    onToggleKeep
}: FeedScreenProps) => {

    const { darkMode } = useTheme();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <FlatList
                    data={[1, 2, 3]}
                    keyExtractor={(item) => item.toString()}
                    renderItem={() => <PostSkeleton darkMode={darkMode} />}
                    contentContainerStyle={[styles.list, contentContainerStyle]}
                    ListHeaderComponent={ListHeaderComponent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                />
            </View>
        );
    }

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
                        onChallengeAction={onChallengeAction}
                        darkMode={darkMode}
                        isKept={keptChallenges.some(kept => kept.postId === item.id)}
                        onToggleKeep={onToggleKeep}
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
    container: { flex: 1 },
    containerDark: {},
    list: { paddingBottom: 100 },
    postCard: {
        marginBottom: 15,
        marginHorizontal: 16,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        overflow: 'hidden',
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    postCardDark: {
        backgroundColor: 'rgba(28,28,30,0.6)',
        borderColor: 'rgba(255,255,255,0.1)',
        shadowOpacity: 0.2,
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
    authorDark: {
        color: '#FFF'
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
        right: 12,
        top: '15%',
        zIndex: 10,
    },
    textOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingRight: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // Slightly more opaque for readability
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.5)',
    },
    textOverlayDark: {
        backgroundColor: 'rgba(28, 28, 30, 0.92)',
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    challengeLabel: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    challengeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        width: '100%',
    },
    contentText: {
        color: '#2C2C2C',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    contentTextDark: {
        color: '#E5E5EA',
    },
    textOnlyPost: {
        marginHorizontal: 20,
        paddingVertical: 4,
    },
    textOnlyBody: {
        marginBottom: 8,
    },
    textOnlyContent: {
        color: '#2C2C2C',
        fontSize: 20,
        fontWeight: '400',
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    textOnlyContentDark: {
        color: '#FFF',
    },
    horizontalReactions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: 8,
    },
    // Challenge button styles
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        gap: 8,
        marginBottom: 8, // Added margin below to fit better
    },
    challengeBtnDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    challengeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    challengeBtnTextDark: {
        color: '#FFF',
    },
    // Menu modal styles
    menuOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        width: width - 48,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        paddingBottom: 32, // Increased padding bottom
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    menuContainerDark: {
        backgroundColor: '#2C2C2E',
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1C1C1E',
        textAlign: 'center',
        marginBottom: 4,
    },
    menuSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 24,
    },
    menuActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    menuActionBtn: {
        alignItems: 'center',
        width: 80,
    },
    menuIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    menuActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1C1C1E',
        textAlign: 'center',
    },
    menuCancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    menuCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
    },
    // SPIND-style proof action buttons
    menuActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    proofBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proofBtnDark: {
        backgroundColor: '#3A3A3C',
    },
    // Footer Action Row
    challengeActionRow: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    // Merged Contour Styles
    challengePillContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 24, // High border radius for pill shape
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    challengePillContainerDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    pillIconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillMainBtn: {
        paddingHorizontal: 20,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillSeparator: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    pillSeparatorDark: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
});
