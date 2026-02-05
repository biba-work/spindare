import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainFeedScreen } from '../screens/MainFeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { FriendsListScreen } from '../screens/FriendsListScreen';
import { UserProfileView } from '../screens/UserProfileView';
import { PostCreationScreen } from '../screens/PostCreationScreen';
import { UserProfile } from '../services/AIService';

export type RootStackParamList = {
    MainFeed: undefined;
    Profile: {
        userProfile: UserProfile;
        spinsLeft: number;
        activeChallenge: string | null;
        onUpdateProfile: (updates: Partial<UserProfile>) => void;
        setSpinsLeft: (count: number) => void;
        onChallengeReceived: (challenge: string | null) => void;
        onShare: (text: string) => void;
        onOpenCamera: () => void;
        onLogout: () => void;
    };
    Messages: {
        onOpenChat: (user: any) => void;
    };
    Chat: {
        currentUser: any;
        otherUser: any;
    };
    FriendsList: {
        challenge: string;
    };
    UserProfile: {
        userId: string;
        username: string;
        avatar: string;
        onStartChat: (user: any) => void;
    };
    PostCreation: {
        challenge: string;
        imageUri: string | null;
        onPost: (data: any) => void;
    };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const ProfileWrapper = ({ navigation, route }: any) => {
    const params = route.params;
    return <ProfileScreen {...params} onBack={() => navigation.goBack()} />;
};

const MessagesWrapper = ({ navigation, route }: any) => {
    return <MessagesScreen {...route.params} onBack={() => navigation.goBack()} />;
};

const FriendsListWrapper = ({ navigation, route }: any) => {
    return <FriendsListScreen {...route.params} onBack={() => navigation.goBack()} />;
};

const PostCreationWrapper = ({ navigation, route }: any) => {
    return <PostCreationScreen {...route.params} onClose={() => navigation.goBack()} />;
};

const ChatWrapper = ({ navigation, route }: any) => {
    return <ChatScreen {...route.params} onBack={() => navigation.goBack()} />;
};

const UserProfileWrapper = ({ navigation, route }: any) => {
    return <UserProfileView {...route.params} onBack={() => navigation.goBack()} />;
};

export const AppNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="MainFeed" component={MainFeedScreen} />
            <Stack.Group screenOptions={{ presentation: 'modal' }}>
                <Stack.Screen name="Profile" component={ProfileWrapper} />
                <Stack.Screen name="Messages" component={MessagesWrapper} />
                <Stack.Screen name="FriendsList" component={FriendsListWrapper} />
                <Stack.Screen name="PostCreation" component={PostCreationWrapper} options={{ animation: 'slide_from_bottom', presentation: 'transparentModal' }} />
            </Stack.Group>
            <Stack.Screen name="Chat" component={ChatWrapper} />
            <Stack.Screen name="UserProfile" component={UserProfileWrapper} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
    );
};
