import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HobbyType, StudyFieldType } from '../services/AIService';
import { AppButton } from '../components/atoms/AppButton';

const { width, height } = Dimensions.get('window');

const HOBBIES: HobbyType[] = ["Reading", "Gaming", "Fitness", "Cooking", "Art", "Photography", "Hiking", "Music"];
const FIELDS: StudyFieldType[] = ["Computer Science", "Business", "Engineering", "Medicine", "Arts", "Law", "Physics", "Design"];

interface OnboardingProps {
    onComplete: (hobbies: HobbyType[], studyFields: StudyFieldType[]) => void;
}

export const OnboardingScreen = ({ onComplete }: OnboardingProps) => {
    const [view, setView] = useState<'welcome' | 'login' | 'signup' | 'traits'>('welcome');
    const [selectedHobbies, setSelectedHobbies] = useState<HobbyType[]>([]);
    const [selectedFields, setSelectedFields] = useState<StudyFieldType[]>([]);

    // Auth State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const toggleHobby = (hobby: HobbyType) => {
        setSelectedHobbies(prev => prev.includes(hobby) ? prev.filter(t => t !== hobby) : [...prev, hobby]);
    };

    const toggleField = (field: StudyFieldType) => {
        setSelectedFields(prev => prev.includes(field) ? prev.filter(l => l !== field) : [...prev, field]);
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
                    <AppButton onPress={() => setView('signup')}>
                        <Text style={styles.btnTextBlack}>CREATE ACCOUNT</Text>
                    </AppButton>
                    <AppButton type="secondary" onPress={() => setView('login')}>
                        <Text style={styles.btnTextWhite}>LOG IN</Text>
                    </AppButton>
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
                    <Text style={styles.formTitle}>LOG IN</Text>
                    <View style={styles.inputStack}>
                        <TextInput
                            placeholder="Username"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            style={styles.input}
                            autoCapitalize="none"
                            value={username}
                            onChangeText={setUsername}
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>
                    <AppButton onPress={() => setView('traits')} style={(!username || !password) && styles.btnDisabled}>
                        <Text style={styles.btnTextBlack}>CONTINUE</Text>
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
                <View style={styles.contentPadding}>
                    <Text style={styles.formTitle}>SIGN UP</Text>
                    <View style={styles.inputStack}>
                        <TextInput
                            placeholder="Username"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            style={styles.input}
                            autoCapitalize="none"
                            value={username}
                            onChangeText={setUsername}
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>
                    <AppButton onPress={() => setView('traits')} style={(!username || !password) && styles.btnDisabled}>
                        <Text style={styles.btnTextBlack}>CREATE ACCOUNT</Text>
                    </AppButton>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    const renderTraits = () => (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
                <Text style={styles.formTitle}>YOUR DNA</Text>
                <Text style={styles.formSubtitle}>AI will optimize your spins based on your background.</Text>

                <Text style={styles.groupLabel}>HOBBIES</Text>
                <View style={styles.pillGrid}>
                    {HOBBIES.map(hobby => (
                        <Pressable
                            key={hobby}
                            style={[styles.pill, selectedHobbies.includes(hobby) && styles.pillActive]}
                            onPress={() => toggleHobby(hobby)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[styles.pillText, selectedHobbies.includes(hobby) && styles.pillTextActive]}>{hobby}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.groupLabel}>STUDY FIELDS</Text>
                <View style={styles.pillGrid}>
                    {FIELDS.map(field => (
                        <Pressable
                            key={field}
                            style={[styles.pill, selectedFields.includes(field) && styles.pillActive]}
                            onPress={() => toggleField(field)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[styles.pillText, selectedFields.includes(field) && styles.pillTextActive]}>{field}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={{ marginTop: 40, paddingBottom: 60 }}>
                    <AppButton
                        onPress={() => onComplete(selectedHobbies, selectedFields)}
                        style={!(selectedHobbies.length > 0 && selectedFields.length > 0) && styles.btnDisabled}
                    >
                        <Text style={styles.btnTextBlack}>START SPINNING</Text>
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
