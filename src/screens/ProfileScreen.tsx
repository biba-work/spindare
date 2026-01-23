import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Pressable, FlatList, Animated, Share, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/atoms/AppButton';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { UserProfile } from '../services/AIService';
import * as ImagePicker from 'expo-image-picker';
import { FriendsListScreen } from './FriendsListScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { SpinWheel } from '../components/molecules/SpinWheel';
import * as Haptics from 'expo-haptics';

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

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M20 6L9 17l-5-5" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const ClockIcon = ({ color }: { color: string }) => (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="10" />
        <Path d="M12 6v6l4 2" />
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

const SPINNER_CHALLENGES = [
    "Walk 10 minutes outside.",
    "Do 20 pushups immediately.",
    "Drink a full glass of water.",
    "Send a nice text to a friend.",
    "Meditate for 5 minutes.",
    "Write down 3 goals for tomorrow.",
    "Read 5 pages of a book.",
    "Clean your workspace for 5 mins."
];

const SpinnerBadge = ({ size = 28 }: { size?: number }) => {
    const color = "#FF3B30"; // Red as requested

    return (
        <View style={[styles.spinnerBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
                <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            </Svg>
        </View>
    );
};

export const ProfileScreen = ({ onBack, onLogout, spinsLeft, setSpinsLeft, activeChallenge, onChallengeReceived, userProfile, onUpdateProfile }: { onBack: () => void; onLogout: () => void; spinsLeft: number; setSpinsLeft: (count: number) => void; activeChallenge: string | null; onChallengeReceived: (challenge: string) => void; userProfile: UserProfile; onUpdateProfile: (updates: Partial<UserProfile>) => void }) => {
    const [mode, setMode] = useState<'text' | 'grid'>('text');
    const [activeView, setActiveView] = useState<'none' | 'spinner' | 'friends' | 'post'>('none');
    const [currentChallenge, setCurrentChallenge] = useState<string | null>(activeChallenge);
    const [proofMode, setProofMode] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const expandAnim = useRef(new Animated.Value(0)).current;



    const handleSpinEnd = (result: string) => {
        setSpinsLeft(Math.max(0, spinsLeft - 1));
        setCurrentChallenge(result);
        onChallengeReceived(result);
        Animated.spring(expandAnim, { toValue: 1, useNativeDriver: false, tension: 50, friction: 8 }).start();
    };

    const handleSend = () => {
        setActiveView('friends');
    };

    const handleCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled) {
            setCapturedImage(result.assets[0].uri);
            setActiveView('post');
        }
    };

    const handleGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery access is required.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled) {
            setCapturedImage(result.assets[0].uri);
            setActiveView('post');
        }
    };

    const handleUpdatePfp = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Gallery access is required.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            onUpdateProfile({ photoURL: result.assets[0].uri });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleTextProof = () => {
        setCapturedImage(null);
        setActiveView('post');
    };

    const handlePostSubmit = (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => {
        console.log("Posted:", content, imageUri, target);
        Alert.alert("Challenge Completed!", "Your proof has been uploaded.");
        closeModal();
    };

    const closeModal = () => {
        setActiveView('none');
        setCurrentChallenge(null);
        setProofMode(false);
        setCapturedImage(null);
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
                            <Pressable onPress={handleUpdatePfp}>
                                <Image
                                    source={{ uri: userProfile.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' }}
                                    style={styles.largeAvatar}
                                />
                            </Pressable>
                            <Pressable style={styles.largeBadgeWrapper} onPress={() => setActiveView('spinner')}>
                                <SpinnerBadge size={28} />
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

            {
                activeView === 'spinner' && (
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
                                options={SPINNER_CHALLENGES}
                                onSpinEnd={handleSpinEnd}
                                canSpin={true}
                            />

                            {currentChallenge && (
                                <Animated.View style={[styles.challengeExpand, { opacity: expandAnim, maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) }]}>
                                    <Text style={styles.expandedLabel}>NEW CHALLENGE</Text>
                                    <Text style={styles.expandedText}>{currentChallenge}</Text>

                                    {!proofMode ? (
                                        <View style={styles.actionRow}>
                                            <Pressable style={styles.actionBtn} onPress={handleSend}>
                                                <SendIcon color="#FFF" />
                                                <Text style={styles.actionBtnText}>SEND</Text>
                                            </Pressable>
                                            <Pressable style={[styles.actionBtn, styles.primaryActionBtn]} onPress={() => setProofMode(true)}>
                                                <CheckIcon color="#000" />
                                                <Text style={[styles.actionBtnText, { color: '#000' }]}>DO IT</Text>
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <View style={styles.proofContainer}>
                                            <View style={styles.proofIconsRow}>
                                                <Pressable style={styles.proofIconBtn} onPress={handleCamera}>
                                                    <CameraIcon color="#FFF" />
                                                </Pressable>
                                                <Pressable style={styles.proofIconBtn} onPress={handleGallery}>
                                                    <GalleryIcon color="#FFF" />
                                                </Pressable>
                                                <Pressable style={styles.proofIconBtn} onPress={handleTextProof}>
                                                    <TextIcon color="#FFF" />
                                                </Pressable>
                                            </View>
                                            <Pressable style={styles.saveLaterBtn} onPress={closeModal}>
                                                <ClockIcon color="rgba(255,255,255,0.5)" />
                                                <Text style={styles.saveLaterText}>Save for later</Text>
                                            </Pressable>
                                        </View>
                                    )}
                                </Animated.View>
                            )}


                        </Animated.View>
                    </Pressable>
                )
            }

            <Modal visible={activeView === 'friends'} animationType="slide" transparent>
                <FriendsListScreen
                    challenge={currentChallenge || ''}
                    onClose={() => setActiveView('spinner')}
                />
            </Modal>

            <Modal visible={activeView === 'post'} animationType="slide" transparent>
                <PostCreationScreen
                    challenge={currentChallenge || ''}
                    imageUri={capturedImage}
                    onClose={() => setActiveView('spinner')}
                    onPost={handlePostSubmit}
                />
            </Modal>
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60 },
    backButton: { width: 44, height: 44, marginLeft: -10, justifyContent: 'center', alignItems: 'center' },
    userBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 10, marginBottom: 40, gap: 24, width: '100%' },
    avatarWrapper: { width: 100, height: 100, position: 'relative' },
    largeAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111' },
    largeBadgeWrapper: { position: 'absolute', bottom: 2, right: 2, zIndex: 20 },
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
    spinnerBadge: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
    spinModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 3000 },
    spinModalContent: { width: width * 0.9, backgroundColor: '#0D0D0D', borderRadius: 40, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    spinModalTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 4, marginBottom: 32 },
    challengeExpand: { width: '100%', marginTop: 24, padding: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, overflow: 'hidden' },
    expandedLabel: { color: '#FF3B30', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
    expandedText: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 },
    spinModalFooter: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800', marginTop: 32, letterSpacing: 2 },
    logoutBtn: { marginTop: 40, marginHorizontal: 20, height: 50, borderColor: 'rgba(255,59,48,0.2)', borderWidth: 1 },
    logoutText: { color: '#FF3B30', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', gap: 8 },
    primaryActionBtn: { backgroundColor: '#FFF' },
    actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    proofContainer: { marginTop: 32, width: '100%', alignItems: 'center' },
    proofIconsRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
    proofIconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    saveLaterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
    saveLaterText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
    textInputContainer: { width: '100%', marginTop: 24, gap: 12 },
    textInput: { width: '100%', height: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 14, textAlignVertical: 'top' },
    textInputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    textActionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
    textConfirmBtn: { backgroundColor: '#FFF' },
    textActionLabel: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});


