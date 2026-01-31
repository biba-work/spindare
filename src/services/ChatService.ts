import { StreamChat, Channel as StreamChannel, ChannelSort, ChannelFilters, ChannelOptions, Event } from 'stream-chat';
import { auth } from './firebaseConfig';

// Replace with your Stream Chat API key from https://dashboard.getstream.io
const STREAM_API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY || 'YOUR_STREAM_API_KEY';

// Initialize Stream Chat client
export const chatClient = StreamChat.getInstance(STREAM_API_KEY);

export interface ChatUser {
    id: string;
    name: string;
    image?: string;
}

export const ChatService = {
    // Connect current Firebase user to Stream Chat
    async connectUser(userId: string, username: string, avatar?: string): Promise<void> {
        if (!chatClient.userID) {
            try {
                // Use test token from environment (for development)
                const testToken = process.env.EXPO_PUBLIC_STREAM_TEST_TOKEN;
                const testUserId = process.env.EXPO_PUBLIC_STREAM_TEST_USER_ID;

                // If we have a test token, we use the hardcoded test user ID
                // otherwise we use the actual Firebase userId with a dev token
                const activeId = testToken ? (testUserId || 'falling-poetry-1') : userId;
                const token = testToken || chatClient.devToken(activeId);

                await chatClient.connectUser(
                    {
                        id: activeId,
                        name: username,
                        image: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
                    },
                    token
                );
                console.log('Stream Chat connected for user:', username, 'as', activeId);
            } catch (error) {
                console.log('Stream Chat connection skipped:', error);
            }
        }
    },

    // Disconnect user from Stream Chat
    async disconnectUser(): Promise<void> {
        if (chatClient.userID) {
            await chatClient.disconnectUser();
            console.log('Stream Chat disconnected');
        }
    },

    // Create or get a direct message channel between two users
    async getOrCreateDMChannel(currentUserId: string, otherUserId: string, otherUsername: string, otherUserAvatar?: string): Promise<StreamChannel> {
        const activeUserId = chatClient.userID || currentUserId;

        // 1. Ensure the other user exists. 
        // We'll try to upsert them using the current authenticated client.
        try {
            await chatClient.upsertUsers([
                {
                    id: otherUserId,
                    name: otherUsername,
                    image: otherUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUsername)}&background=random`
                }
            ]);
            console.log(`✅ Upserted/Synced user ${otherUserId} to Stream Chat`);
        } catch (e) {
            console.warn('User upsert failed. This happens if client-side creation is disabled in Stream Dashboard.', e);
        }

        const sortedIds = [activeUserId, otherUserId].sort();
        const channelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

        try {
            const channel = chatClient.channel('messaging', channelId, {
                name: otherUsername,
                image: otherUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUsername)}&background=random`,
                members: [activeUserId, otherUserId],
            } as any);

            await channel.watch();
            return channel;
        } catch (e: any) {
            console.error('Channel creation failed:', e);
            throw new Error(`Failed to start chat with ${otherUsername}. Please ensure they have logged in at least once.`);
        }
    },

    // Send a challenge message to a user
    async sendChallengeToUser(recipientId: string, recipientName: string, challenge: string, recipientAvatar?: string): Promise<void> {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Must be logged in to send challenges');

        const channel = await this.getOrCreateDMChannel(currentUser.uid, recipientId, recipientName, recipientAvatar);

        // Send a challenge message
        await channel.sendMessage({
            text: `🎯 Challenge: "${challenge}"`,
        });
    },

    // Get channels for current user
    async getUserChannels(): Promise<StreamChannel[]> {
        const currentUser = auth.currentUser;
        if (!currentUser) return [];

        const filters: ChannelFilters = {
            type: 'messaging',
            members: { $in: [currentUser.uid] },
        };

        const sort: ChannelSort = { last_message_at: -1 };
        const options: ChannelOptions = { state: true, watch: true, presence: true };

        const channels = await chatClient.queryChannels(filters, sort, options);
        return channels;
    },

    // Check if client is connected
    isConnected(): boolean {
        return !!chatClient.userID;
    },

    // Get the chat client instance
    getClient(): StreamChat {
        return chatClient;
    },

    // Send a reaction to a message
    async sendReaction(channel: StreamChannel, messageId: string, reactionType: string): Promise<void> {
        await channel.sendReaction(messageId, {
            type: reactionType,
        });
    },

    // Remove a reaction from a message
    async removeReaction(channel: StreamChannel, messageId: string, reactionType: string): Promise<void> {
        await channel.deleteReaction(messageId, reactionType);
    },

    // Send a reply to a message (threaded)
    async sendReply(channel: StreamChannel, parentMessageId: string, text: string, customFields: Record<string, any> = {}): Promise<any> {
        const response = await channel.sendMessage({
            text,
            parent_id: parentMessageId,
            ...customFields,
        } as any);
        return response.message;
    },

    // Subscribe to new messages on a channel
    subscribeToNewMessages(channel: StreamChannel, callback: (event: Event) => void): { unsubscribe: () => void } {
        const handler = (event: Event) => callback(event);
        channel.on('message.new', handler);
        return {
            unsubscribe: () => channel.off('message.new', handler),
        };
    },
};
