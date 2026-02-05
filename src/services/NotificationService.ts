import { db, auth } from './firebaseConfig';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';

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

        return onSnapshot(q, async (snapshot) => {
            const notifs = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                // Fetch fresh user info to keep it synced
                let fromUsername = data.fromUsername;
                let fromAvatar = data.fromAvatar;

                if (data.fromUserId) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            fromUsername = userData.username || fromUsername;
                            fromAvatar = userData.photoURL || fromAvatar;
                        }
                    } catch (e) {
                        console.error("Error fetching notification user:", e);
                    }
                }

                return {
                    id: docSnap.id,
                    ...data,
                    fromUsername,
                    fromAvatar,
                } as Notification;
            }));

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
    },

    // Mark ALL notifications as read
    async markAllAsRead() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const q = query(
                collection(db, 'users', user.uid, 'notifications'),
                where('read', '==', false)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.docs.forEach((docSnap) => {
                batch.update(docSnap.ref, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }
};
