import { supabase } from './supabaseConfig';
import { Platform } from 'react-native';

// expo-notifications remote push is NOT supported in Expo Go SDK 53+.
// We load it lazily inside a try/catch so a bad import never crashes the app.
// In Expo Go this whole block is a no-op; it activates automatically in dev/prod builds.
let _notif: typeof import('expo-notifications') | null = null;
let _device: typeof import('expo-device') | null = null;

try {
    _notif = require('expo-notifications');
    _device = require('expo-device');

    // Only configure the foreground handler when the module loaded successfully
    _notif?.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
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

            await supabase
                .from('profiles')
                .update({ pushToken: token })
                .eq('id', userId);

            console.log('Push token registered:', token);
        } catch (error) {
            console.error('Error registering push token:', error);
        }
    },

    // Send a notification to a specific user
    async sendNotification(
        toUserId: string,
        type: NotificationType,
        content: string,
        fromUserId: string,
        fromUsername: string,
        fromAvatar: string | null,
        targetId?: string
    ) {
        if (fromUserId === toUserId) return;

        try {
            // 1. Write to Supabase notifications table (in-app bell — always works)
            await supabase
                .from('notifications')
                .insert({
                    user_id: toUserId,
                    type,
                    from_user_id: fromUserId,
                    content,
                    target_id: targetId || null,
                    read: false
                });

            // 2. Send real push notification if they have a token (dev/prod builds only)
            if (_notif) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('pushToken')
                    .eq('id', toUserId)
                    .single();

                if (profile?.pushToken) {
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            to: profile.pushToken,
                            sound: 'default',
                            title: `@${fromUsername}`,
                            body: content,
                            data: { type, targetId: targetId || null },
                        }),
                    });
                }
            }
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    },

    // Subscribe to current user's notifications
    subscribeToNotifications(userId: string, callback: (notifs: Notification[]) => void) {
        if (!userId) return () => { };

        const fetchNotifs = async () => {
            const { data } = await supabase
                .from('notifications')
                .select(`
                    id,
                    type,
                    from_user_id,
                    content,
                    target_id,
                    read,
                    created_at,
                    profiles:from_user_id (username, "photoURL")
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                const formatted = data.map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    fromUserId: n.from_user_id,
                    fromUsername: n.profiles?.username || 'User',
                    fromAvatar: n.profiles?.photoURL || null,
                    content: n.content,
                    targetId: n.target_id,
                    read: n.read,
                    timestamp: n.created_at
                } as Notification));
                callback(formatted);
            }
        };

        fetchNotifs();

        const channel = supabase
            .channel(`notifs:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                () => fetchNotifs()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Mark a notification as read
    async markAsRead(userId: string, notifId: string) {
        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notifId)
                .eq('user_id', userId);
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    },

    // Mark ALL notifications as read
    async markAllAsRead(userId: string) {
        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('read', false);
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }
};
