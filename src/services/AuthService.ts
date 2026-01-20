import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from './AIService';

const STORAGE_KEY = 'spindare_auth_session';

export const AuthService = {
    async getSession(): Promise<{ isAuthenticated: boolean; userProfile: UserProfile | null }> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                const session = JSON.parse(data);
                return { isAuthenticated: true, userProfile: session.userProfile };
            }
        } catch (error) {
            console.error('Error fetching session', error);
        }
        return { isAuthenticated: false, userProfile: null };
    },

    async login(userProfile: UserProfile) {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ userProfile }));
        } catch (error) {
            console.error('Error saving session', error);
        }
    },

    async logout() {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Error removing session', error);
        }
    }
};
