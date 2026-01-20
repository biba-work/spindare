import React from 'react';
import { View, Text, StyleSheet, Animated, Pressable, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { AppButton } from '../atoms/AppButton';
import Svg, { Path, Circle } from 'react-native-svg';

const { height } = Dimensions.get('window');

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <Circle cx="8.5" cy="7" r="4" />
        <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

interface OverlayProps {
    visible: boolean;
    type: 'saved' | 'notifications';
    onClose: () => void;
    data: string[];
    onAction: (item: string, action: 'send' | 'snap') => void;
    animation: Animated.Value;
}

export const GenericOverlay = ({ visible, type, onClose, data, onAction, animation }: OverlayProps) => {
    if (!visible) return null;

    return (
        <Animated.View style={[styles.overlay, { transform: [{ translateY: animation }] }]}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeText}>CLOSE</Text>
                    </Pressable>
                    <Text style={styles.title}>{type.toUpperCase()}</Text>
                    <View style={styles.placeholder} />
                </View>

                {type === 'saved' ? (
                    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                        {data.map((item, index) => (
                            <View key={index} style={styles.itemCard}>
                                <Text style={styles.itemText}>{item}</Text>
                                <View style={styles.actions}>
                                    <AppButton
                                        type="icon"
                                        onPress={() => onAction(item, 'send')}
                                        style={styles.miniBtn}
                                    >
                                        <SendIcon color="#FFF" />
                                    </AppButton>
                                    <AppButton
                                        type="icon"
                                        onPress={() => onAction(item, 'snap')}
                                        style={styles.miniBtn}
                                    >
                                        <CameraIcon color="#FFF" />
                                    </AppButton>
                                </View>
                            </View>
                        ))}
                        {data.length === 0 && (
                            <Text style={styles.emptyText}>No saved challenges yet.</Text>
                        )}
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No notifications here.</Text>
                    </View>
                )}
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 1000,
    },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    closeBtn: { width: 60 },
    closeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
    title: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    placeholder: { width: 60 },
    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    itemCard: {
        backgroundColor: '#0A0A0A',
        padding: 24,
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    itemText: { color: '#FFF', fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 16 },
    actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
    miniBtn: { width: 44, height: 44, borderRadius: 22 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' },
});
