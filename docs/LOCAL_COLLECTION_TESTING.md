# Test collection v3 and the admin dashboard locally

## 1. Start PostgreSQL and private object storage

From the repository root:

```sh
docker compose up -d collection-db collection-storage collection-storage-init
```

The defaults bind PostgreSQL to `127.0.0.1:55432`, MinIO’s API to `9000`, and
its console to `9001`. Override `LOCAL_POSTGRES_PORT` if needed.

## 2. Configure and run the backend

Copy `backend/.env.example` to `backend/.env`, then use these local values:

```dotenv
DATABASE_URL=postgres://betterroads:betterroads-local-development-secret@127.0.0.1:55432/betterroads
PORT=3000
SESSION_SECRET=<64 random hex characters>
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=<at least 12 characters>
COLLECTION_S3_ENDPOINT=http://127.0.0.1:9000
COLLECTION_S3_BUCKET=betterroads-sensor-data
COLLECTION_S3_ACCESS_KEY_ID=betterroads-local
COLLECTION_S3_SECRET_ACCESS_KEY=betterroads-local-development-secret
COLLECTION_EXPORT_PSEUDONYM_SALT=<a separate long random secret>
```

Then:

```sh
cd backend
npm run db:migrate
npm run dev
```

Confirm `http://127.0.0.1:3000/api/health` returns `ok: true`.

## 3. Run the administrator dashboard

In another terminal:

```sh
cd dashboard
VITE_API_URL=http://127.0.0.1:3000 npm run dev -- --host 127.0.0.1
```

Open the URL Vite prints, sign in with the bootstrap administrator, then use:

- **Collection** to inspect v3 sessions, sensor/GPS diagnostics, windows,
  private-object state, and markers;
- **Surveyed routes** to create immutable route versions and known sites;
- **Research devices** to authorize an installation for CAR, BIKE, AUTO,
  BUS, or TRUCK data independently;
- **Labeling** for independent review. A reviewer does not receive their own
  pending review again; agreement requires two distinct administrators.

## 4. Run the mobile app

Set the mobile API URL for your environment and run:

```sh
cd mobile/app
npm run start
```

For a physical phone, use your computer’s LAN address rather than
`127.0.0.1`. Choose the exact vehicle subtype and rigid mount.

- **Standard features** collects neutral candidates and random normal feature
  windows. It never uploads raw arrays.
- **Authorized research + raw windows** displays the installation UUID. Add
  that UUID under **Research devices** for the exact vehicle class before
  starting. Raw gzip windows then use the separate private offline queue.
- Only a passenger/research operator may press the marker button. No video is
  recorded.

Record at least 100 m, 20 moving seconds, and five reliable GPS fixes for a
normal standard test. A parked or GPS-less recording should produce no upload.

## 5. Verify the map remains unchanged

Collection v3 intentionally does not paint the public map. After a v3 upload,
the Collection screen should gain a row, while legacy journey/event/segment
counts remain unchanged. Only a future approved vehicle-specific model plus
location consensus may promote evidence to the public map.

## 6. Automated verification

```sh
cd backend && npm test && npm run build
cd ../mobile/app && npm run typecheck
cd ../../dashboard && npm run build
cd ../website && npm run build
cd ../ai && python3 -m pytest
```

Device-only acceptance still requires real ARM32/ARM64 phones: mount
calibration, traffic pause/resume, offline retry, controlled authorization,
Expo Updates, release signing, battery measurement, and APK installation.
