/**
 * MentionInput Component
 * Text input that auto-detects mentions and shows suggestions
 * Features: autocomplete, mention highlighting, real-time detection
 */

import React, { useState, useCallback } from 'react';
import {
  TextInput,
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInputProps,
  Dimensions,
} from 'react-native';
import { parseMentions, ParsedMention } from '../utils/mentionParser';

interface Suggestion {
  id: string;
  handle: string;
  username: string;
  avatar?: string;
  type: 'user' | 'app' | 'verified';
}

interface MentionInputProps extends TextInputProps {
  onMentionDetected?: (mentions: ParsedMention[]) => void;
  suggestions?: Suggestion[];
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  autocompletePlaceholders?: string[];
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 40,
  },
  suggestionsContainer: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionHandle: {
    fontWeight: '600',
    color: '#000',
  },
  suggestionUsername: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  mentionBadge: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  mentionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { id: '1', handle: 'spindare.app', username: 'Spindare App', type: 'verified' },
  { id: '2', handle: 'instagram', username: 'Instagram', type: 'verified' },
  { id: '3', handle: 'github', username: 'GitHub', type: 'verified' },
];

/**
 * MentionInput Component
 * Smart text input for mentioning users/apps anywhere
 * 
 * @example
 * <MentionInput
 *   placeholder="Type @spindare.app to mention..."
 *   onMentionDetected={(mentions) => console.log('Mentions found:', mentions)}
 * />
 */
export const MentionInput = React.forwardRef<TextInput, MentionInputProps>(
  (
    {
      onMentionDetected,
      suggestions = DEFAULT_SUGGESTIONS,
      onSuggestionSelect,
      autocompletePlaceholders = ['@spindare.app', '@instagram', '@github'],
      value = '',
      onChangeText,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState(value as string);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>(
      []
    );
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);

    const handleTextChange = useCallback(
      (text: string) => {
        setInputValue(text);

        // Call parent onChangeText if provided
        if (onChangeText) {
          onChangeText(text);
        }

        // Detect mentions
        const mentions = parseMentions(text);
        if (onMentionDetected) {
          onMentionDetected(mentions);
        }

        // Auto-complete logic
        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex !== -1) {
          const afterAt = text.substring(lastAtIndex + 1);

          // If user just typed @, show all suggestions
          if (afterAt === '' || afterAt.match(/^[\w.-]*$/)) {
            setMentionStartIndex(lastAtIndex);
            const filtered = suggestions.filter((s) =>
              s.handle.toLowerCase().includes(afterAt.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
          } else {
            setShowSuggestions(false);
          }
        } else {
          setShowSuggestions(false);
          setMentionStartIndex(-1);
        }
      },
      [onChangeText, onMentionDetected, suggestions]
    );

    const handleSuggestionPress = (suggestion: Suggestion) => {
      const beforeMention = inputValue.substring(0, mentionStartIndex);
      const afterMention = inputValue.substring(
        inputValue.lastIndexOf('@') + 1 + inputValue.substring(inputValue.lastIndexOf('@') + 1).length
      );

      const newText = `${beforeMention}@${suggestion.handle} ${afterMention}`.trim() + ' ';
      handleTextChange(newText);

      if (onSuggestionSelect) {
        onSuggestionSelect(suggestion);
      }

      setShowSuggestions(false);
    };

    const mentionCount = parseMentions(inputValue).length;

    return (
      <View style={styles.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            ref={ref}
            style={[styles.input, { flex: 1 }, props.style]}
            value={inputValue}
            onChangeText={handleTextChange}
            placeholder="Type @spindare.app or any mention..."
            placeholderTextColor="#999"
            {...props}
          />
          {mentionCount > 0 && (
            <View style={styles.mentionBadge}>
              <Text style={styles.mentionBadgeText}>{mentionCount}</Text>
            </View>
          )}
        </View>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={filteredSuggestions}
              keyExtractor={(item) => item.id}
              scrollEnabled={filteredSuggestions.length > 3}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionPress(item)}
                >
                  {item.type === 'verified' && (
                    <View style={styles.mentionBadge}>
                      <Text style={styles.mentionBadgeText}>✓</Text>
                    </View>
                  )}
                  <Text style={styles.suggestionHandle}>@{item.handle}</Text>
                  <Text style={styles.suggestionUsername}>{item.username}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    );
  }
);

MentionInput.displayName = 'MentionInput';

export default MentionInput;
