import { supabase } from './supabaseConfig';

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
                    profiles:from_user_id (username, photoURL)
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
