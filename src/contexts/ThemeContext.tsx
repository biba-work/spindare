import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeContextType = {
    darkMode: boolean;
    toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
    darkMode: false,
    toggleDarkMode: () => { },
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        loadMode();
    }, []);

    const loadMode = async () => {
        try {
            const storedMode = await AsyncStorage.getItem('darkMode');
            if (storedMode !== null) {
                setDarkMode(storedMode === 'true');
            } else {
                // Default to system preference if nothing stored
                const colorScheme = Appearance.getColorScheme();
                // setDarkMode(colorScheme === 'dark'); // Optional: respect system
            }
        } catch (e) {
            console.error('Failed to load theme mode', e);
        }
    };

    const toggleDarkMode = async () => {
        try {
            const newMode = !darkMode;
            setDarkMode(newMode);
            await AsyncStorage.setItem('darkMode', newMode.toString());
        } catch (e) {
            console.error('Failed to save theme mode', e);
        }
    };

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
