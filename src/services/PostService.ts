import { db, auth, storage } from './firebaseConfig';
import { Image } from 'react-native';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    serverTimestamp,
    getDocs,
    limit,
    where
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export interface Post {
    id: string;
    userId: string;
    author: string;
    avatar: string;
    challenge: string;
    content: string;
    media: string | null;
    timestamp: any;
    reactions: {
        felt: number;
        thought: number;
        intrigued: number;
    };
}

export const PostService = {
    // Helper to upload image to Storage
    async uploadImage(uri: string): Promise<string> {
        try {
            // Read file as base64 using legacy expo-file-system API (more stable)
            // This bypasses the XHR/fetch 'Network request failed' error for local file:// URIs
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const filename = `posts/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, filename);

            // Upload the base64 string directly
            await uploadString(storageRef, base64, 'base64', {
                contentType: 'image/jpeg'
            });

            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Firebase Storage Upload Error:", error);
            throw error;
        }
    },

    // Create a new challenge post
    async createPost(username: string, avatar: string, challenge: string, content: string, mediaUri: string | null) {
        const user = auth.currentUser;
        if (!user) throw new Error("Must be logged in to post");

        let finalMediaUrl = mediaUri;
        if (mediaUri && !mediaUri.startsWith('http')) {
            finalMediaUrl = await this.uploadImage(mediaUri);
        }

        const postData = {
            userId: user.uid,
            author: username,
            avatar: avatar,
            challenge: challenge,
            content: content,
            media: finalMediaUrl,
            timestamp: serverTimestamp(),
            reactions: {
                felt: 0,
                thought: 0,
                intrigued: 0
            }
        };

        return await addDoc(collection(db, 'posts'), postData);
    },

    // Listen to real-time feed updates
    subscribeToFeed(callback: (posts: Post[]) => void) {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Post));
            callback(posts);
        });
    },

    // Listen to specific user's posts
    subscribeToUserPosts(userId: string, callback: (posts: Post[]) => void) {
        // Note: Composite index might be needed for 'where' + 'orderBy'.
        // For now we sort client side or trust 'where' is enough.
        const q = query(collection(db, 'posts'), where('userId', '==', userId));

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Post)).sort((a, b) => {
                // Manual client side sort descending
                const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return tB - tA;
            });
            callback(posts);
        });
    },

    // Add a reaction to a post
    async addReaction(postId: string, type: 'felt' | 'thought' | 'intrigued') {
        const postRef = doc(db, 'posts', postId);
        const updateField = `reactions.${type}`;

        await updateDoc(postRef, {
            [updateField]: increment(1)
        });
    },

    // Seed fake data if collection is empty or for testing
    async seedFakeData() {
        // 1. INJECT CUSTOM GUEST POSTS (From Local Assets)
        const guests = [
            {
                id: "guest-1", author: "Sarah_Vibes",
                challenge: "Morning Light", content: "Caught the sunrise just in time.",
                media: Image.resolveAssetSource(require('../../assets/guest_1.jpg')).uri
            },
            {
                id: "guest-2", author: "Davide33",
                challenge: "Urban Jungle", content: "Concrete and leaves. My favorite combo.",
                media: Image.resolveAssetSource(require('../../assets/guest_2.jpg')).uri
            },
            {
                id: "guest-3", author: "LensWalker",
                challenge: "Reflection", content: "Who knew a puddle could look this deep?",
                media: Image.resolveAssetSource(require('../../assets/guest_3.jpg')).uri
            }
        ];

        for (const guest of guests) {
            const guestQ = query(collection(db, 'posts'), where("userId", "==", guest.id));
            const guestSnap = await getDocs(guestQ);
            if (guestSnap.empty) {
                console.log(`Injecting custom guest post ${guest.id}...`);
                await addDoc(collection(db, 'posts'), {
                    userId: guest.id,
                    author: guest.author,
                    avatar: `https://ui-avatars.com/api/?name=${guest.author}&background=random`,
                    challenge: guest.challenge,
                    content: guest.content,
                    media: guest.media,
                    timestamp: serverTimestamp(),
                    reactions: { felt: Math.floor(Math.random() * 20), thought: Math.floor(Math.random() * 10), intrigued: Math.floor(Math.random() * 5) }
                });
            }
        }

        // 2. Quick check to see if we already have data
        const q = query(collection(db, 'posts'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            console.log("Feed already has data. Skipping seed.");
            return;
        }

        console.log("Seeding fake data...");
        const FAKES = [
            {
                userId: "ai-faker-1",
                author: "ZenMasterAI",
                avatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&q=80",
                challenge: "Silence Protocol",
                content: "Spent 2 hours in total silence. The city sounds like a different beast when you stop contributing to the noise.",
                media: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
                reactions: { felt: 24, thought: 12, intrigued: 5 }
            },
            {
                userId: "ai-faker-2",
                author: "UrbanExplorer",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
                challenge: "Unknown Path",
                content: "Took the back alley near the industrial district. Found this street art I never knew existed. Beauty is everywhere.",
                media: "https://images.unsplash.com/photo-1518107616385-ad308919634a?w=800&q=80",
                reactions: { felt: 8, thought: 3, intrigued: 45 }
            },
            {
                userId: "ai-faker-3",
                author: "MemoryKeeper",
                avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
                challenge: "Deep Memory",
                content: "Wrote down the smell of my grandmother's kitchen. It's crazy how words can make you smell cinnamon and old books.",
                media: null,
                reactions: { felt: 56, thought: 89, intrigued: 2 }
            }
        ];

        for (const fake of FAKES) {
            await addDoc(collection(db, 'posts'), {
                ...fake,
                timestamp: serverTimestamp()
            });
        }
    }
};
