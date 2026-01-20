import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.85;
const RADIUS = WHEEL_SIZE / 2;

interface SpinWheelProps {
    onSpinEnd: (result: number) => void;
}

export const SpinWheel = ({ onSpinEnd }: SpinWheelProps) => {
    const rotation = useRef(new Animated.Value(0)).current;
    const currentRotation = useRef(0);
    const lastAngle = useRef(0);

    useEffect(() => {
        const id = rotation.addListener(({ value }) => {
            currentRotation.current = value;
        });
        return () => rotation.removeListener(id);
    }, [rotation]);

    // Helper to calculate angle from touch point relative to center
    const getAngle = (x: number, y: number) => {
        const dx = x - RADIUS;
        const dy = y - RADIUS;
        return (Math.atan2(dy, dx) * 180) / Math.PI;
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                lastAngle.current = getAngle(locationX, locationY);
                rotation.stopAnimation();
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const angle = getAngle(locationX, locationY);
                const delta = angle - lastAngle.current;

                // Handle wrapping around 180/-180 degrees
                let adjustedDelta = delta;
                if (delta > 180) adjustedDelta -= 360;
                if (delta < -180) adjustedDelta += 360;

                rotation.setValue(currentRotation.current + adjustedDelta);
                lastAngle.current = angle;
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { vx, vy } = gestureState;
                // Calculate angular velocity based on linear velocity and distance from center
                const velocity = Math.sqrt(vx * vx + vy * vy) * (vx > 0 ? 1 : -1) * 5;

                Animated.decay(rotation, {
                    velocity: velocity / 15,
                    deceleration: 0.998, // Slightly higher for "heavier", smoother feel
                    useNativeDriver: true,
                }).start(() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onSpinEnd(Math.floor(Math.random() * 10));
                });
            },
        })
    ).current;

    const rotate = rotation.interpolate({
        inputRange: [-360, 360],
        outputRange: ['-360deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            <Animated.View
                {...panResponder.panHandlers}
                style={[styles.wheelContainer, { transform: [{ rotate }] }]}
            >
                <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                    <G x={RADIUS} y={RADIUS}>
                        {/* Outer Glow/Ring */}
                        <Circle r={RADIUS - 5} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />

                        {/* Main Wheel Body */}
                        <Circle r={RADIUS - 10} fill="#18181b" stroke="#27272a" strokeWidth="2" />
                        <Circle r={RADIUS - 20} fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4,8" />

                        {/* Decorative Segments */}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                            <G key={i} transform={`rotate(${angle})`}>
                                <Path
                                    d={`M${RADIUS - 60} 0 L${RADIUS - 30} 0`}
                                    stroke="#52525b"
                                    strokeWidth="1"
                                    opacity={0.5}
                                />
                                <Circle cx={RADIUS - 45} cy={0} r={1.5} fill="#71717a" />
                            </G>
                        ))}

                        {/* Center Hub */}
                        <Circle r={45} fill="#18181b" stroke="#52525b" strokeWidth="0.5" />
                        <Circle r={40} fill="#18181b" stroke="#FFFFFF" strokeWidth="1" opacity={0.2} />
                        <Circle r={10} fill="#FFFFFF" opacity={0.1} />
                    </G>
                </Svg>
            </Animated.View>
            <View style={styles.pointerContainer}>
                <View style={styles.pointer} />
                <View style={styles.pointerBase} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    wheelContainer: {
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pointerContainer: {
        position: 'absolute',
        top: -15,
        alignItems: 'center',
        zIndex: 10,
    },
    pointer: {
        width: 3,
        height: 35,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    pointerBase: {
        width: 10,
        height: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 5,
        marginTop: -5,
    }
});
