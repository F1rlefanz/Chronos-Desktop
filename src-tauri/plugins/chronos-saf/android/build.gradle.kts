import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.f1rlefanz.chronos.saf"
    compileSdk = 37

    defaultConfig {
        // The app itself is 24; the Storage Access Framework has been there
        // since 21, so this puts no floor of its own under the app.
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
    // Everything the plugin needs and nothing else: the Tauri Android runtime
    // for Plugin/Invoke/JSObject, and androidx.activity for the ActivityResult
    // the folder picker comes back with. The Storage Access Framework itself is
    // in the platform — no androidx.documentfile.
    implementation(project(":tauri-android"))
    implementation("androidx.activity:activity-ktx:1.13.0")
}
