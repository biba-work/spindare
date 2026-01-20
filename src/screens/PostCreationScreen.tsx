import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface PostCreationScreenProps {
    challenge: string;
    imageUri?: string | null;
    onClose: () => void;
    onPost: (content: string, imageUri?: string | null) => void;
}

export const PostCreationScreen = ({ challenge, imageUri: initialImageUri, onClose, onPost }: PostCreationScreenProps) => {
    const [content, setContent] = useState('');
    const [imageUri, setImageUri] = useState(initialImageUri);
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

    const handlePost = () => {
        if (content.trim() || imageUri) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPost(content, imageUri);
        }
    };

    const removeImage = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setImageUri(null);
    };

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView
                    intensity={80}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 12, 14, 0.98)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <Animated.View style={[
                            styles.container,
                            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                        ]}>
                            <View style={styles.header}>
                                <Pressable onPress={onClose} style={styles.closeButton}>
                                    <View style={styles.closeIcon}>
                                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <Path d="M18 6L6 18M6 6l12 12" />
                                        </Svg>
                                    </View>
                                </Pressable>
                                <Text style={styles.headerTitle}>Daily Reflection</Text>
                                <Pressable
                                    onPress={handlePost}
                                    disabled={!content.trim() && !imageUri}
                                    style={({ pressed }) => [
                                        styles.postButton,
                                        (!content.trim() && !imageUri || pressed) && { opacity: 0.5 }
                                    ]}
                                >
                                    <Text style={styles.postButtonText}>SHRP</Text>
                                </Pressable>
                            </View>

                            <View style={styles.challengeBox}>
                                <Text style={styles.challengeLabel}>CHALLENGE</Text>
                                <Text style={styles.challengeText}>{challenge}</Text>
                            </View>

                            {imageUri && (
                                <View style={styles.imagePreviewContainer}>
                                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                                    <Pressable style={styles.removeImageButton} onPress={removeImage}>
                                        <View style={styles.removeIconWrapper}>
                                            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <Path d="M18 6L6 18M6 6l12 12" />
                                            </Svg>
                                        </View>
                                    </Pressable>
                                </View>
                            )}

                            <TextInput
                                style={styles.input}
                                placeholder="Share your experience..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                multiline
                                value={content}
                                onChangeText={setContent}
                                maxLength={300}
                                returnKeyType="done"
                                blurOnSubmit={true}
                                onSubmitEditing={Keyboard.dismiss}
                            />

                            <View style={styles.footer}>
                                <Text style={styles.charCount}>{content.length}/300</Text>
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        padding: 8,
    },
    closeText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    postButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },
    postButtonText: {
        color: '#000000',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    challengeBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    challengeLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 8,
    },
    challengeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Montserrat_400Regular',
        lineHeight: 20,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Montserrat_400Regular',
        lineHeight: 28,
        textAlignVertical: 'top',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 12,
    },
    charCount: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    imagePreviewContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    removeImageButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    removeIconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    closeIcon: {
        padding: 4,
    },
});
