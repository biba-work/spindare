import { supabase } from './supabaseConfig';
import { UserProfile } from './AIService';
import { Post } from './PostService';

export const SearchService = {
    async searchUsers(text: string): Promise<(UserProfile & { uid?: string })[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .ilike('username', `%${cleanText}%`)
                .limit(10);

            if (error) throw error;

            return (data || []).map(profile => ({
                uid: profile.id,
                ...profile
            })) as (UserProfile & { uid?: string })[];
        } catch (error) {
            console.error("Search Users Error:", error);
            return [];
        }
    },

    async searchChallenges(text: string): Promise<Post[]> {
        const cleanText = text.trim();
        if (!cleanText) return [];

        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .or(`challenge.ilike.%${cleanText}%,content.ilike.%${cleanText}%`)
                .limit(15);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error("Search Challenges Error:", error);
            return [];
        }
    }
};
