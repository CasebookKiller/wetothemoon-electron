# 11 — Email: mail.tm (временные адреса)

## Зачем
Регистрация на провайдерах без основного ящика. Плюс тест-сценарии.

## API mail.tm (REST, без ключа)
- `GET  /domains` → список
- `POST /accounts {address, password}` → аккаунт
- `POST /token {address, password}` → JWT
- `GET  /messages` (Bearer) → список
- `GET  /messages/{id}` → текст

## Схема v11
`email_accounts(id, provider, address, password_enc, created_at, expires_at, purpose, profile_id)`
provider ∈ {mail.tm, ...}; purpose ∈ {registration, test}

## Модуль
`services/gateway/email/` + `EmailProviderAdapter`, реализации: `MailTmAdapter`.
**Не смешивать с LLM API** — утилитарный сервис.

## Приоритет: средний (~40 мин на mail.tm)