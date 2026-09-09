package al.spind.spindare

import android.app.Application
import al.spind.spindare.services.AppEnvironment

/**
 * Mirrors SpindareApp.swift's `init` — Clerk has to be configured before any
 * screen renders, which for Android means Application.onCreate rather than a
 * composable's side effect.
 */
class SpindareApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppEnvironment.bootstrap(
            context = this,
            clerkPublishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY,
            apiBaseUrl = BuildConfig.API_BASE_URL,
            debug = BuildConfig.DEBUG,
        )
    }
}
