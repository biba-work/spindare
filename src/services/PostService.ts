import { supabase } from './supabaseConfig';
import { NotificationService } from './NotificationService';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';

export interface Post {
    id: string;
    userId: string;
    author: string;
    avatar: string;
    challenge: string;
    content: string;
    media: string | null;
    timestamp: string;
    reactions: {
        felt: number;
        thought: number;
        intrigued: number;
    };
    spinCount?: number;
}

// Maps a raw Supabase row to the Post interface (created_at → timestamp)
const mapPost = (row: any): Post => ({ ...row, timestamp: row.created_at });

export const PostService = {
    // Helper to upload image to Supabase Storage.
    // Converts ANY format (RAW, HEIC, PNG, WebP, DNG, etc.) to JPEG first
    // so the rest of the app always receives a safe, displayable URL.
    async uploadImage(uri: string): Promise<string> {
        try {
            // Step 1: Convert to JPEG regardless of source format
            const converted = await ImageManipulator.manipulateAsync(
                uri,
                [], // no resize/crop — keep original dimensions
                { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
            );

            // Step 2: Read as base64
            const base64 = await FileSystem.readAsStringAsync(converted.uri, { encoding: 'base64' });
            const filename = `posts/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

            // Step 3: Upload the guaranteed-JPEG bytes
            const { data, error } = await supabase.storage
                .from('spindare-assets')
                .upload(filename, decode(base64), {
                    contentType: 'image/jpeg'
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('spindare-assets')
                .getPublicUrl(data.path);

            return publicUrl;
        } catch (error) {
            console.error("Supabase Storage Upload Error:", error);
            throw error;
        }
    },

    // Upload a video file to Supabase Storage using streaming (no base64 OOM).
    // Uses a signed upload URL + FileSystem.uploadAsync so the entire video
    // is never held in JS memory — safe for files up to several hundred MB.
    async uploadVideo(uri: string, onProgress?: (pct: number) => void): Promise<string> {
        try {
            // Detect MIME from extension
            const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'mp4';
            const mimeMap: Record<string, string> = {
                mp4: 'video/mp4',
                mov: 'video/quicktime',
                avi: 'video/x-msvideo',
                webm: 'video/webm',
                '3gp': 'video/3gpp',
            };
            const contentType = mimeMap[ext] || 'video/mp4';
            const filename = `posts/video_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            // Get a signed upload URL so we can PUT directly without base64
            const { data: signedData, error: signError } = await supabase.storage
                .from('spindare-assets')
                .createSignedUploadUrl(filename);

            if (signError) throw signError;

            // Stream upload — FileSystem.uploadAsync sends raw bytes, no base64
            const uploadResult = await FileSystem.uploadAsync(signedData.signedUrl, uri, {
                httpMethod: 'PUT',
                headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
                uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT ?? 0,
                sessionType: (FileSystem as any).FileSystemSessionType?.BACKGROUND ?? 1,
            });

            if (uploadResult.status < 200 || uploadResult.status >= 300) {
                throw new Error(`Video upload failed (HTTP ${uploadResult.status})`);
            }

            onProgress?.(100);

            const { data: { publicUrl } } = supabase.storage
                .from('spindare-assets')
                .getPublicUrl(filename);

            return publicUrl;
        } catch (error) {
            console.error("Video Upload Error:", error);
            throw error;
        }
    },

    // Create a new challenge post
    async createPost(
        userId: string,
        username: string,
        avatar: string,
        challenge: string,
        content: string,
        mediaUri: string | null,
        onUploadProgress?: (pct: number) => void
    ) {
        if (!userId) throw new Error("Must be logged in to post");

        let finalMediaUrl = mediaUri;
        if (mediaUri && !mediaUri.startsWith('http')) {
            const isVideo = /\.(mp4|mov|avi|webm|3gp)$/i.test(mediaUri);
            finalMediaUrl = isVideo
                ? await this.uploadVideo(mediaUri, onUploadProgress)
                : await this.uploadImage(mediaUri);
        }

        // Calculate functional Spin Count
        let count = 1;
        try {
            const { count: existingCount } = await supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .eq('challenge', challenge);

            count = (existingCount || 0) + 1;
        } catch (err) {
            console.warn("Could not calculate spin count", err);
        }

        const { data, error } = await supabase
            .from('posts')
            .insert({
                userId,
                author: username,
                avatar,
                challenge,
                content,
                media: finalMediaUrl,
                spinCount: count,
                reactions: { felt: 0, thought: 0, intrigued: 0 }
            })
            .select()
            .single();

        if (error) throw error;

        // Update streak — fire and forget, never block the post
        this.updateStreak(userId).catch(e => console.warn("Streak update failed:", e));

        return data;
    },

    // Update the user's daily challenge streak
    async updateStreak(userId: string) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('streak, "lastChallengeDate"')
            .eq('id', userId)
            .single();

        if (!profile) return;

        const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
        const last = profile.lastChallengeDate;

        let newStreak = 1;
        if (last) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (last === today) {
                return; // Already posted today, don't increment
            } else if (last === yesterdayStr) {
                newStreak = (profile.streak || 0) + 1; // Consecutive day
            }
            // else: streak broken, reset to 1
        }

        await supabase
            .from('profiles')
            .update({ streak: newStreak, lastChallengeDate: today })
            .eq('id', userId);
    },

    // Subscribe to real-time feed updates
    subscribeToFeed(callback: (updater: (prev: Post[]) => Post[]) => void) {
        // Initial fetch — replaces entire list once on mount
        const fetchAll = async () => {
            const { data } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) callback(() => data.map(mapPost));
        };

        fetchAll();

        const channel = supabase
            .channel('public:posts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'posts' },
                (payload) => {
                    // New post: prepend without touching existing items
                    const newPost = mapPost(payload.new);
                    callback(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'posts' },
                (payload) => {
                    // Reaction / edit: update only the changed post in place
                    const updated = mapPost(payload.new);
                    callback(prev => prev.map(p => p.id === updated.id ? updated : p));
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'posts' },
                (payload) => {
                    callback(prev => prev.filter(p => p.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Listen to specific user's posts
    subscribeToUserPosts(userId: string, callback: (posts: Post[]) => void) {
        const fetchUserPosts = async () => {
            const { data } = await supabase
                .from('posts')
                .select('*')
                .eq('userId', userId)
                .order('created_at', { ascending: false });
            if (data) callback(data.map(mapPost));
        };

        fetchUserPosts();

        const channel = supabase
            .channel(`user:posts:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'posts', filter: `userId=eq.${userId}` },
                () => fetchUserPosts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Toggle a reaction to a post
    async getUserReaction(userId: string, postId: string): Promise<'felt' | 'thought' | 'intrigued' | null> {
        if (!userId || !postId) return null;
        try {
            const { data } = await supabase
                .from('reactions')
                .select('type')
                .eq('postId', postId)
                .eq('userId', userId)
                .single();
            return (data?.type || null) as any;
        } catch {
            return null;
        }
    },

    async toggleReaction(
        userId: string, 
        currentUsername: string,
        currentAvatar: string | null,
        postId: string, 
        type: 'felt' | 'thought' | 'intrigued'
    ) {
        if (!userId) return;

        try {
            // Check for existing reaction
            const { data: existing, error: fetchError } = await supabase
                .from('reactions')
                .select('*')
                .eq('postId', postId)
                .eq('userId', userId)
                .single();

            if (existing) {
                if (existing.type === type) {
                    // Remove
                    await supabase.from('reactions').delete().eq('id', existing.id);
                    // Update post counts (better done via RPC or edge function, but for now client-side is fine if RLS allows)
                    await supabase.rpc('decrement_reaction', { post_id: postId, reaction_type: type });
                } else {
                    // Change
                    const oldType = existing.type;
                    await supabase.from('reactions').update({ type }).eq('id', existing.id);
                    await supabase.rpc('swap_reaction', { post_id: postId, old_type: oldType, new_type: type });
                }
            } else {
                // Add new
                await supabase.from('reactions').insert({ userId, postId, type });
                await supabase.rpc('increment_reaction', { post_id: postId, reaction_type: type });

                // Notification logic
                const { data: post } = await supabase.from('posts').select('userId').eq('id', postId).single();
                if (post) {
                    await NotificationService.sendNotification(
                        post.userId, 
                        'reaction', 
                        `reacted with ${type} to your post`,
                        userId,
                        currentUsername,
                        currentAvatar,
                        postId
                    );
                }
            }
        } catch (e) {
            console.error("Error toggling reaction", e);
        }
    },

    // Add a comment
    async addComment(
        userId: string, 
        username: string, 
        avatar: string, 
        postId: string, 
        text: string
    ) {
        if (!userId) throw new Error("Must be logged in");

        const { error } = await supabase
            .from('comments')
            .insert({
                postId,
                userId,
                author: username,
                avatar,
                content: text
            });

        if (error) throw error;

        // Send Notification
        const { data: post } = await supabase.from('posts').select('userId').eq('id', postId).single();
        if (post) {
            await NotificationService.sendNotification(
                post.userId, 
                'comment', 
                'commented on your post',
                userId,
                username,
                avatar,
                postId
            );
        }
    },

    // Subscribe to comments
    subscribeToComments(postId: string, callback: (comments: any[]) => void) {
        const fetchComments = async () => {
            const { data } = await supabase
                .from('comments')
                .select('*')
                .eq('postId', postId)
                .order('created_at', { ascending: true });
            if (data) callback(data);
        };

        fetchComments();

        const channel = supabase
            .channel(`comments:${postId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'comments', filter: `postId=eq.${postId}` },
                () => fetchComments()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Seed fake data — DEV ONLY. Never call this in production.
    async seedFakeData() {
        if (!__DEV__) {
            console.warn('seedFakeData() is disabled in production builds.');
            return;
        }
        const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true });
        if (count && count > 0) return;

        console.log("Seeding mock posts to Supabase...");
        const FAKES = [
            {
                userId: "mock-user-1",
                author: "elia.v",
                avatar: "https://i.pravatar.cc/150?img=1",
                challenge: "Silence Protocol",
                content: "Spent 2 hours in total silence. The city sounds like a different beast when you stop contributing to the noise. Highly recommend.",
                media: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
                reactions: { felt: 24, thought: 12, intrigued: 5 },
                spinCount: 1240,
            },
            {
                userId: "mock-user-2",
                author: "marek.r",
                avatar: "https://i.pravatar.cc/150?img=5",
                challenge: "Trace a shadow",
                content: "Found the most perfect shadow at 4pm. Traced it with chalk on my apartment floor. By 5pm it was gone. Impermanence, I guess.",
                media: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
                reactions: { felt: 31, thought: 18, intrigued: 9 },
                spinCount: 876,
            },
            {
                userId: "mock-user-3",
                author: "sofi.k",
                avatar: "https://i.pravatar.cc/150?img=9",
                challenge: "One texture, ten seconds",
                content: "I pressed my palm flat against the bark of an oak for ten full seconds. Felt every ridge. I don't know why this hit me so hard.",
                media: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&q=80",
                reactions: { felt: 67, thought: 14, intrigued: 22 },
                spinCount: 2103,
            },
            {
                userId: "mock-user-4",
                author: "dan.exe",
                avatar: "https://i.pravatar.cc/150?img=12",
                challenge: "No mirror day",
                content: "Went the whole day without checking how I looked. By lunchtime I stopped caring. By evening I felt weirdly free.",
                media: null,
                reactions: { felt: 88, thought: 41, intrigued: 17 },
                spinCount: 3312,
            },
            {
                userId: "mock-user-5",
                author: "lena.w",
                avatar: "https://i.pravatar.cc/150?img=20",
                challenge: "Sky for 60 seconds",
                content: "Lay flat on the pavement outside my building and stared up for exactly 60 seconds. A woman asked if I needed help. We ended up talking for half an hour.",
                media: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                reactions: { felt: 112, thought: 34, intrigued: 56 },
                spinCount: 4018,
            },
            {
                userId: "mock-user-6",
                author: "b.ramos",
                avatar: "https://i.pravatar.cc/150?img=33",
                challenge: "Write a letter you'll never send",
                content: "Wrote three pages. Tore them up. Then wrote three more. The act of writing is different when you know no one else will read it.",
                media: null,
                reactions: { felt: 99, thought: 77, intrigued: 11 },
                spinCount: 1589,
            },
            {
                userId: "mock-user-7",
                author: "theo.n",
                avatar: "https://i.pravatar.cc/150?img=41",
                challenge: "Eat in silence, no phone",
                content: "Ate breakfast with zero distractions. Actually tasted my food. Wild concept.",
                media: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
                reactions: { felt: 45, thought: 29, intrigued: 8 },
                spinCount: 720,
            },
            {
                userId: "mock-user-8",
                author: "mia.sol",
                avatar: "https://i.pravatar.cc/150?img=47",
                challenge: "Photograph something broken",
                content: "Found a cracked pavement tile that looked like a map of somewhere I've never been. The break was more interesting than what surrounded it.",
                media: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
                reactions: { felt: 58, thought: 62, intrigued: 33 },
                spinCount: 945,
            },
        ];

        await supabase.from('posts').insert(FAKES);
        console.log(`Seeded ${FAKES.length} mock posts.`);
    },

    // Subscribe to Kept Challenges
    subscribeToKeptChallenges(userId: string, callback: (kept: any[]) => void) {
        const fetchKept = async () => {
            const { data } = await supabase
                .from('kept_challenges')
                .select('*')
                .eq('userId', userId)
                .order('created_at', { ascending: false });
            if (data) callback(data);
        };

        fetchKept();

        const channel = supabase
            .channel(`kept:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'kept_challenges', filter: `userId=eq.${userId}` },
                () => fetchKept()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },

    // Toggle Keep Challenge
    async toggleKeptChallenge(userId: string, postId: string, challenge: string) {
        const { data: existing } = await supabase
            .from('kept_challenges')
            .select('*')
            .eq('userId', userId)
            .eq('postId', postId)
            .single();

        if (existing) {
            await supabase.from('kept_challenges').delete().eq('id', existing.id);
            return false;
        } else {
            await supabase.from('kept_challenges').insert({ userId, postId, challenge });
            return true;
        }
    },

    // Record Sent/Spind Challenge
    async recordSpindChallenge(userId: string, postId: string, challenge: string) {
        await supabase
            .from('spind_challenges')
            .upsert({ userId, postId, challenge }, { onConflict: 'userId,postId' });
    },

    // Subscribe to Spind Challenges
    subscribeToSpindChallenges(userId: string, callback: (spind: any[]) => void) {
        const fetchSpind = async () => {
            const { data } = await supabase
                .from('spind_challenges')
                .select('*')
                .eq('userId', userId)
                .order('created_at', { ascending: false });
            if (data) callback(data);
        };

        fetchSpind();

        const channel = supabase
            .channel(`spind:${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'spind_challenges', filter: `userId=eq.${userId}` },
                () => fetchSpind()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
};
