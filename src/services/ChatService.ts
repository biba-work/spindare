import { supabase } from './supabaseConfig';

// Message shape matching react-native-gifted-chat's IMessage
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

// Generate a stable, sorted conversation ID for two users
const makeConversationId = (userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('__');
};

export const ChatService = {

    // Get or create a conversation between two users
    async getOrCreateConversation(
        currentUserId: string,
        otherUserId: string
    ): Promise<string> {
        const convoId = makeConversationId(currentUserId, otherUserId);

        const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', convoId)
            .single();

        if (!existing) {
            await supabase.from('conversations').insert({
                id: convoId,
                user1: currentUserId,
                user2: otherUserId,
            });
        }

        return convoId;
    },

    // Send a challenge as a DM
    async sendChallengeToUser(
        currentUserId: string,
        recipientId: string,
        recipientName: string,
        challenge: string,
        recipientAvatar?: string
    ): Promise<void> {
        if (!currentUserId) throw new Error('Must be logged in to send challenges');

        const convoId = await this.getOrCreateConversation(currentUserId, recipientId);

        await this.sendMessage(
            convoId,
            currentUserId,
            `🎯 Challenge: "${challenge}"`
        );
    },

    // Fetch all conversations for a user
    subscribeToConversations(
        currentUserId: string,
        callback: (convos: Conversation[]) => void
    ) {
        const fetchConvos = async () => {
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`user1.eq.${currentUserId},user2.eq.${currentUserId}`)
                .order('last_message_at', { ascending: false });

            if (error || !data) { callback([]); return; }

            // Resolve profiles for the "other" person
            const otherIds = data.map(c =>
                c.user1 === currentUserId ? c.user2 : c.user1
            );

            if (otherIds.length === 0) { callback([]); return; }

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, "photoURL"')
                .in('id', otherIds);

            const profileMap: Record<string, any> = {};
            (profiles || []).forEach((p: any) => {
                profileMap[p.id] = p;
            });

            const convos: Conversation[] = data.map(c => {
                const otherId = c.user1 === currentUserId ? c.user2 : c.user1;
                const profile = profileMap[otherId];
                return {
                    id: c.id,
                    otherUserId: otherId,
                    otherUsername: profile?.username || 'User',
                    otherAvatar: profile?.photoURL || '',
                    lastMessage: c.last_message || '',
                    lastMessageAt: c.last_message_at,
                };
            });

            callback(convos);
        };

        fetchConvos();

        const channel = supabase
            .channel(`convos:${currentUserId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations' },
                () => fetchConvos()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    // Subscribe to messages in a conversation (returns gifted-chat-shaped messages)
    subscribeToMessages(
        conversationId: string,
        callback: (messages: Message[]) => void
    ) {
        const fetchMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!data) { callback([]); return; }

            const senderIds = [...new Set(data.map(m => m.sender_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, "photoURL"')
                .in('id', senderIds);

            const profileMap: Record<string, any> = {};
            (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

            const messages: Message[] = data.map(m => ({
                _id: m.id,
                text: m.text,
                createdAt: new Date(m.created_at),
                image: m.image || undefined,
                user: {
                    _id: m.sender_id,
                    name: profileMap[m.sender_id]?.username || 'User',
                    avatar: profileMap[m.sender_id]?.photoURL || undefined,
                },
            }));

            callback(messages);
        };

        fetchMessages();

        const channel = supabase
            .channel(`msgs:${conversationId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                () => fetchMessages()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    // Send a message
    async sendMessage(
        conversationId: string,
        senderId: string,
        text: string,
        image?: string
    ) {
        const { error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: senderId,
                text,
                image: image || null,
            });

        if (error) throw error;

        // Update conversation preview
        await supabase
            .from('conversations')
            .update({
                last_message: text || '📷 Photo',
                last_message_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
    },

    // Helpers to match old API shape used elsewhere
    isConnected(): boolean { return true; },
    async connectUser() { },
    async disconnectUser() { },
};
