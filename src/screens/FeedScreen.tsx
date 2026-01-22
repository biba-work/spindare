import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Image, Pressable } from 'react-native';
import { ReactionItem } from '../components/molecules/ReactionItem';

const { width } = Dimensions.get('window');

const MOCK_POSTS = [
    {
        id: '1',
        content: "I finally took that walk in silence. It was harder than I thought but so rewarding.",
        author: "Alex",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
        media: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
        time: "2h",
        reactions: { felt: 12, thought: 5, intrigued: 2 },
    },
    {
        id: '2',
        content: "Found a forgotten memory while drawing. It's funny how shapes can trigger emotions.",
        author: "Sarah",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
        media: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=800&q=80",
        time: "4h",
        reactions: { felt: 45, thought: 12, intrigued: 8 },
    },
    {
        id: '3',
        content: "Strangers have the most beautiful stories if you just dare to ask.",
        author: "Jamie",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
        media: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
        time: "5h",
        reactions: { felt: 89, thought: 45, intrigued: 32 },
    },
];

const PostItem = ({ post }: { post: typeof MOCK_POSTS[0] }) => {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <View style={styles.postCard}>
            <View style={styles.header}>
                <Image source={{ uri: post.avatar }} style={styles.avatar} />
                <View>
                    <Text style={styles.author}>{post.author}</Text>
                    <Text style={styles.time}>{post.time} ago</Text>
                </View>
            </View>

            <View style={styles.mediaContainer}>
                <Image source={{ uri: post.media }} style={styles.media} />

                {/* Vertical Reaction Overlay */}
                <View style={styles.reactionOverlay}>
                    <ReactionItem
                        type="felt"
                        count={post.reactions.felt + (selected === 'felt' ? 1 : 0)}
                        active={selected === 'felt'}
                        onSelect={() => setSelected(selected === 'felt' ? null : 'felt')}
                    />
                    <ReactionItem
                        type="thought"
                        count={post.reactions.thought + (selected === 'thought' ? 1 : 0)}
                        active={selected === 'thought'}
                        onSelect={() => setSelected(selected === 'thought' ? null : 'thought')}
                    />
                    <ReactionItem
                        type="intrigued"
                        count={post.reactions.intrigued + (selected === 'intrigued' ? 1 : 0)}
                        active={selected === 'intrigued'}
                        onSelect={() => setSelected(selected === 'intrigued' ? null : 'intrigued')}
                    />
                </View>

                {/* Content Overlay */}
                <View style={styles.textOverlay}>
                    <Text style={styles.contentText} numberOfLines={3}>{post.content}</Text>
                </View>
            </View>
        </View>
    );
};

export const FeedScreen = ({ ListHeaderComponent, onScroll, contentContainerStyle }: { ListHeaderComponent?: React.ReactElement, onScroll?: (event: any) => void, contentContainerStyle?: any }) => {
    return (
        <View style={styles.container}>
            <FlatList
                data={MOCK_POSTS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <PostItem post={item} />}
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
    container: { flex: 1, backgroundColor: '#000' },
    list: { paddingBottom: 100 },
    postCard: { marginBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111' },
    author: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    time: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' },
    mediaContainer: { width: width, height: width * 1.25, backgroundColor: '#111' },
    media: { width: '100%', height: '100%' },
    reactionOverlay: { position: 'absolute', right: 12, top: '15%', zIndex: 10 },
    textOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingRight: 80, // Leave room for reactions scroll if they reached bottom
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0
    },
    contentText: { color: '#FFF', fontSize: 15, fontWeight: '500', lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});

