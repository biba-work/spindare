import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, Image, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface PostCreationScreenProps {
    challenge: string;
    imageUri?: string | null;
    onClose: () => void;
    onPost: (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => void;
}

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
);

export const PostCreationScreen = ({ challenge, imageUri: initialImageUri, onClose, onPost }: PostCreationScreenProps) => {
    const [content, setContent] = useState('');
    const [imageUri, setImageUri] = useState(initialImageUri);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleAction = (target: 'feed' | 'friend') => {
        if (content.trim() || imageUri) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPost(content, imageUri, target);
        }
    };

    const removeImage = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setImageUri(null);
    };

    const isReady = content.trim() || imageUri;

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

                            <View style={styles.header}>
                                <Pressable onPress={onClose} hitSlop={20}>
                                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M19 12H5M12 19l-7-7 7-7" />
                                    </Svg>
                                </Pressable>
                                <Text style={styles.headerTitle}>COMPLETED CHALLENGE</Text>
                                <View style={{ width: 24 }} />
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.scrollContent}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.challengeCard}>
                                    <Text style={styles.challengeLabel}>THE DARE</Text>
                                    <Text style={styles.challengeText}>{challenge}</Text>
                                </View>

                                {imageUri && (
                                    <View style={styles.imageWrapper}>
                                        <Image source={{ uri: imageUri }} style={styles.image} />
                                        <Pressable style={styles.removeImageButton} onPress={removeImage}>
                                            <View style={styles.removeIconWrapper}>
                                                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <Path d="M18 6L6 18M6 6l12 12" />
                                                </Svg>
                                            </View>
                                        </Pressable>
                                    </View>
                                )}

                                <TextInput
                                    style={styles.input}
                                    placeholder="Add a caption or thoughts..."
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                    multiline
                                    value={content}
                                    onChangeText={setContent}
                                    maxLength={300}
                                    autoFocus={!imageUri}
                                />
                            </ScrollView>

                            <View style={styles.actionFooter}>
                                <Pressable
                                    onPress={() => handleAction('friend')}
                                    style={[styles.actionBtn, styles.secondaryBtn, !isReady && styles.disabledBtn]}
                                    disabled={!isReady}
                                >
                                    <SendIcon color={isReady ? "#FFF" : "rgba(255,255,255,0.2)"} />
                                    <Text style={[styles.actionText, !isReady && styles.disabledText]}>SEND TO FRIEND</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => handleAction('feed')}
                                    style={[styles.actionBtn, styles.primaryBtn, !isReady && styles.disabledBtn]}
                                    disabled={!isReady}
                                >
                                    <Text style={styles.primaryText}>POST TO FEED</Text>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: 'transparent' },
    safeArea: { flex: 1, justifyContent: 'flex-end' },
    keyboardView: { flex: 1, justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#161618',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        height: height * 0.85,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderBottomWidth: 0,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 40, marginBottom: 15 },
    headerTitle: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 3, opacity: 0.5 },
    scrollContent: { paddingBottom: 20 },
    challengeCard: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    challengeLabel: { color: '#FF3B30', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
    challengeText: { color: '#FFF', fontSize: 14, fontWeight: '500', lineHeight: 20 },
    imageWrapper: { width: '100%', aspectRatio: 1.2, borderRadius: 20, overflow: 'hidden', marginBottom: 20, backgroundColor: '#111' },
    image: { width: '100%', height: '100%' },
    removeImageButton: { position: 'absolute', top: 12, right: 12 },
    removeIconWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    input: { color: '#FFF', fontSize: 16, minHeight: 80, textAlignVertical: 'top', paddingTop: 0, marginBottom: 10 },
    actionFooter: { flexDirection: 'row', gap: 10, paddingVertical: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    actionBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    primaryBtn: { backgroundColor: '#FFF' },
    secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    disabledBtn: { opacity: 0.3 },
    primaryText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    actionText: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
    disabledText: { color: 'rgba(255,255,255,0.5)' },
});
