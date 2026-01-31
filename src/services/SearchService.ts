import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserProfile } from './AIService';
import { Post } from './PostService';

export const SearchService = {
    async searchUsers(text: string): Promise<UserProfile[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];
        try {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('username', '>=', cleanText),
                where('username', '<=', cleanText + '\uf8ff'),
                limit(5)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as UserProfile);
        } catch (error) {
            console.error("Search Users Error:", error);
            // Fallback for demo if offline/no index
            return [];
        }
    },

    async searchChallenges(text: string): Promise<Post[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];
        try {
            const postsRef = collection(db, 'posts');
            const q = query(
                postsRef,
                where('challenge', '>=', cleanText),
                where('challenge', '<=', cleanText + '\uf8ff'),
                limit(5)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        } catch (error) {
            console.error("Search Challenges Error:", error);
            return [];
        }
    }
};
