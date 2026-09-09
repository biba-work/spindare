package al.spind.spindare.ui.challenges

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.spind.spindare.ui.theme.*

@Composable
fun SpinnerOverlay(
    options: List<String>,
    onClose: () -> Unit,
    onResult: (String) -> Unit
) {
    var landedOption by remember { mutableStateOf<String?>(null) }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.8f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(SpindareSpacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "SPIN TO DARE",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 14.sp,
                    letterSpacing = 4.sp,
                    color = Color.White
                )
            )
            
            Spacer(modifier = Modifier.height(SpindareSpacing.xl))
            
            SpinWheel(
                options = options,
                modifier = Modifier.size(300.dp),
                onSpinEnd = {
                    landedOption = it
                }
            )
            
            Spacer(modifier = Modifier.height(SpindareSpacing.xl))
            
            AnimatedVisibility(
                visible = landedOption != null,
                enter = fadeIn() + expandVertically()
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = landedOption ?: "",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = SpindareSpacing.lg)
                    )
                    Spacer(modifier = Modifier.height(SpindareSpacing.lg))
                    SpindareButton(
                        label = "Accept Challenge",
                        onClick = { onResult(landedOption!!) }
                    )
                }
            }
        }
        
        IconButton(
            onClick = onClose,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(SpindareSpacing.lg)
                .statusBarsPadding()
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
        }
    }
}
