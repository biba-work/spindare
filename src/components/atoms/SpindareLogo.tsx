import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SpindareLogoProps {
    size?: number;
    color?: string;
    darkMode?: boolean;
}

export const SpindareLogo = ({
    size = 100,
    color,
    darkMode = false
}: SpindareLogoProps) => {
    const iconColor = color || (darkMode ? '#FFFFFF' : '#1C1C1E');

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
                {/* 
                    Minimal Geometric 'S' 
                    Constructed from two balanced arcs that imply infinite motion.
                    Top Arc (Right to Left) -> Crossing -> Bottom Arc (Left to Right)
                */}
                <Path d="M 75 25 C 40 25, 30 50, 50 50 S 60 75, 25 75" />

                {/* 
                    Directional Arrow at the end (Bottom Left)
                    Completes the notion of "Spin/Action"
                */}
                <Path d="M 25 60 V 75 H 40" strokeWidth="10" />
            </Svg>
        </View>
    );
};
