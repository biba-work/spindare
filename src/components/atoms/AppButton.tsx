import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle, StyleProp, Insets } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AppButtonProps {
    onPress: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    type?: 'primary' | 'secondary' | 'icon';
    haptic?: boolean;
    hitSlop?: Insets;
    disabled?: boolean;
}

export const AppButton = ({ onPress, children, style, type = 'primary', haptic = true, hitSlop, disabled }: AppButtonProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePress = () => {
        if (disabled) return;
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <Pressable
            onPressIn={disabled ? undefined : handlePressIn}
            onPressOut={disabled ? undefined : handlePressOut}
            onPress={handlePress}
            disabled={disabled}
            hitSlop={hitSlop || { top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
                styles.base,
                type === 'primary' && styles.primary,
                type === 'secondary' && styles.secondary,
                type === 'icon' && styles.icon,
                style,
            ]}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', justifyContent: 'center', width: '100%', flexDirection: 'row', gap: 8 }}>
                {children}
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 48,
    },
    primary: {
        backgroundColor: '#4A4A4A',
        paddingHorizontal: 24,
    },
    secondary: {
        backgroundColor: '#FAF9F6',
        borderWidth: 1,
        borderColor: '#D1D1D1',
        paddingHorizontal: 20,
    },
    icon: {
        width: 48,
        height: 48,
        backgroundColor: '#FFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
});
