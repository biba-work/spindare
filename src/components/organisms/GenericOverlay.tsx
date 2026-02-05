import React, { useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, ScrollView, SafeAreaView, Dimensions, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { AppButton } from '../atoms/AppButton';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { NotificationService, Notification } from '../../services/NotificationService';
import { SocialService } from '../../services/SocialService';
import { formatDistanceToNow } from 'date-fns';

const { width, height } = Dimensions.get('window');

const SendIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 2L11 13" />
        <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
);

const CameraIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <Circle cx="12" cy="13" r="4" />
    </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <Circle cx="8.5" cy="8.5" r="1.5" />
        <Path d="M21 15l-5-5L5 21" />
    </Svg>
);

const TextIcon = ({ color }: { color: string }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
);

const BellIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
);

const InboxIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
);

const MessageIcon = ({ color }: { color: string }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
);

interface OverlayProps {
    visible: boolean;
    type: 'saved' | 'notifications' | 'spind';
    onClose: () => void;
    data: string[] | Notification[];
    onAction: (item: string, action: 'send' | 'camera' | 'gallery' | 'text') => void;
    animation: Animated.Value;
    onOpenMessages?: () => void;
    onViewProfile?: (userId: string, username: string, avatar: string) => void;
}

const MOCK_CHALLENGES = {
    new: [
        { id: 'n1', from: 'Emma', challenge: 'Take a photo of the sky right now', time: '5m ago' },
        { id: 'n2', from: 'Noah', challenge: 'Write about your favorite childhood memory', time: '1h ago' },
    ],
    pending: [
        { id: 'p1', from: 'Noah', challenge: 'Write a poem about coffee', status: 'In progress', time: '2d ago' },
    ]
};

