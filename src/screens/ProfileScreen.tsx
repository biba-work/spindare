import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { MediaSelectionScreen } from './MediaSelectionScreen';
import { PostCreationScreen } from './PostCreationScreen';
import { FriendsListScreen } from './FriendsListScreen';
import { AppButton } from '../components/atoms/AppButton';
import Svg, { Path, Circle } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const BackIcon = ({ color }: { color: string }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
);

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const LogoutIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <Path d="M16 17l5-5-5-5" />
        <Path d="M21 12H9" />
    </Svg>
);

const CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favorite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
];

export const ProfileScreen = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
    const [challenge, setChallenge] = useState<string | null>(null);
    const [isMediaSelecting, setIsMediaSelecting] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleSpinEnd = useCallback((result: string) => {
        setChallenge(result);
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true })
        ]).start();
    }, []);

    const handlePostSubmit = () => {
        setIsPosting(false);
        setChallenge(null);
        onBack();
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <AppButton type="icon" onPress={onBack} style={styles.backBtn}>
                        <BackIcon color="#FFF" />
                    </AppButton>
                    <Text style={styles.headerTitle}>PROFILE</Text>
                    <AppButton type="icon" onPress={onLogout} style={styles.backBtn}>
                        <LogoutIcon color="#FF3B30" />
                    </AppButton>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.profileHero}>
                        <View style={styles.avatarWrapper}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' }}
                                style={styles.avatar}
                            />
                        </View>
                        <Text style={styles.username}>@bibovic</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>12</Text>
                                <Text style={styles.statLabel}>DARES</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>248</Text>
                                <Text style={styles.statLabel}>POINTS</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.wheelSection}>
                        <Text style={styles.sectionHeading}>PRACTICE SPIN</Text>
                        <View style={styles.wheelWrapper}>
                            <SpinWheel
                                options={CHALLENGES}
                                onSpinEnd={handleSpinEnd}
                                canSpin={true}
                            />
                        </View>

                        {challenge && (
                            <Animated.View style={[styles.challengeCard, { opacity: fadeAnim }]}>
                                <Text style={styles.cardLabel}>PRACTICE MODE</Text>
                                <Text style={styles.cardText}>{challenge}</Text>
                                <View style={styles.cardActions}>
                                    <AppButton type="secondary" onPress={() => setIsSharing(true)} style={styles.actionBtn}>
                                        <SendIcon color="#FFF" />
                                        <Text style={styles.btnText}>SHARE</Text>
                                    </AppButton>
                                    <AppButton onPress={() => setIsMediaSelecting(true)} style={styles.actionBtnMain}>
                                        <CameraIcon color="#000" />
                                        <Text style={styles.btnTextBlack}>SNAP</Text>
                                    </AppButton>
                                </View>
                            </Animated.View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {isMediaSelecting && <View style={styles.fullOverlay}><MediaSelectionScreen challenge={challenge || ''} onClose={() => setIsMediaSelecting(false)} onSelect={(t, uri) => { setSelectedImage(uri || null); setIsMediaSelecting(false); setTimeout(() => setIsPosting(true), 400); }} /></View>}
            {isPosting && (
                <View style={styles.fullOverlay}>
                    <PostCreationScreen
                        challenge={challenge || ''}
                        imageUri={selectedImage}
                        onClose={() => setIsPosting(false)}
                        onPost={(c, img, target) => {
                            setIsPosting(false);
                            if (target === 'friend') {
                                setTimeout(() => setIsSharing(true), 400);
                            } else {
                                handlePostSubmit();
                            }
                        }}
                    />
                </View>
            )}
            {isSharing && <View style={styles.fullOverlay}><FriendsListScreen challenge={challenge || ''} onClose={() => setIsSharing(false)} /></View>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
    backBtn: { backgroundColor: 'transparent' },
    headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 4 },
    scrollContent: { paddingBottom: 60 },
    profileHero: { alignItems: 'center', paddingTop: 24, paddingBottom: 32 },
    avatarWrapper: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 4, marginBottom: 16 },
    avatar: { width: '100%', height: '100%', borderRadius: 46 },
    username: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 24 },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statBox: { alignItems: 'center' },
    statVal: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    statLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '800', marginTop: 4 },
    divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 24 },
    wheelSection: { alignItems: 'center', paddingHorizontal: 16 },
    sectionHeading: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: '900', letterSpacing: 4, marginBottom: 32 },
    wheelWrapper: { width: width * 0.8, height: width * 0.8, marginBottom: 32, justifyContent: 'center', alignItems: 'center' },
    challengeCard: { width: '100%', backgroundColor: '#0D0D0D', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
    cardLabel: { color: '#FF3B30', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 12 },
    cardText: { color: '#FFF', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24, fontWeight: '500' },
    cardActions: { flexDirection: 'row', gap: 12, width: '100%' },
    actionBtn: { flex: 1, height: 52 },
    actionBtnMain: { flex: 1, height: 52, backgroundColor: '#FFF' },
    btnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    btnTextBlack: { color: '#000', fontSize: 13, fontWeight: '900' },
    fullOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
});
