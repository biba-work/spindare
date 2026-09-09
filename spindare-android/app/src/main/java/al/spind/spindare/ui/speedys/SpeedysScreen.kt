package al.spind.spindare.ui.speedys

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import al.spind.spindare.model.Speedy
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.ui.theme.*
import kotlinx.coroutines.delay

@OptIn(UnstableApi::class)
@Composable
fun SpeedysScreen() {
    var speedys by remember { mutableStateOf<List<Speedy>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        speedys = AppEnvironment.speedy.speedys()
        loading = false
    }

    if (loading) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Color.White)
        }
        return
    }

    val pagerState = rememberPagerState { speedys.size }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        VerticalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            beyondViewportPageCount = 1
        ) { page ->
            SpeedyCard(speedy = speedys[page], isCurrent = pagerState.currentPage == page)
        }
    }
}

@UnstableApi
@Composable
fun SpeedyCard(speedy: Speedy, isCurrent: Boolean) {
    val context = LocalContext.current
    var isPlaying by remember { mutableStateOf(true) }
    var showHeart by remember { mutableStateOf(false) }
    
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = Player.REPEAT_MODE_ONE
            playWhenReady = true
            volume = 1f
        }
    }

    DisposableEffect(speedy.id) {
        speedy.videoURL?.let { url ->
            exoPlayer.setMediaItem(MediaItem.fromUri(url))
            exoPlayer.prepare()
        }
        onDispose { exoPlayer.release() }
    }

    LaunchedEffect(isCurrent) {
        if (isCurrent) {
            exoPlayer.play()
            isPlaying = true
        } else {
            exoPlayer.pause()
            exoPlayer.seekTo(0)
            isPlaying = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { isPlaying = !isPlaying; if (isPlaying) exoPlayer.play() else exoPlayer.pause() },
                    onDoubleTap = { showHeart = true }
                )
            }
    ) {
        // Base Media
        AsyncImage(
            model = speedy.posterURL ?: speedy.avatar,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        if (speedy.videoURL != null) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        player = exoPlayer
                        useController = false
                        resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Gradient for details legibility
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.85f))
                    )
                )
        )

        // Details (Bottom Left)
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(horizontal = SpindareSpacing.gutter)
                .padding(bottom = 150.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically, 
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                modifier = Modifier.spindarePop {}
            ) {
                AsyncImage(
                    model = speedy.avatar,
                    contentDescription = null,
                    modifier = Modifier.size(26.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f))
                )
                Text(
                    text = "@${speedy.author}",
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                )
            }
            
            Text(
                text = speedy.challenge,
                color = Color.White,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp,
                    letterSpacing = (-0.3).sp
                )
            )
            
            Text(
                text = speedy.detail,
                color = Color.White.copy(alpha = 0.85f),
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                lineHeight = 17.sp,
                maxLines = 3
            )
        }

        // Side Rail (Bottom Right)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(bottom = 150.dp, end = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ReactionButton("Felt", speedy.reactions.felt, SpindareColors.Felt, ReactionGlyphType.FELT, onImage = true) {}
            ReactionButton("Thought", speedy.reactions.thought, SpindareColors.Thought, ReactionGlyphType.THOUGHT, onImage = true) {}
            ReactionButton("Intrigued", speedy.reactions.intrigued, SpindareColors.Intrigued, ReactionGlyphType.INTRIGUED, onImage = true) {}
            
            RailIcon(icon = Icons.Default.Share, label = "Share")
            RailIcon(icon = Icons.Default.Star, label = "Favourite")
        }

        if (!isPlaying) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.35f),
                    modifier = Modifier.size(64.dp)
                )
            }
        }

        if (showHeart) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                LaunchedEffect(Unit) {
                    delay(800)
                    showHeart = false
                }
                Icon(
                    imageVector = Icons.Filled.Favorite,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(100.dp).animateHeart()
                )
            }
        }
    }
}

@Composable
private fun RailIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.16f))
                .spindarePop {},
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
        }
        Text(
            text = label, 
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
            color = Color.White
        )
    }
}

@Composable
private fun Modifier.animateHeart(): Modifier {
    val infiniteTransition = rememberInfiniteTransition(label = "heart")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "heartScale"
    )
    return this.graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}
