import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.f1rlefanz.chronos.update"
    compileSdk = 36

    defaultConfig {
        // The app itself is 24. Nothing here needs more: FileProvider and the
        // installer intent have been there far longer, and the one newer call
        // — canRequestPackageInstalls, Android 8 — is guarded at the call site.
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

kotlin {
    // Kotlin and Java must target the same JVM level, or the build refuses to run.
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_1_8)
    }
}

dependencies {
    // The Tauri Android runtime for Plugin/Invoke/JSObject, and androidx.core
    // for FileProvider — handing a file to another app needs a content URI, and
    // a file:// one has been refused since Android 7.
    implementation(project(":tauri-android"))
    implementation("androidx.core:core-ktx:1.18.0")
}
