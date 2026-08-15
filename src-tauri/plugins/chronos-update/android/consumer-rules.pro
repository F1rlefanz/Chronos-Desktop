# The release APK is minified, and the plugin is only ever reached by
# reflection: Tauri looks up @Command methods by name. Without this the update
# check is stripped out of a release build and only fails once it is in
# someone's hands — which for an updater means it fails silently forever.
-keep class de.f1rlefanz.chronos.update.* {
  @app.tauri.annotation.Command <methods>;
}
