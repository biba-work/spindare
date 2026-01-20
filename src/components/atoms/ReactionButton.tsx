import React, { useRef, useEffect } from 'react';
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

type ReactionType = 'felt' | 'thought' | 'intrigued';

interface ReactionButtonProps {
    type: ReactionType;
    label: string;
    onPress: () => void;
    selected?: boolean;
}

const Shape = ({ type, color }: { type: ReactionType; color: string }) => {
    switch (type) {
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

export const ReactionButton = ({ type, label, onPress, selected }: ReactionButtonProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: selected ? 1.2 : 1,
            useNativeDriver: true,
            friction: 4,
            tension: 40,
        }).start();
    }, [selected]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Pressable onPress={handlePress} style={styles.button}>
            <View style={styles.container}>
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <Shape type={type} color={selected ? '#FFFFFF' : '#52525b'} />
                </Animated.View>
                <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
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
        minWidth: 70, // Ensure consistent width
    },
    container: {
        alignItems: 'center',
    },
    label: {
        marginTop: 10,
        color: '#71717a',
        fontSize: 9,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: 'Inter_400Regular',
    },
    labelSelected: {
        color: '#FFFFFF',
    },
});
