package al.spind.spindare.ui.debug

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import al.spind.spindare.ui.auth.SignInScreen
import al.spind.spindare.ui.feed.FeedScreen
import al.spind.spindare.ui.profile.ProfileScreen
import al.spind.spindare.ui.chat.ChatScreen
import al.spind.spindare.ui.shell.AppShell
import al.spind.spindare.ui.speedys.SpeedysScreen

enum class AppScreen {
    GALLERY, FULL_APP, SIGN_IN, FEED, SPEEDYS, PROFILE, CHAT
}

/**
 * A bypass for the sign-in wall during development.
 * Shows all implemented screens in mock mode.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenGallery() {
    var currentScreen by remember { mutableStateOf(AppScreen.GALLERY) }

    if (currentScreen == AppScreen.GALLERY) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Screen Gallery") },
                    actions = {
                        TextButton(onClick = { 
                            al.spind.spindare.services.AppEnvironment.resetMocks()
                        }) {
                            Text("Reset Mocks")
                        }
                    }
                )
            }
        ) { inner ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(inner),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val screens = AppScreen.entries.filter { it != AppScreen.GALLERY }
                items(screens) { screen ->
                    Button(
                        onClick = { currentScreen = screen },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Open ${screen.name}")
                    }
                }
            }
        }
    } else {
        Box(modifier = Modifier.fillMaxSize()) {
            when (currentScreen) {
                AppScreen.FULL_APP -> AppShell(onExitToGallery = { currentScreen = AppScreen.GALLERY })
                AppScreen.SIGN_IN -> SignInScreen(onSignedIn = { currentScreen = AppScreen.GALLERY })
                AppScreen.FEED -> FeedScreen()
                AppScreen.SPEEDYS -> SpeedysScreen()
                AppScreen.PROFILE -> ProfileScreen()
                AppScreen.CHAT -> ChatScreen(onConversationClick = { /* No-op in gallery */ })
                AppScreen.GALLERY -> {} // Handled above
            }
            
            // Exit overlay - allows switching screens at any time
            if (currentScreen != AppScreen.FULL_APP) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.BottomEnd
                ) {
                    FilledTonalButton(
                        onClick = { currentScreen = AppScreen.GALLERY },
                        modifier = Modifier.alpha(0.7f)
                    ) {
                        Text("Exit to Gallery")
                    }
                }
            }
        }
    }
}
