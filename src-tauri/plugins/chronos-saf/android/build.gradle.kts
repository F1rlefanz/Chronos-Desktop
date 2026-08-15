plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.f1rlefanz.chronos.saf"
    compileSdk = 36

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

    kotlinOptions {
        // Matches app/build.gradle.kts. The newer compilerOptions DSL would
        // work as well, but two spellings of one setting in one build is how
        // they drift apart.
        jvmTarget = "1.8"
    }
}

dependencies {
    // Everything the plugin needs and nothing else: the Tauri Android runtime
    // for Plugin/Invoke/JSObject, and androidx.activity for the ActivityResult
    // the folder picker comes back with. The Storage Access Framework itself is
    // in the platform — no androidx.documentfile.
    implementation(project(":tauri-android"))
    implementation("androidx.activity:activity-ktx:1.10.1")
}
