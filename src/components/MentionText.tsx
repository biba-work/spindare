/**
 * MentionText Component
 * Renders text with clickable mentions
 * Automatically detects and linkifies @mentions
 */

import React from 'react';
import {
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  TextProps,
} from 'react-native';
import { segmentText, ParsedMention } from '../utils/mentionParser';

interface MentionTextProps extends TextProps {
  text: string;
  mentionColor?: string;
  mentionFontWeight?: 'bold' | 'normal' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  onMentionPress?: (mention: ParsedMention) => void;
  allowNavigation?: boolean;
}

const styles = StyleSheet.create({
  mention: {
    color: '#0066cc',
    fontWeight: '600',
  },
});

/**
 * MentionText Component
 * Renders text segments, making mentions clickable
 * 
 * @example
 * <MentionText 
 *   text="Check out @spindare.app on Instagram!" 
 *   mentionColor="#007AFF"
 *   onMentionPress={(mention) => console.log(mention.handle)}
 * />
 */
export const MentionText: React.FC<MentionTextProps> = ({
  text,
  mentionColor = '#0066cc',
  mentionFontWeight = '600',
  onMentionPress,
  allowNavigation = true,
  style,
  ...props
}) => {
  const segments = segmentText(text);

  const handleMentionPress = async (mention: ParsedMention) => {
    // Call custom handler if provided
    if (onMentionPress) {
      onMentionPress(mention);
    }

    // Navigate to URL if allowed
    if (allowNavigation && mention.url) {
      try {
        const canOpen = await Linking.canOpenURL(mention.url);
        if (canOpen) {
          await Linking.openURL(mention.url);
        }
      } catch (error) {
        console.error('Error opening mention URL:', error);
      }
    }
  };

  return (
    <Text style={style} {...props}>
      {segments.map((segment, index) => {
        if (segment.isMention && segment.mention) {
          return (
            <TouchableOpacity
              key={`mention-${index}`}
              onPress={() => handleMentionPress(segment.mention!)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mention,
                  {
                    color: mentionColor,
                    fontWeight: mentionFontWeight,
                  },
                ]}
              >
                {segment.text}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <Text key={`text-${index}`} style={style} {...props}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
};

export default MentionText;
