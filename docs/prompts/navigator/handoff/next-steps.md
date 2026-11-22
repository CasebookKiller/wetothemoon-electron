# docs/prompts/navigator/handoff/next-steps.md

# С чего начать новый чат (Navigator)

> ⚠️ **Формат правок:** «найти → заменить» (два блока). Не diff, не весь файл.
> Gateway остаётся legacy — не трогаем до закрытия Navigator MVP.

## Приоритет на сессию

### Этап 1 — MVP (GigaChat end-to-end, ~2 ч)

1. **Backend** (25 мин):
   - `src/main/services/navigator/toolRegistry.ts` — `ToolEntry`, `register/get/list`
   - `src/main/services/navigator/llmTool.ts` — обёртка `ProviderAdapter`
   - `src/main/ipcHandlers/navigatorHandlers.ts` — `navigator:list-tools`, `navigator:send`, `navigator:on-chunk`
2. **Window + route** (15 мин):
   - `src/main/windows/navigatorWindow.ts` (копия `gatewayWindow.ts`)
   - `src/main/menus/windowMenus.ts` — `+navigatorWindowMenuTemplate`
   - `src/main/main.ts` — 3 регистрации (импорт, хендлер меню, создание)
   - `src/navigation/routes.tsx` — `+{path:'/navigator', Component: NavigatorPage, title:'Navigator'}`
3. **Preload + types** (10 мин):
   - `src/types/navigator.d.ts` — `electronAPI.navigator: {...}`
   - `src/preload.ts` — `+navigator: {...}`
4. **UI** (30 мин):
   - `src/pages/NAVIGATOR/NavigatorPage.tsx` (layout)
   - `src/pages/NAVIGATOR/NavigatorSidebar.tsx` (профили + бейджи DS/GG + launch)
   - `src/pages/NAVIGATOR/NavigatorChat.tsx` (input + send + stream)
5. **Тест** (10 мин): GigaChat send end-to-end

### Этап 1.5 (следующая сессия)

- `DeepSeekAdapter.sendMessage` (TD11) — реализация
- `DeepSeekAdapter.getConversations` — recon (П1b)

### Этап 2 (~2 ч)

- Memory: обобщение `GatewayCacheService` + `contextBuilder`
- `SiteAdapter` (rusprofile) + Fremen Eye на patchright
- `UtilityTool` (email-gen, cookieTracker)

### Этап 3 (после)

- Pipeline (JSON-шаги, `topics/04_JSON_PROTOCOL.md` §Pipeline)
- Alice/Qwen адаптеры

## С чего начать новый чат

```bash
cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron
node scripts/preflight-check.mjs
git log --oneline -5
git status --short
```

## Правила

- **Find/replace** (два блока)
- **git commit по группам**, никогда `git add .`
- **`wm-backup`** перед крупным шагом
- **Gateway не трогаем** до закрытия MVP