package al.spind.spindare.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * Ported from SpindareKit/Design/DesignTokens.swift.
 * 1:1 Color alignment to eliminate "HTML/Generic" feel.
 */
object SpindareColors {
    val Cream = Color(0xFFFAF9F6)
    val Ink = Color(0xFF4A4A4A)
    val Accent = Color(0xFFA7BBC7)
    val AccentDeep = Color(0xFF6B8A99)

    // Dark mode
    val InkDark = Color(0xFF1C1C1E)      // app background
    val SurfaceDark = Color(0xFF3A3A3C)  // elevated surface
    val TextOnDark = Color(0xFFE5E5EA)

    // Text Greys
    val TextSecondary = Color(0xFF6E6E73)
    val TextTertiary = Color(0xFF8A8A8E)

    // Semantic
    val Success = Color(0xFF34C759)
    val Danger = Color(0xFFFF3B30)

    // Reactions
    val Felt = Color(0xFF007AFF)
    val Thought = Color(0xFFFFD60A)
    val Intrigued = Color(0xFF5856D6)

    @Composable
    fun backgroundColor() = if (isSystemInDarkTheme()) InkDark else Cream

    @Composable
    fun surfaceColor() = if (isSystemInDarkTheme()) SurfaceDark else Color.White

    @Composable
    fun primaryColor() = if (isSystemInDarkTheme()) TextOnDark else Ink

    @Composable
    fun secondaryColor() = if (isSystemInDarkTheme()) TextTertiary else TextSecondary

    @Composable
    fun accentColor() = if (isSystemInDarkTheme()) Accent else AccentDeep

    @Composable
    fun hairlineColor(emphasis: Float = 1f) = if (isSystemInDarkTheme()) {
        Color.White.copy(alpha = 0.10f * emphasis)
    } else {
        Color.Black.copy(alpha = 0.05f * emphasis)
    }
}

object SpindareRadius {
    val tight = 4.dp
    val control = 12.dp
    val card = 20.dp
    val panel = 24.dp
    val sheet = 32.dp
}

object SpindareSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 14.dp
    val lg = 20.dp
    val gutter = 24.dp
    val xl = 32.dp
}

val SpindareTypography = Typography(
    titleLarge = TextStyle(
        fontWeight = FontWeight.Black,
        fontSize = 32.sp,
        letterSpacing = 5.sp
    ),
    headlineSmall = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        letterSpacing = (-0.4).sp
    ),
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 23.sp
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp
    ),
    labelSmall = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        letterSpacing = 2.sp
    )
)

private val DarkColorScheme = darkColorScheme(
    primary = SpindareColors.Accent,
    secondary = SpindareColors.TextTertiary,
    background = SpindareColors.InkDark,
    surface = SpindareColors.SurfaceDark
)

private val LightColorScheme = lightColorScheme(
    primary = SpindareColors.AccentDeep,
    secondary = SpindareColors.TextSecondary,
    background = SpindareColors.Cream,
    surface = Color.White
)

@Composable
fun SpindareTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SpindareTypography,
        content = content
    )
}
