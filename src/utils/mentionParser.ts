/**
 * Mention Parser Utility
 * Detects and parses @mentions anywhere in text
 * Supports @username, @handle.app, and @domain.com formats
 */

export interface ParsedMention {
  text: string;
  handle: string;
  startIndex: number;
  endIndex: number;
  type: 'user' | 'app' | 'domain';
  url?: string;
}

export interface ParsedTextSegment {
  text: string;
  isMention: boolean;
  mention?: ParsedMention;
}

/**
 * Regex pattern to match mentions:
 * - @username (alphanumeric, underscore, hyphen)
 * - @handle.app (with domain)
 * - @domain.com
 * Starts with @ and can contain dots, underscores, hyphens
 */
const MENTION_PATTERN = /@([\w.-]+)/g;

/**
 * Parse text and extract all mentions
 * @param text - The text to parse
 * @returns Array of ParsedMention objects
 */
export const parseMentions = (text: string): ParsedMention[] => {
  const mentions: ParsedMention[] = [];
  let match;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const fullMatch = match[0]; // @handle
    const handle = match[1]; // handle (without @)

    // Determine mention type
    let type: 'user' | 'app' | 'domain' = 'user';
    let url: string | undefined;

    if (handle.includes('.')) {
      if (handle.endsWith('.app')) {
        type = 'app';
        // Link to Instagram if it's @spindare.app
        if (handle === 'spindare.app') {
          url = 'https://instagram.com/spindare.app';
        } else {
          url = `https://instagram.com/${handle}`;
        }
      } else {
        type = 'domain';
        url = `https://${handle}`;
      }
    } else {
      // Regular username - assume Instagram
      url = `https://instagram.com/${handle}`;
    }

    mentions.push({
      text: fullMatch,
      handle,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      type,
      url,
    });
  }

  return mentions;
};

/**
 * Split text into segments of mentions and non-mentions
 * Useful for rendering text with mention highlights
 * @param text - The text to segment
 * @returns Array of text segments
 */
export const segmentText = (text: string): ParsedTextSegment[] => {
  const mentions = parseMentions(text);

  if (mentions.length === 0) {
    return [{ text, isMention: false }];
  }

  const segments: ParsedTextSegment[] = [];
  let lastIndex = 0;

  mentions.forEach((mention) => {
    // Add non-mention text before this mention
    if (mention.startIndex > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, mention.startIndex),
        isMention: false,
      });
    }

    // Add the mention
    segments.push({
      text: mention.text,
      isMention: true,
      mention,
    });

    lastIndex = mention.endIndex;
  });

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isMention: false,
    });
  }

  return segments;
};

/**
 * Replace mentions with custom formatter
 * @param text - The text to process
 * @param formatter - Function to format each mention
 * @returns Formatted text or segments
 */
export const formatMentions = (
  text: string,
  formatter: (mention: ParsedMention) => string
): string => {
  const mentions = parseMentions(text);

  if (mentions.length === 0) {
    return text;
  }

  let result = text;
  // Sort by startIndex descending to replace from end to start (avoid index shifting)
  mentions.sort((a, b) => b.startIndex - a.startIndex);

  mentions.forEach((mention) => {
    const replacement = formatter(mention);
    result =
      result.substring(0, mention.startIndex) +
      replacement +
      result.substring(mention.endIndex);
  });

  return result;
};

/**
 * Get all unique mentioned handles from text
 * @param text - The text to analyze
 * @returns Array of unique handles
 */
export const extractHandles = (text: string): string[] => {
  const mentions = parseMentions(text);
  return Array.from(new Set(mentions.map((m) => m.handle)));
};

/**
 * Check if text contains a specific mention
 * @param text - The text to search
 * @param handle - The handle to look for (without @)
 * @returns True if mention exists
 */
export const hasMention = (text: string, handle: string): boolean => {
  const mentions = parseMentions(text);
  return mentions.some((m) => m.handle === handle);
};

/**
 * Replace specific mention with new text
 * @param text - The text to modify
 * @param handle - The handle to replace
 * @param replacement - The replacement text
 * @returns Modified text
 */
export const replaceMention = (
  text: string,
  handle: string,
  replacement: string
): string => {
  return text.replace(new RegExp(`@${handle}\\b`, 'g'), replacement);
};
