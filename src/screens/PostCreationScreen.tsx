import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, Image, ScrollView, ActivityIndicator } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SoundService } from '../services/SoundService';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { uploadToR2 } from '../services/StorageService';

const { width, height } = Dimensions.get('window');

// Bubble particles — 10 evenly-spread directions, deterministic distances
const BUBBLE_COUNT = 10;
const BUBBLE_COLORS = ['#A7BBC7', '#C7A7BC', '#A7C7B0', '#C7BBA7', '#B0C7E8', '#E8C7B0', '#C7E8B0', '#B0B0E8', '#E8B0C7', '#B0E8D4'];
const BUBBLES = Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const angle = (i / BUBBLE_COUNT) * Math.PI * 2;
    const dist  = 65 + (i % 3) * 28; // 65, 93, 121 cycling
    return {
        color: BUBBLE_COLORS[i],
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 8 + (i % 3) * 4, // 8, 12, 16 cycling
    };
});

// Separate component so useVideoPlayer hook is valid
const VideoPreview = ({ uri, style }: { uri: string; style: any }) => {
    const player = useVideoPlayer(uri, p => { p.pause(); });
    return <VideoView player={player} style={style} contentFit="cover" nativeControls />;
};

interface PostCreationScreenProps {
    challenge: string;
    imageUri?: string | null;
    onClose: () => void;
    onPost: (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => Promise<void> | void;
    isSubmitting?: boolean; // kept for back-compat but local state takes over
}

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
);

const CheckIcon = ({ color }: { color: string }) => (
    <Svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="20 6 9 17 4 12" />
    </Svg>
);

const isVideoUri = (uri?: string | null) => !!uri && /\.(mp4|mov|avi|webm|3gp)$/i.test(uri);

