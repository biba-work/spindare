import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { PersonalityType, InterestType } from '../services/AIService';
import { AppButton } from '../components/atoms/AppButton';

const { width, height } = Dimensions.get('window');

const GoogleLogo = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24">
        <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
);

const AppleLogo = () => (
    <Svg width="22" height="22" viewBox="0 0 256 315" fill="#FFFFFF">
        <Path d="M213.803 167.03c.442 47.58 41.74 63.413 42.147 63.615-.35 1.03-6.599 22.568-21.714 44.603-13.047 18.991-26.59 37.903-47.796 38.317-20.81.442-27.56-12.227-51.385-12.227-23.81 0-31.282 11.856-51.01 12.603-20.083.744-35.618-20.78-48.74-39.818C7.105 248.382-11.072 181.651 10.237 144.581c10.584-18.441 29.585-30.121 50.198-30.418 15.617-.297 30.362 10.51 39.954 10.51 9.576 0 27.05-12.723 45.45-10.875 7.696.321 29.283 3.102 43.14 23.367-1.12.695-25.664 14.943-25.176 49.865zM174.197 80.178c18.784-22.716 16.591-43.12 15.424-52.756-16.14 1.258-35.154 11.238-46.726 24.646-10.379 11.97-19.462 32.748-17.073 52.01 18.068 1.402 34.62-7.536 48.375-23.9z" fill="#FFFFFF" />
    </Svg>
);

const PERSON_TYPES: PersonalityType[] = ["Adventurous", "Creative", "Calm", "Introverted", "Extroverted", "Risk-taker", "Thinker"];
const LIKES: InterestType[] = ["Nature", "Tech", "Art", "Sports", "Music", "Food", "Travel", "Coding"];

interface OnboardingProps {
    onComplete: (personality: PersonalityType[], interests: InterestType[]) => void;
}

