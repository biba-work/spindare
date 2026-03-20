import { supabase } from './supabaseConfig';
import { NotificationService } from './NotificationService';

export const SocialService = {
    async followUser(
        currentUserId: string, 
        targetUserId: string,
        fromUsername: string,
        fromAvatar: string | null
    ): Promise<'connected' | 'requested'> {
        if (currentUserId === targetUserId) throw new Error("Cannot follow self");

        // 0. Check target user's privacy settings
        const { data: targetUser } = await supabase
            .from('profiles')
            .select('connectionPrivacy')
            .eq('id', targetUserId)
            .single();

        const isPrivate = targetUser?.connectionPrivacy === 'private';

        if (isPrivate) {
            // Send Connection Request
            await supabase
                .from('connection_requests')
                .upsert({ receiver_id: targetUserId, requester_id: currentUserId, status: 'pending' });

            await NotificationService.sendNotification(
                targetUserId, 
                'follow', 
                'sent you a connection request',
                currentUserId,
                fromUsername,
                fromAvatar
            );
            return 'requested';
        } else {
            // Add to follows table (bidirectional or unidirectional depending on your app, here it seems unidirectional like Twitter)
            await supabase
                .from('follows')
                .upsert({ follower_id: currentUserId, following_id: targetUserId });

            // Send Notification
            await NotificationService.sendNotification(
                targetUserId, 
                'follow', 
                'want to Connect with you',
                currentUserId,
                fromUsername,
                fromAvatar
            );
            return 'connected';
        }
    },

    async checkIsRequested(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;

        const { data } = await supabase
            .from('connection_requests')
            .select('id')
            .eq('receiver_id', targetUserId)
            .eq('requester_id', currentUserId)
            .eq('status', 'pending')
            .single();
        
        return !!data;
    },

    async unfollowUser(currentUserId: string, targetUserId: string) {
        await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId);
    },

    async acceptConnectionRequest(
        currentUserId: string, 
        requesterId: string,
        fromUsername: string,
        fromAvatar: string | null
    ) {
        // 1. Add follow record
        await supabase
            .from('follows')
            .upsert({ follower_id: requesterId, following_id: currentUserId });

        // 2. Update Request
        await supabase
            .from('connection_requests')
            .delete()
            .eq('receiver_id', currentUserId)
            .eq('requester_id', requesterId);

        // 3. Notify requester
        await NotificationService.sendNotification(
            requesterId, 
            'follow', 
            'accepted your connection request',
            currentUserId,
            fromUsername,
            fromAvatar
        );
    },

    async declineConnectionRequest(currentUserId: string, requesterId: string) {
        await supabase
            .from('connection_requests')
            .delete()
            .eq('receiver_id', currentUserId)
            .eq('requester_id', requesterId);
    },

    subscribeToRequests(currentUserId: string, callback: (requests: any[]) => void) {
        if (!currentUserId) return () => { };

        const fetchRequests = async () => {
            const { data } = await supabase
                .from('connection_requests')
                .select(`
                    requester_id,
                    created_at,
                    profiles:requester_id (username, photoURL)
                `)
                .eq('receiver_id', currentUserId)
                .eq('status', 'pending');

            if (data) {
                const formatted = data.map((r: any) => ({
                    id: r.requester_id,
                    username: r.profiles?.username || 'User',
                    photoURL: r.profiles?.photoURL || null,
                    timestamp: r.created_at
                }));
                callback(formatted);
            }
        };

        fetchRequests();

        const channel = supabase
            .channel(`requests:${currentUserId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'connection_requests', filter: `receiver_id=eq.${currentUserId}` },
                () => fetchRequests()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    async checkIsFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;

        const { data } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId)
            .single();
        
        return !!data;
    },

    async getFollowStats(userId: string) {
        try {
            const { count: followers } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', userId);

            const { count: following } = await supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('follower_id', userId);

            return {
                followers: followers || 0,
                following: following || 0
            };
        } catch (e) {
            return { followers: 0, following: 0 };
        }
    },

    async getFriends(currentUserId: string): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        if (!currentUserId) return [];

        try {
            const { data } = await supabase
                .from('follows')
                .select(`
                    following_id,
                    profiles:following_id (username, photoURL)
                `)
                .eq('follower_id', currentUserId);

            if (!data) return [];

            return data.map((f: any) => ({
                id: f.following_id,
                name: f.profiles?.username || 'User',
                username: `@${f.profiles?.username || 'user'}`,
                photoURL: f.profiles?.photoURL
            }));
        } catch (error) {
            console.error("Error fetching friends:", error);
            return [];
        }
    },

    // --- Ghost / Block Logic ---

    async ghostUser(currentUserId: string, targetUserId: string) {
        await supabase
            .from('ghosted_users')
            .upsert({ user_id: currentUserId, ghosted_id: targetUserId });

        await this.unfollowUser(currentUserId, targetUserId);
    },

    async checkIsGhosted(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;

        const { data } = await supabase
            .from('ghosted_users')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('ghosted_id', targetUserId)
            .single();
        
        return !!data;
    },

    async checkIsGhostedBy(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId) return false;

        const { data } = await supabase
            .from('ghosted_users')
            .select('id')
            .eq('user_id', targetUserId)
            .eq('ghosted_id', currentUserId)
            .single();
        
        return !!data;
    },

    async unghostUser(currentUserId: string, targetUserId: string) {
        await supabase
            .from('ghosted_users')
            .delete()
            .eq('user_id', currentUserId)
            .eq('ghosted_id', targetUserId);
    },

    async getGhostedUsers(currentUserId: string): Promise<{ id: string, name: string, username: string, photoURL?: string }[]> {
        if (!currentUserId) return [];

        try {
            const { data } = await supabase
                .from('ghosted_users')
                .select(`
                    ghosted_id,
                    profiles:ghosted_id (username, photoURL)
                `)
                .eq('user_id', currentUserId);

            if (!data) return [];

            return data.map((g: any) => ({
                id: g.ghosted_id,
                name: g.profiles?.username || 'User',
                username: `@${g.profiles?.username || 'user'}`,
                photoURL: g.profiles?.photoURL
            }));
        } catch (error) {
            console.error("Error fetching ghosted users:", error);
            return [];
        }
    }
};
