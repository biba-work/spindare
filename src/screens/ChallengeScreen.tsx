import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SpinWheel } from '../components/molecules/SpinWheel';
import { ReactionButton } from '../components/atoms/ReactionButton';

const { width, height } = Dimensions.get('window');

const CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favorite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
];

export const ChallengeScreen = () => {
    const [challenge, setChallenge] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (challenge) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(20);
        }
    }, [challenge]);

    const handleSpinEnd = () => {
        const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        setChallenge(randomChallenge);
        setReaction(null);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.mainContainer}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerText}>Spindare</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtext}>Daily Reflection</Text>
                </View>

                {/* Central Content */}
                <View style={styles.centerSection}>
                    {!challenge ? (
                        <View style={styles.wheelWrapper}>
                            <SpinWheel onSpinEnd={handleSpinEnd} />
                            <View style={styles.instructionContainer}>
                                <Text style={styles.instructionText}>Spin the wheel</Text>
                                <Text style={styles.instructionSubtext}>to receive your daily challenge</Text>
                            </View>
                        </View>
                    ) : (
                        <Animated.View
                            style={[
                                styles.challengeContainer,
                                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                            ]}
                        >
                            <BlurView intensity={30} tint="dark" style={styles.blurCard}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardLine} />
                                </View>

                                <Text style={styles.challengeText}>
                                    {challenge}
                                </Text>

                                <View style={styles.reactionsRow}>
                                    <View style={styles.reactionItem}>
                                        <ReactionButton
                                            type="felt"
                                            label="Felt"
                                            selected={reaction === 'felt'}
                                            onPress={() => setReaction('felt')}
                                        />
                                    </View>
                                    <View style={styles.reactionItem}>
                                        <ReactionButton
                                            type="thought"
                                            label="Thought"
                                            selected={reaction === 'thought'}
                                            onPress={() => setReaction('thought')}
                                        />
                                    </View>
                                    <View style={styles.reactionItem}>
                                        <ReactionButton
                                            type="intrigued"
                                            label="Intrigued"
                                            selected={reaction === 'intrigued'}
                                            onPress={() => setReaction('intrigued')}
                                        />
                                    </View>
                                </View>
                            </BlurView>

                            <Pressable
                                onPress={() => setChallenge(null)}
                                style={({ pressed }) => [
                                    styles.resetButton,
                                    { opacity: pressed ? 0.5 : 1 }
                                ]}
                            >
                                <Text style={styles.resetText}>New Challenge</Text>
                            </Pressable>
                        </Animated.View>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Moment of silence • {new Date().toLocaleDateString()}</Text>
                </View>

            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0c0c0e', // Very dark gray/black
    },
    mainContainer: {
        flex: 1,
        paddingHorizontal: 24, // Reduced from 32 for better 14 Pro fit
        justifyContent: 'space-between',
        paddingVertical: height * 0.05,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 4,
        fontFamily: 'Inter_400Regular',
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 12,
    },
    headerSubtext: {
        color: '#FFFFFF',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
        opacity: 0.4,
    },
    centerSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    wheelWrapper: {
        alignItems: 'center',
    },
    instructionContainer: {
        marginTop: 60,
        alignItems: 'center',
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 3,
        fontFamily: 'Inter_400Regular',
        marginBottom: 8,
    },
    instructionSubtext: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    challengeContainer: {
        width: '100%',
        alignItems: 'center',
    },
    blurCard: {
        padding: 24, // Reduced from 40 for better fit on 14 Pro
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        width: '100%',
        overflow: 'hidden',
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    cardLine: {
        width: 40,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    challengeText: {
        color: '#FFFFFF',
        fontSize: 26, // Reduced from 30
        fontFamily: 'Montserrat_400Regular',
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 40,
        minHeight: 120,
        textAlignVertical: 'center',
    },
    reactionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Changed to between for better distribution
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        paddingTop: 20,
        width: '100%',
    },
    reactionItem: {
        flex: 1,
        alignItems: 'center',
    },
    resetButton: {
        marginTop: 40,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    resetText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontFamily: 'Inter_400Regular',
    },
});
