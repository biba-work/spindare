import { db, auth } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

export interface ChatUser {
    _id: string;
    name: string;
    avatar: string;
}

export const ChatService = {
    async sendMessage(otherUser: ChatUser, text: string) {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Must be logged in");

        const myProfile = {
            _id: currentUser.uid,
            name: currentUser.displayName || 'User',
            avatar: currentUser.photoURL || ''
        };

        const conversationId = [currentUser.uid, otherUser._id].sort().join('_');

        // 1. Add to messages sub-collection
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        await addDoc(messagesRef, {
            text,
            createdAt: serverTimestamp(),
            user: myProfile,
        });

        // 2. Update conversation metadata
        const conversationRef = doc(db, 'conversations', conversationId);
        await setDoc(conversationRef, {
            participants: [currentUser.uid, otherUser._id],
            lastMessage: text,
            lastMessageTimestamp: serverTimestamp(),
            users: {
                [currentUser.uid]: myProfile,
                [otherUser._id]: otherUser
            }
        }, { merge: true });
    }
};
