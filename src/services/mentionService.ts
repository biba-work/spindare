/**
 * Mention Service
 * Backend service for handling mentions
 * Features: notifications, storage, analytics, social sharing
 */

import { ParsedMention, parseMentions } from '../utils/mentionParser';

interface MentionNotification {
  id: string;
  mentionedHandle: string;
  mentionerUsername: string;
  content: string;
  timestamp: Date;
  read: boolean;
  sourceUrl?: string;
}

interface MentionEvent {
  mentionedHandle: string;
  mentionerUsername: string;
  content: string;
  mentions: ParsedMention[];
  timestamp: Date;
  platform: 'web' | 'mobile' | 'api';
}

interface MentionStats {
  handle: string;
  totalMentions: number;
  monthlyMentions: number;
  recentMentioners: string[];
  engagementScore: number;
}

/**
 * Service for managing mentions across the app
 */
export class MentionService {
  private notifications: MentionNotification[] = [];
  private mentionEvents: MentionEvent[] = [];
  private stats: Map<string, MentionStats> = new Map();

  /**
   * Record a mention event
   */
  recordMention(event: Omit<MentionEvent, 'timestamp' | 'mentions'>) {
    const mentions = parseMentions(event.content);

    const mentionEvent: MentionEvent = {
      ...event,
      mentions,
      timestamp: new Date(),
    };

    this.mentionEvents.push(mentionEvent);

    // Create notifications for mentioned handles
    mentions.forEach((mention) => {
      this.createNotification(
        mention.handle,
        event.mentionerUsername,
        event.content,
        event.platform
      );
    });

    // Update stats
    mentions.forEach((mention) => {
      this.updateStats(mention.handle, event.mentionerUsername);
    });
  }

  /**
   * Create notification for mentioned user
   */
  private createNotification(
    mentionedHandle: string,
    mentionerUsername: string,
    content: string,
    platform: string
  ) {
    const notification: MentionNotification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      mentionedHandle,
      mentionerUsername,
      content: content.substring(0, 100), // Truncate for preview
      timestamp: new Date(),
      read: false,
      sourceUrl: `${platform}://mention/${Date.now()}`,
    };

    this.notifications.push(notification);

    // Could trigger push notification here
    console.log(`🔔 Notification: ${mentionerUsername} mentioned @${mentionedHandle}`);
  }

  /**
   * Update stats for a mentioned handle
   */
  private updateStats(handle: string, mentioner: string) {
    let stat = this.stats.get(handle);

    if (!stat) {
      stat = {
        handle,
        totalMentions: 0,
        monthlyMentions: 0,
        recentMentioners: [],
        engagementScore: 0,
      };
      this.stats.set(handle, stat);
    }

    stat.totalMentions++;
    stat.monthlyMentions++;

    // Track recent mentioners (max 10)
    if (!stat.recentMentioners.includes(mentioner)) {
      stat.recentMentioners.unshift(mentioner);
      if (stat.recentMentioners.length > 10) {
        stat.recentMentioners.pop();
      }
    }

    // Simple engagement score: total mentions + unique mentioners
    stat.engagementScore = stat.totalMentions + stat.recentMentioners.length;
  }

  /**
   * Get notifications for a handle
   */
  getNotifications(handle: string, unreadOnly = false): MentionNotification[] {
    return this.notifications.filter((n) => {
      if (n.mentionedHandle !== handle) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string) {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Get stats for a handle
   */
  getStats(handle: string): MentionStats | undefined {
    return this.stats.get(handle);
  }

  /**
   * Get top mentioned handles
   */
  getTopMentioned(limit = 10): MentionStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => b.totalMentions - a.totalMentions)
      .slice(0, limit);
  }

  /**
   * Search mention events
   */
  searchMentions(query: string, limit = 50): MentionEvent[] {
    return this.mentionEvents
      .filter(
        (event) =>
          event.content.toLowerCase().includes(query.toLowerCase()) ||
          event.mentionerUsername.toLowerCase().includes(query.toLowerCase()) ||
          event.mentions.some((m) =>
            m.handle.toLowerCase().includes(query.toLowerCase())
          )
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get mention timeline
   */
  getMentionTimeline(handle: string): MentionEvent[] {
    return this.mentionEvents
      .filter((event) => event.mentions.some((m) => m.handle === handle))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Export mention analytics
   */
  exportAnalytics() {
    return {
      totalEvents: this.mentionEvents.length,
      totalNotifications: this.notifications.length,
      unreadNotifications: this.notifications.filter((n) => !n.read).length,
      topMentioned: this.getTopMentioned(5),
      allStats: Array.from(this.stats.values()),
    };
  }

  /**
   * Clear old events (older than X days)
   */
  clearOldEvents(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    this.mentionEvents = this.mentionEvents.filter(
      (event) => event.timestamp > cutoffDate
    );
  }
}

// Export singleton instance
export const mentionService = new MentionService();

export default mentionService;
