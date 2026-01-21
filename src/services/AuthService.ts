import { auth, db } from './firebaseConfig';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { UserProfile } from './AIService';

export const AuthService = {
    // Check if user is logged in and return their profile from Firestore
    async getSession(): Promise<{ isAuthenticated: boolean; userProfile: UserProfile | null }> {
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                unsubscribe();
                if (user) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        if (userDoc.exists()) {
                            resolve({
                                isAuthenticated: true,
                                userProfile: userDoc.data() as UserProfile
                            });
                        } else {
                            // User exists in Auth but not Firestore? 
                            // This shouldn't happen with our sign-up flow but handle it
                            resolve({ isAuthenticated: true, userProfile: null });
                        }
                    } catch (error) {
                        console.error('Error fetching user profile:', error);
                        resolve({ isAuthenticated: false, userProfile: null });
                    }
                } else {
                    resolve({ isAuthenticated: false, userProfile: null });
                }
            });
        });
    },

    // Sign up new user and create Firestore record
    async signUp(email: string, pass: string, profile: Omit<UserProfile, 'xp' | 'level'>): Promise<UserProfile> {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const fullProfile: UserProfile = {
                ...profile,
                xp: 0,
                level: 1,
            };

            // Save onboarding info to Firestore
            await setDoc(doc(db, 'users', user.uid), fullProfile);

            return fullProfile;
        } catch (error: any) {
            console.error('Signup Error:', error.message);
            throw error;
        }
    },

    // Existing login
    async login(email: string, pass: string): Promise<UserProfile> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                return userDoc.data() as UserProfile;
            } else {
                throw new Error('User profile not found');
            }
        } catch (error: any) {
            console.error('Login Error:', error.message);
            throw error;
        }
    },

    // Update level/XP in Firestore
    async updateProgress(xp: number, level: number) {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), { xp, level });
        }
    },

    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
};
