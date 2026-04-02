import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo';
import { useToast } from '../contexts/ToastContext';

export const Show = ({ when, children }: { when: 'signed-in' | 'signed-out', children: React.ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) return null;
  
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  
  return null;
};

export const SignInButton = () => {
  const { signOut } = useAuth();
  const { showToast } = useToast();
  
  const handlePress = () => {
    showToast("Sign in flow started", { type: 'info' });
    console.log("Sign In pressed");
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={handlePress}
    >
      <Text style={styles.buttonText}>Sign In</Text>
    </TouchableOpacity>
  );
};

export const SignUpButton = () => {
  const { showToast } = useToast();

  const handlePress = () => {
    showToast("Sign up flow started", { type: 'info' });
    console.log("Sign Up pressed");
  };

  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={handlePress}
    >
      <Text style={styles.buttonText}>Sign Up</Text>
    </TouchableOpacity>
  );
};

export const UserButton = () => {
  const { user } = useUser();
  const { signOut } = useAuth();

  return (
    <View style={styles.userContainer}>
      <Text style={styles.userName}>{user?.firstName || 'User'}</Text>
      <TouchableOpacity onPress={() => signOut()} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#6C47FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: '#fff',
  },
  signOutButton: {
    padding: 4,
  },
  signOutText: {
    color: '#999',
    fontSize: 12,
  }
});
