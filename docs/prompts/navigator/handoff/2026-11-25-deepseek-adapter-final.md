# Handoff — Navigator — 2026-11-25 (DeepSeekAdapter: ЗАКРЫТ)

> Заменяет Handoff 2026-11-25 (вечер) и 2026-11-25_DeepSeekAdapter_end.
> Фиксирует: **DS-адаптер доведён до рабочего состояния end-to-end.**
> Изоляция профилей подтверждена: 3 DS-профиля одновременно в NAV, Gateway-DS + NAV-DS одновременно.
> Возвращаться к адаптеру — только при смене разметки DS, для `thinking`/reasoning,
> или при переезде Gateway-UI на BrowserPool (техдолг).

---

## Git state

- **HEAD:** `9fc9456` — `chore(gateway): удалены устаревшие HTML-снапшоты DeepSeek (recon-материалы)`
- **Впереди origin/main:** 14 коммитов (не запушены)
- **Рабочее дерево — НЕ НАШЕ (НЕ коммитить):**
  - `docs/prompts/gateway/topics/10_COOKIE_TRACKER.md`
  - `scripts/manifest.json`
  - `scripts/mjs/test-deepseek-api.mjs` (только whitespace в шапке, pre-existing)
  - `scripts/test-intervals-abort.mjs`
  - `src/main/services/pranaBindu/spice/providers/intervalsIcuProvider.ts`
- **БД:** `~/.config/wetothemoon-electron/gateway.db` (Schema **v11**).

### Быстрая проверка при старте

```bash
cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron
node scripts/mjs/preflight-check.mjs
git log --oneline -5
git status --short
sqlite3 ~/.config/wetothemoon-electron/gateway.db "PRAGMA user_version;"  # ожидаем 11
npx tsc --noEmit 2>&1 | grep -E "navigator|deepseek" || echo "чисто"