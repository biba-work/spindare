import { auth, db } from './firebaseConfig';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User,
    GoogleAuthProvider,
    OAuthProvider
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    collection,
    where,
    getDocs
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
        console.log('AuthService.signUp received:', { email, pass, profile });
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const fullProfile: UserProfile = {
                ...profile,
                xp: 0,
                level: 1,
                spinsLeft: 2,
                lastSpinTimestamp: 0,
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

    async signInWithGoogle(): Promise<UserProfile> {
        try {
            // Import dynamically to avoid issues if module isn't installed
            const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');
            const { signInWithCredential, GoogleAuthProvider: FirebaseGoogleAuthProvider } = await import('firebase/auth');

            // Configure Google Sign-In (only needs to be done once, but safe to call multiple times)
            GoogleSignin.configure({
                // Web client ID from your google-services.json (client_type: 3)
                webClientId: '571702461891-1eu4tqotmi0dr8f6udq555bcp6cmb3n6.apps.googleusercontent.com',
            });

            // Check if user is already signed in
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Trigger Google Sign-In
            const signInResult = await GoogleSignin.signIn();

            // Get the ID token
            const idToken = signInResult.data?.idToken;
            if (!idToken) {
                throw new Error('No ID token received from Google');
            }

            // Create Firebase credential with Google ID token
            const googleCredential = FirebaseGoogleAuthProvider.credential(idToken);

            // Sign in to Firebase with the Google credential
            const userCredential = await signInWithCredential(auth, googleCredential);
            const user = userCredential.user;

            // Handle the rest (check if profile exists, create if not)
            return await this._handleSocialLogin(user);
        } catch (error: any) {
            console.error('Google Sign-In Error:', error);

            // Handle specific error codes
            const { statusCodes } = await import('@react-native-google-signin/google-signin').catch(() => ({ statusCodes: {} }));

            if (error.code === statusCodes?.SIGN_IN_CANCELLED) {
                throw new Error('Sign in was cancelled');
            } else if (error.code === statusCodes?.IN_PROGRESS) {
                throw new Error('Sign in is already in progress');
            } else if (error.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
                throw new Error('Play Services not available');
            }

            throw error;
        }
    },

    async signInWithApple(): Promise<UserProfile> {
        console.warn('Apple Sign-in triggered. Full implementation requires native configuration.');
        throw new Error('Apple Sign-in not fully configured for native. Use Email login for testing.');
    },

    async _handleSocialLogin(user: User): Promise<UserProfile> {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            return userDoc.data() as UserProfile;
        } else {
            // New social user, create a minimal profile
            const profile: UserProfile = {
                username: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                studyFields: [],
                hobbies: [],
                xp: 0,
                level: 1,
                spinsLeft: 2,
                lastSpinTimestamp: 0,
            };
            await setDoc(doc(db, 'users', user.uid), profile);
            return profile;
        }
    },

    // Update level/XP in Firestore
    async updateProgress(xp: number, level: number) {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), { xp, level });
        }
    },

    async updateSpinnerState(spinsLeft: number, lastSpinTimestamp: number) {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), { spinsLeft, lastSpinTimestamp });
        }
    },

    async updateProfilePicture(photoURL: string) {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), { photoURL });
        }
    },

    async updateUsername(username: string) {
        const user = auth.currentUser;
        if (user) {
            // 1. Update User Profile
            await updateDoc(doc(db, 'users', user.uid), { username });

            // 2. Update all past posts by this user to reflect new username
            // Note: In a production app with millions of posts, this would be a Cloud Function.
            // For now, doing it client-side is fine for our scale.
            try {
                const postsQuery = query(collection(db, 'posts'), where("userId", "==", user.uid));
                const postsSnap = await getDocs(postsQuery);

                const updatePromises = postsSnap.docs.map(postDoc =>
                    updateDoc(doc(db, 'posts', postDoc.id), { author: username })
                );

                await Promise.all(updatePromises);
            } catch (error) {
                console.error("Error updating posts with new username:", error);
                // We don't throw here to avoid failing the profile update if post update fails
            }
        }
    },

    // Reactive session listener
    onSessionChange(callback: (user: User | null, profile: UserProfile | null) => void) {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        callback(user, userDoc.data() as UserProfile);
                    } else {
                        callback(user, null);
                    }
                } catch (error) {
                    console.error('Error fetching user profile in listener:', error);
                    callback(user, null);
                }
            } else {
                callback(null, null);
            }
        });
    },

    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
};
