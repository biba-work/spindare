import { StreamChat } from 'stream-chat';
import { supabase } from './supabaseConfig';

const STREAM_KEY = process.env.EXPO_PUBLIC_STREAM_KEY || "";
const TOKEN_SERVER_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-stream-token`;

// Stream Chat client singleton
const client = StreamChat.getInstance(STREAM_KEY);

export interface Message {
    _id: string;
    text: string;
    createdAt: Date;
    user: {
        _id: string;
        name: string;
        avatar?: string;
    };
    image?: string;
}

export interface Conversation {
    id: string;
    otherUserId: string;
    otherUsername: string;
    otherAvatar: string;
    lastMessage: string;
    lastMessageAt: string;
}

export const ChatService = {

    /**
     * Connects the current user to the Stream Chat client.
     * Fetches a server-side generated token from a Supabase Edge Function.
     */
    async connectUser(userId: string, username: string, avatar?: string): Promise<void> {
        if (client.userID) return; // Already connected

        try {
            // Fetch token from our new Edge Function
            const res = await fetch(TOKEN_SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
                },
                body: JSON.stringify({ userId }),
            });

            if (!res.ok) throw new Error(`Token server error: ${res.status}`);
            const { token } = await res.json();

            await client.connectUser(
                {
                    id: userId,
                    name: username,
                    image: avatar,
                },
                token
            );
        } catch (error) {
            console.error("[ChatService] Failed to connect user:", error);
            throw error;
        }
    },

    async disconnectUser(): Promise<void> {
        await client.disconnectUser();
    },

    // Get or create a conversation between two users
    async getOrCreateConversation(
        currentUserId: string,
        otherUserId: string
    ): Promise<string> {
        // Stream uses 'messaging' channel type by default
        const channel = client.channel('messaging', {
            members: [currentUserId, otherUserId],
        });
        
        await channel.create();
        return channel.id!;
    },

    // Send a challenge as a DM
    async sendChallengeToUser(
        currentUserId: string,
        recipientId: string,
        _recipientName: string, // Kept for compatibility with old API call
        challenge: string,
        _recipientAvatar?: string // Kept for compatibility
    ): Promise<void> {
        if (!client.userID) throw new Error('Must be connected to Stream Chat');

        const channel = client.channel('messaging', {
            members: [currentUserId, recipientId],
        });

        await channel.sendMessage({
            text: `🎯 Challenge: "${challenge}"`,
        });
    },

    // Fetch all conversations for a user
    subscribeToConversations(
        currentUserId: string,
        callback: (convos: Conversation[]) => void
    ) {
        const fetchConvos = async () => {
            const filter = { members: { $in: [currentUserId] } };
            const sort = [{ last_message_at: -1 }];
            
            const channels = await client.queryChannels(filter, sort as any, {
                watch: true,
                state: true,
            });

            const convos: Conversation[] = channels.map((channel: any) => {
                const otherMember: any = Object.values(channel.state.members).find(
                    (m: any) => m.user?.id !== currentUserId
                );
                
                return {
                    id: channel.id!,
                    otherUserId: otherMember?.user?.id || 'unknown',
                    otherUsername: otherMember?.user?.name || 'User',
                    otherAvatar: otherMember?.user?.image || '',
                    lastMessage: channel.state.messages[channel.state.messages.length - 1]?.text || '',
                    lastMessageAt: channel.state.last_message_at?.toISOString() || new Date().toISOString(),
                };
            });

            callback(convos);
        };

        fetchConvos();

        // Stream handles real-time updates via internal listeners when watch: true is used
        const listener = client.on((event: any) => {
            if (event.type === 'message.new' || event.type === 'notification.added_to_channel') {
                fetchConvos();
            }
        });

        return () => {
            listener.unsubscribe();
        };
    },

    // Subscribe to messages in a conversation
    subscribeToMessages(
        conversationId: string,
        callback: (messages: Message[]) => void
    ) {
        const channel = client.channel('messaging', conversationId);

        const fetchMessages = async () => {
            await channel.watch();
            const streamMessages = channel.state.messages;
            
            const messages: Message[] = streamMessages.map((m: any) => ({
                _id: m.id,
                text: m.text || '',
                createdAt: new Date(m.created_at),
                image: (m.attachments?.[0]?.type === 'image' ? m.attachments[0].image_url : undefined),
                user: {
                    _id: m.user?.id || 'unknown',
                    name: m.user?.name || 'User',
                    avatar: m.user?.image || undefined,
                },
            }));

            callback(messages.reverse()); // latest first for display
        };

        fetchMessages();

        const listener = channel.on('message.new', () => fetchMessages());

        return () => {
            listener.unsubscribe();
        };
    },

    // Send a message
    async sendMessage(
        conversationId: string,
        _senderId: string, // Stream uses the connected user context
        text: string,
        image?: string
    ) {
        const channel = client.channel('messaging', conversationId);
        
        await channel.sendMessage({
            text,
            attachments: image ? [{ type: 'image', image_url: image }] : [],
        });
    },

    isConnected(): boolean {
        return !!client.userID;
    },
};
