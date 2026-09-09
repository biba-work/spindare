package al.spind.spindare.ui.theme

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.*

/**
 * Ported from SpindareKit/Design/DesignTokens.swift.
 * Unified interaction for all interactive elements.
 */
@Composable
fun Modifier.spindarePop(onClick: () -> Unit): Modifier {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.96f else 1f,
        animationSpec = SpindareMotion.Pop,
        label = "pop"
    )

    return this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clickable(
            interactionSource = interactionSource,
            indication = null,
            onClick = onClick
        )
}

/**
 * 1:1 match for iOS primary action buttons (hairline or solid ink).
 */
@Composable
fun SpindareButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String = "",
    isLoading: Boolean = false,
    enabled: Boolean = true,
    style: SpindareButtonStyle = SpindareButtonStyle.Primary
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.97f else 1.0f,
        animationSpec = SpindareMotion.Pop,
        label = "btnScale"
    )

    val containerColor = when(style) {
        SpindareButtonStyle.Primary -> SpindareColors.Ink
        SpindareButtonStyle.Secondary -> SpindareColors.hairlineColor(1.2f)
        SpindareButtonStyle.Ghost -> Color.Transparent
    }
    
    val contentColor = when(style) {
        SpindareButtonStyle.Primary -> Color.White
        else -> SpindareColors.primaryColor()
    }

    Surface(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier
            .height(if (style == SpindareButtonStyle.Secondary) 44.dp else 56.dp)
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            },
        shape = RoundedCornerShape(if (style == SpindareButtonStyle.Secondary) SpindareRadius.control else SpindareRadius.card),
        color = if (enabled) containerColor else containerColor.copy(alpha = 0.5f),
        contentColor = contentColor,
        interactionSource = interactionSource,
        content = {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = contentColor)
                } else {
                    Text(
                        text = label.uppercase(),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.5.sp
                        )
                    )
                }
            }
        }
    )
}

enum class SpindareButtonStyle { Primary, Secondary, Ghost }

/**
 * High-fidelity card mirroring Spindare.Shadow.card and Radius.card.
 */
@Composable
fun SpindareCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(SpindareRadius.card),
    color: Color = SpindareColors.surfaceColor(),
    borderEmphasis: Float = 1f,
    content: @Composable () -> Unit
) {
    Surface(
        modifier = modifier
            .shadow(
                elevation = 2.dp,
                shape = shape,
                ambientColor = Color.Black.copy(alpha = 0.04f),
                spotColor = Color.Black.copy(alpha = 0.04f)
            )
            .border(BorderStroke(1.dp, SpindareColors.hairlineColor(borderEmphasis)), shape),
        shape = shape,
        color = color,
        content = content
    )
}

@Composable
fun SpindareTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp),
        enabled = enabled,
        placeholder = {
            Text(
                text = placeholder,
                style = MaterialTheme.typography.bodyLarge.copy(
                    color = SpindareColors.primaryColor().copy(alpha = 0.4f)
                )
            )
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = SpindareColors.primaryColor().copy(alpha = 0.05f),
            unfocusedContainerColor = SpindareColors.primaryColor().copy(alpha = 0.05f),
            disabledContainerColor = SpindareColors.primaryColor().copy(alpha = 0.02f),
            focusedBorderColor = SpindareColors.hairlineColor(),
            unfocusedBorderColor = SpindareColors.hairlineColor(),
            disabledBorderColor = SpindareColors.hairlineColor(),
            focusedTextColor = SpindareColors.primaryColor(),
            unfocusedTextColor = SpindareColors.primaryColor()
        ),
        shape = RoundedCornerShape(SpindareRadius.card),
        singleLine = true,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions
    )
}

@Composable
fun SpindareLabel(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = SpindareColors.primaryColor().copy(alpha = 0.6f)
) {
    Text(
        text = text.uppercase(),
        modifier = modifier,
        style = MaterialTheme.typography.labelSmall,
        color = color
    )
}

/**
 * signature expandable challenge pill.
 */
