package al.spind.spindare.ui.challenges

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.unit.dp
import al.spind.spindare.ui.theme.SpindareColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.*

@Composable
fun SpinWheel(
    options: List<String>,
    modifier: Modifier = Modifier,
    canSpin: Boolean = true,
    onSpinEnd: (String) -> Unit = {}
) {
    var rotation by remember { mutableStateOf(0f) }
    var isSpinning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    val deceleration = 0.998f
    val restingVelocity = 12f
    val tickAngle = 360f / 48f
    
    val velocityTracker = remember { VelocityTracker() }

    // Colors resolved here to avoid Composable calls inside Canvas draw block
    val bgColor = SpindareColors.backgroundColor()
    val primaryColor = SpindareColors.primaryColor()
    val hairlineColor = SpindareColors.hairlineColor()
    val accentColor = SpindareColors.Accent

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .pointerInput(canSpin) {
                if (!canSpin) return@pointerInput
                detectDragGestures(
                    onDragStart = { isSpinning = false },
                    onDrag = { change, dragAmount ->
                        val center = Offset(size.width / 2f, size.height / 2f)
                        val pos = change.position
                        val prevPos = pos - dragAmount
                        
                        val angle = atan2(pos.y - center.y, pos.x - center.x)
                        val prevAngle = atan2(prevPos.y - center.y, prevPos.x - center.x)
                        
                        var delta = (angle - prevAngle).toDegrees()
                        if (delta > 180) delta -= 360
                        if (delta < -180) delta += 360
                        
                        rotation += delta
                        velocityTracker.addPosition(change.uptimeMillis, change.position)
                    },
                    onDragEnd = {
                        val velocity = velocityTracker.calculateVelocity()
                        val speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y) * 0.1f
                        
                        if (speed > 15f) {
                            isSpinning = true
                            scope.launch {
                                var currentVelocity = speed * 12f
                                val step = 1f / 60f
                                
                                while (currentVelocity > restingVelocity) {
                                    rotation += currentVelocity * step
                                    currentVelocity *= deceleration
                                    delay(16)
                                }
                                
                                isSpinning = false
                                val segmentAngle = 360f / options.size
                                val landedIndex = (((270f - rotation) % 360f + 360f) % 360f / segmentAngle).toInt()
                                val targetRotation = 270f - (landedIndex * segmentAngle + segmentAngle / 2f)
                                
                                animate(
                                    initialValue = rotation,
                                    targetValue = targetRotation,
                                    animationSpec = spring(dampingRatio = 0.6f, stiffness = Spring.StiffnessLow)
                                ) { value, _ ->
                                    rotation = value
                                }
                                
                                onSpinEnd(options[landedIndex % options.size])
                            }
                        }
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val r = size.minDimension / 2f
            val center = Offset(size.width / 2f, size.height / 2f)
            
            drawCircle(
                color = bgColor,
                radius = r - 2.dp.toPx(),
                center = center
            )
            
            withTransform({
                rotate(rotation, center)
            }) {
                for (i in 0 until 48) {
                    val isAccent = i % 12 == 0
                    val angle = (i * tickAngle - 90).toRadians()
                    val outer = r - 2.dp.toPx()
                    val inner = r - 20.dp.toPx()
                    
                    drawLine(
                        color = if (isAccent) accentColor else hairlineColor,
                        start = Offset(center.x + cos(angle) * outer, center.y + sin(angle) * outer),
                        end = Offset(center.x + cos(angle) * inner, center.y + sin(angle) * inner),
                        strokeWidth = (if (isAccent) 2.dp else 1.dp).toPx()
                    )
                }
                
                val hub = r * 0.3f
                drawCircle(
                    color = bgColor,
                    radius = hub,
                    center = center
                )
                drawCircle(
                    color = primaryColor,
                    radius = hub,
                    center = center,
                    style = Stroke(width = 1.dp.toPx())
                )
            }
            
            val pointerPath = Path().apply {
                moveTo(center.x, center.y - r + 4.dp.toPx())
                lineTo(center.x + 10.dp.toPx(), center.y - r + 14.dp.toPx())
                lineTo(center.x, center.y - r + 34.dp.toPx())
                lineTo(center.x - 10.dp.toPx(), center.y - r + 14.dp.toPx())
                close()
            }
            drawPath(path = pointerPath, color = primaryColor)
        }
    }
}

private fun Float.toDegrees() = this * 180f / PI.toFloat()
private fun Float.toRadians() = this * PI.toFloat() / 180f
