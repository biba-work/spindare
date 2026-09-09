package al.spind.spindare.ui.theme

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.rememberSplineBasedDecay
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.AnchoredDraggableState
import androidx.compose.foundation.gestures.DraggableAnchors
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.anchoredDraggable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

enum class DragValue { Resting, Actions }

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SwipeActionRow(
    modifier: Modifier = Modifier,
    onArchive: (() -> Unit)? = null,
    onMute: (() -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val density = LocalDensity.current
    val actionWidth = 80.dp
    val actionWidthPx = with(density) { actionWidth.toPx() }
    
    val decayAnimationSpec = rememberSplineBasedDecay<Float>()
    val snapAnimationSpec = spring<Float>(
        dampingRatio = 0.85f,
        stiffness = Spring.StiffnessLow
    )

    val state = remember(actionWidthPx) {
        AnchoredDraggableState(
            initialValue = DragValue.Resting,
            anchors = DraggableAnchors {
                DragValue.Resting at 0f
                DragValue.Actions at -actionWidthPx * (if (onDelete != null && onArchive != null) 2f else 1f)
            },
            positionalThreshold = { distance: Float -> distance * 0.5f },
            velocityThreshold = { with(density) { 100.dp.toPx() } },
            snapAnimationSpec = snapAnimationSpec,
            decayAnimationSpec = decayAnimationSpec
        )
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .background(SpindareColors.backgroundColor())
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onMute != null) {
                SwipeActionIcon(
                    icon = Icons.Default.NotificationsOff,
                    color = Color(0xFF8E8E93),
                    onClick = onMute
                )
            }
            if (onArchive != null) {
                SwipeActionIcon(
                    icon = Icons.Default.Archive,
                    color = Color(0xFF007AFF),
                    onClick = onArchive
                )
            }
            if (onDelete != null) {
                SwipeActionIcon(
                    icon = Icons.Default.Delete,
                    color = SpindareColors.Danger,
                    onClick = onDelete
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .offset {
                    IntOffset(
                        x = state.requireOffset().roundToInt(),
                        y = 0
                    )
                }
                .anchoredDraggable(state, Orientation.Horizontal)
                .background(SpindareColors.surfaceColor())
        ) {
            content()
        }
    }
}

@Composable
private fun SwipeActionIcon(
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .width(80.dp)
            .background(color),
        contentAlignment = Alignment.Center
    ) {
        IconButton(onClick = onClick) {
            Icon(icon, contentDescription = null, tint = Color.White)
        }
    }
}
