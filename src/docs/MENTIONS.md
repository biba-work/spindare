# Mentions System Documentation

Complete guide for using the @mentions system in Spindare.

## Overview

The mentions system allows users to mention anyone anywhere in the app using the `@` symbol. It supports:
- **@username** - Regular usernames
- **@handle.app** - App handles (e.g., @spindare.app)
- **@domain.com** - Websites and domains

All mentions are automatically detected, clickable, and linked to Instagram or the respective domain.

## Features

✅ Automatic mention detection in any text  
✅ Clickable mentions linking to Instagram/websites  
✅ Autocomplete suggestions while typing  
✅ Mention counter badge  
✅ Mention analytics and statistics  
✅ Notifications for mentioned users  
✅ Real-time mention tracking  

## Usage

### 1. Basic Text Rendering with Mentions

```tsx
import { MentionText } from './components/MentionText';

export function MyComponent() {
  return (
    <MentionText
      text="Check out @spindare.app on Instagram! Also follow @instagram"
      mentionColor="#007AFF"
      onMentionPress={(mention) => {
        console.log('Mention pressed:', mention.handle);
      }}
    />
  );
}
```

### 2. Text Input with Mention Autocomplete

```tsx
import { MentionInput } from './components/MentionInput';

export function CommentBox() {
  const inputRef = useRef<TextInput>(null);

  return (
    <MentionInput
      ref={inputRef}
      placeholder="Type a comment with @mentions..."
      onMentionDetected={(mentions) => {
        console.log('Found mentions:', mentions);
      }}
      onSuggestionSelect={(suggestion) => {
        console.log('Selected:', suggestion.handle);
      }}
    />
  );
}
```

### 3. Using the Mentions Hook

```tsx
import { useMentions } from './hooks/useMentions';

export function PostEditor() {
  const {
    text,
    setText,
    mentions,
    stats,
    addMention,
    removeMention,
    hasMention,
  } = useMentions('', {
    trackAnalytics: true,
    onMentionAdded: (mention) => {
      console.log('Added mention:', mention);
    },
  });

  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write your post..."
      />
      <Text>Mentions found: {stats.total}</Text>
      <Text>Handles: {stats.handles.join(', ')}</Text>
      
      <Button
        title={`Add @spindare.app`}
        onPress={() => addMention('spindare.app')}
      />
    </View>
  );
}
```

### 4. Mention Service (Backend)

```tsx
import { mentionService } from './services/mentionService';

// Record a mention
mentionService.recordMention({
  mentionedHandle: 'spindare.app',
  mentionerUsername: 'john_doe',
  content: 'Check out @spindare.app - it\'s amazing!',
  platform: 'mobile',
});

// Get notifications
const notifications = mentionService.getNotifications('spindare.app');

// Get statistics
const stats = mentionService.getStats('spindare.app');
console.log(`Total mentions: ${stats?.totalMentions}`);

// Export analytics
const analytics = mentionService.exportAnalytics();
```

## API Reference

### MentionText Component

Display text with clickable mentions.

**Props:**
- `text` (string, required) - Text to render
- `mentionColor` (string) - Color of mention text (default: '#0066cc')
- `mentionFontWeight` (string) - Font weight of mentions (default: '600')
- `onMentionPress` (function) - Called when mention is pressed
- `allowNavigation` (boolean) - Navigate to mention URL (default: true)
- All standard Text component props

**Example:**
```tsx
<MentionText
  text="Hello @spindare.app and @instagram"
  mentionColor="#007AFF"
  onMentionPress={(mention) => console.log(mention)}
/>
```

### MentionInput Component

Text input with mention autocomplete.

**Props:**
- `onMentionDetected` (function) - Called with detected mentions
- `suggestions` (array) - Custom suggestion list
- `onSuggestionSelect` (function) - Called when suggestion is selected
- `autocompletePlaceholders` (array) - Placeholder suggestions
- All standard TextInput component props

**Example:**
```tsx
<MentionInput
  placeholder="Type @..."
  onMentionDetected={(mentions) => console.log(mentions)}
  suggestions={[
    { id: '1', handle: 'spindare.app', username: 'Spindare', type: 'verified' }
  ]}
/>
```

### useMentions Hook

Manage mentions in component state.

**Options:**
- `trackAnalytics` (boolean) - Log mention analytics
- `storeMentions` (boolean) - Store mentions locally
- `onMentionAdded` (function) - Callback when mention added
- `onMentionRemoved` (function) - Callback when mention removed

**Returns:**
- `text` - Current text
- `setText` - Update text
- `mentions` - Array of ParsedMention objects
- `stats` - MentionStats object
- `addMention(handle)` - Add mention to text
- `removeMention(handle)` - Remove mention from text
- `clearMentions()` - Remove all mentions
- `getMentionAt(index)` - Get mention at index
- `hasMention(handle)` - Check if mention exists

### Mention Service

Backend service for mention management.

