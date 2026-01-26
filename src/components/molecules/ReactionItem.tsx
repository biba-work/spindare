import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Easing } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const FeltIcon = ({ active }: { active: boolean }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (active) {
            Animated.timing(anim, {
                toValue: 1,
                duration: 1000, // Faster single pulse
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true
            }).start();
        } else {
            anim.setValue(0);
        }
    }, [active]);

    return (
        <View style={styles.iconCenterer}>
            {[0, 1, 2].map((i) => {
                const rotation = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [`${i * 120}deg`, `${i * 120 + 360}deg`]
                });
                const radius = anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [7, 2, 7]
                });

                return (
                    <Animated.View
                        key={i}
                        style={{
                            position: 'absolute',
                            transform: [
                                { rotate: rotation },
                                { translateY: radius }
                            ]
                        }}
                    >
                        <View style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#007AFF',
                            opacity: active ? 1 : 0.4
                        }} />
                    </Animated.View>
                );
            })}
        </View>
    );
};

const ThoughtIcon = ({ active }: { active: boolean }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (active) {
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: false }),
                Animated.timing(anim, { toValue: 0.5, duration: 400, useNativeDriver: false })
            ]).start();
        } else {
            anim.setValue(0);
        }
    }, [active]);

    return (
        <View style={styles.thoughtContainer}>
            {[0, 1, 2].map((i) => {
                const height = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 14]
                });
                return (
                    <Animated.View
                        key={i}
                        style={[
                            styles.waveLine,
                            {
                                height: active ? height : 6,
                                backgroundColor: '#FFD60A',
                                opacity: active ? 1 : 0.4,
                                transform: [{ translateY: i % 2 === 0 ? 3 : -3 }]
                            }
                        ]}
                    />
                );
            })}
        </View>
    );
};

const IntriguedIcon = ({ active }: { active: boolean }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (active) {
            Animated.timing(anim, {
                toValue: 1,
                duration: 1200,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true
            }).start();
        } else {
            anim.setValue(0);
        }
    }, [active]);

    const rotate = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const glow = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.2, 0.8, 0.2]
    });

    return (
        <View style={styles.intriguedBox}>
            <Animated.View style={[styles.glow, { opacity: active ? glow : 0.1 }]} />
            <Animated.View style={{ transform: [{ rotate }] }}>
                <Svg width="24" height="24" viewBox="0 0 24 24">
                    <Circle cx="12" cy="4" r="1.5" fill="#5856D6" opacity={active ? 1 : 0.4} />
                    <Circle cx="12" cy="20" r="1.5" fill="#5856D6" opacity={active ? 1 : 0.4} />
                    <Path d="M4 12 L8 12 M16 12 L20 12" stroke="#5856D6" strokeWidth="2" strokeLinecap="round" opacity={active ? 0.8 : 0.3} />
                    {active && <Circle cx="12" cy="12" r="1" fill="#4A4A4A" />}
                </Svg>
            </Animated.View>
        </View>
    );
};

export const ReactionItem = ({ type, count, active, onSelect, isOwner, fadeOut }: { type: 'felt' | 'thought' | 'intrigued', count: number, active: boolean, onSelect: () => void, isOwner?: boolean, fadeOut?: boolean }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (fadeOut) {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true
            }).start();
        } else {
            opacity.setValue(1);
        }
    }, [fadeOut]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true })
        ]).start();
        onSelect();
    };

    const renderIcon = () => {
        switch (type) {
            case 'felt': return <FeltIcon active={active} />;
            case 'thought': return <ThoughtIcon active={active} />;
            case 'intrigued': return <IntriguedIcon active={active} />;
        }
    };

    return (
        <Pressable onPress={handlePress} style={styles.reactionBtn} disabled={fadeOut}>
            <Animated.View style={[styles.iconBox, active && styles.iconBoxActive, { transform: [{ scale }], opacity }]}>
                {renderIcon()}
            </Animated.View>
            <View style={styles.infoBox}>
                {(isOwner || active) && (
                    <Animated.View style={{ opacity }}>
                        <Text style={[styles.countText, active && styles.countTextActive]}>
                            {isOwner ? count : active ? '+1' : ''}
                        </Text>
                    </Animated.View>
                )}
                <Animated.View style={{ opacity }}>
                    <Text style={[styles.label, active && styles.labelActive]}>{type.toUpperCase()}</Text>
                </Animated.View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    reactionBtn: {
        alignItems: 'center',
        marginVertical: 12,
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    iconBoxActive: {
        borderColor: '#4A4A4A',
        backgroundColor: '#FFF',
        borderWidth: 1.5,
    },
    infoBox: {
        alignItems: 'center',
        marginTop: 6,
    },
    countText: {
        color: '#9E9E9E',
        fontSize: 12,
        fontWeight: '500',
    },
    countTextActive: {
        color: '#4A4A4A',
    },
    label: {
        color: '#AEAEB2',
        fontSize: 8,
        fontWeight: '500',
        letterSpacing: 1.2,
    },
    labelActive: {
        color: '#4A4A4A',
    },
    thoughtContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 3,
    },
    waveLine: {
        width: 2,
        height: 8,
        backgroundColor: '#D1D1D1',
        borderRadius: 1,
    },
    intriguedBox: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    glow: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#5856D6',
    },
    iconCenterer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
