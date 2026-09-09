package al.spind.spindare.ui.shell

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import al.spind.spindare.model.Conversation
import al.spind.spindare.ui.challenges.SpinnerOverlay
import al.spind.spindare.ui.feed.FeedScreen
import al.spind.spindare.ui.profile.ProfileScreen
import al.spind.spindare.ui.speedys.SpeedysScreen
import al.spind.spindare.ui.zone.ZoneScreen
import al.spind.spindare.ui.chat.ChatScreen
import al.spind.spindare.ui.chat.ChatTranscriptScreen
import al.spind.spindare.ui.theme.*

enum class AppPage { PROFILE, FEED, NOTIFICATIONS }

@Composable
fun AppShell(onExitToGallery: (() -> Unit)? = null) {
    val pagerState = rememberPagerState(initialPage = 1) { AppPage.entries.size }
    
    var mode by remember { mutableStateOf(AppMode.FEED) }
    var showSpinner by remember { mutableStateOf(false) }
    var activeConversation by remember { mutableStateOf<Conversation?>(null) }
    var activeLayer by remember { mutableStateOf<AppLayer?>(null) }
    
    val isReceded = activeLayer != null || showSpinner || activeConversation != null
    
    val backgroundScale by animateFloatAsState(
        targetValue = if (isReceded) 0.94f else 1f,
        animationSpec = SpindareMotion.Enter,
        label = "bgScale"
    )
    
    val backgroundDim by animateFloatAsState(
        targetValue = if (isReceded) 0.18f else 0f,
        animationSpec = SpindareMotion.Enter,
        label = "bgDim"
    )

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .scale(backgroundScale)
                .background(SpindareColors.backgroundColor())
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                beyondViewportPageCount = 1,
                userScrollEnabled = !isReceded
            ) { pageIndex ->
                when (AppPage.entries[pageIndex]) {
                    // Spin lives on the profile per the redesign, not floating
                    // over the feed — it's the one screen that's unambiguously
                    // "yours," which is where starting a challenge belongs.
                    AppPage.PROFILE -> ProfileScreen(onSpinnerClick = { showSpinner = true })
                    AppPage.FEED -> FeedPage(
                        mode = mode,
                        onModeChange = { mode = it },
                        onChatClick = { activeLayer = AppLayer.CHAT }
                    )
                    AppPage.NOTIFICATIONS -> NotificationsPlaceholder()
                }
            }
            
            if (backgroundDim > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = backgroundDim))
                )
            }
            
            CameraPunchBorder()
        }
        
        if (showSpinner) {
            SpinnerOverlay(
                options = al.spind.spindare.model.Challenges.all,
                onClose = { showSpinner = false },
                onResult = { showSpinner = false }
            )
        }

        activeConversation?.let { conversation ->
            Box(modifier = Modifier.fillMaxSize().background(SpindareColors.backgroundColor())) {
                ChatTranscriptScreen(
                    conversation = conversation,
                    onBack = { activeConversation = null }
                )
            }
        }

        if (onExitToGallery != null && !isReceded) {
            Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.BottomStart) {
                FilledTonalButton(onClick = onExitToGallery, modifier = Modifier.scale(0.8f)) {
                    Text("Exit Gallery")
                }
            }
        }
        
        activeLayer?.let { layer ->
            Box(modifier = Modifier.fillMaxSize().background(SpindareColors.backgroundColor())) {
                when (layer) {
                    AppLayer.CHAT -> ChatScreen(onConversationClick = { 
                        activeConversation = it
                        activeLayer = null 
                    })
                    else -> Column(
                        modifier = Modifier.fillMaxSize().padding(SpindareSpacing.xl),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Layer ${layer.name} Placeholder")
                        SpindareButton(label = "Close", onClick = { activeLayer = null })
                    }
                }
            }
        }
    }
}

@Composable
private fun FeedPage(
    mode: AppMode,
    onModeChange: (AppMode) -> Unit,
    onChatClick: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        when (mode) {
            AppMode.FEED -> FeedScreen()
            AppMode.SPEEDYS -> SpeedysScreen()
            AppMode.ZONE -> ZoneScreen()
        }

        if (mode == AppMode.FEED) {
            AppHeader(
                modifier = Modifier.align(Alignment.TopCenter),
                onSavedClick = onChatClick
            )
        }

        ModeSwitcher(
            mode = mode,
            onModeChange = onModeChange,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                // enableEdgeToEdge() means content draws behind the system nav
                // bar/gesture pill too, same as the status bar — without this
                // the pill can render flush against or under it depending on
                // the device's nav mode.
                .navigationBarsPadding()
                .padding(bottom = SpindareSpacing.lg)
        )
    }
}

@Composable
fun NotificationsPlaceholder() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Notifications coming soon", color = SpindareColors.primaryColor())
    }
}

enum class AppLayer { CHAT, COMPOSER, SETTINGS }
