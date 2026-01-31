import { db, auth } from './firebaseConfig';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

export type NotificationType = 'reaction' | 'follow' | 'challenge' | 'comment';

export interface Notification {
    id: string;
    type: NotificationType;
    fromUserId: string;
    fromUsername: string;
    fromAvatar: string | null;
    content: string; // "liked your post", "started following you"
    targetId: string | null; // postId, or challengeId
    read: boolean;
    timestamp: any;
}

export const NotificationService = {
    // Send a notification to a specific user
    async sendNotification(toUserId: string, type: NotificationType, content: string, targetId?: string) {
        const currentUser = auth.currentUser;

        // Safety check: Don't notify self, and ensure user is logged in
        if (!currentUser || currentUser.uid === toUserId) return;

        try {
            await addDoc(collection(db, 'users', toUserId, 'notifications'), {
                type,
                fromUserId: currentUser.uid,
                fromUsername: currentUser.displayName || 'User',
                fromAvatar: currentUser.photoURL || null,
                content,
                targetId: targetId || null,
                read: false,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    },

    // Subscribe to current user's notifications
    subscribeToNotifications(callback: (notifs: Notification[]) => void) {
        const user = auth.currentUser;
        if (!user) return () => { };

        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];
            callback(notifs);
        });
    },

    // Mark a notification as read
    async markAsRead(notifId: string) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
                read: true
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }
};
