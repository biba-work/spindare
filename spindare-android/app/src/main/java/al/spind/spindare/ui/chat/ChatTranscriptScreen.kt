package al.spind.spindare.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.spind.spindare.model.*
import al.spind.spindare.services.AppEnvironment
import al.spind.spindare.services.MockSeed
import al.spind.spindare.ui.theme.*
import java.time.Instant

import androidx.compose.material.icons.filled.Call
import al.spind.spindare.ui.chat.CallScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatTranscriptScreen(
    conversation: Conversation,
    onBack: () -> Unit
) {
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var showCall by remember { mutableStateOf(false) }
    
    if (showCall) {
        CallScreen(
            username = conversation.otherUsername,
            onEndCall = { showCall = false }
        )
        return
    }

    LaunchedEffect(conversation.id) {
        messages = AppEnvironment.chat.messages(ConversationRef(conversation.id, conversation.otherUserId, conversation.otherUsername))
        if (messages.isEmpty() && !AppEnvironment.isLive) {
            messages = MockSeed.seedMessages(conversation.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        AsyncImage(
                            model = "https://api.dicebear.com/7.x/avataaars/svg?seed=${conversation.otherUsername}",
                            contentDescription = null,
                            modifier = Modifier.size(36.dp).clip(CircleShape).background(Color.LightGray)
                        )
                        Column {
                            Text(conversation.otherUsername, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold))
                            Text("Active now", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showCall = true }) {
                        Icon(Icons.Default.Call, contentDescription = "Call")
                    }
                    IconButton(onClick = { /* TODO */ }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SpindareColors.backgroundColor())
            )
        },
        bottomBar = {
            ChatInput(
                text = inputText,
                onTextChange = { inputText = it },
                onSend = {
                    // TODO: Real send
                    inputText = ""
                }
            )
        },
        containerColor = SpindareColors.backgroundColor()
    ) { inner ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(inner),
            contentPadding = PaddingValues(SpindareSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SpindareSpacing.sm),
            reverseLayout = false // In real app, might want true for bubble effect
        ) {
            items(messages) { message ->
                MessageBubble(message = message, isOwn = message.senderId == MockSeed.SELF_ID)
            }
        }
    }
}

@Composable
private fun MessageBubble(message: Message, isOwn: Boolean) {
    val alignment = if (isOwn) Alignment.CenterEnd else Alignment.CenterStart
    val color = if (isOwn) SpindareColors.Ink else SpindareColors.hairlineColor().copy(alpha = 0.5f)
    val textColor = if (isOwn) Color.White else SpindareColors.primaryColor()
    
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = alignment) {
        Surface(
            color = color,
            shape = RoundedCornerShape(
                topStart = 20.dp,
                topEnd = 20.dp,
                bottomStart = if (isOwn) 20.dp else 4.dp,
                bottomEnd = if (isOwn) 4.dp else 20.dp
            )
        ) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                Text(text = message.text, color = textColor, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun ChatInput(
    text: String,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().navigationBarsPadding(),
        color = SpindareColors.backgroundColor(),
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier.padding(SpindareSpacing.md).height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SpindareSpacing.sm)
        ) {
            IconButton(onClick = { /* TODO: Photo */ }) {
                Icon(Icons.Default.Photo, contentDescription = "Photo", tint = SpindareColors.primaryColor())
            }
            
            TextField(
                value = text,
                onValueChange = onTextChange,
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(24.dp)),
                placeholder = { Text("Message...") },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = SpindareColors.hairlineColor().copy(alpha = 0.1f),
                    unfocusedContainerColor = SpindareColors.hairlineColor().copy(alpha = 0.1f),
                    disabledContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                maxLines = 4
            )
            
            if (text.isNotBlank()) {
                IconButton(onClick = onSend) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = SpindareColors.AccentDeep)
                }
            } else {
                IconButton(onClick = { /* TODO: Voice */ }) {
                    Icon(Icons.Default.Mic, contentDescription = "Voice", tint = SpindareColors.primaryColor())
                }
            }
        }
    }
}

@Composable
private fun AsyncImage(model: Any?, contentDescription: String?, modifier: Modifier) {
    // Wrapper for Coil AsyncImage to avoid import spam
    coil3.compose.AsyncImage(model = model, contentDescription = contentDescription, modifier = modifier)
}
