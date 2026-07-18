import { api } from './ApiService';
import { Platform } from 'react-native';

// expo-notifications remote push is NOT supported in Expo Go SDK 53+.
// We load it lazily inside a try/catch so a bad import never crashes the app.
// In Expo Go this whole block is a no-op; it activates automatically in dev/prod builds.
let _notif: typeof import('expo-notifications') | null = null;
let _device: typeof import('expo-device') | null = null;

try {
    _notif = require('expo-notifications');
    _device = require('expo-device');

    _notif?.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch {
    // Running in Expo Go SDK 53+ — push notifications unavailable, silently skip
}

export type NotificationType = 'reaction' | 'follow' | 'challenge' | 'comment';

export interface Notification {
    id: string;
    type: NotificationType;
    fromUserId: string;
    fromUsername: string;
    fromAvatar: string | null;
    content: string;
    targetId: string | null;
    read: boolean;
    timestamp: string;
}

const mapNotification = (n: any): Notification => ({
    id: n.id,
    type: n.type,
    fromUserId: n.fromUserId,
    fromUsername: n.fromUser?.username || 'User',
    fromAvatar: n.fromUser?.photoURL || null,
    content: n.content,
    targetId: n.targetId,
    read: n.read,
    timestamp: n.createdAt,
});

const POLL_INTERVAL_MS = 15000;

export const NotificationService = {

    // Call this once on app start for the logged-in user.
    // Silently no-ops in Expo Go — works in dev/prod builds.
    async registerPushToken(userId: string) {
        if (!_notif || !_device) return;
        if (!_device.isDevice) return;

        try {
            const { status: existingStatus } = await _notif.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await _notif.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Push notification permission denied');
                return;
            }

            if (Platform.OS === 'android') {
                await _notif.setNotificationChannelAsync('default', {
                    name: 'Spindare',
                    importance: _notif.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#A7BBC7',
                });
            }

            const token = (await _notif.getExpoPushTokenAsync()).data;
            await api.patch('/profiles/push-token', { pushToken: token });

            console.log('Push token registered:', token);
        } catch (error) {
            console.error('Error registering push token:', error);
        }
    },

    // Notification creation (in-app row + push send) now happens server-side
    // — see server/src/notifications/notifications.service.ts, called
    // automatically by PostsService (reactions/comments) and SocialService
    // (follow/connection events). This stub only exists so any stray import
    // elsewhere doesn't crash; it's a no-op by design.
    async sendNotification(..._args: unknown[]) {
        console.warn('NotificationService.sendNotification is now handled server-side; this call is a no-op.');
    },

    // Poll the current user's notifications (was Supabase Realtime).
    subscribeToNotifications(userId: string, callback: (notifs: Notification[]) => void) {
        if (typeof userId !== 'string' || userId.length === 0 || typeof callback !== 'function') return () => { };

        let cancelled = false;
        const fetchNotifs = async () => {
            try {
                const data = await api.get<any[]>('/notifications');
                if (!cancelled) callback(data.map(mapNotification));
            } catch (e) {
                console.warn('Notifications poll failed:', e);
            }
        };

        fetchNotifs();
        const interval = setInterval(fetchNotifs, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    },

    async markAsRead(userId: string, notifId: string) {
        try {
            await api.patch(`/notifications/${notifId}/read`);
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    },

    async markAllAsRead(userId: string) {
        try {
            await api.patch('/notifications/read-all');
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }
};
