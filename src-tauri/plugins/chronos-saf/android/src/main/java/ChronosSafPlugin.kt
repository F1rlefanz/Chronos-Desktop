package de.f1rlefanz.chronos.saf

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.concurrent.Executors

@InvokeArg
class ConfigureArgs {
  lateinit var role: String
  lateinit var folder: String
}

@InvokeArg
class RoleArgs {
  lateinit var role: String
}

@InvokeArg
class NameArgs {
  lateinit var role: String
  lateinit var name: String
}

@InvokeArg
class WriteArgs {
  lateinit var role: String
  lateinit var name: String
  lateinit var contents: String
}

@InvokeArg
class WriteBytesArgs {
  lateinit var role: String
  lateinit var name: String
  lateinit var mimeType: String
  lateinit var base64: String
}

@InvokeArg
class OpenArgs {
  lateinit var role: String
  var name: String? = null
}

/**
 * Reading and writing the folders a user picked, through the Storage Access
 * Framework.
 *
 * The desktop opens a folder with a path and writes through a temporary file it
 * renames into place. Android hands out no path — the picker grants a
 * permission on a document *tree*, and every file inside it is reached through
 * the content provider that owns it. So this is not a port of the desktop code;
 * it is the same handful of operations against a different world.
 *
 * Deliberately without `androidx.documentfile`: `DocumentsContract` needs no
 * extra dependency and lists a folder in a single cursor query, where
 * `DocumentFile.listFiles()` costs one query per child.
 */
@TauriPlugin
class ChronosSafPlugin(private val activity: Activity) : Plugin(activity) {
  /**
   * The folders this plugin may touch, by role, set by [configure].
   *
   * Two of them, because they are two different things: `sync` is shared with
   * another device and holds one file per device, `files` is this phone's own
   * and holds what the app produces for its user to find. Same rule as
   * `sync_configure` on the desktop — a folder arrives once, is checked once,
   * and every later call names a file that is resolved against it.
   */
  private val roots = mutableMapOf<String, Uri>()

  private val resolver get() = activity.contentResolver

  /**
   * Every file operation runs here, never on the thread the call arrived on.
   *
   * A content provider is not a disk: answering can mean waiting on another app,
   * and on a cloud provider on a network. Doing that on the thread that drives
   * the interface is how an app stops drawing and the system kills it — and it
   * is not hypothetical: a folder deleted underneath us froze the interface for
   * seven seconds before this existed. A single thread, so two writes to the
   * same folder cannot interleave.
   */
  private val worker = Executors.newSingleThreadExecutor()

  /** Runs [work] off the caller's thread, and turns a throw into a rejection. */
  private fun background(invoke: Invoke, work: () -> Unit) {
    worker.execute {
      try {
        work()
      } catch (ex: Exception) {
        invoke.reject(ex.message ?: "Der Ordner konnte nicht gelesen werden.")
      }
    }
  }