@Composable
fun ChallengePill(
    text: String,
    modifier: Modifier = Modifier,
    expanded: Boolean = false,
    onClick: () -> Unit = {}
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(SpindareRadius.control),
        color = SpindareColors.accentColor().copy(alpha = 0.18f),
        contentColor = SpindareColors.accentColor()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.sp
                ),
                maxLines = if (expanded) Int.MAX_VALUE else 1,
                modifier = Modifier.weight(1f, fill = false)
            )
            val rotation by animateFloatAsState(if (expanded) 180f else 0f)
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                modifier = Modifier.size(12.dp).graphicsLayer { rotationZ = rotation }
            )
        }
    }
}

/** Which bespoke glyph a reaction button draws. Mirrors ReactionType in Models.kt. */
enum class ReactionGlyphType { FELT, THOUGHT, INTRIGUED }

/**
 * iOS-matched Reaction Button.
 *
 * The glyph is a bespoke shape per reaction, ported from ReactionGlyph in
 * SpindareKit/Views/ReactionRow.swift — not a generic dot or a stock icon.
 * Users learn these shapes as the reaction's identity, so a shared glyph for
 * all three (the previous Android implementation) reads as "no icons at all."
 */
@Composable
fun ReactionButton(
    label: String,
    count: Int,
    color: Color,
    glyph: ReactionGlyphType,
    isActive: Boolean = false,
    onImage: Boolean = false,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.spindarePop(onClick)
    ) {
        Box(
            modifier = Modifier
                .size(if (onImage) 40.dp else 46.dp)
                .clip(CircleShape)
                .background(if (isActive) color else Color.White.copy(alpha = 0.16f))
                .border(
                    if (isActive) BorderStroke(0.dp, Color.Transparent)
                    else BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            ReactionGlyph(type = glyph, color = if (isActive) Color.White else color)
        }
        
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 8.sp,
                letterSpacing = 1.2.sp,
                color = if (onImage) Color.White else SpindareColors.secondaryColor()
            )
        )
        
        if (!onImage) {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = SpindareColors.primaryColor()
                )
            )
        }
    }
}

/**
 * A ring drawn around the device's actual front-camera cutout, if it has one.
 *
 * The previous implementation drew a hardcoded 28dp circle fixed to top-center —
 * that only happens to line up on a device whose punch-hole is centered and
 * exactly that size. Most Android phones aren't: cutouts vary in position
 * (centered, left, right) and diameter across manufacturers. This reads the
 * real [DisplayCutout] geometry from the window insets and draws the ring
 * around whatever is actually there, inset by [borderWidth] outward, and
 * draws nothing on a device with no cutout (under-display camera, older
 * notch-free hardware) rather than showing a phantom ring.
 */
@Composable
fun CameraPunchBorder(
    modifier: Modifier = Modifier,
    color: Color = SpindareColors.Accent.copy(alpha = 0.3f),
    borderWidth: Dp = 8.dp
) {
    val view = LocalView.current
    val density = LocalDensity.current
    var cutoutRectPx by remember { mutableStateOf<android.graphics.Rect?>(null) }

    // WindowInsets change on rotation/fold, so this must re-read rather than
    // capture the cutout once at first composition.
    DisposableEffect(view) {
        val listener = android.view.View.OnApplyWindowInsetsListener { v, insets ->
            cutoutRectPx = insets.displayCutout?.boundingRects?.firstOrNull()
            v.onApplyWindowInsets(insets)
        }
        view.setOnApplyWindowInsetsListener(listener)
        view.requestApplyInsets()
        onDispose { view.setOnApplyWindowInsetsListener(null) }
    }

    val rectPx = cutoutRectPx ?: return
    with(density) {
        val widthDp = rectPx.width().toDp()
        val heightDp = rectPx.height().toDp()
        val topDp = rectPx.top.toDp()
        val leftDp = rectPx.left.toDp()
        val diameter = maxOf(widthDp, heightDp) + borderWidth * 2

        Canvas(
            modifier = modifier
                .offset(x = leftDp - borderWidth, y = topDp - borderWidth)
                .size(diameter)
        ) {
            drawCircle(color = color, radius = size.width / 2, style = Stroke(width = 2.dp.toPx()))
            drawCircle(
                color = color.copy(alpha = 0.1f),
                radius = size.width / 2 + 4.dp.toPx(),
                style = Stroke(width = 4.dp.toPx())
            )
        }
    }
}

