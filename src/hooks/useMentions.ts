/**
 * useMentions Hook
 * React hook for managing mentions in your app
 * Handles detection, storage, and analytics
 */

import { useState, useCallback, useEffect } from 'react';
import {
  parseMentions,
  ParsedMention,
  extractHandles,
} from '../utils/mentionParser';

interface MentionStats {
  total: number;
  byType: {
    user: number;
    app: number;
    domain: number;
  };
  handles: string[];
  mostMentioned?: string;
}

interface UseMentionsOptions {
  trackAnalytics?: boolean;
  storeMentions?: boolean;
  onMentionAdded?: (mention: ParsedMention) => void;
  onMentionRemoved?: (handle: string) => void;
}

/**
 * Hook for managing mentions
 * @param initialText - Initial text to parse
 * @param options - Configuration options
 * @returns Mention utilities and state
 * 
 * @example
 * const { mentions, stats, setText } = useMentions("Check @spindare.app", {
 *   trackAnalytics: true,
 * });
 */
export const useMentions = (
  initialText = '',
  options: UseMentionsOptions = {}
) => {
  const {
    trackAnalytics = false,
    storeMentions = false,
    onMentionAdded,
    onMentionRemoved,
  } = options;

  const [text, setText] = useState(initialText);
  const [mentions, setMentions] = useState<ParsedMention[]>([]);
  const [stats, setStats] = useState<MentionStats>({
    total: 0,
    byType: { user: 0, app: 0, domain: 0 },
    handles: [],
  });
  const [previousMentions, setPreviousMentions] = useState<ParsedMention[]>([]);

  // Parse mentions whenever text changes
  useEffect(() => {
    const newMentions = parseMentions(text);
    setMentions(newMentions);

    // Calculate stats
    const stats: MentionStats = {
      total: newMentions.length,
      byType: {
        user: newMentions.filter((m) => m.type === 'user').length,
        app: newMentions.filter((m) => m.type === 'app').length,
        domain: newMentions.filter((m) => m.type === 'domain').length,
      },
      handles: extractHandles(text),
    };

    // Find most mentioned handle
    if (stats.handles.length > 0) {
      const handleCounts = stats.handles.reduce(
        (acc, handle) => {
          acc[handle] = (acc[handle] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      stats.mostMentioned = Object.entries(handleCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
    }

    setStats(stats);

    // Track analytics
    if (trackAnalytics) {
      console.log('[Mentions Analytics]', stats);
    }

    // Call callbacks for added/removed mentions
    if (onMentionAdded || onMentionRemoved) {
      const addedMentions = newMentions.filter(
        (m) =>
          !previousMentions.some(
            (pm) => pm.handle === m.handle && pm.startIndex === m.startIndex
          )
      );
      const removedMentions = previousMentions.filter(
        (m) =>
          !newMentions.some(
            (nm) => nm.handle === m.handle && nm.startIndex === m.startIndex
          )
      );

      addedMentions.forEach((mention) => {
        if (onMentionAdded) onMentionAdded(mention);
      });
      removedMentions.forEach((mention) => {
        if (onMentionRemoved) onMentionRemoved(mention.handle);
      });
    }

    setPreviousMentions(newMentions);

    // Store mentions if enabled
    if (storeMentions && newMentions.length > 0) {
      // This would typically save to AsyncStorage or a database
      console.log('[Stored Mentions]', newMentions);
    }
  }, [text, trackAnalytics, storeMentions, onMentionAdded, onMentionRemoved, previousMentions]);

  const addMention = useCallback(
    (handle: string) => {
      if (!text.includes(`@${handle}`)) {
        setText(`${text} @${handle}`.trim());
      }
    },
    [text]
  );

  const removeMention = useCallback(
    (handle: string) => {
      const newText = text.replace(new RegExp(`@${handle}\\b\\s?`, 'g'), '').trim();
      setText(newText);
    },
    [text]
  );

  const clearMentions = useCallback(() => {
    // Remove all mentions while keeping other text
    let newText = text;
    mentions.forEach((mention) => {
      newText = newText.replace(mention.text, '').trim();
    });
    setText(newText);
  }, [text, mentions]);

  const getMentionAt = useCallback(
    (index: number): ParsedMention | undefined => {
      return mentions.find(
        (m) => index >= m.startIndex && index <= m.endIndex
      );
    },
    [mentions]
  );

  const hasMention = useCallback(
    (handle: string): boolean => {
      return mentions.some((m) => m.handle === handle);
    },
    [mentions]
  );

  return {
    text,
    setText,
    mentions,
    stats,
    addMention,
    removeMention,
    clearMentions,
    getMentionAt,
    hasMention,
  };
};

export default useMentions;