export const PostCreationScreen = ({ challenge, imageUri: initialImageUri, onClose, onPost }: PostCreationScreenProps) => {
    const { darkMode } = useTheme();
    const [content, setContent]           = useState('');
    const [imageUri, setImageUri]         = useState(initialImageUri);
    const [submitting, setSubmitting]     = useState(false);
    const [success, setSuccess]           = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // 0–100 for video uploads
    const isVideo = isVideoUri(imageUri);

    // Entry animation
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Success overlay
    const overlayOpacity  = useRef(new Animated.Value(0)).current;
    const checkScale      = useRef(new Animated.Value(0)).current;
    const checkOpacity    = useRef(new Animated.Value(0)).current;
    const circleScale     = useRef(new Animated.Value(0)).current;

    // Bubble particles
    const bubbleAnims = useRef(
        BUBBLES.map(() => ({
            scale:      new Animated.Value(0),
            translateX: new Animated.Value(0),
            translateY: new Animated.Value(0),
            opacity:    new Animated.Value(1),
        }))
    ).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const triggerSuccess = () => {
        setSuccess(true);
        SoundService.postSuccess();

        // 1. Fade in overlay
        Animated.timing(overlayOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();

        // 2. Pop the green circle in
        Animated.spring(circleScale, {
            toValue: 1, friction: 4, tension: 80, useNativeDriver: true,
        }).start();

        // 3. Check appears just after the circle
        setTimeout(() => {
            Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
            Animated.timing(checkOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
        }, 120);

        // 4. Bubbles explode outward then fade
        bubbleAnims.forEach((b, i) => {
            const bubble = BUBBLES[i];
            const delay = i * 30;
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.spring(b.scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
                    Animated.timing(b.translateX, { toValue: bubble.tx, duration: 550, useNativeDriver: true }),
                    Animated.timing(b.translateY, { toValue: bubble.ty, duration: 550, useNativeDriver: true }),
                    Animated.sequence([
                        Animated.delay(300),
                        Animated.timing(b.opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
                    ]),
                ]),
            ]).start();
        });

        // 5. Close after animation settles
        setTimeout(() => onClose(), 1600);
    };

    const handleAction = async (target: 'feed' | 'friend') => {
        if ((!content.trim() && !imageUri) || submitting || success) return;
        setSubmitting(true);
        setUploadProgress(0);
        try {
            let mediaUrl: string | null | undefined = imageUri;
            if (imageUri) {
                const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
                const { publicUrl } = await uploadToR2(imageUri, 'posts', mimeType, (pct) => setUploadProgress(pct));
                mediaUrl = publicUrl;
            }
            await onPost(content, mediaUrl, target);
            triggerSuccess();
        } catch {
            setSubmitting(false);
            setUploadProgress(0);
        }
    };

    const removeImage = () => {
        SoundService.tap();
        setImageUri(null);
    };

    const isReady = !!(content.trim() || imageUri);

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={20} tint={darkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(28,28,30,0.95)' : 'rgba(250,249,246,0.95)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <Animated.View style={[styles.container, darkMode && styles.containerDark, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

                            <View style={styles.header}>
                                <Pressable onPress={onClose} hitSlop={20} disabled={submitting || success}>
                                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#FFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M19 12H5M12 19l-7-7 7-7" />
                                    </Svg>
                                </Pressable>
                                <Text style={[styles.headerTitle, darkMode && styles.textDark]}>COMPLETED CHALLENGE</Text>
                                <View style={{ width: 24 }} />
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                style={{ flexGrow: 0 }}
                                contentContainerStyle={styles.scrollContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={[styles.challengeCard, darkMode && styles.cardDark]}>
                                    <Text style={styles.challengeLabel}>THE DARE</Text>
                                    <Text style={[styles.challengeText, darkMode && styles.textDark]}>{challenge}</Text>
                                </View>

                                {imageUri && (
                                    <View style={[styles.imageWrapper, isVideo && styles.videoWrapper]}>
                                        {isVideo ? (
                                            <VideoPreview uri={imageUri} style={styles.image} />
                                        ) : (
                                            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                                        )}
                                        {/* Video type badge */}
                                        {isVideo && (
                                            <View style={styles.videoBadge}>
                                                <Text style={styles.videoBadgeText}>VIDEO</Text>
                                            </View>
                                        )}
                                        <Pressable style={styles.removeImageButton} onPress={removeImage} disabled={submitting}>
                                            <View style={styles.removeIconWrapper}>
                                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <Path d="M18 6L6 18M6 6l12 12" />
                                                </Svg>
                                            </View>
                                        </Pressable>
                                    </View>
                                )}

                                <View style={[styles.inputContainer, darkMode && styles.cardDark]}>
                                    <TextInput
                                        style={[styles.input, darkMode && styles.textDark]}
                                        placeholder="Add a caption or thoughts..."
                                        placeholderTextColor={darkMode ? '#8E8E93' : '#C5C5C5'}
                                        multiline
                                        value={content}
                                        onChangeText={setContent}
                                        maxLength={300}
                                        editable={!submitting && !success}
                                    />
                                </View>
                            </ScrollView>

                            {/* Video upload progress bar */}
                            {submitting && isVideo && uploadProgress > 0 && uploadProgress < 100 && (
                                <View style={styles.progressWrap}>
                                    <View style={styles.progressTrack}>
                                        <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                                    </View>
                                    <Text style={[styles.progressLabel, darkMode && { color: '#8E8E93' }]}>
                                        Uploading video… {Math.round(uploadProgress)}%
                                    </Text>
                                </View>
                            )}

                            <View style={[styles.actionFooter, darkMode && styles.borderDark]}>
                                <Pressable
                                    onPress={() => handleAction('friend')}
                                    style={[styles.actionBtn, styles.secondaryBtn, darkMode && styles.secondaryBtnDark, (!isReady || submitting) && styles.disabledBtn]}
                                    disabled={!isReady || submitting || success}
                                >
                                    <SendIcon color={isReady && !submitting ? (darkMode ? '#FFF' : '#8E8E93') : '#AEAEB2'} />
                                    <Text style={[styles.actionText, darkMode && styles.textDark, (!isReady || submitting) && styles.disabledText]}>SEND PRIVATELY</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => handleAction('feed')}
                                    style={[styles.actionBtn, styles.primaryBtn, darkMode && styles.primaryBtnDark, (!isReady || submitting) && styles.disabledBtn]}
                                    disabled={!isReady || submitting || success}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FAF9F6" />
                                    ) : (
                                        <Text style={styles.primaryText}>POST TO FEED</Text>
                                    )}
                                </Pressable>
                            </View>

                        </Animated.View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* ── Success overlay ─────────────────────────────────────── */}
            {success && (
                <Animated.View style={[StyleSheet.absoluteFill, styles.successOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
                    {/* Bubble particles */}
                    {BUBBLES.map((bubble, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.bubble,
                                {
                                    width: bubble.size,
                                    height: bubble.size,
                                    borderRadius: bubble.size / 2,
                                    backgroundColor: bubble.color,
                                    opacity: bubbleAnims[i].opacity,
                                    transform: [
                                        { translateX: bubbleAnims[i].translateX },
                                        { translateY: bubbleAnims[i].translateY },
                                        { scale: bubbleAnims[i].scale },
                                    ],
                                },
                            ]}
                        />
                    ))}

                    {/* Green circle + checkmark */}
                    <Animated.View style={[styles.successCircle, { transform: [{ scale: circleScale }] }]}>
                        <Animated.View style={{ opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
                            <CheckIcon color="#FFF" />
                        </Animated.View>
                    </Animated.View>

                    <Animated.Text style={[styles.successLabel, { opacity: checkOpacity }]}>
                        Posted!
                    </Animated.Text>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: 'transparent' },
    safeArea: { flex: 1 },
    keyboardView: { flex: 1, justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#FAF9F6',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 25,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        borderBottomWidth: 0,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.03,
        shadowRadius: 20,
    },
    containerDark: {
        backgroundColor: '#1C1C1E',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { color: '#8E8E93', fontSize: 10, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase', paddingRight: Platform.OS === 'android' ? 2 : 0 },
    textDark: { color: '#FFF' },
    scrollContent: { paddingVertical: 8 },
    challengeCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    cardDark: { backgroundColor: '#2C2C2E', borderColor: 'rgba(255,255,255,0.05)' },
    challengeLabel: { color: '#A7BBC7', fontSize: 9, fontWeight: '500', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
    challengeText: { color: '#4A4A4A', fontSize: 16, fontWeight: '400', lineHeight: 24 },
    imageWrapper: { width: '100%', aspectRatio: 1.25, borderRadius: 24, overflow: 'hidden', marginBottom: 20, backgroundColor: '#F0F0F0' },
    videoWrapper: { aspectRatio: 9 / 16 },
    image: { width: '100%', height: '100%' },
    videoBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    videoBadgeText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    removeImageButton: { position: 'absolute', top: 12, right: 12 },
    removeIconWrapper: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    inputContainer: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        marginBottom: 10,
    },
    input: { color: '#4A4A4A', fontSize: 16, minHeight: 60, maxHeight: 150, textAlignVertical: 'top', lineHeight: 24 },
    actionFooter: { flexDirection: 'row', gap: 12, paddingVertical: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.03)' },
    borderDark: { borderTopColor: 'rgba(255,255,255,0.05)' },
    actionBtn: { flex: 1, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryBtn: { backgroundColor: '#4A4A4A' },
    primaryBtnDark: { backgroundColor: '#3A3A3C' },
    secondaryBtn: { backgroundColor: '#FAF9F6', borderWidth: 1, borderColor: '#D1D1D1' },
    secondaryBtnDark: { backgroundColor: 'transparent', borderColor: '#48484A' },
    disabledBtn: { opacity: 0.2 },
    primaryText: { color: '#FAF9F6', fontWeight: '500', fontSize: 12, letterSpacing: 1, paddingRight: Platform.OS === 'android' ? 6 : 0 },
    actionText: { color: '#8E8E93', fontWeight: '500', fontSize: 12, letterSpacing: 1, paddingRight: Platform.OS === 'android' ? 6 : 0 },
    disabledText: { color: '#AEAEB2' },

    // ── Video upload progress ─────────────────────────────────────────────────
    progressWrap: {
        paddingHorizontal: 0,
        paddingBottom: 12,
        gap: 6,
    },
    progressTrack: {
        height: 3,
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#A7BBC7',
        borderRadius: 2,
    },
    progressLabel: {
        fontSize: 11,
        color: '#8E8E93',
        fontWeight: '500',
        letterSpacing: 0.2,
    },

    // ── Success overlay ───────────────────────────────────────────────────────
    successOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 999,
    },
    successCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#34C759',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#34C759',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 12,
    },
    successLabel: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
        letterSpacing: -0.3,
    },
    bubble: {
        position: 'absolute',
    },
});
