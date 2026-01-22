import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Pressable, FlatList, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/atoms/AppButton';
import Svg, { Path, Rect } from 'react-native-svg';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { UserProfile } from '../services/AIService';

const { width } = Dimensions.get('window');

const ArrowLeftIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
);

const SwordIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <Path d="M13 19l-2 2-3-3-2-2 2-2" />
        <Path d="M9.5 12.5L21 21v-3h-3L6.5 6.5" />
        <Path d="M11 5l2-2 3 3 2 2-2 2" />
    </Svg>
);

const GridIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="7" height="7" />
        <Rect x="14" y="3" width="7" height="7" />
        <Rect x="14" y="14" width="7" height="7" />
        <Rect x="3" y="14" width="7" height="7" />
    </Svg>
);

const COMPLETED_CHALLENGES = [
    {
        id: '1',
        title: "Silence Protocol",
        content: "Take a photo of something that reminds you of silence.",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
        date: "2024-01-20"
    },
    {
        id: '2',
        title: "Deep Memory",
        content: "Write down one thing you've never told anyone.",
        image: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=400&q=80",
        date: "2024-01-21"
    },
    {
        id: '3',
        title: "Stranger Bond",
        content: "Ask a stranger what their favorite memory is.",
        image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
        date: "2024-01-22"
    },
    {
        id: '4',
        title: "Unknown Path",
        content: "Walk 100 steps in a direction you never go.",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        date: "2024-01-23"
    }
];

