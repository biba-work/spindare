package al.spind.spindare.ui.shell

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import al.spind.spindare.R
import al.spind.spindare.ui.theme.*

/**
 * 1:1 Port of AppHeader.swift.
 * Fixed height 60dp, centered wordmark, and specific brand icons.
 */
@Composable
fun AppHeader(
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    savedCount: Int = 0,
    activityCount: Int = 0,
    compact: Boolean = false,
    onProfileClick: () -> Unit = {},
    onSavedClick: () -> Unit = {},
    onSearchClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {}
) {
    val height = if (compact) 48.dp else 60.dp
    val wordmarkRes = if (isSystemInDarkTheme()) R.drawable.spindare_wordmark_on_dark else R.drawable.spindare_wordmark

    Surface(
        modifier = modifier
            .fillMaxWidth()
            // MainActivity calls enableEdgeToEdge(), so content draws behind the
            // system status bar by design — without this, the header's icons sit
            // at y=0 and the clock/battery physically overlap them.
            .statusBarsPadding()
            .height(height),
        color = SpindareColors.backgroundColor(),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Wordmark (Centered)
            if (!compact) {
                Image(
                    painter = painterResource(id = wordmarkRes),
                    contentDescription = "SPINDARE",
                    modifier = Modifier
                        .height(18.dp)
                        .align(Alignment.Center)
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = SpindareSpacing.md),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left
                Row(
                    verticalAlignment = Alignment.CenterVertically, 
                    horizontalArrangement = Arrangement.spacedBy(SpindareSpacing.xs)
                ) {
                    Box(modifier = Modifier.size(40.dp).spindarePop(onProfileClick), contentAlignment = Alignment.Center) {
                        AsyncImage(
                            model = avatarUrl ?: "https://api.dicebear.com/7.x/avataaars/svg?seed=you",
                            contentDescription = null,
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(SpindareColors.primaryColor().copy(alpha = 0.1f))
                                .border(1.dp, SpindareColors.hairlineColor(), CircleShape)
                        )
                    }
                    
                    HeaderIconButton(
                        icon = Icons.Outlined.Bookmark,
                        count = savedCount,
                        badgeColor = SpindareColors.Accent,
                        onClick = onSavedClick
                    )
                }

                // Right
                Row(
                    verticalAlignment = Alignment.CenterVertically, 
                    horizontalArrangement = Arrangement.spacedBy(SpindareSpacing.xs)
                ) {
                    HeaderIconButton(
                        icon = Icons.Outlined.Search,
                        onClick = onSearchClick
                    )
                    HeaderIconButton(
                        icon = Icons.Outlined.Notifications,
                        count = activityCount,
                        badgeColor = SpindareColors.Danger,
                        onClick = onNotificationsClick
                    )
                }
            }
            
            // Bottom hairline
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(SpindareColors.hairlineColor())
                    .align(Alignment.BottomCenter)
            )
        }
    }
}

@Composable
private fun HeaderIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    count: Int = 0,
    badgeColor: Color = Color.Red,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .spindarePop(onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = SpindareColors.primaryColor(),
            modifier = Modifier.size(19.dp)
        )
        
        if (count > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (-4).dp, y = 4.dp)
                    .size(15.dp)
                    .clip(CircleShape)
                    .background(badgeColor),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (count > 9) "9+" else count.toString(),
                    color = Color.White,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.sp
                    )
                )
            }
        }
    }
}