export const GenericOverlay = ({ visible, type, onClose, data, onAction, animation, onOpenMessages, onViewProfile }: OverlayProps) => {
    const { darkMode } = useTheme();
    const [subTab, setSubTab] = useState<'notifs' | 'inbox' | 'messages'>('notifs');
    const [activeProofId, setActiveProofId] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    React.useEffect(() => {
        if (visible && type === 'notifications') {
            const notifUnsub = NotificationService.subscribeToNotifications(setNotifications);
            const reqUnsub = SocialService.subscribeToRequests(setRequests);
            return () => {
                notifUnsub();
                reqUnsub();
            }
        }
    }, [visible, type]);

    if (!visible) return null;

    const handleTabSwitch = (tab: 'notifs' | 'inbox' | 'messages') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (tab === 'messages' && onOpenMessages) {
            onOpenMessages();
        } else {
            setSubTab(tab);
        }
    };

    const renderNotificationsPanel = () => {
        const challengeNotifs = notifications.filter(n => n.type === 'challenge');
        const generalNotifs = notifications.filter(n => n.type !== 'challenge');

        if (subTab === 'notifs') {
            return (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Connection Requests Section */}
                    {requests.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>FOLLOW REQUESTS</Text>
                            {/* ... existing request mapping code ... */}
                            {requests.map((req) => (
                                <View key={req.id} style={[styles.notifCard, darkMode && styles.notifCardDark, { flexDirection: 'column' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <Pressable
                                            onPress={() => { if (onViewProfile) onViewProfile(req.id, req.username, req.photoURL || ''); onClose(); }}
                                            style={styles.notifAvatarContainer}
                                        >
                                            <Image
                                                source={{ uri: req.photoURL || Image.resolveAssetSource(require('../../../assets/rashica_pfp.jpg')).uri }}
                                                style={styles.notifAvatar}
                                            />
                                        </Pressable>
                                        <Text style={[styles.notifText, darkMode && styles.notifTextDark, { flex: 1, marginBottom: 0 }]}>
                                            <Text
                                                onPress={() => { if (onViewProfile) onViewProfile(req.id, req.username, req.photoURL || ''); onClose(); }}
                                                style={[styles.notifUser, darkMode && styles.notifUserDark]}
                                            >
                                                @{req.username}
                                            </Text> wants to connect
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10, paddingLeft: 46 }}>
                                        <Pressable
                                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); SocialService.acceptConnectionRequest(req.id); }}
                                            style={[styles.acceptBtn, { flex: 1, height: 36, backgroundColor: '#4A4A4A' }]}
                                        >
                                            <Text style={styles.acceptBtnText}>CONFIRM</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); SocialService.declineConnectionRequest(req.id); }}
                                            style={[styles.acceptBtn, { flex: 1, height: 36, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#AEAEB2' }]}
                                        >
                                            <Text style={[styles.acceptBtnText, { color: darkMode ? '#AEAEB2' : '#8E8E93' }]}>DELETE</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {generalNotifs.map((notif) => (
                        <Pressable key={notif.id} style={[styles.notifCard, darkMode && styles.notifCardDark]}>
                            <Pressable
                                onPress={() => { if (onViewProfile && notif.fromUserId) onViewProfile(notif.fromUserId, notif.fromUsername, notif.fromAvatar || ''); onClose(); }}
                                style={styles.notifAvatarContainer}
                            >
                                <Image
                                    source={{ uri: notif.fromAvatar || Image.resolveAssetSource(require('../../../assets/rashica_pfp.jpg')).uri }}
                                    style={styles.notifAvatar}
                                />
                            </Pressable>
                            <View style={styles.notifContent}>
                                <Text style={[styles.notifText, darkMode && styles.notifTextDark]}>
                                    <Text
                                        onPress={() => { if (onViewProfile && notif.fromUserId) onViewProfile(notif.fromUserId, notif.fromUsername, notif.fromAvatar || ''); onClose(); }}
                                        style={[styles.notifUser, darkMode && styles.notifUserDark]}
                                    >@{notif.fromUsername}</Text> {notif.content}
                                </Text>
                                <Text style={styles.notifTime}>
                                    {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate ? notif.timestamp.toDate() : new Date(), { addSuffix: true }) : 'just now'}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                    {generalNotifs.length === 0 && requests.length === 0 && (
                        <View style={styles.emptyState}>
                            <BellIcon color={darkMode ? "#555" : "#D1D1D1"} />
                            <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No new notifications</Text>
                        </View>
                    )}
                </ScrollView>
            );
        }

        return (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>{challengeNotifs.length}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>CHALLENGES</Text>
                </View>

                {challengeNotifs.map(notif => (
                    <View key={notif.id} style={[styles.inboxCard, darkMode && styles.inboxCardDark]}>
                        <View style={styles.inboxHeader}>
                            <Text style={[styles.inboxFrom, darkMode && styles.inboxFromDark]}>
                                {notif.fromUsername === 'You' ? 'You sent a challenge' : `@${notif.fromUsername}`}
                            </Text>
                            <Text style={styles.inboxTime}>
                                {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate ? notif.timestamp.toDate() : new Date(), { addSuffix: true }) : 'just now'}
                            </Text>
                        </View>
                        <Text style={[styles.inboxChallenge, darkMode && styles.inboxChallengeDark]}>
                            "{notif.targetId || notif.content}"
                        </Text>

                        {/* Only show actions if it's NOT a sent message (i.e. if I received it) */}
                        {notif.fromUsername !== 'You' && (
                            activeProofId === notif.id ? (
                                <View style={styles.proofActions}>
                                    <Pressable onPress={() => onAction(notif.targetId || '', 'camera')} style={styles.proofBtn}>
                                        <CameraIcon color="#FAF9F6" />
                                    </Pressable>
                                    <Pressable onPress={() => onAction(notif.targetId || '', 'gallery')} style={styles.proofBtn}>
                                        <GalleryIcon color="#FAF9F6" />
                                    </Pressable>
                                    <Pressable onPress={() => onAction(notif.targetId || '', 'text')} style={styles.proofBtn}>
                                        <TextIcon color="#FAF9F6" />
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActiveProofId(notif.id); }} style={styles.acceptBtn}>
                                    <Text style={styles.acceptBtnText}>ACCEPT CHALLENGE</Text>
                                </Pressable>
                            )
                        )}
                    </View>
                ))}

                {challengeNotifs.length === 0 && (
                    <View style={styles.emptyState}>
                        <InboxIcon color={darkMode ? "#555" : "#D1D1D1"} />
                        <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No active challenges</Text>
                        <Text style={styles.emptySubtext}>Spin the wheel to send some!</Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <Animated.View style={[styles.overlay, { transform: [{ translateY: animation }] }]}>
            <View style={[styles.solidBackground, darkMode && styles.solidBackgroundDark]} />
            <BlurView intensity={20} tint={darkMode ? "dark" : "light"} style={StyleSheet.absoluteFill}>
                <SafeAreaView style={styles.container}>
                    <View style={[styles.header, darkMode && styles.headerDark]}>
                        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.closeText, darkMode && styles.closeTextDark]}>Close</Text>
                        </Pressable>
                        <Text style={[styles.title, darkMode && styles.titleDark]}>
                            {type === 'saved' ? 'KEPT' : type === 'spind' ? 'SPIND' : 'ACTIVITY'}
                        </Text>
                        <View style={styles.placeholder} />
                    </View>

                    {type === 'notifications' && (
                        <View style={styles.tabsContainer}>
                            <Pressable onPress={() => handleTabSwitch('notifs')} style={[styles.tab, darkMode && styles.tabDark, subTab === 'notifs' && (darkMode ? styles.activeTabDark : styles.activeTab)]}>
                                <BellIcon color={subTab === 'notifs' ? (darkMode ? "#FFF" : "#4A4A4A") : "#AEAEB2"} />
                                <Text style={[styles.tabLabel, darkMode && styles.tabLabelDark, subTab === 'notifs' && (darkMode ? styles.activeTabLabelDark : styles.activeTabLabel)]}>Notifications</Text>
                            </Pressable>
                            <Pressable onPress={() => handleTabSwitch('inbox')} style={[styles.tab, darkMode && styles.tabDark, subTab === 'inbox' && (darkMode ? styles.activeTabDark : styles.activeTab)]}>
                                <InboxIcon color={subTab === 'inbox' ? (darkMode ? "#FFF" : "#4A4A4A") : "#AEAEB2"} />
                                <Text style={[styles.tabLabel, darkMode && styles.tabLabelDark, subTab === 'inbox' && (darkMode ? styles.activeTabLabelDark : styles.activeTabLabel)]}>SPIND</Text>
                            </Pressable>
                            <Pressable onPress={() => handleTabSwitch('messages')} style={[styles.tab, darkMode && styles.tabDark, subTab === 'messages' && (darkMode ? styles.activeTabDark : styles.activeTab)]}>
                                <MessageIcon color={subTab === 'messages' ? (darkMode ? "#FFF" : "#4A4A4A") : "#AEAEB2"} />
                                <Text style={[styles.tabLabel, darkMode && styles.tabLabelDark, subTab === 'messages' && (darkMode ? styles.activeTabLabelDark : styles.activeTabLabel)]}>Messages</Text>
                            </Pressable>
                        </View>
                    )}

                    <View style={styles.mainContent}>
                        {(type === 'saved' || type === 'spind') ? (
                            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                                {(data as string[]).map((item, index) => (
                                    <View key={index} style={[styles.savedCard, darkMode && styles.savedCardDark]}>
                                        <Text style={[styles.savedText, darkMode && styles.savedTextDark]}>{item}</Text>
                                        <View style={styles.savedActions}>
                                            <Pressable onPress={() => onAction(item, 'send')} style={[styles.savedActionBtn, darkMode && styles.savedActionBtnDark]}>
                                                <SendIcon color="#FAF9F6" />
                                            </Pressable>
                                            <Pressable onPress={() => onAction(item, 'camera')} style={[styles.savedActionBtn, darkMode && styles.savedActionBtnDark]}>
                                                <CameraIcon color="#FAF9F6" />
                                            </Pressable>
                                            <Pressable onPress={() => onAction(item, 'gallery')} style={[styles.savedActionBtn, darkMode && styles.savedActionBtnDark]}>
                                                <GalleryIcon color="#FAF9F6" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                                {data.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Text style={[styles.emptyText, darkMode && styles.emptyTextDark]}>No saved challenges yet.</Text>
                                        <Text style={styles.emptySubtext}>Challenges you save will appear here</Text>
                                    </View>
                                )}
                            </ScrollView>
                        ) : renderNotificationsPanel()}
                    </View>
                </SafeAreaView>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5000,
    },
    solidBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FAF9F6',
    },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    closeBtn: { padding: 4 },
    closeText: { color: '#A7BBC7', fontSize: 14, fontWeight: '500' },
    title: { color: '#4A4A4A', fontSize: 11, fontWeight: '600', letterSpacing: 3 },
    placeholder: { width: 50 },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingTop: 20,
        gap: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    activeTab: {
        backgroundColor: '#FFF',
        borderColor: 'rgba(0,0,0,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#AEAEB2',
    },
    activeTabLabel: {
        color: '#4A4A4A',
        fontWeight: '600',
    },
    mainContent: { flex: 1, paddingTop: 20 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 18,
        marginBottom: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    notifDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#A7BBC7',
        marginRight: 14,
        marginTop: 6,
    },
    notifAvatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        backgroundColor: '#F0F0F0',
        overflow: 'hidden',
    },
    notifAvatar: {
        width: '100%',
        height: '100%',
    },
    notifContent: { flex: 1 },
    notifText: { color: '#4A4A4A', fontSize: 14, lineHeight: 20, marginBottom: 6 },
    notifUser: { fontWeight: '600', color: '#4A4A4A' },
    notifTime: { color: '#AEAEB2', fontSize: 11, fontWeight: '500' },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    sectionBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#A7BBC7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionBadgeText: {
        color: '#FAF9F6',
        fontSize: 11,
        fontWeight: '700',
    },
    sectionTitle: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2,
    },
    inboxCard: {
        padding: 20,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.65)',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
    },
    inboxHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    inboxFrom: {
        color: '#4A4A4A',
        fontSize: 13,
        fontWeight: '600',
    },
    inboxTime: {
        color: '#AEAEB2',
        fontSize: 11,
        fontWeight: '500',
    },
    inboxChallenge: {
        color: '#4A4A4A',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
        marginBottom: 16,
    },
    proofActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    proofBtn: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptBtn: {
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptBtnText: {
        color: '#FAF9F6',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#F0F0F0',
    },
    statusText: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: '600',
    },
    savedCard: {
        padding: 20,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.65)',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    savedText: {
        color: '#4A4A4A',
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 22,
        marginBottom: 16,
    },
    savedActions: {
        flexDirection: 'row',
        gap: 10,
    },
    savedActionBtn: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4A4A4A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyText: {
        color: '#AEAEB2',
        fontSize: 15,
        fontWeight: '500',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#D1D1D1',
        fontSize: 13,
        fontWeight: '400',
        marginTop: 6,
    },
    // Dark Mode Styles
    solidBackgroundDark: {
        backgroundColor: '#1C1C1E',
    },
    headerDark: {
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeTextDark: {
        color: '#FFF',
    },
    titleDark: {
        color: '#FFF',
    },
    tabDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    activeTabDark: {
        backgroundColor: '#2C2C2E',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabLabelDark: {
        color: '#8E8E93',
    },
    activeTabLabelDark: {
        color: '#FFF',
    },
    notifCardDark: {
        backgroundColor: 'rgba(44,44,46,0.8)',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    notifTextDark: {
        color: '#E5E5EA',
    },
    notifUserDark: {
        color: '#FFF',
    },
    inboxCardDark: {
        backgroundColor: 'rgba(44,44,46,0.6)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inboxFromDark: {
        color: '#FFF',
    },
    inboxChallengeDark: {
        color: '#E5E5EA',
    },
    savedCardDark: {
        backgroundColor: 'rgba(44,44,46,0.6)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    savedTextDark: {
        color: '#E5E5EA',
    },
    savedActionBtnDark: {
        backgroundColor: '#3A3A3C',
    },
    emptyTextDark: {
        color: '#8E8E93',
    },
});
