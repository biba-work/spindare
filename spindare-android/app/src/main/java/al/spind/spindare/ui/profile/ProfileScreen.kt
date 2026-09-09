package al.spind.spindare.ui.profile

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Grid3x3
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import al.spind.spindare.model.Post
import al.spind.spindare.model.Profile
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.ui.theme.*

@Composable
fun ProfileScreen(onSpinnerClick: () -> Unit = {}) {
    var profile by remember { mutableStateOf<Profile?>(null) }
    var posts by remember { mutableStateOf<List<Post>>(emptyList()) }
    var isGrid by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        profile = AppEnvironment.profile.currentProfile()
        profile?.let {
            posts = AppEnvironment.feed.userPosts(it.id)
        }
    }

    Scaffold(
        topBar = {
            ProfileHeader(onSettingsClick = {})
        },
        floatingActionButton = {
            // Moved here from a floating button over the feed — the profile is
            // unambiguously "yours," which is where starting a challenge belongs.
            FloatingActionButton(
                onClick = onSpinnerClick,
                shape = CircleShape,
                containerColor = SpindareColors.Ink,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Refresh, contentDescription = "Spin")
            }
        },
        containerColor = SpindareColors.backgroundColor()
    ) { inner ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(inner)
        ) {
            ProfileIdentity(profile)
            
            ProfileStats(
                postsCount = posts.size,
                reactionsCount = posts.sumOf { it.reactions.total }
            )

            LayoutToggle(isGrid = isGrid, onToggle = { isGrid = it })

            if (isGrid) {
                PostGrid(posts)
            } else {
                PostList(posts)
            }
        }
    }
}

@Composable
private fun ProfileHeader(onSettingsClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .height(60.dp)
            .padding(horizontal = SpindareSpacing.md),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Spacer(modifier = Modifier.size(40.dp))
        Text(
            text = "PROFILE",
            style = MaterialTheme.typography.labelSmall.copy(
                letterSpacing = 3.sp,
                fontWeight = FontWeight.SemiBold
            )
        )
        IconButton(onClick = onSettingsClick) {
            Icon(Icons.Default.Settings, contentDescription = "Settings")
        }
    }
}

@Composable
private fun ProfileIdentity(profile: Profile?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = SpindareSpacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(SpindareSpacing.sm)
    ) {
        AsyncImage(
            model = profile?.photoURL ?: "https://api.dicebear.com/7.x/avataaars/svg?seed=you",
            contentDescription = null,
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(SpindareColors.primaryColor().copy(alpha = 0.1f))
        )
        
        Text(
            text = "@${profile?.username ?: "you"}",
            style = MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp
            )
        )
        
        Text(
            text = "Creative Explorer",
            style = MaterialTheme.typography.bodyMedium,
            color = SpindareColors.secondaryColor()
        )
    }
}

@Composable
private fun ProfileStats(postsCount: Int, reactionsCount: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = SpindareSpacing.md),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        StatItem(value = postsCount, label = "Posts")
        Box(
            modifier = Modifier
                .padding(horizontal = SpindareSpacing.xl)
                .width(1.dp)
                .height(36.dp)
                .background(SpindareColors.hairlineColor())
        )
        StatItem(value = reactionsCount, label = "Reactions")
    }
}

@Composable
private fun StatItem(value: Int, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
        )
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 10.sp,
                letterSpacing = 1.sp,
                color = SpindareColors.secondaryColor()
            )
        )
    }
}

@Composable
private fun LayoutToggle(isGrid: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SpindareSpacing.gutter, vertical = SpindareSpacing.md)
            .height(40.dp)
            .background(SpindareColors.hairlineColor().copy(alpha = 0.5f), RoundedCornerShape(SpindareRadius.control))
            .padding(3.dp)
    ) {
        ToggleButton(
            isActive = isGrid,
            icon = Icons.Default.Grid3x3,
            onClick = { onToggle(true) },
            modifier = Modifier.weight(1f)
        )
        ToggleButton(
            isActive = !isGrid,
            icon = Icons.AutoMirrored.Filled.List,
            onClick = { onToggle(false) },
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ToggleButton(isActive: Boolean, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit, modifier: Modifier) {
    val bgColor by animateColorAsState(if (isActive) SpindareColors.surfaceColor() else Color.Transparent)
    val tint by animateColorAsState(if (isActive) SpindareColors.primaryColor() else SpindareColors.secondaryColor())
    
    Box(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(SpindareRadius.control - 2.dp))
            .background(bgColor)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun PostGrid(posts: List<Post>) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxSize().padding(horizontal = 2.dp),
        contentPadding = PaddingValues(bottom = 80.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        items(posts, key = { it.id }) { post ->
            Box(
                modifier = Modifier
                    .aspectRatio(1f)
                    .background(SpindareColors.primaryColor().copy(alpha = 0.05f))
            ) {
                post.media?.let { url ->
                    AsyncImage(
                        model = url,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}

@Composable
private fun PostList(posts: List<Post>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpindareSpacing.md, bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(SpindareSpacing.md)
    ) {
        items(posts, key = { it.id }) { post ->
            SpindareCard {
                Column(modifier = Modifier.padding(SpindareSpacing.md)) {
                    Text(post.challenge, fontWeight = FontWeight.Bold)
                    Text(post.createdAt.toString(), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