@Composable
fun MorphingPullHandle(
    pullProgress: Float,
    modifier: Modifier = Modifier,
    color: Color = SpindareColors.primaryColor().copy(alpha = 0.4f)
) {
    Canvas(modifier = modifier.size(width = 40.dp, height = 12.dp)) {
        val width = size.width
        val height = size.height
        val lift = (10.dp.toPx() * pullProgress.coerceIn(0f, 1f))
        
        val path = Path().apply {
            moveTo(0f, height / 2)
            quadraticTo(width / 2, height / 2 - lift, width, height / 2)
        }
        
        drawPath(
            path = path,
            color = color,
            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
        )
    }
}

@Composable
fun OnboardingBackground(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        SpindareColors.Cream.copy(alpha = 0.95f),
                        SpindareColors.Cream
                    )
                )
            )
    ) {
        content()
    }
}

/**
 * Ported from ReactionGlyph in SpindareKit/Views/ReactionRow.swift. Each
 * reaction gets its own silhouette — users learn these as the reaction's
 * identity, so a shared dot for all three defeats the point of having icons.
 */
@Composable
fun ReactionGlyph(type: ReactionGlyphType, color: Color, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(18.dp), contentAlignment = Alignment.Center) {
        when (type) {
            ReactionGlyphType.FELT -> FeltGlyph(color)
            ReactionGlyphType.THOUGHT -> ThoughtGlyph(color)
            ReactionGlyphType.INTRIGUED -> IntriguedGlyph(color)
        }
    }
}

/** Three dots orbiting the center, pinching inward at the midpoint of their revolution. */
@Composable
private fun FeltGlyph(color: Color) {
    val transition = rememberInfiniteTransition(label = "felt")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing)),
        label = "feltPhase"
    )
    Canvas(modifier = Modifier.size(18.dp)) {
        val center = Offset(size.width / 2, size.height / 2)
        // Radius pinches 7 -> 2 -> 7 across one revolution — the collapse at
        // the midpoint is the glyph's signature, not an animation afterthought.
        val pinch = kotlin.math.abs(phase - 0.5f) * 2f
        val orbitRadius = (2.dp.toPx() + pinch * 5.dp.toPx())
        repeat(3) { i ->
            val angle = (i * 120f + phase * 360f) * (kotlin.math.PI / 180f)
            val dot = Offset(
                center.x + orbitRadius * kotlin.math.cos(angle).toFloat(),
                center.y + orbitRadius * kotlin.math.sin(angle).toFloat()
            )
            drawCircle(color = color, radius = 2.5.dp.toPx(), center = dot)
        }
    }
}

/** Three bars that extend and settle at half-height — "still thinking." */
@Composable
private fun ThoughtGlyph(color: Color) {
    val transition = rememberInfiniteTransition(label = "thought")
    val phase by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "thoughtPhase"
    )
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        val offsets = listOf(3.dp, (-3).dp, 3.dp)
        repeat(3) { i ->
            Box(
                modifier = Modifier
                    .offset(y = offsets[i])
                    .width(2.5.dp)
                    .height(5.dp + (6.dp * phase))
                    .clip(RoundedCornerShape(1.25.dp))
                    .background(color)
            )
        }
    }
}

/** A broken axis that rotates once per pulse while a glow blooms at the center. */
@Composable
private fun IntriguedGlyph(color: Color) {
    val transition = rememberInfiniteTransition(label = "intrigued")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(2200, easing = LinearEasing)),
        label = "intriguedRotation"
    )
    Canvas(modifier = Modifier.size(18.dp)) {
        val c = Offset(size.width / 2, size.height / 2)
        rotate(rotation, pivot = c) {
            for (dy in listOf(-6.5f, 6.5f)) {
                drawCircle(color = color, radius = 1.75.dp.toPx(), center = Offset(c.x, c.y + dy.dp.toPx()))
            }
            for (dx in listOf(-6.5f, 6.5f)) {
                val inner = if (dx < 0) c.x - 3.dp.toPx() else c.x + 3.dp.toPx()
                drawLine(
                    color = color,
                    start = Offset(c.x + dx.dp.toPx(), c.y),
                    end = Offset(inner, c.y),
                    strokeWidth = 2.5.dp.toPx()
                )
            }
        }
    }
}
