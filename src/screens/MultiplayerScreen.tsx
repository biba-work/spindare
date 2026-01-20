import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

export const MultiplayerScreen = ({ onClose }: { onClose: () => void }) => {
    const [mode, setMode] = useState<'main' | 'host' | 'join'>('main');
    const [tab, setTab] = useState<'code' | 'qr'>('code');
    const [rounds, setRounds] = useState(5);
    const [code, setCode] = useState('');

    const renderMain = () => (
        <View style={styles.menu}>
            <Text style={styles.title}>PLAY WITH OTHERS</Text>
            <View style={styles.options}>
                <Pressable style={styles.optionBtn} onPress={() => setMode('host')}>
                    <Text style={styles.optionTitle}>BE HOST</Text>
                    <Text style={styles.optionSub}>Start a new server</Text>
                </Pressable>
                <Pressable style={styles.optionBtn} onPress={() => setMode('join')}>
                    <Text style={styles.optionTitle}>JOIN SERVER</Text>
                    <Text style={styles.optionSub}>Enter a 6-digit code</Text>
                </Pressable>
            </View>
        </View>
    );

    const renderHost = () => (
        <View style={styles.menu}>
            <Text style={styles.title}>SERVER CREATED</Text>
            <View style={styles.tabs}>
                <Pressable onPress={() => setTab('code')} style={[styles.tab, tab === 'code' && styles.tabActive]}>
                    <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>CODE</Text>
                </Pressable>
                <Pressable onPress={() => setTab('qr')} style={[styles.tab, tab === 'qr' && styles.tabActive]}>
                    <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>QR CODE</Text>
                </Pressable>
            </View>

            {tab === 'code' ? (
                <View style={styles.codeContainer}>
                    <Text style={styles.codeLabel}>INVITE CODE</Text>
                    <Text style={styles.bigCode}>734 621</Text>
                </View>
            ) : (
                <View style={styles.qrContainer}>
                    <Svg width="200" height="200" viewBox="0 0 100 100">
                        <Rect width="100" height="100" fill="white" />
                        <Rect x="10" y="10" width="30" height="30" fill="black" />
                        <Rect x="60" y="10" width="30" height="30" fill="black" />
                        <Rect x="10" y="60" width="30" height="30" fill="black" />
                        <Rect x="60" y="60" width="20" height="20" fill="black" />
                    </Svg>
                </View>
            )}

            <View style={styles.setup}>
                <Text style={styles.label}>CHOOSE ROUNDS</Text>
                <View style={styles.roundsRow}>
                    {[5, 10, 15, 20].map(r => (
                        <Pressable
                            key={r}
                            style={[styles.roundBtn, rounds === r && styles.roundBtnActive]}
                            onPress={() => setRounds(r)}
                        >
                            <Text style={[styles.roundText, rounds === r && styles.roundTextActive]}>{r}</Text>
                        </Pressable>
                    ))}
                </View>
                <Pressable style={styles.startBtn}>
                    <Text style={styles.startText}>START SESSION</Text>
                </Pressable>
            </View>
        </View>
    );

    const renderJoin = () => (
        <View style={styles.menu}>
            <Text style={styles.title}>JOIN SERVER</Text>
            <View style={styles.tabs}>
                <Pressable onPress={() => setTab('code')} style={[styles.tab, tab === 'code' && styles.tabActive]}>
                    <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>ENTER CODE</Text>
                </Pressable>
                <Pressable onPress={() => setTab('qr')} style={[styles.tab, tab === 'qr' && styles.tabActive]}>
                    <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>SCAN QR</Text>
                </Pressable>
            </View>

            {tab === 'code' ? (
                <View style={styles.inputContainer}>
                    <TextInput
                        placeholder="000 000"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        style={styles.joinInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={code}
                        onChangeText={setCode}
                    />
                    <Pressable style={[styles.startBtn, code.length === 6 && styles.startBtnActive]}>
                        <Text style={styles.startText}>JOIN NOW</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.qrScannerPlaceholder}>
                    <Text style={styles.scannerText}>Camera Feed Placeholder...</Text>
                </View>
            )}
        </View>
    );

    return (
        <Animated.View style={styles.overlay}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    {mode !== 'main' && (
                        <Pressable onPress={() => setMode('main')}>
                            <Text style={styles.backText}>BACK</Text>
                        </Pressable>
                    )}
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={onClose}>
                        <Text style={styles.closeText}>CLOSE</Text>
                    </Pressable>
                </View>

                {mode === 'main' && renderMain()}
                {mode === 'host' && renderHost()}
                {mode === 'join' && renderJoin()}
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0c0c0e',
        zIndex: 500,
    },
    safe: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        padding: 20,
        height: 60,
    },
    backText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '700',
    },
    closeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
    },
    menu: {
        flex: 1,
        paddingHorizontal: 30,
        paddingTop: 40,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 4,
        textAlign: 'center',
        marginBottom: 60,
    },
    options: {
        gap: 20,
    },
    optionBtn: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 30,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    optionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 4,
    },
    optionSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 40,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: '#FFFFFF',
    },
    tabText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    tabTextActive: {
        color: '#000000',
    },
    codeContainer: {
        alignItems: 'center',
        marginVertical: 40,
    },
    codeLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 15,
    },
    bigCode: {
        color: '#FFFFFF',
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 10,
    },
    qrContainer: {
        alignItems: 'center',
        marginVertical: 40,
    },
    setup: {
        marginTop: 40,
    },
    label: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 15,
    },
    roundsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    roundBtn: {
        flex: 1,
        paddingVertical: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        alignItems: 'center',
    },
    roundBtnActive: {
        backgroundColor: '#FFFFFF',
    },
    roundText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '700',
    },
    roundTextActive: {
        color: '#000000',
    },
    startBtn: {
        width: '100%',
        marginTop: 40,
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    startBtnActive: {
        backgroundColor: '#FFFFFF',
    },
    startText: {
        color: '#000000',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    inputContainer: {
        alignItems: 'center',
    },
    joinInput: {
        width: '100%',
        color: '#FFFFFF',
        fontSize: 32,
        textAlign: 'center',
        fontWeight: '900',
        letterSpacing: 5,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 40,
    },
    qrScannerPlaceholder: {
        width: '100%',
        height: 250,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    }
});
