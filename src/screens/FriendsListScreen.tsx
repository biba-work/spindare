import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Animated, Pressable, Platform, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const MOCK_FRIENDS = [
    { id: '1', name: 'Babi', username: 'Zef_F', initial: 'Z', color: '#FFB2B2' },
    { id: '2', name: 'Lucas Chen', username: '@lucas_c', initial: 'L', color: '#B2FFB2' },
    { id: '3', name: 'Emma Wilson', username: '@emma_w', initial: 'E', color: '#B2B2FF' },
    { id: '4', name: 'Noah Brown', username: '@noah_b', initial: 'N', color: '#FFFFB2' },
    { id: '5', name: 'Mia Garcia', username: '@mia_g', initial: 'M', color: '#FFB2FF' },
    { id: '6', name: 'Oliver Taylor', username: '@oliver_t', initial: 'O', color: '#B2FFFF' },
];

interface FriendItemProps {
    friend: typeof MOCK_FRIENDS[0];
    onSend: (id: string) => void;
}

const FriendItem = ({ friend, onSend }: FriendItemProps) => {
    const [sent, setSent] = useState(false);

    const handleSend = () => {
        if (!sent) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSent(true);
            onSend(friend.id);
        }
    };

    return (
        <View style={styles.friendRow}>
            <View style={styles.friendInfo}>
                <View style={[styles.avatar, { backgroundColor: friend.color }]}>
                    <Text style={styles.avatarText}>{friend.initial}</Text>
                </View>
                <View style={styles.nameContainer}>
                    <Text style={styles.nameText}>{friend.name}</Text>
                    <Text style={styles.usernameText}>{friend.username}</Text>
                </View>
            </View>
            <Pressable
                onPress={handleSend}
                style={({ pressed }) => [
                    styles.sendButton,
                    sent && styles.sentButton,
                    pressed && !sent && { opacity: 0.7 }
                ]}
            >
                <Text style={[styles.sendButtonText, sent && styles.sentButtonText]}>
                    {sent ? 'SENT' : 'SEND'}
                </Text>
            </Pressable>
        </View>
    );
};

export const FriendsListScreen = ({ onClose, challenge }: { onClose: () => void, challenge: string }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleSendToFriend = (id: string) => {
        console.log(`Challenge sent to friend ${id}: ${challenge}`);
    };

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(250, 249, 246, 0.95)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <Animated.View style={[
                    styles.container,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <View style={styles.header}>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>Close</Text>
                        </Pressable>
                        <Text style={styles.headerTitle}>CHALLENGE A FRIEND</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.challengePreview}>
                        <Text style={styles.previewLabel}>SENDING CHALLENGE</Text>
                        <Text style={styles.previewText} numberOfLines={2}>"{challenge}"</Text>
                    </View>

                    <FlatList
                        data={MOCK_FRIENDS}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <FriendItem friend={item} onSend={handleSendToFriend} />
                        )}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: 'transparent' },
    safeArea: { flex: 1 },
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 24 },
    headerTitle: { color: '#8E8E93', fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 3 },
    closeButton: { padding: 4 },
    closeText: { color: '#A7BBC7', fontSize: 13, fontWeight: '500' },
    challengePreview: {
        marginHorizontal: 32,
        padding: 20,
        backgroundColor: '#FFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
    },
    previewLabel: { color: '#A7BBC7', fontSize: 8, fontWeight: '500', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
    previewText: { color: '#4A4A4A', fontSize: 15, lineHeight: 22, fontWeight: '400' },
    listContent: { paddingHorizontal: 32, paddingBottom: 40 },
    friendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    friendInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    avatarText: { color: '#4A4A4A', fontSize: 16, fontWeight: '500' },
    nameContainer: { justifyContent: 'center' },
    nameText: { color: '#4A4A4A', fontSize: 15, fontWeight: '500' },
    usernameText: { color: '#AEAEB2', fontSize: 12, fontWeight: '400', marginTop: 2 },
    sendButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, backgroundColor: '#4A4A4A', minWidth: 90, alignItems: 'center' },
    sentButton: { backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#D1D1D1' },
    sendButtonText: { color: '#FAF9F6', fontSize: 11, fontWeight: '500', letterSpacing: 1 },
    sentButtonText: { color: '#8E8E93' },
});
