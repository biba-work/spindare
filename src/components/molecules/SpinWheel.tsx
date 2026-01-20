import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.88;
const RADIUS = WHEEL_SIZE / 2;

interface SpinWheelProps {
    options: string[];
    onSpinEnd: (result: string) => void;
    canSpin: boolean;
    onPress?: () => void;
}

export const SpinWheel = ({ options, onSpinEnd, canSpin, onPress }: SpinWheelProps) => {
    const rotation = useRef(new Animated.Value(0)).current;
    const currentRotation = useRef(0);
    const lastAngle = useRef(0);
    const lastSegmentIndex = useRef(-1);
    const [isSpinning, setIsSpinning] = useState(false);

    const autoSpinAnim = useRef(new Animated.Value(0)).current;
    const loopRef = useRef<Animated.CompositeAnimation | null>(null);
    const wheelRef = useRef<View>(null);
    const [wheelCenter, setWheelCenter] = useState({ x: 0, y: 0 });

    const SEGMENT_COUNT = 48;

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
        const id = rotation.addListener(({ value }) => {
            currentRotation.current = value;
            if (!canSpin) return;

            const segmentAngle = 360 / SEGMENT_COUNT;
            const normalizedRotation = ((value % 360) + 360) % 360;
            const currentIndex = Math.floor(normalizedRotation / segmentAngle);

            if (currentIndex !== lastSegmentIndex.current) {
                if (Platform.OS === 'ios') {
                    Haptics.selectionAsync();
                }
                lastSegmentIndex.current = currentIndex;
            }
        });
        return () => rotation.removeListener(id);
    }, [options.length, canSpin]);

    const getAngle = (x: number, y: number) => {
        const dx = x - wheelCenter.x;
        const dy = y - wheelCenter.y;
        return (Math.atan2(dy, dx) * 180) / Math.PI;
    };

    const onGestureEvent = (event: any) => {
        if (!canSpin || isSpinning) return;
        const { absoluteX, absoluteY } = event.nativeEvent;
        const angle = getAngle(absoluteX, absoluteY);

        let delta = angle - lastAngle.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        rotation.setValue(currentRotation.current + delta);
        lastAngle.current = angle;
    };

    const onHandlerStateChange = (event: any) => {
        if (!canSpin || isSpinning) return;
        const { state, absoluteX, absoluteY, velocityX, velocityY } = event.nativeEvent;

        if (state === State.BEGAN) {
            rotation.stopAnimation();
            lastAngle.current = getAngle(absoluteX, absoluteY);
        }

        if (state === State.END) {
            const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY) * 0.1;

            if (velocity < 15) {
                if (onPress) onPress();
                return;
            }

            setIsSpinning(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            Animated.decay(rotation, {
                velocity: velocity / 15,
                deceleration: 0.998,
                useNativeDriver: true,
            }).start(() => {
                setIsSpinning(false);
                const finalRot = ((currentRotation.current % 360) + 360) % 360;
                const segmentAngle = 360 / options.length;
                const winningIndex = Math.floor(((360 - finalRot + 270) % 360) / segmentAngle);
                onSpinEnd(options[winningIndex % options.length]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            });
        }
    };

    const onLayout = () => {
        wheelRef.current?.measure((x, y, width, height, pageX, pageY) => {
            setWheelCenter({
                x: pageX + width / 2,
                y: pageY + height / 2
            });
        });
    };

    const rotate = rotation.interpolate({
        inputRange: [-360, 360],
        outputRange: ['-360deg', '360deg'],
    });

    const autoRotate = autoSpinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const segments = useMemo(() => {
        const paths = [];
        const count = SEGMENT_COUNT;
        const angleStep = 360 / count;
        for (let i = 0; i < count; i++) {
            const startAngle = i * angleStep;
            const rad = (startAngle * Math.PI) / 180;
            const x1 = RADIUS + (RADIUS - 2) * Math.cos(rad);
            const y1 = RADIUS + (RADIUS - 2) * Math.sin(rad);
            const x2 = RADIUS + (RADIUS - 20) * Math.cos(rad);
            const y2 = RADIUS + (RADIUS - 20) * Math.sin(rad);
            paths.push(
                <Path
                    key={i}
                    d={`M${x1},${y1} L${x2},${y2}`}
                    stroke={i % (count / 4) === 0 ? "#FFF" : "rgba(255,255,255,0.15)"}
                    strokeWidth={i % (count / 4) === 0 ? "2" : "1"}
                />
            );
        }
        return paths;
    }, []);

    return (
        <View style={styles.container} onLayout={onLayout} ref={wheelRef}>
            <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                activeOffsetX={[-10, 10]}
                activeOffsetY={[-10, 10]}
            >
                <Animated.View
                    style={[styles.wheelContainer, { transform: [{ rotate: canSpin ? rotate : autoRotate }] }]}
                    renderToHardwareTextureAndroid={true}
                >
                    <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                        <Circle cx={RADIUS} cy={RADIUS} r={RADIUS - 2} fill="#000" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <G>{segments}</G>
                        <Circle cx={RADIUS} cy={RADIUS} r={RADIUS * 0.3} fill="#000" stroke="#FFF" strokeWidth="2" />
                        <Circle cx={RADIUS} cy={RADIUS} r={RADIUS * 0.25} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <SvgText x={RADIUS} y={RADIUS + 8} fill="#FFF" fontSize="24" fontWeight="900" textAnchor="middle">S</SvgText>
                    </Svg>
                </Animated.View>
            </PanGestureHandler>
            <View style={styles.pointerContainer}>
                <Svg width="20" height="30" viewBox="0 0 20 30">
                    <Path d="M10 0 L20 10 L10 30 L0 10 Z" fill="#FFF" />
                </Svg>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    wheelContainer: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center' },
    pointerContainer: { position: 'absolute', top: -10, zIndex: 500, alignItems: 'center' },
});

