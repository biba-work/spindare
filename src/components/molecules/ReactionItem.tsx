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
            Animated.loop(
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 3000,
                    easing: Easing.linear,
                    useNativeDriver: false
                })
            ).start();
        } else {
            anim.setValue(0);
        }
    }, [active]);

    return (
        <View style={styles.iconCenterer}>
            <Svg width="24" height="24" viewBox="0 0 24 24">
                {[0, 1].map((i) => {
                    const radius = anim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [2, 6, 2]
                    });
                    const rotate = anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [i === 0 ? '0deg' : '180deg', i === 0 ? '360deg' : '540deg']
                    });

                    return (
                        <G key={i} transform="translate(12, 12)">
                            <Animated.View style={{ transform: [{ rotate }] }}>
                                <AnimatedCircle
                                    cx={0}
                                    cy={radius}
                                    r="2.5"
                                    fill="#FF3B30"
                                    opacity={active ? 1 : 0.5}
                                />
                            </Animated.View>
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};

const ThoughtIcon = ({ active }: { active: boolean }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (active) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true })
                ])
            ).start();
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
                                opacity: active ? 1 : 0.4,
                                backgroundColor: active ? '#FFD60A' : 'rgba(255,255,255,0.4)',
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
            Animated.loop(
                Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
            ).start();
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
                    {active && <Circle cx="12" cy="12" r="1" fill="#FFF" />}
                </Svg>
            </Animated.View>
        </View>
    );
};

export const ReactionItem = ({ type, count, active, onSelect }: { type: 'felt' | 'thought' | 'intrigued', count: number, active: boolean, onSelect: () => void }) => {
    const scale = useRef(new Animated.Value(1)).current;

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
        <Pressable onPress={handlePress} style={styles.reactionBtn}>
            <Animated.View style={[styles.iconBox, active && styles.iconBoxActive, { transform: [{ scale }] }]}>
                {renderIcon()}
            </Animated.View>
            <View style={styles.infoBox}>
                <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                <Text style={[styles.label, active && styles.labelActive]}>{type.toUpperCase()}</Text>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    reactionBtn: {
        alignItems: 'center',
        marginVertical: 10,
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    iconBoxActive: {
        borderColor: 'rgba(255,255,255,0.4)',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    infoBox: {
        alignItems: 'center',
        marginTop: 4,
    },
    countText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '800',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    countTextActive: {
        color: '#FFF',
    },
    label: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 1,
    },
    labelActive: {
        color: '#FFF',
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
        width: 2.5,
        height: 8,
        backgroundColor: '#FFD60A',
        borderRadius: 1.5,
    },
    intriguedBox: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    glow: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#5856D6',
    },
    iconCenterer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
