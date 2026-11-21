# 10 — CookieTracker

## Зачем
WAF-токены меняются, сессии истекают, fingerprint детектится. Нужно видеть cookies per-profile.

## Схема v11
- `profile_cookies(profile_id, domain, name, value_hash, first_seen, last_seen, changed_at)` PK (profile_id, domain, name)
- `cookie_events(id, profile_id, kind, payload_json, at)` kind ∈ {set, changed, expired, waf_rotated}

## IPC
- `gatewayCookieSnapshot(profileId)` → текущие
- `gatewayCookieDiff(profileId, sinceTs)` → события
- bridge: `cookie:changed`, `session:expired`, `waf:rotated`

## Этапы
1. snapshot при launch → diff → события (1 сессия)
2. UI-индикатор в диалоге аккаунтов (30 мин)
3. fingerprint (canvas/WebGL/timezone/fonts) — отдельно (П5)

## Приоритет: средний