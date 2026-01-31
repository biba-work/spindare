import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserProfile } from './AIService';
import { Post } from './PostService';

export const SearchService = {
    async searchUsers(text: string): Promise<(UserProfile & { uid?: string })[]> {
        const cleanText = text.trim().toLowerCase();
        if (!cleanText) return [];

        try {
            const usersRef = collection(db, 'users');

            // Try using a lowercase indexed field first (if you have 'usernameLower' in DB)
            // Fallback: just get all users and filter client-side (fine for small apps)
            const snapshot = await getDocs(usersRef);

            const allUsers = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...(doc.data() as UserProfile)
            }));

            // Filter client-side for partial match (case-insensitive)
            const filtered = allUsers.filter(u =>
                u.username?.toLowerCase().includes(cleanText)
            );

            return filtered.slice(0, 10); // Limit results to 10
        } catch (error) {
            console.error("Search Users Error:", error);
            return [];
        }
    },

    async searchChallenges(text: string): Promise<Post[]> {
        const cleanText = text.trim().toLowerCase();
        if (!cleanText) return [];

        try {
            const postsRef = collection(db, 'posts');
            const snapshot = await getDocs(postsRef);

            const allPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Post, 'id'>)
            }));

            // Filter client-side for partial match on challenge (case-insensitive)
            const filtered = allPosts.filter(p =>
                p.challenge?.toLowerCase().includes(cleanText) ||
                p.content?.toLowerCase().includes(cleanText)
            );

            return filtered.slice(0, 15); // Limit results to 15
        } catch (error) {
            console.error("Search Challenges Error:", error);
            return [];
        }
    }
};
