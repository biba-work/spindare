package al.spind.spindare.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import al.spind.spindare.model.Conversation
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.ui.theme.*
import java.time.Duration
import java.time.Instant

@Composable
fun ChatScreen(onConversationClick: (Conversation) -> Unit) {
    var conversations by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        conversations = AppEnvironment.chat.conversations()
        loading = false
    }

    if (loading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = SpindareColors.AccentDeep)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(SpindareColors.backgroundColor()),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        items(conversations, key = { it.id }) { conversation ->
            SwipeActionRow(
                onArchive = { /* TODO */ },
                onDelete = { /* TODO */ }
            ) {
                ConversationItem(conversation, onClick = { onConversationClick(conversation) })
            }
        }
    }
}

@Composable
private fun ConversationItem(conversation: Conversation, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .spindarePop(onClick = onClick)
            .padding(horizontal = SpindareSpacing.lg, vertical = SpindareSpacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = "https://api.dicebear.com/7.x/avataaars/svg?seed=${conversation.otherUsername}",
            contentDescription = null,
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(SpindareColors.primaryColor().copy(alpha = 0.1f))
        )
        
        Spacer(modifier = Modifier.width(SpindareSpacing.md))
        
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = conversation.otherUsername,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                    color = SpindareColors.primaryColor()
                )
                Text(
                    text = formatRelativeTime(conversation.lastMessageAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = SpindareColors.secondaryColor()
                )
            }
            
            Text(
                text = conversation.lastMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = if (conversation.unreadCount > 0) SpindareColors.primaryColor() else SpindareColors.secondaryColor(),
                maxLines = 1,
                fontWeight = if (conversation.unreadCount > 0) FontWeight.Bold else FontWeight.Normal
            )
        }
        
        if (conversation.unreadCount > 0) {
            Box(
                modifier = Modifier
                    .padding(start = 8.dp)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(SpindareColors.Accent)
            )
        }
    }
}

private fun formatRelativeTime(instant: Instant?): String {
    if (instant == null) return "now"
    val now = Instant.now()
    val diff = Duration.between(instant, now)
    return when {
        diff.toMinutes() < 1 -> "now"
        diff.toHours() < 1 -> "${diff.toMinutes()}m"
        diff.toDays() < 1 -> "${diff.toHours()}h"
        else -> "${diff.toDays()}d"
    }
}