  @Command
  fun pickFolder(invoke: Invoke) {
    // Not on the worker: this starts an activity rather than touching files,
    // and the launcher it goes through belongs to the main thread.
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
      Intent.FLAG_GRANT_READ_URI_PERMISSION or
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
    )
    startActivityForResult(invoke, intent, "folderPicked")
  }

  @ActivityCallback
  fun folderPicked(invoke: Invoke, result: ActivityResult) {
    val ret = JSObject()

    // Backing out of the picker is an answer, not a failure: whatever folder
    // was set before stays set.
    val uri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
    if (uri == null) {
      ret.put("uri", null)
      invoke.resolve(ret)
      return
    }

    try {
      // Without this the grant dies with the activity, and the folder chosen
      // today would be unreadable after the next start.
      resolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      )
      ret.put("uri", uri.toString())
      invoke.resolve(ret)
    } catch (ex: Exception) {
      invoke.reject(ex.message ?: "Der Ordner konnte nicht dauerhaft freigegeben werden.")
    }
  }

  /**
   * Accepts a folder chosen earlier, and refuses one that is no longer ours.
   *
   * Two different failures live here, and the difference matters to whoever
   * reads the message: the grant can be withdrawn (in the system settings, or
   * by reinstalling), and the folder itself can be gone (deleted, or on a card
   * that was taken out). Both messages name the cause only — the caller says
   * which folder it was about.
   */
  @Command
  fun configure(invoke: Invoke) {
    val args = invoke.parseArgs(ConfigureArgs::class.java)

    background(invoke) {
      if (!isKnownRole(args.role)) {
        invoke.reject("Unbekannter Ordner \"${args.role}\".")
        return@background
      }

      val uri = Uri.parse(args.folder)

      val granted = resolver.persistedUriPermissions.any {
        it.uri == uri && it.isReadPermission && it.isWritePermission
      }
      if (!granted) {
        invoke.reject("die Freigabe dafür besteht nicht mehr. Bitte den Ordner neu wählen.")
        return@background
      }

      // Cheapest proof that the folder is still there: ask it for its children.
      val cursor = resolver.query(
        childrenUri(uri),
        arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID),
        null, null, null
      )
      if (cursor == null) {
        invoke.reject("er ist nicht mehr da.")
        return@background
      }
      cursor.close()

      roots[args.role] = uri
      invoke.resolve(JSObject())
    }
  }

  @Command
  fun listFiles(invoke: Invoke) {
    val args = invoke.parseArgs(RoleArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))

      val names = mutableListOf<String>()
      resolver.query(
        childrenUri(root),
        arrayOf(
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_MIME_TYPE
        ),
        null, null, null
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          val name = cursor.getString(0) ?: continue
          if (cursor.getString(1) != DocumentsContract.Document.MIME_TYPE_DIR) names.add(name)
        }
      }

      val ret = JSObject()
      ret.put("files", JSArray.from(names.toTypedArray()))
      invoke.resolve(ret)
    }
  }

  @Command
  fun readFile(invoke: Invoke) {
    val args = invoke.parseArgs(NameArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))

      val ret = JSObject()
      val document = findChild(root, args.name)

      // A device that has not written yet is not an error.
      if (document == null) {
        ret.put("contents", null)
      } else {
        ret.put(
          "contents",
          resolver.openInputStream(document)?.use { it.readBytes().toString(Charsets.UTF_8) }
        )
      }

      invoke.resolve(ret)
    }
  }

  @Command
  fun writeFile(invoke: Invoke) {
    val args = invoke.parseArgs(WriteArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))
      replace(invoke, root, args.name, MIME_JSON, args.contents.toByteArray(Charsets.UTF_8))
    }
  }

  /**
   * The same, for a file that is not text. One of the three export formats is
   * a PDF, and there is no honest way to push those bytes through a string.
   */
  @Command
  fun writeBytes(invoke: Invoke) {
    val args = invoke.parseArgs(WriteBytesArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))
      replace(invoke, root, args.name, args.mimeType, Base64.decode(args.base64, Base64.DEFAULT))
    }
  }

  @Command
  fun deleteFile(invoke: Invoke) {
    val args = invoke.parseArgs(NameArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))

      findChild(root, args.name)?.let { DocumentsContract.deleteDocument(resolver, it) }
      invoke.resolve(JSObject())
    }
  }

  /**
   * Shows a folder, or one file in it, to the user.
   *
   * Not every device has something that answers for a directory — the phone
   * decides, not us. Saying so is the point: a button that silently does
   * nothing is exactly the failure this replaces.
   */
  @Command
  fun openDocument(invoke: Invoke) {
    val args = invoke.parseArgs(OpenArgs::class.java)

    background(invoke) {
      val root = roots[args.role] ?: return@background invoke.reject(noFolder(args.role))

      val name = args.name
      val target: Uri
      val mime: String

      if (name == null) {
        target = treeDocument(root)
        mime = DocumentsContract.Document.MIME_TYPE_DIR
      } else {
        target = findChild(root, name)
          ?: return@background invoke.reject("Die Datei ist nicht mehr da.")
        mime = resolver.getType(target) ?: MIME_ANY
      }

      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(target, mime)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

      // Starting an activity belongs to the main thread; finding the document
      // did not.
      activity.runOnUiThread {
        try {
          activity.startActivity(intent)
          invoke.resolve(JSObject())
        } catch (ex: ActivityNotFoundException) {
          invoke.reject("Auf diesem Gerät kann das nichts öffnen.")
        } catch (ex: Exception) {
          invoke.reject(ex.message ?: "Das konnte nicht geöffnet werden.")
        }
      }
    }
  }

  /**
   * Puts contents where a name already points, through a second name.
   *
   * SAF cannot replace a file in one move: `createDocument` with a name that is
   * taken produces a *second* file, and writing over the live one truncates it
   * first — long enough for a sync client watching the folder to copy the half
   * that exists. So the bytes go to a temporary name, the old file is removed,
   * and the temporary one takes its place.
   *
   * The temporary name keeps the real extension on purpose: a provider derives
   * the extension from the MIME type and would append one to a name ending in
   * `.part`, leaving `chronos-x.json.part.json` behind. It is instead
   * `chronos-x-part.json`, which no other device reads, because `isSyncFileName`
   * only accepts a bare device id between the prefix and the extension.
   */
  private fun replace(invoke: Invoke, root: Uri, name: String, mime: String, bytes: ByteArray) {
    val dot = name.lastIndexOf('.')
    val temporaryName =
      if (dot <= 0) "$name-part" else name.substring(0, dot) + "-part" + name.substring(dot)

    // A leftover from a write that died halfway would collide with this one.
    findChild(root, temporaryName)?.let { DocumentsContract.deleteDocument(resolver, it) }

    val temporary =
      DocumentsContract.createDocument(resolver, treeDocument(root), mime, temporaryName)
        ?: return invoke.reject("im Ordner konnte keine Datei angelegt werden.")

    val written = resolver.openOutputStream(temporary, "wt")?.use { it.write(bytes); true }
    if (written != true) return invoke.reject("der Schreibvorgang wurde abgewiesen.")

    findChild(root, name)?.let { DocumentsContract.deleteDocument(resolver, it) }
    DocumentsContract.renameDocument(resolver, temporary, name)

    // A provider that refused the rename would have invented a name of its
    // own; saying so beats leaving a file nothing will ever read.
    if (findChild(root, name) == null) {
      return invoke.reject("die Datei konnte im Ordner nicht abgelegt werden.")
    }

    invoke.resolve(JSObject())
  }

  private fun treeDocument(root: Uri): Uri =
    DocumentsContract.buildDocumentUriUsingTree(root, DocumentsContract.getTreeDocumentId(root))

  private fun childrenUri(root: Uri): Uri =
    DocumentsContract.buildChildDocumentsUriUsingTree(root, DocumentsContract.getTreeDocumentId(root))

  /** The document URI for a display name in the folder, or `null`. */
  private fun findChild(root: Uri, name: String): Uri? {
    resolver.query(
      childrenUri(root),
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME
      ),
      null, null, null
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        if (cursor.getString(1) == name) {
          return DocumentsContract.buildDocumentUriUsingTree(root, cursor.getString(0))
        }
      }
    }
    return null
  }

  private fun isKnownRole(role: String) = role == ROLE_SYNC || role == ROLE_FILES

  private fun noFolder(role: String) = if (role == ROLE_SYNC) {
    "es ist kein Ordner für den Abgleich gewählt."
  } else {
    "es ist kein Ordner für die Dateien gewählt."
  }

  private companion object {
    const val ROLE_SYNC = "sync"
    const val ROLE_FILES = "files"
    const val MIME_JSON = "application/json"
    const val MIME_ANY = "*/*"
  }
}
