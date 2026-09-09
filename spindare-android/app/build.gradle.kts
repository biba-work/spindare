plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    // Lowercase on purpose. `namespace` is the Kotlin/Java package the generated
    // R and BuildConfig classes live in, and Android package names are lowercase
    // by convention — uppercase segments trip lint and are a case-sensitivity
    // hazard on Linux CI. It does not have to match `applicationId`; decoupling
    // the two is exactly why both fields exist.
    namespace = "al.spind.spindare"
    compileSdk = 36

    defaultConfig {
        // Matches the iOS PRODUCT_BUNDLE_IDENTIFIER (al.SPIND.Spindare) exactly.
        // This is the store/device identity — keeping it identical across both
        // platforms keeps deep links, analytics, and console listings aligned.
        applicationId = "al.SPIND.Spindare"
        // 24 is Clerk's floor (clerk-android requires minSdk 24+).
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Mirrors SpindareApp.swift's two constants. The Clerk publishable key
        // is client-safe by design (it is the `pk_test_`/`pk_live_` key, not the
        // secret key — that one must never reach a client bundle).
        buildConfigField(
            "String",
            "CLERK_PUBLISHABLE_KEY",
            "\"pk_test_ZW5oYW5jZWQtdXJjaGluLTkuY2xlcmsuYWNjb3VudHMuZGV2JA\"",
        )
        // Empty string keeps the app on on-device mock data while auth stays
        // real, exactly like the iOS build. Point it at the deployed Nest API
        // (or a LAN IP such as "http://10.0.2.2:3000" for the emulator talking
        // to a locally-run server) to go live.
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        // java.time on minSdk 24 needs desugaring; the models parse ISO-8601
        // timestamps with Instant rather than hand-rolling a date parser.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.clerk.api)
    // clerk-android-ui is deliberately NOT included. The app builds its own
    // onboarding to match the iOS flow (username + interests, custom styling),
    // so the prebuilt components are unused weight — and D8 emits a metadata
    // warning for every one of its sealed-class states, which buried the build
    // log under ~400k lines and made dexing take minutes. Add it back only if
    // Clerk's drop-in screens are actually adopted.

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.osmdroid)

    coreLibraryDesugaring(libs.desugar.jdk.libs)
    testImplementation(libs.junit)
}
