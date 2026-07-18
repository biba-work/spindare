import { api } from './ApiService';

export const SocialService = {
    async followUser(
        currentUserId: string,
        targetUserId: string,
        fromUsername: string,
        fromAvatar: string | null
    ): Promise<'connected' | 'requested'> {
        if (currentUserId === targetUserId) throw new Error("Cannot follow self");
        return api.post(`/social/follow/${targetUserId}`, { username: fromUsername, avatar: fromAvatar });
    },

    async checkIsRequested(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;
        const { requested } = await api.get<{ following: boolean; requested: boolean }>(`/social/follow/${targetUserId}/status`);
        return requested;
    },

    async unfollowUser(currentUserId: string, targetUserId: string) {
        await api.delete(`/social/follow/${targetUserId}`);
    },

    async acceptConnectionRequest(
        currentUserId: string,
        requesterId: string,
        fromUsername: string,
        fromAvatar: string | null
    ) {
        await api.post(`/social/requests/${requesterId}/accept`, { username: fromUsername, avatar: fromAvatar });
    },

    async declineConnectionRequest(currentUserId: string, requesterId: string) {
        await api.post(`/social/requests/${requesterId}/decline`);
    },

    // Poll pending connection requests (was Supabase Realtime).
    subscribeToRequests(currentUserId: string, callback: (requests: any[]) => void) {
        if (!currentUserId) return () => { };
        let cancelled = false;
        const fetchRequests = async () => {
            try {
                const data = await api.get<any[]>('/social/requests');
                if (!cancelled) callback(data);
            } catch (e) {
                console.warn('Connection requests poll failed:', e);
            }
        };
        fetchRequests();
        const interval = setInterval(fetchRequests, 15000);
        return () => { cancelled = true; clearInterval(interval); };
    },

    async checkIsFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;
        const { following } = await api.get<{ following: boolean; requested: boolean }>(`/social/follow/${targetUserId}/status`);
        return following;
    },

    async getFollowStats(userId: string) {
        try {
            return await api.get<{ followers: number; following: number }>(`/social/follow-stats/${userId}`);
        } catch (e) {
            return { followers: 0, following: 0 };
        }
    },

    async getFriends(currentUserId: string): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        if (!currentUserId) return [];
        try {
            return await api.get('/social/friends');
        } catch (error) {
            console.error("Error fetching friends:", error);
            return [];
        }
    },

    // --- Ghost / Block Logic ---

    async ghostUser(currentUserId: string, targetUserId: string) {
        await api.post(`/social/ghost/${targetUserId}`);
    },

    async checkIsGhosted(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;
        const { ghosted } = await api.get<{ ghosted: boolean; ghostedBy: boolean }>(`/social/ghosted/${targetUserId}/status`);
        return ghosted;
    },

    async checkIsGhostedBy(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;
        const { ghostedBy } = await api.get<{ ghosted: boolean; ghostedBy: boolean }>(`/social/ghosted/${targetUserId}/status`);
        return ghostedBy;
    },

    async unghostUser(currentUserId: string, targetUserId: string) {
        await api.delete(`/social/ghost/${targetUserId}`);
    },

    // ── Saved Challenges (kept_challenges) ─────────────────────────────────────

    async saveChallenge(userId: string, challenge: string, postId?: string): Promise<void> {
        await api.post('/challenges/kept/save', { challenge, postId });
    },

    async getSavedChallenges(userId: string): Promise<{ challenge: string; expiresAt: string }[]> {
        return api.get('/challenges/kept/saved');
    },

    async getGhostedUsers(currentUserId: string): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        if (!currentUserId) return [];
        try {
            return await api.get('/social/ghosted');
        } catch (error) {
            console.error("Error fetching ghosted users:", error);
            return [];
        }
    }
};
