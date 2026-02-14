import { doc, setDoc, deleteDoc, getDoc, collection, getCountFromServer, serverTimestamp, getDocs, QueryDocumentSnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

import { NotificationService } from './NotificationService';

export const SocialService = {
    async followUser(targetUserId: string): Promise<'connected' | 'requested'> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Not authenticated");
        if (currentUserId === targetUserId) throw new Error("Cannot follow self");

        // 0. Check target user's privacy settings
        const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
        const targetUserData = targetUserDoc.data();
        const isPrivate = targetUserData?.connectionPrivacy === 'private';

        if (isPrivate) {
            // Send Connection Request
            await setDoc(doc(db, 'users', targetUserId, 'connectionRequests', currentUserId), {
                createdAt: serverTimestamp(),
                status: 'pending'
            });
            await NotificationService.sendNotification(targetUserId, 'follow', 'sent you a connection request');
            return 'requested';
        } else {
            // 1. Add to my 'following'
            await setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), {
                createdAt: serverTimestamp()
            });
            // 2. Add to their 'followers'
            await setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), {
                createdAt: serverTimestamp()
            });

            // 3. Send Notification
            await NotificationService.sendNotification(targetUserId, 'follow', 'want to Connect with you');
            return 'connected';
        }
    },

    async checkIsRequested(targetUserId: string): Promise<boolean> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return false;

        const docRef = doc(db, 'users', targetUserId, 'connectionRequests', currentUserId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists();
    },

    async unfollowUser(targetUserId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Not authenticated");

        await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
        await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));
        // Also remove any pending request
        await deleteDoc(doc(db, 'users', targetUserId, 'connectionRequests', currentUserId));
    },

    async acceptConnectionRequest(requesterId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return;

        // 1. Add requester to my followers
        await setDoc(doc(db, 'users', currentUserId, 'followers', requesterId), {
            createdAt: serverTimestamp()
        });
        // 2. Add me to requester's following
        await setDoc(doc(db, 'users', requesterId, 'following', currentUserId), {
            createdAt: serverTimestamp()
        });

        // 3. Delete Request
        await deleteDoc(doc(db, 'users', currentUserId, 'connectionRequests', requesterId));

        // 4. Notify requester
        await NotificationService.sendNotification(requesterId, 'follow', 'accepted your connection request');
    },

    async declineConnectionRequest(requesterId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return;

        await deleteDoc(doc(db, 'users', currentUserId, 'connectionRequests', requesterId));
    },

    subscribeToRequests(callback: (requests: any[]) => void) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return () => { };

        const q = collection(db, 'users', currentUserId, 'connectionRequests');

        return onSnapshot(q, async (snapshot) => {
            const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const requesterId = docSnap.id;
                // Fetch basic user info
                const userDoc = await getDoc(doc(db, 'users', requesterId));
                const userData = userDoc.data();
                return {
                    id: requesterId,
                    username: userData?.username || 'User',
                    photoURL: userData?.photoURL || null,
                    timestamp: docSnap.data().createdAt
                };
            }));

            callback(requests);
        });
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
    },

    // --- Ghost / Block Logic ---

    async ghostUser(targetUserId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return;

        // Add to ghosted collection
        await setDoc(doc(db, 'users', currentUserId, 'ghosted', targetUserId), {
            createdAt: serverTimestamp()
        });

        // Optionally unfollow
        await this.unfollowUser(targetUserId);
    },

    async checkIsGhosted(targetUserId: string): Promise<boolean> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return false;

        const docRef = doc(db, 'users', currentUserId, 'ghosted', targetUserId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists();
    },

    async checkIsGhostedBy(targetUserId: string): Promise<boolean> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return false;

        // Check if target has ghosted ME
        const docRef = doc(db, 'users', targetUserId, 'ghosted', currentUserId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists();
    },

    async unghostUser(targetUserId: string) {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return;

        await deleteDoc(doc(db, 'users', currentUserId, 'ghosted', targetUserId));
    },

    async getGhostedUsers(): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return [];

        try {
            const ghostedRef = collection(db, 'users', currentUserId, 'ghosted');
            const snapshot = await getDocs(ghostedRef);

            interface GhostUser {
                id: string;
                name: string;
                username: string;
                photoURL?: string;
            }

            const promises = snapshot.docs.map(async (docSnap): Promise<GhostUser | null> => {
                const targetId = docSnap.id;
                const userDoc = await getDoc(doc(db, 'users', targetId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    return {
                        id: targetId,
                        name: (data.username as string) || 'User',
                        username: `@${data.username}`,
                        photoURL: data.photoURL as string | undefined
                    };
                }
                return null;
            });

            const results = await Promise.all(promises);
            return results.filter((u): u is GhostUser => u !== null);
        } catch (error) {
            console.error("Error fetching ghosted users:", error);
            return [];
        }
    }
};
