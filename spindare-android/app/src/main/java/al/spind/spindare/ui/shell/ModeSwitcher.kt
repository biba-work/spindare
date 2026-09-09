package al.spind.spindare.ui.shell

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Square
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import al.spind.spindare.ui.theme.*

enum class AppMode { FEED, SPEEDYS, ZONE }

/**
 * 1:1 Port of ModeSwitcher.swift.
 * Floating capsule with material background and animated active pill.
 */
@Composable
fun ModeSwitcher(
    mode: AppMode,
    onModeChange: (AppMode) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = SpindareColors.backgroundColor().copy(alpha = 0.9f),
        border = androidx.compose.foundation.BorderStroke(
            1.dp, 
            SpindareColors.hairlineColor(1.2f)
        ),
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier.padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AppMode.entries.forEach { item ->
                ModePill(
                    icon = when (item) {
                        AppMode.FEED -> Icons.Default.Square
                        AppMode.SPEEDYS -> Icons.Default.PlayArrow
                        AppMode.ZONE -> Icons.Default.Place
                    },
                    isActive = mode == item,
                    onClick = { onModeChange(item) }
                )
            }
        }
    }
}

@Composable
private fun ModePill(
    icon: ImageVector,
    isActive: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isActive) SpindareColors.primaryColor() else Color.Transparent,
        animationSpec = spring(dampingRatio = 0.9f, stiffness = 200f),
        label = "pillBg"
    )
    
    val iconColor by animateColorAsState(
        targetValue = if (isActive) SpindareColors.backgroundColor() else SpindareColors.primaryColor(),
        animationSpec = spring(dampingRatio = 0.9f, stiffness = 200f),
        label = "pillIcon"
    )

    Box(
        modifier = Modifier
            .size(width = 46.dp, height = 34.dp)
            .clip(CircleShape)
            .background(backgroundColor)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(17.dp),
            tint = iconColor
        )
    }
}
