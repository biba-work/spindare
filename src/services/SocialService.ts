import { doc, setDoc, deleteDoc, getDoc, collection, getCountFromServer, serverTimestamp, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

import { NotificationService } from './NotificationService';

export const SocialService = {
    async followUser(targetUserId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Not authenticated");
        if (currentUserId === targetUserId) throw new Error("Cannot follow self");

        // 1. Add to my 'following'
        await setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), {
            createdAt: serverTimestamp()
        });
        // 2. Add to their 'followers'
        await setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), {
            createdAt: serverTimestamp()
        });

        // 3. Send Notification
        await NotificationService.sendNotification(targetUserId, 'follow', 'started following you');
    },

    async unfollowUser(targetUserId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Not authenticated");

        await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
        await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));
    },

    async checkIsFollowing(targetUserId: string): Promise<boolean> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return false;

        const docRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists();
    },

    async getFollowStats(userId: string) {
        try {
            const followersColl = collection(db, 'users', userId, 'followers');
            const followingColl = collection(db, 'users', userId, 'following');

            const followersSnapshot = await getCountFromServer(followersColl);
            const followingSnapshot = await getCountFromServer(followingColl);

            return {
                followers: followersSnapshot.data().count,
                following: followingSnapshot.data().count
            };
        } catch (e) {
            // console.error("Error getting stats", e);
            return { followers: 0, following: 0 };
        }
    },

    async getFriends(): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return [];

        try {
            const followingRef = collection(db, 'users', currentUserId, 'following');
            const snapshot = await getDocs(followingRef);

            interface FriendResult {
                id: string;
                name: string;
                username: string;
                photoURL?: string;
            }

            const friendPromises = snapshot.docs.map(async (docSnap: QueryDocumentSnapshot<DocumentData>): Promise<FriendResult | null> => {
                const friendId = docSnap.id;
                const friendDoc = await getDoc(doc(db, 'users', friendId));
                if (friendDoc.exists()) {
                    const data = friendDoc.data();
                    return {
                        id: friendId,
                        name: data.username || 'User',
                        username: `@${data.username}`,
                        photoURL: data.photoURL as string | undefined
                    };
                }
                return null;
            });

            const results = await Promise.all(friendPromises);
            return results.filter((f): f is FriendResult => f !== null);
        } catch (error) {
            console.error("Error fetching friends:", error);
            return [];
        }
    }
};