**Methods:**
- `recordMention(event)` - Record a mention event
- `getNotifications(handle, unreadOnly)` - Get notifications
- `markAsRead(notificationId)` - Mark notification as read
- `getStats(handle)` - Get mention statistics
- `getTopMentioned(limit)` - Get top mentioned handles
- `searchMentions(query, limit)` - Search mention events
- `getMentionTimeline(handle)` - Get timeline for handle
- `exportAnalytics()` - Export all analytics
- `clearOldEvents(daysOld)` - Clear old events

## Mention Parser Utilities

### parseMentions(text)
Extract all mentions from text.

```tsx
import { parseMentions } from './utils/mentionParser';

const mentions = parseMentions('Hello @spindare.app and @instagram');
// Returns: [
//   { text: '@spindare.app', handle: 'spindare.app', type: 'app', url: 'https://instagram.com/spindare.app' },
//   { text: '@instagram', handle: 'instagram', type: 'user', url: 'https://instagram.com/instagram' }
// ]
```

### segmentText(text)
Split text into mention and non-mention segments.

```tsx
const segments = segmentText('Hello @spindare.app');
// Returns: [
//   { text: 'Hello ', isMention: false },
//   { text: '@spindare.app', isMention: true, mention: {...} }
// ]
```

### extractHandles(text)
Get all unique handles mentioned in text.

```tsx
const handles = extractHandles('Hey @spindare.app and @instagram');
// Returns: ['spindare.app', 'instagram']
```

### formatMentions(text, formatter)
Apply custom formatting to mentions.

```tsx
const formatted = formatMentions(
  'Check @spindare.app',
  (mention) => `[${mention.handle}](${mention.url})`
);
// Returns: 'Check [spindare.app](https://instagram.com/spindare.app)'
```

## Styling Mentions

### Custom Colors

```tsx
<MentionText
  text="@spindare.app"
  mentionColor="#FF1493"
  style={{ fontSize: 16 }}
/>
```

### Using Theme

```tsx
const theme = {
  mentionColor: '#007AFF',
  mentionFontWeight: '600',
};

<MentionText
  text="Hello @spindare.app"
  mentionColor={theme.mentionColor}
  mentionFontWeight={theme.mentionFontWeight}
/>
```

## Best Practices

1. **Always show visual feedback** - Use color/styling to distinguish mentions
2. **Provide autocomplete** - Help users find the right handles to mention
3. **Track analytics** - Monitor who's being mentioned most
4. **Handle errors gracefully** - If Instagram link fails, show alternative
5. **Limit suggestions** - Don't show too many autocomplete options at once
6. **Cache suggestions** - Store popular handles for faster autocomplete
7. **Validate handles** - Check against a whitelist if needed
8. **Rate limit** - Prevent spam of mentions in notifications

## Examples

### Feed Post with Mentions

```tsx
import { MentionText } from './components/MentionText';

export function FeedPost({ content, author }) {
  return (
    <View style={styles.post}>
      <Text style={styles.author}>{author}</Text>
      <MentionText
        text={content}
        mentionColor="#007AFF"
        style={styles.content}
        onMentionPress={(mention) => {
          navigateToProfile(mention.handle);
        }}
      />
    </View>
  );
}
```

### Comment Box

```tsx
import { MentionInput } from './components/MentionInput';
import { mentionService } from './services/mentionService';

export function CommentBox({ postId, onSubmit }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    mentionService.recordMention({
      mentionedHandle: 'spindare.app',
      mentionerUsername: 'current_user',
      content: text,
      platform: 'mobile',
    });
    onSubmit(text);
  };

  return (
    <View>
      <MentionInput
        value={text}
        onChangeText={setText}
        placeholder="Add a comment @mention someone..."
      />
      <Button title="Post" onPress={handleSubmit} />
    </View>
  );
}
```

### Mention Analytics Dashboard

```tsx
import { mentionService } from './services/mentionService';

export function AnalyticsDashboard() {
  const analytics = mentionService.exportAnalytics();
  const topMentioned = mentionService.getTopMentioned(5);

  return (
    <View>
      <Text>Total Mention Events: {analytics.totalEvents}</Text>
      <Text>Unread Notifications: {analytics.unreadNotifications}</Text>
      
      <Text style={styles.heading}>Top Mentioned:</Text>
      {topMentioned.map((stat) => (
        <View key={stat.handle}>
          <Text>@{stat.handle}: {stat.totalMentions} mentions</Text>
        </View>
      ))}
    </View>
  );
}
```

## Troubleshooting

**Mentions not detecting?**
- Check regex pattern in `mentionParser.ts`
- Ensure text contains valid `@handle` format

**Links not opening?**
- Verify Instagram handle format
- Check if `Linking.canOpenURL()` returns true
- Test on actual device (simulator may have restrictions)

**Performance issues?**
- Use `useMemo` to prevent re-parsing on every render
- Cache parsed mentions
- Lazy load suggestions only when needed

**Suggestion dropdown not showing?**
- Check `showSuggestions` state
- Verify suggestions array is not empty
- Ensure user typed `@` character

## Contributing

To add new mention types or features:

1. Modify regex pattern in `mentionParser.ts`
2. Add new type to `ParsedMention` interface
3. Update `MentionText` component styling
4. Add tests for new mention type
5. Update this documentation

## License

See repository LICENSE file