export const OnboardingScreen = ({ onComplete }: OnboardingProps) => {
    const [view, setView] = useState<'welcome' | 'login' | 'signup' | 'personality'>('welcome');
    const [selectedTypes, setSelectedTypes] = useState<PersonalityType[]>([]);
    const [selectedLikes, setSelectedLikes] = useState<InterestType[]>([]);

    const toggleType = (type: PersonalityType) => {
        setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    const toggleLike = (like: InterestType) => {
        setSelectedLikes(prev => prev.includes(like) ? prev.filter(l => l !== like) : [...prev, like]);
    };

    const renderWelcome = () => (
        <SafeAreaView style={styles.centerWrapper}>
            <View style={styles.heroContent}>
                <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>S</Text>
                </View>
                <Text style={styles.title}>SPINDARE</Text>
                <Text style={styles.subtitle}>Curated challenges. Personalized for you.</Text>

                <View style={styles.btnStack}>
                    <AppButton onPress={() => setView('personality')}>
                        <GoogleLogo />
                        <Text style={styles.btnTextBlack}>Continue with Google</Text>
                    </AppButton>
                    <AppButton type="secondary" onPress={() => setView('personality')}>
                        <AppleLogo />
                        <Text style={styles.btnTextWhite}>Continue with Apple</Text>
                    </AppButton>
                </View>

                <View style={styles.accountLinks}>
                    <Text style={styles.accountText}>
                        Already have an account?{' '}
                        <Text style={styles.redLink} onPress={() => setView('login')}>Login</Text>
                    </Text>
                    <Text style={styles.accountText}>
                        or just{' '}
                        <Text style={styles.whiteLink} onPress={() => setView('signup')}>SIGN UP</Text>
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );

    const renderLoginForm = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            <SafeAreaView style={styles.container}>
                <AppButton type="icon" onPress={() => setView('welcome')} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </AppButton>
                <View style={styles.contentPadding}>
                    <Text style={styles.formTitle}>LOGIN</Text>
                    <View style={styles.inputStack}>
                        <TextInput placeholder="Email" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} autoCapitalize="none" />
                        <TextInput placeholder="Password" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} secureTextEntry />
                    </View>
                    <AppButton onPress={() => setView('personality')}>
                        <Text style={styles.btnTextBlack}>LOG IN</Text>
                    </AppButton>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    const renderSignupForm = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            <SafeAreaView style={styles.container}>
                <AppButton type="icon" onPress={() => setView('welcome')} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </AppButton>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
                    <Text style={styles.formTitle}>SIGN UP</Text>
                    <View style={styles.inputStack}>
                        <TextInput placeholder="Name" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} />
                        <TextInput placeholder="Surname" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} />
                        <TextInput placeholder="Email" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} autoCapitalize="none" />
                        <TextInput placeholder="Password" placeholderTextColor="rgba(255,255,255,0.3)" style={styles.input} secureTextEntry />
                    </View>
                    <AppButton onPress={() => setView('personality')}>
                        <Text style={styles.btnTextBlack}>CREATE ACCOUNT</Text>
                    </AppButton>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    const renderPersonality = () => (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
                <Text style={styles.formTitle}>CRAFT YOUR VIBE</Text>
                <Text style={styles.formSubtitle}>AI will optimize your spins based on your DNA.</Text>

                <Text style={styles.groupLabel}>CHARACTER</Text>
                <View style={styles.pillGrid}>
                    {PERSON_TYPES.map(type => (
                        <Pressable
                            key={type}
                            style={[styles.pill, selectedTypes.includes(type) && styles.pillActive]}
                            onPress={() => toggleType(type)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[styles.pillText, selectedTypes.includes(type) && styles.pillTextActive]}>{type}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.groupLabel}>INTERESTS</Text>
                <View style={styles.pillGrid}>
                    {LIKES.map(like => (
                        <Pressable
                            key={like}
                            style={[styles.pill, selectedLikes.includes(like) && styles.pillActive]}
                            onPress={() => toggleLike(like)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[styles.pillText, selectedLikes.includes(like) && styles.pillTextActive]}>{like}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={{ marginTop: 40, paddingBottom: 60 }}>
                    <AppButton
                        onPress={() => onComplete(selectedTypes, selectedLikes)}
                        style={!(selectedTypes.length > 0 && selectedLikes.length > 0) && styles.btnDisabled}
                    >
                        <Text style={styles.btnTextBlack}>ENTER SPINDARE</Text>
                    </AppButton>
                </View>
            </ScrollView>
        </SafeAreaView>
    );

    return (
        <View style={styles.flexContainer}>
            {view === 'welcome' && renderWelcome()}
            {view === 'login' && renderLoginForm()}
            {view === 'signup' && renderSignupForm()}
            {view === 'personality' && renderPersonality()}
        </View>
    );
};

const styles = StyleSheet.create({
    flexContainer: { flex: 1, backgroundColor: '#000' },
    flex: { flex: 1 },
    centerWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    container: { flex: 1 },
    contentPadding: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
    heroContent: { alignItems: 'center' },
    logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
    logoText: { fontSize: 40, fontWeight: '900', color: '#000' },
    title: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 8, textAlign: 'center', marginBottom: 12 },
    subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginBottom: 48, lineHeight: 20 },
    btnStack: { width: '100%', gap: 16 },
    btnTextBlack: { color: '#000', fontSize: 14, fontWeight: '900' },
    btnTextWhite: { color: '#FFF', fontSize: 14, fontWeight: '900' },
    btnDisabled: { opacity: 0.1 },
    accountLinks: { marginTop: 32, alignItems: 'center', gap: 8 },
    accountText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
    redLink: { color: '#FF3B30', fontWeight: '900' },
    whiteLink: { color: '#FFF', fontWeight: '900' },
    backButton: { marginLeft: 16, marginTop: 16 },
    backText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
    formTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', marginBottom: 12, letterSpacing: 2 },
    formSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 40 },
    inputStack: { gap: 16, marginBottom: 40 },
    input: { backgroundColor: '#0D0D0D', borderRadius: 16, padding: 18, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    groupLabel: { color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: '900', letterSpacing: 4, marginBottom: 16, marginTop: 16 },
    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0A0A0A' },
    pillActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
    pillText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
    pillTextActive: { color: '#000' },
});
