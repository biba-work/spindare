import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Animated,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Image,
    ImageBackground,
    LayoutAnimation,
    UIManager,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { HobbyType, StudyFieldType } from '../services/AIService';
import { AppButton } from '../components/atoms/AppButton';
import { AuthService } from '../services/AuthService';
import { SpindareLogo } from '../components/atoms/SpindareLogo';

const { width, height } = Dimensions.get('window');

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

    // Auth State
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // User Traits
    const [selectedHobbies, setSelectedHobbies] = useState<HobbyType[]>([]);
    const [selectedFields, setSelectedFields] = useState<StudyFieldType[]>([]);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Subtle background breathing animation could go here
    }, []);

    const switchView = (newView: 'welcome' | 'login' | 'signup' | 'traits') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Fade out
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setView(newView);
            setError(null);
            // Fade in
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });
    };

    const toggleHobby = (hobby: HobbyType) => {
        Haptics.selectionAsync();
        setSelectedHobbies(prev => prev.includes(hobby) ? prev.filter(t => t !== hobby) : [...prev, hobby]);
    };

    const toggleField = (field: StudyFieldType) => {
        Haptics.selectionAsync();
        setSelectedFields(prev => prev.includes(field) ? prev.filter(l => l !== field) : [...prev, field]);
    };

    const handleSocialAuth = async (type: 'google' | 'apple') => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setError(null);
            setIsSubmitting(true);
            const profile = type === 'google' ? await AuthService.signInWithGoogle() : await AuthService.signInWithApple();

            if (profile.hobbies.length === 0 || profile.studyFields.length === 0) {
                // New user via social, needs onboarding
                setEmail(profile.email);
                setUsername(profile.username);
                setIsSubmitting(false);
                switchView('traits');
            } else {
                // Existing user
                await onComplete(profile.email, '', profile.username, profile.hobbies, profile.studyFields, false);
            }
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (isLogin: boolean) => {
        if (isSubmitting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (isLogin) {
            // Login flow
            setIsSubmitting(true);
            try {
                // We pass empty arrays for login, they will be fetched from profile
                await onComplete(email.trim(), password, '', [], [], false);
            } catch (err: any) {
                setError(err.message || 'Login failed');
                setIsSubmitting(false);
            }
        } else {
            // Signup flow -> Go to traits
            const trimmedEmail = email.trim().toLowerCase();
            const trimmedUsername = username.trim();

            // Log for debugging
            console.log('Signup Continue pressed with:', { email, trimmedEmail, username: trimmedUsername, password: password ? '[set]' : '[empty]' });

            if (!trimmedEmail) {
                setError('Please enter your email address');
                return;
            }

            // Basic email format check
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                setError('Please enter a valid email address (e.g., example@email.com)');
                return;
            }

            if (!password) {
                setError('Please enter a password');
                return;
            }

            if (password.length < 6) {
                setError('Password must be at least 6 characters');
                return;
            }

            if (!trimmedUsername) {
                setError('Please enter a username');
                return;
            }

            // Update the email state to the normalized version before switching
            setEmail(trimmedEmail);
            switchView('traits');
        }
    };

    // Email validation regex
    const isValidEmail = (emailToCheck: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailToCheck);
    };

    const handleFinalSignup = async () => {
        if (isSubmitting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedUsername = username.trim();

        // Log exact characters for debugging
        console.log('Email raw value:', JSON.stringify(email));
        console.log('Email trimmed:', JSON.stringify(trimmedEmail));
        console.log('Email char codes:', trimmedEmail.split('').map(c => c.charCodeAt(0)));

        // Validate email format before attempting signup
        if (!trimmedEmail) {
            setError('Please enter your email address');
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setError(`Invalid email format: "${trimmedEmail}"\nPlease enter a valid email address (e.g., example@email.com)`);
            return;
        }

        if (!password) {
            setError('Please enter a password');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setIsSubmitting(true);
        try {
            console.log('Attempting signup with validated email:', { email: trimmedEmail, username: trimmedUsername });
            await onComplete(trimmedEmail, password, trimmedUsername, selectedHobbies, selectedFields, true);
        } catch (err: any) {
            // Show the exact email we tried to use in the error
            setError(`${err.message}\nAttempted email: '${trimmedEmail}'`);
            setIsSubmitting(false);
            // If error is account related, might need to go back, but let's stay on traits for now so they don't lose selection
        }
    };

    // --- RENDER HELPERS ---

    const renderHeader = (title: string, subtitle?: string) => (
        <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
    );

    const renderInput = (
        placeholder: string,
        value: string,
        setValue: (t: string) => void,
        isSecure = false,
        autoCap = 'none' as const,
        keyboardType: any = 'default'
    ) => (
        <BlurView intensity={20} tint="light" style={styles.inputBlur}>
            <TextInput
                placeholder={placeholder}
                placeholderTextColor="rgba(0,0,0,0.4)"
                style={styles.input}
                value={value}
                onChangeText={setValue}
                secureTextEntry={isSecure}
                autoCapitalize={autoCap}
                keyboardType={keyboardType}
            />
        </BlurView>
    );

    const renderWelcome = () => (
        <View style={styles.fullScreenCenter}>
            <View style={styles.logoContainer}>
                <SpindareLogo size={60} />
            </View>

            <Text style={styles.brandTitle}>SPINDARE</Text>
            <Text style={styles.brandSubtitle}>Dare to be creative.</Text>

            <View style={styles.bottomSheet}>
                <Pressable
                    onPress={() => handleSocialAuth('google')}
                    style={({ pressed }) => [
                        styles.socialBtn,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                    ]}
                >
                    <Ionicons name="logo-google" size={20} color="#000" />
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                </Pressable>

                <Pressable
                    onPress={() => handleSocialAuth('apple')}
                    style={({ pressed }) => [
                        styles.socialBtnDark,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                    ]}
                >
                    <Ionicons name="logo-apple" size={20} color="#FFF" />
                    <Text style={[styles.socialBtnText, { color: '#FFF' }]}>Continue with Apple</Text>
                </Pressable>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                </View>

                <AppButton onPress={() => switchView('login')} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Log In</Text>
                </AppButton>

                <Pressable onPress={() => switchView('signup')} style={styles.loginLink}>
                    <Text style={styles.loginLinkText}>Don't have an account? <Text style={{ fontWeight: '700', color: '#000' }}>Create Account</Text></Text>
                </Pressable>
            </View>
        </View>
    );

    const renderLogin = () => (
        <View style={styles.formContainer}>
            <Pressable onPress={() => switchView('welcome')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#000" />
            </Pressable>

            {renderHeader("Welcome Back", "Sign in to continue your streak.")}

            <View style={styles.inputStack}>
                {renderInput("Email", email, setEmail, false, 'none', 'email-address')}
                {renderInput("Password", password, setPassword, true)}
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.footerActions}>
                <AppButton
                    onPress={() => handleSubmit(true)}
                    style={[styles.primaryBtn, { width: '100%' }]}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Log In</Text>}
                </AppButton>
            </View>
        </View>
    );

    const renderSignup = () => (
        <View style={styles.formContainer}>
            <Pressable onPress={() => switchView('welcome')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#000" />
            </Pressable>

            {renderHeader("Create Account", "Join the creative revolution.")}

            <View style={styles.inputStack}>
                {renderInput("Username", username, setUsername)}
                {renderInput("Email", email, setEmail, false, 'none', 'email-address')}
                {renderInput("Password", password, setPassword, true)}
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.footerActions}>
                <AppButton
                    onPress={() => handleSubmit(false)}
                    style={[styles.primaryBtn, { width: '100%' }]}
                    disabled={isSubmitting}
                >
                    <Text style={styles.primaryBtnText}>Continue</Text>
                </AppButton>
            </View>
        </View>
    );

    const renderTraits = () => (
        <View style={styles.formContainer}>
            <Pressable onPress={() => switchView('signup')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#000" />
            </Pressable>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {renderHeader("Personalize", "Select what interests you.")}

                <Text style={styles.sectionLabel}>HOBBIES</Text>
                <View style={styles.chipGrid}>
                    {HOBBIES.map(hobby => (
                        <Pressable
                            key={hobby}
                            style={[styles.chip, selectedHobbies.includes(hobby) && styles.chipActive]}
                            onPress={() => toggleHobby(hobby)}
                        >
                            <Text style={[styles.chipText, selectedHobbies.includes(hobby) && styles.chipTextActive]}>{hobby}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.sectionLabel}>FIELDS OF STUDY</Text>
                <View style={styles.chipGrid}>
                    {FIELDS.map(field => (
                        <Pressable
                            key={field}
                            style={[styles.chip, selectedFields.includes(field) && styles.chipActive]}
                            onPress={() => toggleField(field)}
                        >
                            <Text style={[styles.chipText, selectedFields.includes(field) && styles.chipTextActive]}>{field}</Text>
                        </Pressable>
                    ))}
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <AppButton
                    onPress={handleFinalSignup}
                    style={[styles.primaryBtn, { marginTop: 40 }]}
                    disabled={isSubmitting || selectedHobbies.length === 0}
                >
                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Finish Setup</Text>}
                </AppButton>
            </ScrollView>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ImageBackground
                source={require('../../assets/guest_1.jpg')} // Using one of the new assets as a bg
                style={styles.backgroundImage}
                blurRadius={Platform.OS === 'ios' ? 40 : 10} // Heavy blur for glassmorphism background
            >
                <LinearGradient
                    colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.9)']}
                    style={StyleSheet.absoluteFill}
                />

                <SafeAreaView style={styles.container}>
                    <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
                        {view === 'welcome' && renderWelcome()}
                        {view === 'login' && renderLogin()}
                        {view === 'signup' && renderSignup()}
                        {view === 'traits' && renderTraits()}
                    </Animated.View>
                </SafeAreaView>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        flex: 1,
    },
    fullScreenCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    logoContainer: {
        width: 100,
        height: 100,
        backgroundColor: '#FFF',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        marginBottom: 24,
        transform: [{ rotate: '-5deg' }]
    },
    logo: {
        width: 60,
        height: 60,
    },
    brandTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#1C1C1E',
        letterSpacing: 4,
        marginBottom: 8,
    },
    brandSubtitle: {
        fontSize: 16,
        color: '#4A4A4A',
        fontWeight: '500',
        marginBottom: 60,
    },
    bottomSheet: {
        width: '100%',
        gap: 16,
    },
    socialBtn: {
        backgroundColor: '#FFF',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        // gap removed
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    socialBtnDark: {
        backgroundColor: '#1C1C1E',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        // gap removed for compatibility
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    socialBtnText: {
        fontSize: 16,
        fontWeight: 'bold', // Changed from '600'
        color: '#1C1C1E',
        marginLeft: 12, // Added margin instead of gap
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 8,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    orText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(0,0,0,0.4)',
    },
    primaryBtn: {
        backgroundColor: '#1C1C1E',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    loginLink: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    loginLinkText: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.6)',
    },
    // Form Styles
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerContainer: {
        marginBottom: 32,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1C1C1E',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(0,0,0,0.5)',
    },
    inputStack: {
        gap: 16,
    },
    inputBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    input: {
        height: 56,
        paddingHorizontal: 20,
        fontSize: 16,
        color: '#1C1C1E',
    },
    footerActions: {
        marginTop: 40,
        gap: 16,
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginTop: 16,
        fontWeight: '500',
    },
    // Traits
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1C1C1E',
        letterSpacing: 2,
        marginBottom: 16,
        marginTop: 24,
        opacity: 0.6,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    chipActive: {
        backgroundColor: '#1C1C1E',
        borderColor: '#1C1C1E',
    },
    chipText: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.6)',
        fontWeight: '500',
    },
    chipTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
});
