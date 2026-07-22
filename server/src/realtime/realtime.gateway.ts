import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

// Replaces Supabase Realtime (postgres_changes), which was the thing that
// never actually worked per CLAUDE.md's "Known Issues" section — this is a
// plain broadcast-to-everyone-connected socket, simpler than trying to
// replicate postgres_changes filtering, which is all the client ever needed
// anyway (the mobile services just refetch on any relevant event).
//
// Client side: connect with `io(API_BASE_URL)` and listen for the events
// below instead of calling supabase.channel(...).on('postgres_changes', ...).
@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`client connected: ${client.id}`);
  }

  postCreated(post: unknown) {
    this.server?.emit('post:created', post);
  }

  postUpdated(post: unknown) {
    this.server?.emit('post:updated', post);
  }

  reactionChanged(postId: string, reactions: unknown) {
    this.server?.emit('post:reactions', { postId, reactions });
  }

  commentCreated(comment: unknown) {
    this.server?.emit('comment:created', comment);
  }

  profileUpdated(profile: unknown) {
    this.server?.emit('profile:updated', profile);
  }

  notificationCreated(userId: string, notification: unknown) {
    // Targeted rooms would need clients to join a room per userId — for now,
    // broadcast and let the client filter by userId, same trust model the
    // anon-key Supabase Realtime setup already had.
    this.server?.emit(`notification:${userId}`, notification);
  }

  // Targeted at the recipient, same shape as notificationCreated — a chat
  // message must not fan out to every connected client.
  messageCreated(userId: string, message: unknown) {
    this.server?.emit(`message:${userId}`, message);
  }
}
