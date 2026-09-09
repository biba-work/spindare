package al.spind.spindare

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.api.Clerk
import al.spind.spindare.ui.auth.SignInScreen
import al.spind.spindare.ui.theme.SpindareTheme
import al.spind.spindare.ui.debug.ScreenGallery
import al.spind.spindare.ui.shell.AppShell

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SpindareTheme { 
                // Bypass auth for debugging UI alignment
                if (!al.spind.spindare.services.AppEnvironment.isLive) {
                    ScreenGallery()
                } else {
                    RootView() 
                }
            }
        }
    }
}

/**
 * Root routing, mirroring iOS's RootView: Clerk's own session state decides
 * whether onboarding or the app shows. Driving it from [Clerk.userFlow] rather
 * than a local `isSignedIn` flag is what makes a returning user land straight in
 * the app — the persisted session is restored by the SDK, and the UI just
 * follows it.
 */
@Composable
private fun RootView() {
    val initialized by Clerk.isInitialized.collectAsStateWithLifecycle()
    val user by Clerk.userFlow.collectAsStateWithLifecycle()

    if (!initialized) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (user == null) {
        // Signing in flips Clerk.userFlow, which recomposes this straight into
        // the app shell — so the callback has nothing left to do.
        SignInScreen(onSignedIn = {})
        return
    }

    AppShell()
}
