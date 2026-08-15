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

    kotlinOptions {
        // Matches app/build.gradle.kts, for the same reason as the SAF plugin:
        // two spellings of one setting in one build is how they drift apart.
        jvmTarget = "1.8"
    }
}

dependencies {
    // The Tauri Android runtime for Plugin/Invoke/JSObject, and androidx.core
    // for FileProvider — handing a file to another app needs a content URI, and
    // a file:// one has been refused since Android 7.
    implementation(project(":tauri-android"))
    implementation("androidx.core:core-ktx:1.13.1")
}
