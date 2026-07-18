import { api, API_BASE_URL } from './ApiService';
import { NotificationService } from './NotificationService';
import * as FileSystem from 'expo-file-system/legacy';
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

// Maps a raw API row to the Post interface (createdAt → timestamp)
const mapPost = (row: any): Post => ({ ...row, timestamp: row.createdAt ?? row.created_at });

// Realtime replacement: the old subscribeToFeed/subscribeToUserPosts/etc.
// used Supabase's postgres_changes. The Nest backend has no equivalent
// wired up client-side yet (see src/services/RealtimeClient.ts if you add
// one) — polling here is simpler and correct, just less instant. Swap the
// interval for a socket.io listener later if the lag becomes noticeable.
const POLL_INTERVAL_MS = 8000;

export const PostService = {
    // Upload an image via the Nest storage endpoint (was Supabase Storage).
    async uploadImage(uri: string, deleteSource = false): Promise<string> {
        let convertedUri: string | null = null;
        try {
            const converted = await ImageManipulator.manipulateAsync(
                uri,
                [],
                { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
            );
            convertedUri = converted.uri;

            const base64 = await FileSystem.readAsStringAsync(convertedUri, { encoding: 'base64' });

            const { url } = await api.post<{ url: string }>('/storage/upload', {
                base64,
                contentType: 'image/jpeg',
                folder: 'posts',
            });

            FileSystem.deleteAsync(convertedUri, { idempotent: true }).catch(() => {});
            if (deleteSource) {
                FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }

            return url;
        } catch (error) {
            if (convertedUri) {
                FileSystem.deleteAsync(convertedUri, { idempotent: true }).catch(() => {});
            }
            console.error("Storage Upload Error:", error);
            throw error;
        }
    },

    // Streams a video via a presigned PUT URL — same no-OOM approach as
    // before, just pointed at the Nest /storage/presign endpoint instead of
    // supabase.storage.createSignedUploadUrl().
    async uploadVideo(uri: string, onProgress?: (pct: number) => void): Promise<string> {
        try {
            const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'mp4';
            const mimeMap: Record<string, string> = {
                mp4: 'video/mp4',
                mov: 'video/quicktime',
                avi: 'video/x-msvideo',
                webm: 'video/webm',
                '3gp': 'video/3gpp',
            };
            const contentType = mimeMap[ext] || 'video/mp4';
            const filename = `video_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
                '/storage/presign',
                { filename, contentType, folder: 'posts' }
            );

            const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
                httpMethod: 'PUT',
                headers: { 'Content-Type': contentType },
                uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT ?? 0,
                sessionType: (FileSystem as any).FileSystemSessionType?.BACKGROUND ?? 1,
            });

            if (uploadResult.status < 200 || uploadResult.status >= 300) {
                throw new Error(`Video upload failed (HTTP ${uploadResult.status})`);
            }

            onProgress?.(100);
            return publicUrl;
        } catch (error) {
            console.error("Video Upload Error:", error);
            throw error;
        }
    },

    async createPost(
        userId: string,
        username: string,
        avatar: string,
        challenge: string,
        content: string,
        mediaUri: string | null,
        onUploadProgress?: (pct: number) => void,
        mediaFromCamera = false
    ) {
        if (!userId) throw new Error("Must be logged in to post");

        let finalMediaUrl = mediaUri;
        if (mediaUri && !mediaUri.startsWith('http')) {
            const isVideo = /\.(mp4|mov|avi|webm|3gp)$/i.test(mediaUri);
            finalMediaUrl = isVideo
                ? await this.uploadVideo(mediaUri, onUploadProgress)
                : await this.uploadImage(mediaUri, mediaFromCamera);
        }

        // Spin count and streak update now happen server-side in
        // PostsService.createPost — see server/src/posts/posts.service.ts.
        return mapPost(await api.post('/posts', {
            username,
            avatar,
            challenge,
            content,
            media: finalMediaUrl,
        }));
    },

    // Poll the feed. Returns an unsubscribe function, same signature the
    // callers already expect from the old Realtime-backed version.
    subscribeToFeed(callback: (updater: (prev: Post[]) => Post[]) => void) {
        let cancelled = false;
        const fetchAll = async () => {
            try {
                const data = await api.get<any[]>('/posts');
                if (!cancelled) callback(() => data.map(mapPost));
            } catch (e) {
                console.warn('Feed poll failed:', e);
            }
        };
        fetchAll();
        const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    },

    subscribeToUserPosts(userId: string, callback: (posts: Post[]) => void) {
        let cancelled = false;
        const fetchUserPosts = async () => {
            try {
                const data = await api.get<any[]>(`/posts/user/${userId}`);
                if (!cancelled) callback(data.map(mapPost));
            } catch (e) {
                console.warn('User posts poll failed:', e);
            }
        };
        fetchUserPosts();
        const interval = setInterval(fetchUserPosts, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    },

    async getUserReaction(userId: string, postId: string): Promise<'felt' | 'thought' | 'intrigued' | null> {
        if (!userId || !postId) return null;
        try {
            return await api.get<'felt' | 'thought' | 'intrigued' | null>(`/posts/${postId}/reaction`);
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
            // Notification-on-new-reaction is handled server-side now.
            await api.post(`/posts/${postId}/reaction`, { username: currentUsername, avatar: currentAvatar, type });
        } catch (e) {
            console.error("Error toggling reaction", e);
        }
    },

    async addComment(
        userId: string,
        username: string,
        avatar: string,
        postId: string,
        text: string
    ) {
        if (!userId) throw new Error("Must be logged in");
        // Notification-on-comment is handled server-side now.
        await api.post(`/posts/${postId}/comments`, { username, avatar, text });
    },

    subscribeToComments(postId: string, callback: (comments: any[]) => void) {
        let cancelled = false;
        const fetchComments = async () => {
            try {
                const data = await api.get<any[]>(`/posts/${postId}/comments`);
                if (!cancelled) callback(data);
            } catch (e) {
                console.warn('Comments poll failed:', e);
            }
        };
        fetchComments();
        const interval = setInterval(fetchComments, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    },

    // Seed fake data — DEV ONLY. Never call this in production.
    async seedFakeData() {
        if (!__DEV__) {
            console.warn('seedFakeData() is disabled in production builds.');
            return;
        }

        const FAKES = [
            {
                userId: "mock-user-1", author: "elia.v", avatar: "https://i.pravatar.cc/150?img=1",
                challenge: "Silence Protocol",
                content: "Spent 2 hours in total silence. The city sounds like a different beast when you stop contributing to the noise. Highly recommend.",
                media: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
                reactions: { felt: 24, thought: 12, intrigued: 5 }, spinCount: 1240,
            },
            {
                userId: "mock-user-2", author: "marek.r", avatar: "https://i.pravatar.cc/150?img=5",
                challenge: "Trace a shadow",
                content: "Found the most perfect shadow at 4pm. Traced it with chalk on my apartment floor. By 5pm it was gone. Impermanence, I guess.",
                media: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
                reactions: { felt: 31, thought: 18, intrigued: 9 }, spinCount: 876,
            },
            {
                userId: "mock-user-3", author: "sofi.k", avatar: "https://i.pravatar.cc/150?img=9",
                challenge: "One texture, ten seconds",
                content: "I pressed my palm flat against the bark of an oak for ten full seconds. Felt every ridge. I don't know why this hit me so hard.",
                media: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&q=80",
                reactions: { felt: 67, thought: 14, intrigued: 22 }, spinCount: 2103,
            },
            {
                userId: "mock-user-4", author: "dan.exe", avatar: "https://i.pravatar.cc/150?img=12",
                challenge: "No mirror day",
                content: "Went the whole day without checking how I looked. By lunchtime I stopped caring. By evening I felt weirdly free.",
                media: null, reactions: { felt: 88, thought: 41, intrigued: 17 }, spinCount: 3312,
            },
            {
                userId: "mock-user-5", author: "lena.w", avatar: "https://i.pravatar.cc/150?img=20",
                challenge: "Sky for 60 seconds",
                content: "Lay flat on the pavement outside my building and stared up for exactly 60 seconds. A woman asked if I needed help. We ended up talking for half an hour.",
                media: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                reactions: { felt: 112, thought: 34, intrigued: 56 }, spinCount: 4018,
            },
            {
                userId: "mock-user-6", author: "b.ramos", avatar: "https://i.pravatar.cc/150?img=33",
                challenge: "Write a letter you'll never send",
                content: "Wrote three pages. Tore them up. Then wrote three more. The act of writing is different when you know no one else will read it.",
                media: null, reactions: { felt: 99, thought: 77, intrigued: 11 }, spinCount: 1589,
            },
            {
                userId: "mock-user-7", author: "theo.n", avatar: "https://i.pravatar.cc/150?img=41",
                challenge: "Eat in silence, no phone",
                content: "Ate breakfast with zero distractions. Actually tasted my food. Wild concept.",
                media: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
                reactions: { felt: 45, thought: 29, intrigued: 8 }, spinCount: 720,
            },
            {
                userId: "mock-user-8", author: "mia.sol", avatar: "https://i.pravatar.cc/150?img=47",
                challenge: "Photograph something broken",
                content: "Found a cracked pavement tile that looked like a map of somewhere I've never been. The break was more interesting than what surrounded it.",
                media: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
                reactions: { felt: 58, thought: 62, intrigued: 33 }, spinCount: 945,
            },
        ];

        const result = await api.post<{ seeded: number }>('/posts/seed', { posts: FAKES });
        console.log(`Seeded ${result.seeded} mock posts.`);
    },

    // ---- Kept challenges ----

    subscribeToKeptChallenges(userId: string, callback: (kept: any[]) => void) {
        let cancelled = false;
        const fetchKept = async () => {
            try {
                const data = await api.get<any[]>('/challenges/kept');
                if (!cancelled) callback(data);
            } catch (e) {
                console.warn('Kept challenges poll failed:', e);
            }
        };
        fetchKept();
        const interval = setInterval(fetchKept, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    },

    async toggleKeptChallenge(userId: string, postId: string, challenge: string) {
        return api.post<boolean>('/challenges/kept/toggle', { postId, challenge });
    },

    // ---- Spind (sent) challenges ----

    async recordSpindChallenge(userId: string, postId: string, challenge: string) {
        await api.post('/challenges/spind', { postId, challenge });
    },

    subscribeToSpindChallenges(userId: string, callback: (spind: any[]) => void) {
        let cancelled = false;
        const fetchSpind = async () => {
            try {
                const data = await api.get<any[]>('/challenges/spind');
                if (!cancelled) callback(data);
            } catch (e) {
                console.warn('Spind challenges poll failed:', e);
            }
        };
        fetchSpind();
        const interval = setInterval(fetchSpind, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    }
};
