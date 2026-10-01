package org.betterroads.recorder

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID

/** All journal operations and callbacks share this monitor. No bridge event buffering. */
internal object Journal {
  val lock = Any()
  fun directory(context: Context) = File(context.noBackupFilesDir, "road-recording").apply { mkdirs() }
  fun metadata(context: Context) = File(directory(context), "session.json")
  fun samples(context: Context) = File(directory(context), "samples.jsonl")
  fun read(context: Context): JSONObject? = metadata(context).takeIf { it.exists() }?.let { JSONObject(it.readText()) }
  fun save(context: Context, value: JSONObject) {
    val file = android.util.AtomicFile(metadata(context))
    val stream = file.startWrite()
    try { stream.write(value.toString().toByteArray()); file.finishWrite(stream) }
    catch (e: Exception) { file.failWrite(stream); throw e }
  }
  fun status(context: Context): String? = synchronized(lock) {
    val value = read(context) ?: return@synchronized null
    value.put("running", RecordingService.active != null)
    value.put("lastSampleAt", RecordingService.lastSampleAt)
    value.put("lastLocationAt", RecordingService.lastLocationAt)
    value.toString()
  }
}

class RoadRecorderModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("RoadRecorder")
    AsyncFunction("status") { Journal.status(context) }
    AsyncFunction("start") { config: String ->
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open the app before starting a journey." }
      synchronized(Journal.lock) {
        check(Journal.read(context) == null) { "Finish the saved journey before starting another." }
        val value = JSONObject().put("id", UUID.randomUUID().toString())
          .put("config", JSONObject(config)).put("startedAt", System.currentTimeMillis())
        Journal.samples(context).writeText("")
        Journal.save(context, value)
        try {
          val intent = Intent(context, RecordingService::class.java)
          if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
        }
        catch (e: Exception) {
          Journal.metadata(context).delete(); Journal.samples(context).delete(); throw e
        }
        value.toString()
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") {
      synchronized(Journal.lock) { RecordingService.active?.finish(null) }
      Journal.status(context)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("read") { offset: Double ->
      synchronized(Journal.lock) {
        val rows = org.json.JSONArray()
        RandomAccessFile(Journal.samples(context), "r").use { file ->
          require(offset >= 0 && offset <= file.length())
          file.seek(offset.toLong())
          var count = 0
          while (count < 1000 && file.filePointer < file.length()) {
            val before = file.filePointer
            val line = file.readLine() ?: break
            // A process death may leave an incomplete final record. Do not invent a sample.
            try { rows.put(org.json.JSONArray(line)) }
            catch (_: Exception) { file.seek(before); break }
            count++
          }
          JSONObject().put("rows", rows).put("offset", file.filePointer).toString()
        }
      }
    }
    AsyncFunction("clear") { id: String ->
      synchronized(Journal.lock) {
        check(RecordingService.active == null) { "Recording is still active." }
        check(Journal.read(context)?.getString("id") == id) { "Session changed." }
        check(Journal.samples(context).delete() || !Journal.samples(context).exists())
        check(Journal.metadata(context).delete())
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
          .cancel(RecordingService.ERROR_NOTIFICATION_ID)
      }
    }
    AsyncFunction("mark") { markerType: String ->
      synchronized(Journal.lock) {
        val service = RecordingService.active ?: throw IllegalStateException("Recording is not active.")
        service.appendMarker(markerType)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
