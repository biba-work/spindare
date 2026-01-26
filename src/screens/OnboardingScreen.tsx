import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HobbyType, StudyFieldType } from '../services/AIService';
import { AppButton } from '../components/atoms/AppButton';
import { AuthService } from '../services/AuthService';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const HOBBIES: HobbyType[] = ["Reading", "Gaming", "Fitness", "Cooking", "Art", "Photography", "Hiking", "Music"];
const FIELDS: StudyFieldType[] = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Physics", "Design"];

interface OnboardingProps {
    onComplete: (
        email: string,
        pass: string,
        username: string,
        hobbies: HobbyType[],
        studyFields: StudyFieldType[],
        isSignup: boolean
    ) => Promise<void>;
}

export const OnboardingScreen = ({ onComplete }: OnboardingProps) => {
    const [view, setView] = useState<'welcome' | 'login' | 'signup' | 'traits'>('welcome');
    const [selectedHobbies, setSelectedHobbies] = useState<HobbyType[]>([]);
    const [selectedFields, setSelectedFields] = useState<StudyFieldType[]>([]);

    // Auth State
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleHobby = (hobby: HobbyType) => {
        setSelectedHobbies(prev => prev.includes(hobby) ? prev.filter(t => t !== hobby) : [...prev, hobby]);
    };

    const toggleField = (field: StudyFieldType) => {
        setSelectedFields(prev => prev.includes(field) ? prev.filter(l => l !== field) : [...prev, field]);
    };

    const handleSocialAuth = async (type: 'google' | 'apple') => {
        try {
            setError(null);
            const profile = type === 'google' ? await AuthService.signInWithGoogle() : await AuthService.signInWithApple();
            if (profile.hobbies.length === 0 || profile.studyFields.length === 0) {
                setEmail(profile.email);
                setUsername(profile.username);
                setView('traits');
            } else {
                await onComplete(profile.email, '', profile.username, profile.hobbies, profile.studyFields, false);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const renderWelcome = () => (
        <SafeAreaView style={styles.centerWrapper}>
            <View style={styles.heroContent}>
                <View style={styles.logoCircle}>
                    <Image source={require('../../assets/logo.png')} style={styles.mainLogoImage} resizeMode="contain" />
                </View>
                <Text style={styles.title}>SPINDARE</Text>
                <Text style={styles.subtitle}>Curated challenges.{"\n"}Personalized for you.</Text>

                <View style={styles.btnStack}>
                    <AppButton onPress={() => handleSocialAuth('google')} style={styles.googleBtn}>
                        <Ionicons name="logo-google" size={18} color="#4A4A4A" />
                        <Text style={styles.btnTextBlack}>Continue with Google</Text>
                    </AppButton>

                    <AppButton onPress={() => handleSocialAuth('apple')} style={styles.appleBtn}>
                        <Ionicons name="logo-apple" size={18} color="#FAF9F6" />
                        <Text style={styles.btnTextWhite}>Continue with Apple</Text>
                    </AppButton>
                </View>

                <View style={styles.altAuthLinks}>
                    <Pressable onPress={() => setView('login')}>
                        <Text style={styles.altAuthText}>Already have an account? <Text style={styles.altAuthTextHighlight}>Login</Text></Text>
                    </Pressable>
                    <View style={styles.altAuthOrContainer}>
                        <View style={styles.altAuthLine} />
                        <Text style={styles.altAuthOr}>or</Text>
                        <View style={styles.altAuthLine} />
                    </View>
                    <Pressable onPress={() => setView('signup')}>
                        <Text style={styles.altAuthText}>New here? <Text style={styles.altAuthTextHighlight}>Join Spindare</Text></Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );

    const renderLoginForm = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            <SafeAreaView style={styles.container}>
                <Pressable onPress={() => setView('welcome')} style={styles.backButton}>
                    <Text style={styles.backText}>← back</Text>
                </Pressable>
                <View style={styles.contentPadding}>
                    <Text style={styles.formTitle}>LOGIN</Text>
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    <View style={styles.inputStack}>
                        <TextInput
                            placeholder="Email Address"
                            placeholderTextColor="#C5C5C5"
                            style={styles.input}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setError(null); }}
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#C5C5C5"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(null); }}
                        />
                    </View>
                    <AppButton
                        onPress={() => setView('traits')}
                        style={[styles.mainActionBtn, (!email || !password) && styles.btnDisabled]}
                        disabled={!email || !password}
                    >
                        <Text style={styles.btnTextWhite}>CONTINUE</Text>
                    </AppButton>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    const renderSignupForm = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            <SafeAreaView style={styles.container}>
                <Pressable onPress={() => setView('welcome')} style={styles.backButton}>
                    <Text style={styles.backText}>← back</Text>
                </Pressable>
                <View style={styles.contentPadding}>
                    <Text style={styles.formTitle}>JOIN</Text>
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    <View style={styles.inputStack}>
                        <TextInput
                            placeholder="Email"
                            placeholderTextColor="#C5C5C5"
                            style={styles.input}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={(t) => { setEmail(t); setError(null); }}
                        />
                        <TextInput
                            placeholder="Username"
                            placeholderTextColor="#C5C5C5"
                            style={styles.input}
                            autoCapitalize="none"
                            value={username}
                            onChangeText={(t) => { setUsername(t); setError(null); }}
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#C5C5C5"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={(t) => { setPassword(t); setError(null); }}
                        />
                    </View>
                    <AppButton
                        onPress={() => setView('traits')}
                        style={[styles.mainActionBtn, (!email || !username || !password) && styles.btnDisabled]}
                        disabled={!email || !username || !password}
                    >
                        <Text style={styles.btnTextWhite}>NEXT STEP</Text>
                    </AppButton>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    const renderTraits = () => (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
                <Text style={styles.formTitle}>PROFILE</Text>
                <Text style={styles.subtitle}>Select your DNA to personalize challenges.</Text>

                <Text style={styles.groupLabel}>HOBBIES</Text>
                <View style={styles.pillGrid}>
                    {HOBBIES.map(hobby => (
                        <Pressable
                            key={hobby}
                            style={[styles.pill, selectedHobbies.includes(hobby) && styles.pillActive]}
                            onPress={() => toggleHobby(hobby)}
                        >
                            <Text style={[styles.pillText, selectedHobbies.includes(hobby) && styles.pillTextActive]}>{hobby}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.groupLabel}>FIELDS</Text>
                <View style={styles.pillGrid}>
                    {FIELDS.map(field => (
                        <Pressable
                            key={field}
                            style={[styles.pill, selectedFields.includes(field) && styles.pillActive]}
                            onPress={() => toggleField(field)}
                        >
                            <Text style={[styles.pillText, selectedFields.includes(field) && styles.pillTextActive]}>{field}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={{ marginTop: 60, paddingBottom: 60 }}>
                    <AppButton
                        onPress={async () => {
                            try {
                                setIsSubmitting(true);
                                setError(null);
                                await onComplete(email, password, username, selectedHobbies, selectedFields, view === 'signup');
                            } catch (err: any) {
                                setError(err.message);
                                setView(view === 'signup' ? 'signup' : 'login');
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        style={[styles.mainActionBtn, (!(selectedHobbies.length > 0 && selectedFields.length > 0) || isSubmitting) && styles.btnDisabled]}
                        disabled={!(selectedHobbies.length > 0 && selectedFields.length > 0) || isSubmitting}
                    >
                        <Text style={styles.btnTextWhite}>{isSubmitting ? '...' : 'ENTER SPINDARE'}</Text>
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
            {view === 'traits' && renderTraits()}
        </View>
    );
};

const styles = StyleSheet.create({
    flexContainer: { flex: 1, backgroundColor: '#FAF9F6' },
    flex: { flex: 1 },
    centerWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 40 },
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    contentPadding: { paddingHorizontal: 32, paddingTop: 48, paddingBottom: 40 },
    heroContent: { alignItems: 'center' },
    logoCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    mainLogoImage: { width: 40, height: 40 },
    title: { color: '#4A4A4A', fontSize: 24, fontWeight: '500', letterSpacing: 8, textAlign: 'center', marginBottom: 12 },
    subtitle: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginBottom: 48, lineHeight: 22, fontWeight: '400' },
    btnStack: { width: '100%', gap: 12 },
    googleBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)', height: 50, borderRadius: 25, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center' },
    appleBtn: { backgroundColor: '#4A4A4A', height: 50, borderRadius: 25, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center' },
    btnTextBlack: { color: '#4A4A4A', fontSize: 13, fontWeight: '500' },
    btnTextWhite: { color: '#FAF9F6', fontSize: 13, fontWeight: '500' },
    btnDisabled: { opacity: 0.2 },
    altAuthLinks: { marginTop: 40, alignItems: 'center', width: '100%' },
    altAuthOrContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
    altAuthLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.03)' },
    altAuthOr: { color: '#C5C5C5', fontSize: 11, paddingHorizontal: 12, fontWeight: '400' },
    altAuthText: { color: '#8E8E93', fontSize: 13, fontWeight: '400' },
    altAuthTextHighlight: { color: '#A7BBC7', fontWeight: '500' },
    backButton: { padding: 20, paddingTop: 10 },
    backText: { color: '#8E8E93', fontSize: 14, fontWeight: '400' },
    formTitle: { color: '#4A4A4A', fontSize: 22, fontWeight: '500', marginBottom: 8, letterSpacing: 2 },
    inputStack: { gap: 12, marginBottom: 32, marginTop: 24 },
    input: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, color: '#4A4A4A', fontSize: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    mainActionBtn: { backgroundColor: '#4A4A4A', height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
    groupLabel: { color: '#4A4A4A', fontSize: 10, fontWeight: '500', letterSpacing: 2, marginBottom: 16, marginTop: 32 },
    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)', backgroundColor: '#FFF' },
    pillActive: { backgroundColor: '#FAF9F6', borderColor: '#A7BBC7' },
    pillText: { color: '#AEAEB2', fontSize: 13, fontWeight: '400' },
    pillTextActive: { color: '#4A4A4A', fontWeight: '500' },
    errorText: { color: '#FF3B30', fontSize: 12, fontWeight: '400', marginBottom: 16, textAlign: 'center' },
});
