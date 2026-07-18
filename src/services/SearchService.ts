import { api } from './ApiService';
import { UserProfile } from './AIService';
import { Post } from './PostService';

const mapPost = (row: any): Post => ({ ...row, timestamp: row.createdAt ?? row.created_at });

export const SearchService = {
    async searchUsers(text: string): Promise<(UserProfile & { uid?: string })[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];
        try {
            return await api.get(`/search/users?q=${encodeURIComponent(cleanText)}`);
        } catch (error) {
            console.error("Search Users Error:", error);
            return [];
        }
    },

    async searchChallenges(text: string): Promise<Post[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];
        try {
            const data = await api.get<any[]>(`/search/challenges?q=${encodeURIComponent(cleanText)}`);
            return data.map(mapPost);
        } catch (error) {
            console.error("Search Challenges Error:", error);
            return [];
        }
    }
};
