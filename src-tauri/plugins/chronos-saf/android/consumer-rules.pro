# The release APK is minified, and the plugin is only ever reached by
# reflection: Tauri looks up @Command and @ActivityCallback methods by name.
# Without this the folder picker is stripped out of a release build and only
# fails once it is in someone's hands.
-keep class de.f1rlefanz.chronos.saf.* {
  @app.tauri.annotation.Command <methods>;
  @app.tauri.annotation.ActivityCallback <methods>;
}
