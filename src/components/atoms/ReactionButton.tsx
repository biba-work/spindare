import React, { useRef, useEffect } from 'react';
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

type ReactionType = 'send' | 'do' | 'save' | 'felt' | 'thought' | 'intrigued' | 'camera' | 'gallery' | 'text';

interface ReactionButtonProps {
    type: ReactionType;
    label: string;
    onPress: () => void;
    selected?: boolean;
}

const Shape = ({ type, color }: { type: ReactionType; color: string }) => {
    switch (type) {
        case 'camera':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <Circle cx="12" cy="13" r="4" />
                </Svg>
            );
        case 'gallery':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <Circle cx="8.5" cy="8.5" r="1.5" />
                    <Path d="M21 15l-5-5L5 21" />
                </Svg>
            );
        case 'text':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </Svg>
            );
        case 'send':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </Svg>
            );
        case 'do':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Polygon points="5,3 19,12 5,21" fill={color} opacity={0.8} />
                </Svg>
            );
        case 'save':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Path
                        d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                        fill={color}
                        opacity={0.8}
                    />
                </Svg>
            );
        case 'felt':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Circle cx="12" cy="12" r="8" fill={color} opacity={0.8} />
                </Svg>
            );
        case 'thought':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Polygon points="12,4 20,20 4,20" fill={color} opacity={0.8} />
                </Svg>
            );
        case 'intrigued':
            return (
                <Svg width="20" height="20" viewBox="0 0 24 24">
                    <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={color} opacity={0.8} />
                </Svg>
            );
    }
};

const getColorForType = (type: ReactionType): string => {
    switch (type) {
        case 'felt':
            return '#FF6B6B';
        case 'thought':
            return '#4ECDC4';
        case 'intrigued':
            return '#FFE66D';
        default:
            return '#4A4A4A';
    }
};

export const ReactionButton = ({ type, label, onPress, selected }: ReactionButtonProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rippleScale = useRef(new Animated.Value(0.5)).current;
    const rippleOpacity = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(glowAnim, {
            toValue: selected ? 1 : 0,
            useNativeDriver: false,
            friction: 5,
            tension: 40,
        }).start();
    }, [selected]);

    const handlePress = () => {
        if (selected) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        scaleAnim.setValue(0.6);
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1.3,
                useNativeDriver: true,
                friction: 3,
                tension: 180,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                friction: 3,
                tension: 180,
            }),
        ]).start();

        rippleScale.setValue(0.5);
        rippleOpacity.setValue(0.6);
        Animated.parallel([
            Animated.timing(rippleScale, {
                toValue: 2.5,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(rippleOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();

        onPress();
    };

    const glowBackgroundColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0)', 'rgba(74,74,74,0.15)'],
    });

    const rippleColor = getColorForType(type);

    return (
        <Pressable onPress={handlePress} style={styles.button}>
            <View style={[styles.container, { position: 'relative', overflow: 'visible' }]} renderToHardwareTextureAndroid={true}>
                {/* Ripple effect */}
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            backgroundColor: rippleColor,
                            transform: [{ scale: rippleScale }],
                            opacity: rippleOpacity,
                        },
                    ]}
                    pointerEvents="none"
                />

                {/* Glow background */}
                <Animated.View
                    style={[
                        styles.glowBackground,
                        {
                            backgroundColor: glowBackgroundColor,
                        },
                    ]}
                >
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <Shape type={type} color={selected ? '#FFFFFF' : '#3f3f46'} />
                    </Animated.View>
                </Animated.View>

                <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
    },
    container: {
        alignItems: 'center',
    },
    ripple: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        top: -20,
        left: -20,
    },
    glowBackground: {
        borderRadius: 20,
        padding: 10,
        margin: -10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        marginTop: 10,
        color: '#71717a',
        fontSize: 9,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
    },
    labelSelected: {
        color: '#FFFFFF',
    },
});
