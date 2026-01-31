import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, Image, ScrollView, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface PostCreationScreenProps {
    challenge: string;
    imageUri?: string | null;
    onClose: () => void;
    onPost: (content: string, imageUri?: string | null, target?: 'feed' | 'friend') => void;
    isSubmitting?: boolean;
}

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
);

export const PostCreationScreen = ({ challenge, imageUri: initialImageUri, onClose, onPost, isSubmitting = false }: PostCreationScreenProps) => {
    const { darkMode } = useTheme();
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
        if ((content.trim() || imageUri) && !isSubmitting) {
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
                <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(250, 249, 246, 0.95)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <Animated.View style={[styles.container, darkMode && styles.containerDark, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

                            <View style={styles.header}>
                                <Pressable onPress={onClose} hitSlop={20} disabled={isSubmitting}>
                                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? "#FFF" : "#8E8E93"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                    <View style={styles.imageWrapper}>
                                        <Image source={{ uri: imageUri }} style={styles.image} />
                                        <Pressable style={styles.removeImageButton} onPress={removeImage} disabled={isSubmitting}>
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
                                        placeholderTextColor={darkMode ? "#8E8E93" : "#C5C5C5"}
                                        multiline
                                        value={content}
                                        onChangeText={setContent}
                                        maxLength={300}
                                        editable={!isSubmitting}
                                    />
                                </View>
                            </ScrollView>

                            <View style={[styles.actionFooter, darkMode && styles.borderDark]}>
                                <Pressable
                                    onPress={() => handleAction('friend')}
                                    style={[styles.actionBtn, styles.secondaryBtn, darkMode && styles.secondaryBtnDark, (!isReady || isSubmitting) && styles.disabledBtn]}
                                    disabled={!isReady || isSubmitting}
                                >
                                    <SendIcon color={isReady && !isSubmitting ? (darkMode ? "#FFF" : "#8E8E93") : "#AEAEB2"} />
                                    <Text style={[styles.actionText, darkMode && styles.textDark, (!isReady || isSubmitting) && styles.disabledText]}>SEND PRIVATELY</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => handleAction('feed')}
                                    style={[styles.actionBtn, styles.primaryBtn, darkMode && styles.primaryBtnDark, (!isReady || isSubmitting) && styles.disabledBtn]}
                                    disabled={!isReady || isSubmitting}
                                >
                                    {isSubmitting ? (
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
    headerTitle: { color: '#8E8E93', fontSize: 10, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase' },
    textDark: { color: '#FFF' },
    scrollContent: { paddingVertical: 8 },
    challengeCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    cardDark: { backgroundColor: '#2C2C2E', borderColor: 'rgba(255,255,255,0.05)' },
    challengeLabel: { color: '#A7BBC7', fontSize: 9, fontWeight: '500', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
    challengeText: { color: '#4A4A4A', fontSize: 16, fontWeight: '400', lineHeight: 24 },
    imageWrapper: { width: '100%', aspectRatio: 1.25, borderRadius: 24, overflow: 'hidden', marginBottom: 20, backgroundColor: '#F0F0F0' },
    image: { width: '100%', height: '100%' },
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
    primaryText: { color: '#FAF9F6', fontWeight: '500', fontSize: 12, letterSpacing: 1 },
    actionText: { color: '#8E8E93', fontWeight: '500', fontSize: 12, letterSpacing: 1 },
    disabledText: { color: '#AEAEB2' },
});
