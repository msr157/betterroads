# Identity, administration, and accountability

Migration `0005_identity_contracts.sql` is additive: existing device and
journey rows retain null ownership. New travel uploads require a mobile session
and copy its user ID to device and journey records. Payload schema version 1 is
unchanged.

Migration `0006_accepted_contributions.sql` adds the ranking acceptance marker.
`0007_schema_snapshot.sql` is deliberately metadata-only: its snapshot teaches
Drizzle the combined additive schema so the next generated migration does not
attempt to recreate identity tables.

Mobile and administrator sessions store only HMAC-SHA-256 token hashes, along with
expiry, last-use, and revocation timestamps. Administrator passwords use
scrypt. Startup bootstraps `ADMIN_BOOTSTRAP_*` only when no administrator
exists, so deployments cannot overwrite a working database account.

Public leaderboards expose opted-in display names and contribution totals only;
they never expose Google subject, email, DOB/age, gender, or city. Contractor
and road-contract records appear publicly only after explicit publication.

Only journeys with a non-null `accepted_at` marker (set after validated storage
and road aggregation complete) count toward contribution rankings.

New public endpoints are `/api/public/leaderboard`, `/api/public/contributors`,
`/api/public/contributors/:id`, and `/api/public/contracts`. Mobile identity is
under `/api/mobile`: Google exchange, profile lookup/update/deletion, logout,
and session listing/revocation. Admin account/session, search, derived alert, contractor,
contract/import, map/replay, and GeoJSON export routes are under `/api/admin`.

The contract import endpoint accepts RFC 4180-style quoted CSV, including
escaped quotes, embedded commas, and line breaks.

Users can delete their account through `DELETE /api/mobile/me` with an explicit
`DELETE` confirmation. Profile/session data and ownership links are removed;
retained road measurements become anonymous and are removed from rankings.
