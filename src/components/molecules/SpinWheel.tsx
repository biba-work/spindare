import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated, PanResponder, Image, Platform } from 'react-native';
import Svg, { G, Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.88;
const RADIUS = WHEEL_SIZE / 2;

interface SpinWheelProps {
    options: string[];
    onSpinEnd: (result: string) => void;
    userAvatar?: string;
    canSpin: boolean;
    onPress?: () => void;
}

export const SpinWheel = ({ options, onSpinEnd, userAvatar, canSpin, onPress }: SpinWheelProps) => {
    const rotation = useRef(new Animated.Value(0)).current;
    const currentRotation = useRef(0);
    const lastAngle = useRef(0);
    const lastSegmentIndex = useRef(-1);
    const [isSpinning, setIsSpinning] = useState(false);
    const autoSpinAnim = useRef(new Animated.Value(0)).current;
    const loopRef = useRef<Animated.CompositeAnimation | null>(null);

    const SEGMENT_COUNT = 32; // Mechanical clicks

    useEffect(() => {
        if (!canSpin) {
            loopRef.current = Animated.loop(
                Animated.timing(autoSpinAnim, {
                    toValue: 1,
                    duration: 30000,
                    easing: (t) => t,
                    useNativeDriver: true,
                })
            );
            loopRef.current.start();
        } else {
            if (loopRef.current) loopRef.current.stop();
            autoSpinAnim.setValue(0);
        }
        return () => loopRef.current?.stop();
    }, [canSpin]);

    useEffect(() => {
        if (!canSpin) return;
        const id = rotation.addListener(({ value }) => {
            currentRotation.current = value;
            // Mechanical "click" logic based on segments
            const segmentAngle = 360 / SEGMENT_COUNT;
            const normalizedRotation = ((value % 360) + 360) % 360;
            const currentIndex = Math.floor(normalizedRotation / segmentAngle);

            if (currentIndex !== lastSegmentIndex.current) {
                if (Platform.OS === 'ios') {
                    // Ultra-light mechanical click
                    Haptics.selectionAsync();
                }
                lastSegmentIndex.current = currentIndex;
            }
        });
        return () => rotation.removeListener(id);
    }, [options.length, canSpin]);

    const getAngle = (x: number, y: number) => {
        const dx = x - RADIUS;
        const dy = y - RADIUS;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return angle;
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => canSpin && !isSpinning,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return canSpin && !isSpinning && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
            },
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                lastAngle.current = getAngle(locationX, locationY);
                rotation.stopAnimation();
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const angle = getAngle(locationX, locationY);
                let delta = angle - lastAngle.current;

                // Handle 180/-180 degree wrap around
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;

                rotation.setValue(currentRotation.current + delta);
                lastAngle.current = angle;
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { vx, vy } = gestureState;
                const velocity = Math.sqrt(vx * vx + vy * vy) * (vx > 0 ? 1 : -1) * 10;

                if (Math.abs(velocity) < 2) {
                    if (onPress) onPress();
                    return;
                }

                setIsSpinning(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                Animated.decay(rotation, {
                    velocity: velocity / 12,
                    deceleration: 0.997, // High quality slow-down
                    useNativeDriver: true,
                }).start(() => {
                    setIsSpinning(false);
                    const finalRot = ((currentRotation.current % 360) + 360) % 360;
                    // Ensure the winning logic matches the rotation (pointer at top = 270 deg)
                    const segmentAngle = 360 / options.length;
                    const winningIndex = Math.floor(((360 - finalRot + 270) % 360) / segmentAngle);
                    onSpinEnd(options[winningIndex % options.length]);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                });
            },
        })
    ).current;

    const rotate = rotation.interpolate({
        inputRange: [-360, 360],
        outputRange: ['-360deg', '360deg'],
    });

    const autoRotate = autoSpinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const renderVisualSegments = () => {
        const paths = [];
        const count = SEGMENT_COUNT;
        const angleStep = 360 / count;

        for (let i = 0; i < count; i++) {
            const startAngle = i * angleStep;
            const endAngle = (i + 1) * angleStep;

            // Premium mechanical hatch marks
            const rad = (startAngle * Math.PI) / 180;
            const x1 = RADIUS + (RADIUS - 2) * Math.cos(rad);
            const y1 = RADIUS + (RADIUS - 2) * Math.sin(rad);
            const x2 = RADIUS + (RADIUS - 16) * Math.cos(rad);
            const y2 = RADIUS + (RADIUS - 16) * Math.sin(rad);

            paths.push(
                <G key={i}>
                    {/* Outer tick */}
                    <Path
                        d={`M${x1},${y1} L${x2},${y2}`}
                        stroke={i % 4 === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}
                        strokeWidth={i % 4 === 0 ? "1.5" : "1"}
                    />
                </G>
            );
        }
        return paths;
    };

    if (!canSpin) {
        return (
            <View style={styles.container}>
                <Animated.View style={[styles.lockedRing, { transform: [{ rotate: autoRotate }] }]}>
                    <Svg width={WHEEL_SIZE * 0.4} height={WHEEL_SIZE * 0.4} viewBox="0 0 100 100">
                        <Circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="3,6" />
                        <Circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </Svg>
                    <View style={styles.avatarContainerLocked}>
                        <Image source={{ uri: userAvatar }} style={styles.avatar} />
                    </View>
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.View
                {...panResponder.panHandlers}
                style={[styles.wheelContainer, { transform: [{ rotate }] }]}
                renderToHardwareTextureAndroid={true}
            >
                <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                    {/* Outer Boundary */}
                    <Circle cx={RADIUS} cy={RADIUS} r={RADIUS - 1} fill="#050505" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

                    {/* Mechanical Ticks */}
                    <G>{renderVisualSegments()}</G>

                    {/* Inner Branding Rings */}
                    <Circle cx={RADIUS} cy={RADIUS} r={RADIUS * 0.45} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <Circle cx={RADIUS} cy={RADIUS} r={RADIUS * 0.42} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="1,10" />
                </Svg>

                <View style={styles.avatarContainer}>
                    <Image source={{ uri: userAvatar }} style={styles.avatar} />
                    {/* Shine effect */}
                    <View style={styles.avatarShine} />
                </View>
            </Animated.View>

            {/* Precision Pointer */}
            <View style={styles.pointerContainer}>
                <Svg width="30" height="40" viewBox="0 0 30 40">
                    <Path d="M15 0 L30 15 L15 40 L0 15 Z" fill="#FFFFFF" />
                    <Path d="M15 5 L25 15 L15 30 L5 15 Z" fill="#000000" />
                </Svg>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    wheelContainer: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center' },
    lockedRing: { width: WHEEL_SIZE * 0.4, height: WHEEL_SIZE * 0.4, alignItems: 'center', justifyContent: 'center' },
    avatarContainer: {
        position: 'absolute',
        width: WHEEL_SIZE * 0.38,
        height: WHEEL_SIZE * 0.38,
        borderRadius: (WHEEL_SIZE * 0.38) / 2,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#000',
        elevation: 10,
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
    },
    avatarContainerLocked: {
        position: 'absolute',
        width: WHEEL_SIZE * 0.35,
        height: WHEEL_SIZE * 0.35,
        borderRadius: (WHEEL_SIZE * 0.35) / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: '#000',
    },
    avatar: { width: '100%', height: '100%' },
    avatarShine: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.05)' },
    pointerContainer: { position: 'absolute', top: -15, zIndex: 500, alignItems: 'center' },
});
