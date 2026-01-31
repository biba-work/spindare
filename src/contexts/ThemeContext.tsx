import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
    darkMode: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    darkMode: false,
    toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemScheme = useColorScheme();
    const [darkMode, setDarkMode] = useState(false); // Default to false initially
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('user_theme_preference');
                if (savedTheme !== null) {
                    setDarkMode(savedTheme === 'dark');
                } else {
                    setDarkMode(systemScheme === 'dark');
                }
            } catch (error) {
                console.error("Failed to load theme preference", error);
                setDarkMode(systemScheme === 'dark');
            } finally {
                setIsLoaded(true);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = () => {
        setDarkMode((prev) => {
            const newMode = !prev;
            AsyncStorage.setItem('user_theme_preference', newMode ? 'dark' : 'light')
                .catch(e => console.error("Failed to save theme preference", e));
            return newMode;
        });
    };

    // Prevent rendering children until theme is loaded to avoid flash
    if (!isLoaded) return null;

    return (
        <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
