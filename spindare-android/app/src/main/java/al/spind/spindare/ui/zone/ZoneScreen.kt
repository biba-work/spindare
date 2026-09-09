package al.spind.spindare.ui.zone

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import al.spind.spindare.model.Venue
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.ui.theme.*

@Composable
fun ZoneScreen() {
    val context = LocalContext.current
    val density = LocalDensity.current
    var venues by remember { mutableStateOf<List<Venue>>(emptyList()) }
    var selectedVenue by remember { mutableStateOf<Venue?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        venues = AppEnvironment.zone.venues()
        loading = false
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                MapView(ctx).apply {
                    setTileSource(TileSourceFactory.MAPNIK)
                    controller.setZoom(15.0)
                    controller.setCenter(GeoPoint(40.758896, -73.985130))
                    setMultiTouchControls(true)
                    @Suppress("DEPRECATION")
                    setBuiltInZoomControls(false)
                }
            },
            update = { mapView ->
                mapView.overlays.clear()
                venues.forEach { venue ->
                    val marker = Marker(mapView)
                    marker.position = GeoPoint(venue.latitude, venue.longitude)
                    marker.title = venue.name
                    
                    // Premium Custom Marker
                    val iconSize = with(density) { 44.dp.toPx() }.toInt()
                    val bitmap = Bitmap.createBitmap(iconSize, iconSize, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
                    
                    // Outer ring for sponsors
                    if (venue.sponsoredChallenge != null) {
                        paint.color = SpindareColors.Accent.copy(alpha = 0.55f).toArgb()
                        canvas.drawCircle(iconSize/2f, iconSize/2f, iconSize/2f, paint)
                    }
                    
                    // Inner white border
                    paint.color = android.graphics.Color.WHITE
                    canvas.drawCircle(iconSize/2f, iconSize/2f, (iconSize/2f) - (if (venue.sponsoredChallenge != null) 6f else 0f), paint)
                    
                    // Inner circle
                    paint.color = if (venue.sponsoredChallenge != null) SpindareColors.Felt.toArgb() else SpindareColors.TextSecondary.toArgb()
                    canvas.drawCircle(iconSize/2f, iconSize/2f, (iconSize/2f) - (if (venue.sponsoredChallenge != null) 10f else 4f), paint)
                    
                    marker.icon = android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    
                    marker.setOnMarkerClickListener { _, _ ->
                        selectedVenue = venue
                        true
                    }
                    mapView.overlays.add(marker)
                }
                mapView.invalidate()
            },
            modifier = Modifier.fillMaxSize()
        )

        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = SpindareColors.AccentDeep
            )
        }

        AnimatedVisibility(
            visible = selectedVenue != null,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically { it } + fadeIn(),
            exit = slideOutVertically { it } + fadeOut()
        ) {
            selectedVenue?.let { venue ->
                VenueDetailCard(
                    venue = venue,
                    onClose = { selectedVenue = null },
                    onTakeChallenge = { /* TODO */ }
                )
            }
        }
    }
}

@Composable
private fun VenueDetailCard(
    venue: Venue,
    onClose: () -> Unit,
    onTakeChallenge: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(SpindareSpacing.md)
            .padding(bottom = 100.dp),
        shape = RoundedCornerShape(SpindareRadius.panel),
        color = SpindareColors.surfaceColor(),
        tonalElevation = 8.dp,
        shadowElevation = 12.dp
    ) {
        Column(
            modifier = Modifier.padding(SpindareSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(SpindareSpacing.md)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = venue.name,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = venue.category.name.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.5.sp),
                        color = SpindareColors.secondaryColor()
                    )
                }
                IconButton(
                    onClick = onClose,
                    modifier = Modifier.size(28.dp).background(SpindareColors.hairlineColor(1.4f), CircleShape)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Close", modifier = Modifier.size(12.dp))
                }
            }

            Text(
                text = venue.blurb,
                style = MaterialTheme.typography.bodyMedium,
                color = SpindareColors.secondaryColor()
            )

            venue.sponsoredChallenge?.let { challenge ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(SpindareRadius.control))
                        .background(SpindareColors.Accent.copy(alpha = 0.14f))
                        .padding(SpindareSpacing.md),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "SPONSORED CHALLENGE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp
                        ),
                        color = SpindareColors.AccentDeep
                    )
                    Text(
                        text = challenge,
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                        color = SpindareColors.primaryColor()
                    )
                }

                SpindareButton(
                    label = "Do this",
                    onClick = onTakeChallenge
                )
                
                Text(
                    text = "Posts for sponsored challenges appear to others 5 minutes after posting.",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = SpindareColors.secondaryColor()
                )
            }
        }
    }
}
