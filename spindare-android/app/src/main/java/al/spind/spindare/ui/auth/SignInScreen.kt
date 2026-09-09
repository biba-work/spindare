package al.spind.spindare.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.network.serialization.errorMessage
import com.clerk.api.signin.SignIn
import kotlinx.coroutines.launch
import al.spind.spindare.ui.theme.*

@Composable
fun SignInScreen(onSignedIn: () -> Unit) {
    var step by remember { mutableStateOf(OnboardingStep.WELCOME) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    OnboardingBackground {
        Box(modifier = Modifier.fillMaxSize()) {
            when (step) {
                OnboardingStep.WELCOME -> WelcomeStep(
                    onLoginClick = { step = OnboardingStep.LOGIN },
                    onSignupClick = { /* TODO */ }
                )
                OnboardingStep.LOGIN -> LoginStep(
                    email = email,
                    onEmailChange = { email = it; error = null },
                    password = password,
                    onPasswordChange = { password = it; error = null },
                    error = error,
                    busy = busy,
                    onBack = { step = OnboardingStep.WELCOME },
                    onLogin = {
                        busy = true
                        error = null
                        scope.launch {
                            when (val result = Clerk.auth.signInWithPassword {
                                identifier = email.trim()
                                this.password = password
                            }) {
                                is ClerkResult.Success -> {
                                    if (result.value.status == SignIn.Status.COMPLETE) {
                                        onSignedIn()
                                    } else {
                                        error = "Extra verification needed (${result.value.status})."
                                    }
                                }
                                is ClerkResult.Failure -> error = result.errorMessage
                            }
                            busy = false
                        }
                    }
                )
            }
        }
    }
}

enum class OnboardingStep { WELCOME, LOGIN }

@Composable
private fun WelcomeStep(
    onLoginClick: () -> Unit,
    onSignupClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(SpindareSpacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.weight(1f))

        Box(
            modifier = Modifier
                .size(100.dp)
                .shadow(4.dp, RoundedCornerShape(30.dp))
                .clip(RoundedCornerShape(30.dp))
                .background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Text("S", style = SpindareTypography.titleLarge, fontSize = 40.sp, color = SpindareColors.Ink)
        }

        Spacer(modifier = Modifier.height(SpindareSpacing.lg))

        Text(
            "Spindare",
            style = SpindareTypography.titleLarge,
            fontSize = 32.sp,
            color = SpindareColors.Ink
        )

        Spacer(modifier = Modifier.height(SpindareSpacing.sm))

        Text(
            "Dare to be creative.",
            style = SpindareTypography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = SpindareColors.Ink
        )

        Spacer(modifier = Modifier.height(60.dp))

        SpindareButton(
            label = "Continue with Google",
            onClick = { /* TODO */ },
            style = SpindareButtonStyle.Ghost,
            modifier = Modifier.background(Color.White, RoundedCornerShape(SpindareRadius.card)).border(1.dp, SpindareColors.hairlineColor(), RoundedCornerShape(SpindareRadius.card))
        )

        Spacer(modifier = Modifier.height(SpindareSpacing.md))

        SpindareButton(
            label = "Log In",
            onClick = onLoginClick,
            style = SpindareButtonStyle.Primary
        )

        TextButton(onClick = onSignupClick) {
            Text(
                "Don't have an account? Create Account",
                style = SpindareTypography.bodyMedium,
                color = SpindareColors.Ink.copy(alpha = 0.6f)
            )
        }

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
private fun LoginStep(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    error: String?,
    busy: Boolean,
    onBack: () -> Unit,
    onLogin: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = SpindareSpacing.lg)
            .padding(top = 60.dp)
    ) {
        IconButton(
            onClick = onBack,
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White.copy(alpha = 0.8f))
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = SpindareColors.Ink
            )
        }

        Spacer(modifier = Modifier.height(SpindareSpacing.lg))

        Text(
            "Welcome Back",
            style = SpindareTypography.headlineSmall,
            fontWeight = FontWeight.ExtraBold,
            color = SpindareColors.Ink
        )

        Text(
            "Sign in to continue your streak.",
            style = SpindareTypography.bodyLarge,
            color = SpindareColors.Ink.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(SpindareSpacing.xl))

        SpindareTextField(
            value = email,
            onValueChange = onEmailChange,
            placeholder = "Email",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next)
        )

        Spacer(modifier = Modifier.height(SpindareSpacing.md))

        SpindareTextField(
            value = password,
            onValueChange = onPasswordChange,
            placeholder = "Password",
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done)
        )

        if (error != null) {
            Spacer(modifier = Modifier.height(SpindareSpacing.md))
            Text(
                error,
                color = SpindareColors.Danger,
                style = SpindareTypography.bodyMedium,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        SpindareButton(
            label = "Log In",
            onClick = onLogin,
            isLoading = busy,
            enabled = email.isNotBlank() && password.isNotBlank()
        )

        Spacer(modifier = Modifier.height(40.dp))
    }
}
