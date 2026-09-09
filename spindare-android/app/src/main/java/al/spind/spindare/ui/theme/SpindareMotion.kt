package al.spind.spindare.ui.theme

import androidx.compose.animation.core.*
import androidx.compose.runtime.Composable

/**
 * Ported from SpindareKit/Design/DesignTokens.swift (Motion).
 * Two spring families for everything.
 */
object SpindareMotion {
    /** Slides, entrances, sheets. Smooth, fast, critically-damped. */
    val Enter = spring<Float>(
        dampingRatio = 0.95f,
        stiffness = 300f // Adjusted for response ~0.32s
    )

    /** Taps and reactions. Tactile and crisp, no excessive wobble. */
    val Pop = spring<Float>(
        dampingRatio = 0.80f,
        stiffness = 500f // Adjusted for response ~0.22s
    )

    /** Programmatic page changes. */
    val Page = spring<Float>(
        dampingRatio = 0.90f,
        stiffness = 200f
    )

    /** Snapping back. */
    val Settle = spring<Float>(
        dampingRatio = 0.85f,
        stiffness = 250f
    )
    
    /** iOS Apple/Instagram curve. */
    val AppleCurve = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)
}
