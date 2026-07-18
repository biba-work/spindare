import { api } from './ApiService';
import { UserProfile } from './AIService';

export const AuthService = {
    // Fetch profile from the API by User ID
    async getProfile(userId: string): Promise<UserProfile | null> {
        try {
            return await api.get<UserProfile>(`/profiles/${userId}`);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    },

    // Create a new profile
    async createProfile(userId: string, profile: Omit<UserProfile, 'xp' | 'level' | 'spinsLeft' | 'lastSpinTimestamp'>): Promise<UserProfile> {
        try {
            return await api.post<UserProfile>('/profiles', profile);
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

    // Update level/XP
    async updateProgress(userId: string, xp: number, level: number) {
        await api.patch('/profiles/progress', { xp, level });
    },

    async updateSpinnerState(userId: string, spinsLeft: number, lastSpinTimestamp: number) {
        await api.patch('/profiles/spinner', { spinsLeft, lastSpinTimestamp });
    },

    async updateProfilePicture(userId: string, photoURL: string) {
        await api.patch('/profiles/picture', { photoURL });
    },

    async updateUsername(userId: string, username: string) {
        await api.patch('/profiles/username', { username });
    },

    async updateConnectionPrivacy(userId: string, privacy: 'open' | 'private') {
        await api.patch('/profiles/privacy', { privacy });
    },

    // Profile listener — was Supabase Realtime, now polls. The Nest realtime
    // gateway also emits 'profile:updated' over the socket (see
    // NotificationService.ts for the shared socket.io client setup) if you
    // want to switch this to push-based later; poll is simpler and correct
    // for now.
    onProfileChange(userId: string, callback: (profile: UserProfile | null) => void) {
        let cancelled = false;
        const poll = async () => {
            if (cancelled) return;
            const profile = await this.getProfile(userId);
            if (!cancelled) callback(profile);
        };
        const interval = setInterval(poll, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }
};
