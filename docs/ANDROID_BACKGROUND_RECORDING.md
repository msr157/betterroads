# Android background recording

BetterRoads records Android journeys in a native foreground service. The
service owns the GPS, accelerometer, and gyroscope listeners, writes a
newline-delimited journal under the app's no-backup storage, flushes the file
once per second, and holds a bounded partial wake lock while the journey is
active. React Native reads and replays the journal when the app is visible;
the hardware listeners never depend on the Activity or JavaScript lifecycle.

## Start and stop contract

- The service can only be started from the visible app after location permission
  has been granted.
- Android shows an ongoing notification with a stop action. The service uses
  the `location` foreground-service type and releases listeners, the wake lock,
  and the notification when stopped.
- The service is `START_NOT_STICKY`: a force-stop, reboot, or process kill does
  not silently create a new journey. Any journal left behind is recovered when
  the app opens and is labeled if an interruption was recorded.

## Recovery and upload

The journal is replayed through the existing collection engine in bounded
pages. A partial final line is ignored, and the journal offset advances only
after a page has been consumed. The upload queue is written before the native
journal is deleted, so offline or expired-auth journeys remain recoverable.

## Release checks

Before shipping a build, test on physical Android devices with the screen
locked for at least 15 minutes:

1. Verify the notification remains visible and accelerometer, gyroscope, and
   GPS timestamps advance.
2. Switch apps, reopen BetterRoads, and confirm the same journey is restored.
3. Stop from the app and from the notification, then confirm all listeners and
   the wake lock are released.
4. Disable GPS, revoke a required permission, enable battery saver, and
   force-stop the app; confirm a new journey is refused when notification
   access is missing, an active journey is marked interrupted, and no samples
   are fabricated.
5. Finish offline, restart the app, restore connectivity, and verify one upload
   with no duplicate session.
