import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Pressable, Image } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { AppButton } from '../components/atoms/AppButton';

const { width } = Dimensions.get('window');

const MOCK_POSTS = [
    {
        id: '1',
        content: "I finally took that walk in silence. It was harder than I thought but so rewarding.",
        author: "Alex",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
        time: "2h",
        reactions: { felt: 12, thought: 5, intrigued: 2 },
    },
    {
        id: '2',
        content: "Found a forgotten memory while drawing. It's funny how shapes can trigger emotions.",
        author: "Sarah",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
        time: "4h",
        reactions: { felt: 45, thought: 12, intrigued: 8 },
    },
    {
        id: '3',
        content: "Strangers have the most beautiful stories if you just dare to ask.",
        author: "Jamie",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
        time: "5h",
        reactions: { felt: 89, thought: 45, intrigued: 32 },
    },
];

const ReactionIcon = ({ type, color = "#FFF", size = 18 }: { type: 'felt' | 'thought' | 'intrigued', color?: string, size?: number }) => {
    switch (type) {
        case 'felt': return (
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Circle cx="12" cy="12" r="8" fill={color} />
            </Svg>
        );
        case 'thought': return (
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Polygon points="12,4 21,19 3,19" fill={color} />
            </Svg>
        );
        case 'intrigued': return (
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={color} />
            </Svg>
        );
    }
};

const PostItem = ({ post }: { post: typeof MOCK_POSTS[0] }) => {
    const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const pickerAnim = useRef(new Animated.Value(0)).current;

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowPicker(true);
        Animated.spring(pickerAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
    };

    const handleSelectReaction = (type: string | null) => {
        if (!type) {
            setSelectedReaction(null);
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedReaction(type);
        Animated.timing(pickerAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowPicker(false));
    };

    return (
        <View style={styles.postCard}>
            <View style={styles.leftCol}>
                <Image source={{ uri: post.avatar }} style={styles.authorAvatar} />
                <View style={styles.threadLine} />
            </View>

            <View style={styles.rightCol}>
                <View style={styles.postMeta}>
                    <Text style={styles.authorName}>{post.author}</Text>
                    <Text style={styles.timeText}>{post.time}</Text>
                </View>

                <Text style={styles.contentParagraph}>{post.content}</Text>

                <View style={styles.interactionRow}>
                    <Pressable
                        onLongPress={handleLongPress}
                        onPress={() => handleSelectReaction(selectedReaction ? null : 'felt')}
                        style={[styles.reactBtn, selectedReaction && styles.reactBtnActive]}
                        hitSlop={{ top: 12, bottom: 12, left: 15, right: 15 }}
                    >
                        <ReactionIcon
                            type={selectedReaction as any || 'felt'}
                            size={14}
                            color={selectedReaction ? "#000" : "rgba(255,255,255,0.4)"}
                        />
                        <Text style={[styles.reactText, selectedReaction && styles.reactTextActive]}>
                            {selectedReaction ? selectedReaction.toUpperCase() : "REACT"}
                        </Text>
                    </Pressable>

                    <View style={styles.statGroup}>
                        <View style={styles.statItem}>
                            <ReactionIcon type="felt" size={10} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.statCount}>{post.reactions.felt}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <ReactionIcon type="thought" size={10} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.statCount}>{post.reactions.thought}</Text>
                        </View>
                    </View>
                </View>

                {showPicker && (
                    <Animated.View style={[styles.picker, { transform: [{ translateY: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], opacity: pickerAnim }]}>
                        {['felt', 'thought', 'intrigued'].map((type) => (
                            <Pressable
                                key={type}
                                style={styles.pickerItem}
                                onPress={() => handleSelectReaction(type)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <ReactionIcon type={type as any} size={24} />
                                <Text style={styles.pickerText}>{type.toUpperCase()}</Text>
                            </Pressable>
                        ))}
                    </Animated.View>
                )}
            </View>
        </View>
    );
};

export const FeedScreen = ({ ListHeaderComponent }: { ListHeaderComponent?: React.ReactElement }) => {
    return (
        <View style={styles.container}>
            <FlatList
                data={MOCK_POSTS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <PostItem post={item} />}
                contentContainerStyle={styles.list}
                ListHeaderComponent={ListHeaderComponent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    list: { paddingBottom: 100 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 64 },
    postCard: { flexDirection: 'row', padding: 16 },
    leftCol: { alignItems: 'center', marginRight: 16 },
    authorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111' },
    threadLine: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, borderRadius: 1 },
    rightCol: { flex: 1 },
    postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    authorName: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    timeText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600' },
    contentParagraph: { color: '#FFF', fontSize: 14, lineHeight: 22, marginBottom: 24, fontWeight: '500' },
    interactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0D0D0D', height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    reactBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
    reactText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    reactTextActive: { color: '#000' },
    statGroup: { flexDirection: 'row', gap: 16 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '700' },
    picker: { position: 'absolute', bottom: 44, left: 0, backgroundColor: '#161616', flexDirection: 'row', padding: 12, borderRadius: 24, gap: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 1000 },
    pickerItem: { alignItems: 'center', gap: 8 },
    pickerText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
});
