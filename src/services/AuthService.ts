import { supabase } from './supabaseConfig';
import { UserProfile } from './AIService';

export const AuthService = {
    // Fetch profile from Supabase by User ID
    async getProfile(userId: string): Promise<UserProfile | null> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                throw error;
            }
            return data as UserProfile;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    },

    // Create a new Supabase profile
    async createProfile(userId: string, profile: Omit<UserProfile, 'xp' | 'level' | 'spinsLeft' | 'lastSpinTimestamp'>): Promise<UserProfile> {
        try {
            const fullProfile: UserProfile & { id: string } = {
                id: userId,
                ...profile,
                xp: 0,
                level: 1,
                spinsLeft: 2,
                lastSpinTimestamp: 0,
                streak: 0,
                lastChallengeDate: '',
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(fullProfile);

            if (error) throw error;
            return fullProfile;
        } catch (error: any) {
            console.error('Create Profile Error:', error.message);
            throw error;
        }
    },

    // Legacy support for login flow in UI
    async login(userId: string): Promise<UserProfile> {
        const profile = await this.getProfile(userId);
        if (!profile) throw new Error('User profile not found');
        return profile;
    },

    // Update level/XP in Supabase
    async updateProgress(userId: string, xp: number, level: number) {
        await supabase
            .from('profiles')
            .update({ xp, level })
            .eq('id', userId);
    },

    async updateSpinnerState(userId: string, spinsLeft: number, lastSpinTimestamp: number) {
        await supabase
            .from('profiles')
            .update({ spinsLeft, lastSpinTimestamp })
            .eq('id', userId);
    },

    async updateProfilePicture(userId: string, photoURL: string) {
        await supabase
            .from('profiles')
            .update({ photoURL })
            .eq('id', userId);
    },

    async updateUsername(userId: string, username: string) {
        // 1. Update User Profile
        await supabase
            .from('profiles')
            .update({ username })
            .eq('id', userId);

        // 2. Update all past posts by this user to reflect new username
        try {
            await supabase
                .from('posts')
                .update({ author: username })
                .eq('userId', userId);
        } catch (error) {
            console.error("Error updating posts with new username:", error);
        }
    },

    async updateConnectionPrivacy(userId: string, privacy: 'open' | 'private') {
        await supabase
            .from('profiles')
            .update({ connectionPrivacy: privacy })
            .eq('id', userId);
    },

    // Profile listener (Supabase Realtime)
    onProfileChange(userId: string, callback: (profile: UserProfile | null) => void) {
        const channel = supabase
            .channel(`profile:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    callback(payload.new as UserProfile);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
};
