# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ─── React Native core ────────────────────────────────────────────────────────
# The RN bridge uses reflection to find and instantiate native modules.
# Stripping any of these will silently break native functionality.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep all ReactPackage implementations (module registries)
-keep class * implements com.facebook.react.ReactPackage { *; }

# Keep all native module classes (anything extending ReactContextBaseJavaModule)
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# ─── Expo modules ─────────────────────────────────────────────────────────────
# expo-secure-store, expo-web-browser, expo-camera, expo-image-picker,
# expo-video, expo-haptics, expo-font — all use the Expo module registry
-keep class expo.modules.** { *; }
-keep class * implements expo.modules.kotlin.modules.Module { *; }
-keep class * extends expo.modules.core.BasePackage { *; }
-keep class * implements expo.modules.core.interfaces.Package { *; }

# Expo application initializer
-keep class host.exp.exponent.** { *; }

# ─── Clerk ────────────────────────────────────────────────────────────────────
# @clerk/clerk-expo is JS-only but relies on expo-secure-store (kept above)
# and expo-web-browser for OAuth. Both are covered. Keep the Clerk JS bridge:
-keep class com.clerk.** { *; }
-dontwarn com.clerk.**

# ─── Stream Chat ──────────────────────────────────────────────────────────────
-keep class io.getstream.** { *; }
-dontwarn io.getstream.**

# ─── OkHttp / networking ──────────────────────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**

# ─── JavaScript interface bridge ──────────────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Native methods ───────────────────────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ─── Serialization safety ─────────────────────────────────────────────────────
-keep class * implements android.os.Parcelable { *; }
-keep class * implements java.io.Serializable { *; }

# ─── Suppress common warnings from RN ecosystem ───────────────────────────────
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn expo.modules.**
