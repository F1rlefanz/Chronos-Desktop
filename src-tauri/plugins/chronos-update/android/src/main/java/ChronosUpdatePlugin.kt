package de.f1rlefanz.chronos.update

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

@InvokeArg
class UrlArgs {
  lateinit var url: String
}

/**
 * Fetching the update manifest, and asking Android to install an APK.
 *
 * Two operations and no cleverness. The manifest is a small JSON file on a
 * public release; the APK is a few tens of megabytes fetched from the same
 * place. Neither is parsed here — what a version means is the front end's
 * business, and a Kotlin file that also knew the shape of the manifest would be
 * a second place to keep that true.
 *
 * The install is a *request*. Android reserves installing packages to itself:
 * this writes the APK where another app may read it, hands the system installer
 * a content URI and stops. The user sees Android's own screen and agrees to it,
 * or does not. There is no silent path and there should not be one.
 */
@TauriPlugin
class ChronosUpdatePlugin(private val activity: Activity) : Plugin(activity) {
  /**
   * One worker for every network call, as in the SAF plugin and for the same
   * reason: this runs on the thread the call arrived on otherwise, and that is
   * the one drawing the interface. A download of thirty megabytes on it is a
   * frozen app for as long as the network takes.
   */
  private val worker = Executors.newSingleThreadExecutor()

  /**
   * The [Invoke] is passed in rather than closed over so that anything the
   * block fails to catch still answers it. An unanswered call is a promise that
   * never settles — worse than an error, because the interface waits forever
   * with nothing to show.
   */
  private fun background(invoke: Invoke, block: () -> Unit) {
    worker.execute {
      try {
        block()
      } catch (error: Throwable) {
        invoke.reject(error.message ?: "Das Update ist fehlgeschlagen.")
      }
    }
  }

  /** Follows redirects itself: GitHub answers `releases/latest/download/…`
   *  with a 302 to a different host, and HttpURLConnection refuses to follow a
   *  redirect that changes protocol or host on its own. */
  private fun open(url: String, redirectsLeft: Int = 5): HttpURLConnection {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 30_000
    connection.instanceFollowRedirects = true
    connection.setRequestProperty("Accept", "*/*")

    val status = connection.responseCode
    val redirected = status == HttpURLConnection.HTTP_MOVED_PERM ||
      status == HttpURLConnection.HTTP_MOVED_TEMP ||
      status == HttpURLConnection.HTTP_SEE_OTHER ||
      status == 307 ||
      status == 308

    if (redirected && redirectsLeft > 0) {
      val next = connection.getHeaderField("Location")
      connection.disconnect()
      if (next != null) return open(next, redirectsLeft - 1)
    }

    if (status !in 200..299) {
      connection.disconnect()
      throw IllegalStateException("Der Server hat mit $status geantwortet.")
    }

    return connection
  }

  @Command
  fun fetchText(invoke: Invoke) {
    val args = invoke.parseArgs(UrlArgs::class.java)

    background(invoke) {
      try {
        val connection = open(args.url)
        val text = try {
          connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
          connection.disconnect()
        }

        invoke.resolve(JSObject().put("text", text))
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Die Update-Datei war nicht erreichbar.")
      }
    }
  }

  @Command
  fun downloadAndInstall(invoke: Invoke) {
    val args = invoke.parseArgs(UrlArgs::class.java)

    background(invoke) {
      try {
        // Into the cache directory on purpose: `file_paths.xml` already exposes
        // it to the FileProvider, and a half-finished download that the system
        // reclaims is a download worth losing. The name is fixed so a second
        // attempt overwrites the first rather than filling the cache up.
        val target = File(activity.cacheDir, "chronos-update.apk")

        val connection = open(args.url)
        try {
          connection.inputStream.use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
          }
        } finally {
          connection.disconnect()
        }

        if (target.length() == 0L) {
          invoke.reject("Die heruntergeladene Datei ist leer.")
          return@background
        }

        // Android 8 and newer: installing from anywhere but a store is a switch
        // in the system settings, per app. It cannot be flipped from here — the
        // best this can do is open the screen that holds it and say so.
        val mayInstall = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
          activity.packageManager.canRequestPackageInstalls()

        if (!mayInstall) {
          activity.runOnUiThread {
            try {
              activity.startActivity(
                Intent(
                  Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                  Uri.parse("package:${activity.packageName}")
                )
              )
            } catch (_: ActivityNotFoundException) {
              // Some builds do not carry that screen; the installer below will
              // then say so itself.
            }
          }

          invoke.resolve(
            JSObject().put("started", false).put("needsPermission", true)
          )
          return@background
        }

        val uri = FileProvider.getUriForFile(
          activity,
          "${activity.packageName}.fileprovider",
          target
        )

        // On the main thread, because that is where a launcher belongs — the
        // same rule the SAF plugin follows for its picker.
        activity.runOnUiThread {
          val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }

          try {
            activity.startActivity(intent)
            invoke.resolve(
              JSObject().put("started", true).put("needsPermission", false)
            )
          } catch (_: ActivityNotFoundException) {
            invoke.reject("Auf diesem Gerät gibt es keinen Installationsdienst.")
          }
        }
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Das Update konnte nicht geladen werden.")
      }
    }
  }
}
