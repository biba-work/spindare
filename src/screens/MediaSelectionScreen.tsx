import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

const { width, height } = Dimensions.get('window');

interface MediaSelectionScreenProps {
    onSelect: (type: 'camera' | 'gallery' | 'text', imageUri?: string) => void;
    onClose: () => void;
    challenge: string;
}

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Svg>
);

export const MediaSelectionScreen = ({ onSelect, onClose, challenge }: MediaSelectionScreenProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height * 0.3)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleSelect = async (type: 'camera' | 'gallery' | 'text') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (type === 'camera') {
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access camera is required to take photos.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                onSelect('camera', result.assets[0].uri);
            }
        } else if (type === 'gallery') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access gallery is required to select photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                onSelect('gallery', result.assets[0].uri);
            }
        } else {
            onSelect(type);
        }
    };

    return (
        <View style={styles.fullScreen}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 12, 14, 0.98)' }]} />
            )}

            <SafeAreaView style={styles.safeArea}>
                <Pressable style={styles.dismissArea} onPress={onClose} />

                <Animated.View style={[
                    styles.contentContainer,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Choose medium</Text>
                        <Text style={styles.challengeText} numberOfLines={1}>"{challenge}"</Text>
                    </View>

                    <View style={styles.optionsGrid}>
                        <Pressable
                            style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
                            onPress={() => handleSelect('camera')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <CameraIcon color="#FFFFFF" />
                            </View>
                            <Text style={styles.optionLabel}>Camera</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
                            onPress={() => handleSelect('gallery')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <GalleryIcon color="#FFFFFF" />
                            </View>
                            <Text style={styles.optionLabel}>Gallery</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [styles.optionCard, pressed && styles.optionPressed]}
                            onPress={() => handleSelect('text')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <TextIcon color="#FFFFFF" />
                            </View>
                            <Text style={styles.optionLabel}>Just Text</Text>
                        </Pressable>
                    </View>

                    <Pressable onPress={onClose} style={styles.cancelButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    safeArea: {
        flex: 1,
    },
    dismissArea: {
        flex: 1,
    },
    contentContainer: {
        backgroundColor: '#161618',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderBottomWidth: 0,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'Inter_400Regular',
        marginBottom: 8,
    },
    challengeText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontFamily: 'Montserrat_400Regular',
        textAlign: 'center',
    },
    optionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    optionCard: {
        flex: 1,
        alignItems: 'center',
    },
    optionPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    iconWrapper: {
        width: height * 0.08,
        height: height * 0.08,
        borderRadius: (height * 0.08) / 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    optionLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
        fontFamily: 'Inter_400Regular',
        letterSpacing: 0.5,
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
    },
});
