package al.spind.spindare.ui.feed

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import al.spind.spindare.model.Post
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.ui.theme.*
import java.time.Duration
import java.time.Instant

sealed interface FeedUiState {
    data object Loading : FeedUiState
    data object Empty : FeedUiState
    data class Error(val message: String) : FeedUiState
    data class Loaded(val posts: List<Post>) : FeedUiState
}

@Composable
fun FeedScreen() {
    var state by remember { mutableStateOf<FeedUiState>(FeedUiState.Loading) }
    var reloadToken by remember { mutableStateOf(0) }

    LaunchedEffect(reloadToken) {
        state = FeedUiState.Loading
        state = runCatching { AppEnvironment.feed.feed() }
            .fold(
                onSuccess = { if (it.isEmpty()) FeedUiState.Empty else FeedUiState.Loaded(it) },
                onFailure = { FeedUiState.Error(it.message ?: "Couldn't load the feed.") },
            )
    }

    when (val current = state) {
        is FeedUiState.Loading -> Centered { CircularProgressIndicator(color = SpindareColors.AccentDeep) }

        is FeedUiState.Empty -> Centered {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Nothing here yet", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Be the first to complete a challenge.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = SpindareColors.secondaryColor(),
                )
            }
        }

        is FeedUiState.Error -> Centered {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Couldn't load the feed", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { reloadToken++ }) { Text("Try again") }
            }
        }

        is FeedUiState.Loaded -> LazyColumn(
            contentPadding = PaddingValues(top = 0.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(SpindareSpacing.md),
            modifier = Modifier.fillMaxSize().background(SpindareColors.backgroundColor()),
        ) {
            items(current.posts, key = { it.id }) { PostCard(it) }
        }
    }
}

@Composable
private fun PostCard(post: Post) {
    var challengeExpanded by remember { mutableStateOf(false) }
    var isSaved by remember { mutableStateOf(false) }

    SpindareCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SpindareSpacing.sm)
    ) {
        Column(
            modifier = Modifier.padding(vertical = SpindareSpacing.md),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            // Author Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = SpindareSpacing.md),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(SpindareSpacing.sm)
            ) {
                AsyncImage(
                    model = post.avatar ?: "https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}",
                    contentDescription = null,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(SpindareColors.primaryColor().copy(alpha = 0.1f))
                )
                
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = post.author,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = (-0.2).sp
                        ),
                        color = SpindareColors.primaryColor()
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        if ((post.spinCount ?: 0) > 0) {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(9.dp),
                                tint = SpindareColors.accentColor()
                            )
                            Text(
                                text = post.spinCount.toString(),
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, letterSpacing = 0.sp),
                                color = SpindareColors.accentColor()
                            )
                        }
                        Text(
                            text = formatRelativeTime(post.createdAt),
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, letterSpacing = 0.sp),
                            color = SpindareColors.secondaryColor()
                        )
                    }
                }

                IconButton(onClick = { isSaved = !isSaved }, modifier = Modifier.size(32.dp)) {
                    Icon(
                        if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                        contentDescription = "Save",
                        tint = if (isSaved) SpindareColors.accentColor() else SpindareColors.secondaryColor(),
                        modifier = Modifier.size(15.dp)
                    )
                }
                IconButton(onClick = { /* More */ }, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.MoreHoriz, 
                        contentDescription = "More", 
                        tint = SpindareColors.secondaryColor(),
                        modifier = Modifier.size(15.dp)
                    )
                }
            }

            // Challenge Pill
            ChallengePill(
                text = post.challenge,
                expanded = challengeExpanded,
                onClick = { challengeExpanded = !challengeExpanded },
                modifier = Modifier.padding(horizontal = SpindareSpacing.md).padding(top = SpindareSpacing.sm)
            )

            Spacer(modifier = Modifier.height(SpindareSpacing.md))

            // Media & Floating Reactions
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = SpindareSpacing.md)
            ) {
                Column {
                    post.media?.let { url ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(420.dp)
                                .clip(RoundedCornerShape(SpindareRadius.control))
                        ) {
                            AsyncImage(
                                model = url,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                            
                            // Gradient for legibility
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(260.dp)
                                    .align(Alignment.BottomCenter)
                                    .background(
                                        Brush.verticalGradient(
                                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.85f))
                                        )
                                    )
                            )
                            
                            if (!post.content.isNullOrEmpty()) {
                                Text(
                                    text = post.content,
                                    style = SpindareTypography.bodyLarge,
                                    color = Color.White,
                                    modifier = Modifier
                                        .align(Alignment.BottomStart)
                                        .padding(SpindareSpacing.md)
                                        .padding(bottom = 4.dp),
                                    maxLines = 3
                                )
                            }
                        }
                    } ?: run {
                        // Text body
                        if (!post.content.isNullOrEmpty()) {
                            Text(
                                text = post.content,
                                style = SpindareTypography.bodyLarge,
                                color = SpindareColors.primaryColor(),
                                modifier = Modifier.padding(bottom = SpindareSpacing.md)
                            )
                        }
                    }
                }

                // Floating Reaction Rail (Right side)
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(bottom = SpindareSpacing.md, end = SpindareSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(SpindareSpacing.sm)
                ) {
                    val onImage = post.media != null
                    ReactionButton("Felt", post.reactions.felt, SpindareColors.Felt, ReactionGlyphType.FELT, onImage = onImage) {}
                    ReactionButton("Thought", post.reactions.thought, SpindareColors.Thought, ReactionGlyphType.THOUGHT, onImage = onImage) {}
                    ReactionButton("Intrigued", post.reactions.intrigued, SpindareColors.Intrigued, ReactionGlyphType.INTRIGUED, onImage = onImage) {}
                }
            }

            Spacer(modifier = Modifier.height(SpindareSpacing.sm))

            // Primary Action Button
            SpindareButton(
                label = "Try this challenge",
                onClick = { /* TODO */ },
                style = SpindareButtonStyle.Secondary,
                modifier = Modifier
                    .padding(horizontal = SpindareSpacing.md)
                    .padding(bottom = SpindareSpacing.sm)
            )
        }
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}

private fun formatRelativeTime(instant: Instant?): String {
    if (instant == null) return "now"
    val now = Instant.now()
    val diff = Duration.between(instant, now)
    return when {
        diff.toMinutes() < 1 -> "now"
        diff.toHours() < 1 -> "${diff.toMinutes()}m"
        diff.toDays() < 1 -> "${diff.toHours()}h"
        diff.toDays() < 7 -> "${diff.toDays()}d"
        else -> "${diff.toDays() / 7}w"
    }
}
