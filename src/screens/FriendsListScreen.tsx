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
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0c0c0e' }]} />
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
    fullScreen: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 4,
        fontFamily: 'Inter_400Regular',
    },
    closeButton: {
        padding: 4,
    },
    closeText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    challengePreview: {
        marginHorizontal: 24,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        marginBottom: 24,
    },
    previewLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 8,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 4,
    },
    previewText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: 'Montserrat_400Regular',
        fontStyle: 'italic',
        opacity: 0.8,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    friendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '700',
    },
    nameContainer: {
        justifyContent: 'center',
    },
    nameText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Inter_400Regular',
    },
    usernameText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    sendButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minWidth: 80,
        alignItems: 'center',
    },
    sentButton: {
        backgroundColor: 'transparent',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    sentButtonText: {
        color: 'rgba(255,255,255,0.4)',
    },
});