const SpinnerBadge = ({ spinsLeft, size = 28 }: { spinsLeft: number; size?: number }) => {
    let color = "#8E8E93"; // Gray (0)
    if (spinsLeft === 2) color = "#4CD964"; // Green
    if (spinsLeft === 1) color = "#FFD60A"; // Yellow

    return (
        <View style={[styles.spinnerBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
                <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            </Svg>
        </View>
    );
};

export const ProfileScreen = ({ onBack, onLogout, spinsLeft, setSpinsLeft }: { onBack: () => void; onLogout: () => void; spinsLeft: number; setSpinsLeft: (count: number) => void }) => {
    const [mode, setMode] = useState<'text' | 'grid'>('text');
    const [isSpinModalVisible, setIsSpinModalVisible] = useState(false);
    const [currentChallenge, setCurrentChallenge] = useState<string | null>(null);
    const expandAnim = useRef(new Animated.Value(0)).current;

    const userProfile: UserProfile = {
        email: "bibovic@example.com",
        username: "bibovic",
        hobbies: ["Photography", "Gaming", "Art"],
        studyFields: ["Computer Science"],
        xp: 248,
        level: 3
    };

    const handleSpinEnd = (result: string) => {
        setSpinsLeft(Math.max(0, spinsLeft - 1));
        setCurrentChallenge(result);
        Animated.spring(expandAnim, { toValue: 1, useNativeDriver: false, tension: 50, friction: 8 }).start();
    };

    const closeModal = () => {
        setIsSpinModalVisible(false);
        setCurrentChallenge(null);
        expandAnim.setValue(0);
    };

    const renderTextItem = ({ item }: { item: typeof COMPLETED_CHALLENGES[0] }) => (
        <View style={styles.gridModeItem}>
            <View style={styles.textModeGridItem}>
                <Text style={styles.gridItemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.gridItemContent} numberOfLines={4}>{item.content}</Text>
                <Text style={styles.gridItemDate}>{item.date}</Text>
            </View>
        </View>
    );

    const renderGridItem = ({ item }: { item: typeof COMPLETED_CHALLENGES[0] }) => (
        <View style={styles.gridModeItem}>
            <Image source={{ uri: item.image }} style={styles.gridImage} />
            <View style={styles.gridOverlay}>
                <Text style={styles.gridText} numberOfLines={2}>{item.content}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Pressable onPress={onBack} style={styles.backButton}>
                        <ArrowLeftIcon color="#FFF" />
                    </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* User Info Bar */}
                    <View style={styles.userBar}>
                        <View style={styles.avatarWrapper}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' }}
                                style={styles.largeAvatar}
                            />
                            <Pressable style={styles.largeBadgeWrapper} onPress={() => setIsSpinModalVisible(true)}>
                                <SpinnerBadge spinsLeft={spinsLeft} size={28} />
                            </Pressable>
                        </View>
                        <View style={styles.userTextInfo}>
                            <Text style={styles.usernameText}>@{userProfile.username}</Text>
                            <Text style={styles.statusLabel}>CREATIVE</Text>
                        </View>
                    </View>

                    {/* Content Tabs */}
                    <View style={styles.tabsContainer}>
                        <Pressable
                            style={[styles.tab, mode === 'text' && styles.activeTab]}
                            onPress={() => setMode('text')}
                        >
                            <SwordIcon color={mode === 'text' ? "#FFF" : "rgba(255,255,255,0.4)"} />
                        </Pressable>
                        <Pressable
                            style={[styles.tab, mode === 'grid' && styles.activeTab]}
                            onPress={() => setMode('grid')}
                        >
                            <GridIcon color={mode === 'grid' ? "#FFF" : "rgba(255,255,255,0.4)"} />
                        </Pressable>
                    </View>

                    {/* Challenges History */}
                    <View style={styles.historyContainer}>
                        <View style={styles.gridContainer}>
                            {COMPLETED_CHALLENGES.map(item => (
                                <View key={item.id}>
                                    {mode === 'text' ? renderTextItem({ item }) : renderGridItem({ item })}
                                </View>
                            ))}
                        </View>
                    </View>

                    <AppButton type="secondary" onPress={onLogout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>LOGOUT</Text>
                    </AppButton>
                </ScrollView>
            </SafeAreaView>

            {isSpinModalVisible && (
                <Pressable style={styles.spinModalOverlay} onPress={closeModal}>
                    <Animated.View
                        style={[
                            styles.spinModalContent,
                            {
                                transform: [{
                                    scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] })
                                }]
                            }
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={styles.spinModalTitle}>SPIN TO REVEAL</Text>
                        <SpinWheel
                            options={["DARE", "QUEST", "TRUTH", "RISK"]}
                            onSpinEnd={handleSpinEnd}
                            canSpin={spinsLeft > 0}
                        />

                        {currentChallenge && (
                            <Animated.View style={[styles.challengeExpand, { opacity: expandAnim, maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) }]}>
                                <Text style={styles.expandedLabel}>NEW CHALLENGE</Text>
                                <Text style={styles.expandedText}>{currentChallenge}</Text>
                            </Animated.View>
                        )}

                        <Text style={styles.spinModalFooter}>{spinsLeft} SPINS LEFT</Text>
                    </Animated.View>
                </Pressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60 },
    backButton: { width: 44, height: 44, marginLeft: -10, justifyContent: 'center', alignItems: 'center' },
    userBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 40, gap: 24 },
    avatarWrapper: { position: 'relative' },
    largeAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111' },
    largeBadgeWrapper: { position: 'absolute', bottom: 0, right: 0, zIndex: 10 },
    userTextInfo: { flex: 1, justifyContent: 'center' },
    usernameText: { color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 4 },
    statusLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
    scrollContent: { paddingBottom: 60 },
    tabsContainer: { flexDirection: 'row', marginBottom: 20, marginHorizontal: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 16 },
    activeTab: { borderBottomWidth: 2, borderColor: '#FFF' },
    historyContainer: { paddingHorizontal: 20 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridModeItem: { width: (width - 52) / 2, height: (width - 52) / 2, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    textModeGridItem: { flex: 1, padding: 16, justifyContent: 'space-between' },
    gridItemTitle: { color: '#FF3B30', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    gridItemContent: { color: '#FFF', fontSize: 13, fontWeight: '600', lineHeight: 18 },
    gridItemDate: { color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '700' },
    gridImage: { width: '100%', height: '100%', opacity: 0.5 },
    gridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
    gridText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    spinnerBadge: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
    spinModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 3000 },
    spinModalContent: { width: width * 0.9, backgroundColor: '#0D0D0D', borderRadius: 40, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    spinModalTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 4, marginBottom: 32 },
    challengeExpand: { width: '100%', marginTop: 24, padding: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, overflow: 'hidden' },
    expandedLabel: { color: '#FF3B30', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
    expandedText: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 },
    spinModalFooter: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800', marginTop: 32, letterSpacing: 2 },
    logoutBtn: { marginTop: 40, marginHorizontal: 20, height: 50, borderColor: 'rgba(255,59,48,0.2)', borderWidth: 1 },
    logoutText: { color: '#FF3B30', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
});


