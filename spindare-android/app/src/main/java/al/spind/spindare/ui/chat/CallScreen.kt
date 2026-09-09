package al.spind.spindare.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.spind.spindare.ui.theme.*
import coil3.compose.AsyncImage

@Composable
fun CallScreen(
    username: String,
    onEndCall: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SpindareColors.Ink)
            .padding(SpindareSpacing.xl)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            AsyncImage(
                model = "https://api.dicebear.com/7.x/avataaars/svg?seed=$username",
                contentDescription = null,
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.1f))
            )
            
            Spacer(modifier = Modifier.height(SpindareSpacing.xl))
            
            Text(
                text = username,
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            
            Text(
                text = "Ringing...",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.6f)
            )
        }
        
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 60.dp),
            horizontalArrangement = Arrangement.spacedBy(32.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallActionButton(icon = Icons.Default.Mic, label = "Mute", onClick = {})
            
            IconButton(
                onClick = onEndCall,
                modifier = Modifier
                    .size(64.dp)
                    .background(SpindareColors.Felt, CircleShape)
            ) {
                Icon(Icons.Default.CallEnd, contentDescription = "End Call", tint = Color.White, modifier = Modifier.size(32.dp))
            }
            
            CallActionButton(icon = Icons.Default.VolumeUp, label = "Speaker", onClick = {})
        }
    }
}

@Composable
private fun CallActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        IconButton(
            onClick = onClick,
            modifier = Modifier
                .size(48.dp)
                .background(Color.White.copy(alpha = 0.1f), CircleShape)
        ) {
            Icon(icon, contentDescription = label, tint = Color.White)
        }
        Text(text = label, color = Color.White, fontSize = 12.sp)
    }
}
