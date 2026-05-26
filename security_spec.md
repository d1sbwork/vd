# Security Specification: Standoff 2 Match Hub

## 1. Data Invariants

1. **User Identity Isolation**: A player cannot modify or hijack another player's profile data. Read is permitted for matches, but write operations are tied strictly to authenticated `request.auth.uid`.
2. **Lobby Integrity**: Only the lobby creator can edit, close, or delete their Standoff 2 private lobby. Other players can only register their participation (increment/decrement `joinedPlayerCount`).
3. **Role Lockdown**: General players cannot register themselves with elevated privileges like `role: "admin"` or `role: "verified_host"`. High-privilege updates are secured via administrative validation.
4. **Bootstrapped Admin Integration**: The user email is validated against trusted admin documents, and the current session email `disbalanceg2@gmail.com` with `email_verified == true` is granted admin privileges.

## 2. The "Dirty Dozen" Threat Payloads

Here are twelve adversarial payloads designed to verify security constraints:

1. **Identity Hijacking**: Try to create a User profile with `id: "some_victim_uid"` but authenticated as `attacker_uid`.
2. **Role Escalation**: Try to register a User document with `role: "admin"` at profile registration.
3. **Admin Self-Assignment**: Attackers try to insert an entry into `/admins/attacker_uid` directly.
4. **Lobby Hijacking**: Try to delete or update another host's Standoff 2 lobby code.
5. **Denial of Wallet String Attack**: Try to write a 1MB junk string in `lobbyCode` or `displayName` to exhaust memory.
6. **Time Spoofing**: Try to set a future/past date for `createdAt` instead of `request.time`.
7. **Lobby Status Bypass**: Try to modify a closed lobby back to active when not authorized.
8. **Invalid ID Character Spraying**: Creating collections with target document IDs containing invalid special characters like `../` or SQL injection strings.
9. **Private Stats Hijacking**: Try to modify other users' training score stats directly from client SDK.
10. **Ghost Lobby Property Update**: Direct update adding custom fields like `cheatMode: true` into `lobby` data structures.
11. **Negative Count Attack**: Inject negative player numbers (e.g. `joinedPlayerCount: -99`) to break filtering counters.
12. **Anonymous Write Attack**: Submitting writes with unauthenticated or spoofed credentials.

All operations above are intercepted, filtered, and returned as `PERMISSION_DENIED` by the security rules compiled below.
