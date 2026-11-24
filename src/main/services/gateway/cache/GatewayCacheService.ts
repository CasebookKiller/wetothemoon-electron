// src/main/services/gateway/cache/GatewayCacheService.ts

import fs from 'fs/promises';
import path from 'path';
import type { DatabaseSync } from 'node:sqlite';
import { getGatewayCache } from './db';
import { computeMessageHash } from './hash';
import type {
  CachedConversation,
  CachedMessage,
  ConversationListItem,
  IncomingMessage,
  MessageBlock,
  MessageRole,
  SearchResult,
  CacheStats,
  WebSource,
} from './types';

interface ExistingMessageRow {
  id: string;
  message_hash: string | null;
  pw_key: string | null;
  sequence: number;
  content_plain: string;
  content_html: string | null;
  thinking: string | null;
  blocks_json: string | null;
  sources_json: string | null;
  branch_total: number | null;
  branch_index: number | null;
  is_active: number | null;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

export class GatewayCacheService {
  private static instance: GatewayCacheService;

  static getInstance(): GatewayCacheService {
    if (!GatewayCacheService.instance) {
      GatewayCacheService.instance = new GatewayCacheService();
    }
    return GatewayCacheService.instance;
  }

  private get db(): DatabaseSync {
    return getGatewayCache();
  }

  // ========== Conversations ==========

  /**
   * Синхронизирует диалог:
   *   1) upsert метаданных диалога
   *   2) для каждого incoming-сообщения — lookup по message_hash (приоритет),
   *      затем по pw_key (для строк без hash), затем по (role, content_plain)
   *      — последний fallback защищает от «плавающих» parentHash в partial-sync
   *   3) вставка новых с message_hash + pw_key (только numeric pw_key)
   *   4) пересчёт message_count по фактическому содержимому БД
   *
   * Возвращает { inserted, updated, total, hashedLegacy }.
   * hashedLegacy — сколько старых (NULL-hash) строк закрыли.
   */
  async syncConversation(
    convId: string,
    title: string,
    incoming: IncomingMessage[],
    opts?: { prune?: boolean; profileId?: string }
  ): Promise<{
    inserted: number;
    updated: number;
    total: number;
    hashedLegacy: number;
  }> {
    const db = this.db;
    const now = Date.now();
    const profileId = opts?.profileId ?? 'default';

    // Подготовленные statements (один раз на вызов)
    const selectByHash = db.prepare(`
      SELECT id, message_hash, pw_key, sequence, content_plain,
             content_html, thinking, blocks_json, sources_json,
             branch_total, branch_index, is_active
      FROM messages
      WHERE conversation_id = ? AND message_hash = ?
    `);
    // Для сообщений с ветками: ищем по (pw_key, branch_index).
    const selectByPwKeyAndBranch = db.prepare(`
      SELECT id, message_hash, pw_key, sequence, content_plain,
             content_html, thinking, blocks_json, sources_json,
             branch_total, branch_index, is_active
      FROM messages
      WHERE conversation_id = ? AND pw_key = ?
        AND COALESCE(branch_index, 1) = ?
    `);
    // Для сообщений без веток: по (pw_key). Может быть несколько (старые
    // версии), но нам нужен только один — тот, что относится к текущей
    // активной версии или последний обновлённый.
    const selectByPwKeyFallback = db.prepare(`
      SELECT id, message_hash, pw_key, sequence, content_plain,
             content_html, thinking, blocks_json, sources_json,
             branch_total, branch_index, is_active
      FROM messages
      WHERE conversation_id = ? AND pw_key = ?
      ORDER BY is_active DESC, saved_at DESC
      LIMIT 1
    `);
    // Content-match ограничен свежими сообщениями (< 5 минут).
    // Иначе regenerate короткого ответа ("OK") перезаписывает СТАРОЕ
    // сообщение с тем же текстом и оставляет ему низкий sequence
    // → в UI ответ оказывается "до" вопроса.
    const contentMatchCutoff = Date.now() - 5 * 60 * 1000;
    const selectByContent = db.prepare(`
      SELECT id, message_hash, pw_key, sequence, content_plain,
             content_html, thinking, blocks_json, sources_json,
             branch_total, branch_index
      FROM messages
      WHERE conversation_id = ? AND role = ? AND content_plain = ?
        AND saved_at > ?
      LIMIT 1
    `);
    const selectLastByRole = db.prepare(`
      SELECT id, message_hash, pw_key, sequence, content_plain,
             content_html, thinking, blocks_json, sources_json,
             branch_total, branch_index
      FROM messages
      WHERE conversation_id = ? AND role = ?
      ORDER BY sequence DESC
      LIMIT 1
    `);
    const insertStmt = db.prepare(`
      INSERT INTO messages
        (id, conversation_id, sequence, role, content_plain, content_html,
         thinking, blocks_json, sources_json, saved_at, message_hash, pw_key,
         branch_total, branch_index, is_active, profile_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        message_hash = excluded.message_hash,
        pw_key = excluded.pw_key,
        sequence = excluded.sequence,
        content_plain = excluded.content_plain,
        content_html = COALESCE(excluded.content_html, messages.content_html),
        thinking = excluded.thinking,
        blocks_json = excluded.blocks_json,
        sources_json = COALESCE(excluded.sources_json, messages.sources_json),
        saved_at = excluded.saved_at,
        branch_total = excluded.branch_total,
        branch_index = excluded.branch_index,
        is_active = excluded.is_active
    `);
    const updateStmt = db.prepare(`
      UPDATE messages
      SET message_hash = ?, pw_key = ?, sequence = ?, content_plain = ?,
          content_html = COALESCE(?, content_html), thinking = ?, blocks_json = ?,
          sources_json = COALESCE(?, sources_json),
          branch_total = ?, branch_index = ?, is_active = ?
      WHERE id = ?
    `);

    let inserted = 0;
    let updated = 0;
    let hashedLegacy = 0;
    let parentHash: string | undefined;

    db.exec('BEGIN');
    try {
      // 1. Upsert диалога ДО сообщений (иначе FOREIGN KEY)
      db.prepare(`
        INSERT INTO conversations
          (id, title, created_at, updated_at, last_message_at, message_count, pinned, archived, profile_id)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          updated_at = excluded.updated_at,
          last_message_at = COALESCE(excluded.last_message_at, conversations.last_message_at)
      `).run(
        convId,
        title,
        now,
        now,
        incoming.length > 0 ? now : null,
        incoming.length,
        profileId
      );

      // 1.5. PRUNE — удаляем все старые сообщения диалога перед полной
      // перезаписью. Вызывается только при history:complete (полный sync),
      // НЕ на progress. Решает проблему коллизий sequence от прошлых
      // частичных sync (4x seq=0, 4x seq=1, …).
      if (opts?.prune) {
        // v5: не удаляем, а деактивируем. Старые версии остаются
        // в истории для долговременной памяти.
        const deactivated = db
          .prepare('UPDATE messages SET is_active = 0 WHERE conversation_id = ?')
          .run(convId);
        console.log(
          `[GatewayCache] prune: деактивировано ${deactivated.changes} старых сообщений для ${convId}`
        );
      }

            // 2. Сообщения — цепочка parentHash через for
      for (let idx = 0; idx < incoming.length; idx++) {
        const m = incoming[idx];
        const contentPlain =
          m.contentPlain ?? m.blocks?.map((b) => b.content).join('\n\n') ?? '';
        
        // pw_key валиден ТОЛЬКО если numeric.
        const numericKey = m.id && /^\d+$/.test(m.id) ? m.id : null;
        
        // v5: определяем, есть ли у сообщения ветки
        const branchTotal = m.branchTotal ?? 1;
        const branchIndex = m.branchIndex ?? 1;
        const hasBranch = branchTotal > 1;

        // v5: salt должен включать branchIndex для веток, чтобы
        // одинаковый текст в разных ветках давал разные hash.
        const salt = hasBranch
          ? `${numericKey ?? parentHash ?? 'x'}_b${branchIndex}`
          : (numericKey ?? parentHash);
        const messageHash = computeMessageHash(
          convId,
          m.role,
          contentPlain,
          salt
        );
        const contentHtml = m.contentHtml ?? null;
        const thinking = m.thinking ?? null;
        
        // ⚠️ 1. Сначала объявляем blocksJson
        const blocksJson = JSON.stringify(
          m.blocks ?? [{ type: 'text', content: contentPlain }]
        );
        const sourcesJson = m.sources && m.sources.length > 0
          ? JSON.stringify(m.sources)
          : null;

        // v5: активная ли ветка (1) или сохранена для истории (0).
        // Пока deepseekService это не передаёт — будет 1.
        const isActive = m.isActive ?? 1;

        // 2a. Lookup: hash → (pw_key + branch) → (role, content_plain) → last by role
        let existing = selectByHash.get(convId, messageHash) as
          | ExistingMessageRow
          | undefined;
        if (!existing && numericKey) {
          if (hasBranch) {
            // Для веток — ищем строго по (pw_key, branch_index)
            existing = selectByPwKeyAndBranch.get(
              convId,
              numericKey,
              branchIndex
            ) as ExistingMessageRow | undefined;
          } else {
            // Для не-веток — ищем по pw_key, предпочитая активные
            existing = selectByPwKeyFallback.get(convId, numericKey) as
              | ExistingMessageRow
              | undefined;
          }
        }
        // Fallback по тексту — только для не-веток (для веток текст
        // может совпадать, но это разные версии)
        if (!existing && !numericKey && !hasBranch) {
          existing = selectByContent.get(
            convId,
            m.role,
            contentPlain,
            contentMatchCutoff
          ) as ExistingMessageRow | undefined;
        }
        // Fallback для стримящегося ответа — только при не-prune
        if (!existing && !opts?.prune && idx === incoming.length - 1) {
          existing = selectLastByRole.get(convId, m.role) as
            | ExistingMessageRow
            | undefined;
        }

        // 2b. Вычисляем sequence
        // Если это полная синхронизация (prune) — берём idx.
        // Если частичная (visible only) — НЕ МЕНЯЕМ sequence у существующих,
        // а новые добавляем в конец (иначе они прыгают в начало).
        let sequence: number;
        if (opts?.prune) {
          sequence = idx;
        } else if (existing) {
          sequence = existing.sequence;
        } else {
          const maxRow = db.prepare('SELECT MAX(sequence) as m FROM messages WHERE conversation_id = ?').get(convId) as { m: number | null };
          sequence = (maxRow?.m ?? -1) + 1;
        }

        // 2c. Update или Insert
        if (existing) {
          const wasLegacy = !existing.message_hash;
          // 5.7.30: debug для 41-50
          if (opts?.prune && numericKey && parseInt(numericKey, 10) >= 41 && parseInt(numericKey, 10) <= 50) {
            console.log(
              `[sync] pwKey=${numericKey} existing.id=${existing.id.slice(-30)} ` +
                `old.active=${existing.is_active} old.br=${existing.branch_index}/${existing.branch_total} ` +
                `new.active=${isActive} new.br=${branchIndex}/${branchTotal}`
            );
          }
          // 5.8.3: contentHtml=null (snapshot из IndexedDB) НЕ считается
          // изменением — иначе UPDATE перезапишет COALESCE (хотя и вернёт
          // прежнее значение, но потратит время и обновит saved_at).
          const contentHtmlChanged =
            contentHtml !== null &&
            (existing.content_html ?? null) !== contentHtml;

          const changed =
            existing.message_hash !== messageHash ||
            existing.pw_key !== numericKey ||
            existing.sequence !== sequence ||
            existing.content_plain !== contentPlain ||
            contentHtmlChanged ||
            (existing.thinking ?? null) !== thinking ||
            (existing.blocks_json ?? null) !== blocksJson ||
            (existing.sources_json ?? null) !== sourcesJson ||
            (existing.branch_total ?? 1) !== branchTotal ||
            (existing.branch_index ?? 1) !== branchIndex ||
            (existing.is_active ?? 1) !== isActive;

          if (changed) {
            // 5.7.32: если существующая запись имеет другой pw_key —
            // updateStmt обновит id «в наследство». Это приводит к тому,
            // что id=..._48 хранит pw_key=50. Удаляем старую и INSERT.
            const idMismatch =
              existing.pw_key !== numericKey &&
              !existing.id.endsWith(`_h_${existing.message_hash}`);

            if (idMismatch) {
              db.prepare('DELETE FROM messages WHERE id = ?').run(existing.id);
              const newId = hasBranch
                ? `${convId}_h_${messageHash}`
                : numericKey
                  ? `${convId}_${numericKey}`
                  : `${convId}_h_${messageHash}`;
              insertStmt.run(
                newId,
                convId,
                sequence,
                m.role,
                contentPlain,
                contentHtml,
                thinking,
                blocksJson,
                sourcesJson,
                now,
                messageHash,
                numericKey,
                branchTotal,
                branchIndex,
                isActive,
                profileId
              );
              if (wasLegacy) hashedLegacy++;
              inserted++;
            } else {
              updateStmt.run(
                messageHash,
                numericKey,
                sequence,
                contentPlain,
                contentHtml,
                thinking,
                blocksJson,
                sourcesJson,
                branchTotal,
                branchIndex,
                isActive,
                existing.id
              );
              if (wasLegacy) hashedLegacy++;
              updated++;
            }
          }
        } else {
          // v5: для веток — всегда hash-based id (уникальность по ветке).
          // Для не-веток — обратная совместимость (numeric id).
          const id = hasBranch
            ? `${convId}_h_${messageHash}`
            : (numericKey
                ? `${convId}_${numericKey}`
                : `${convId}_h_${messageHash}`);
          insertStmt.run(
            id,
            convId,
            sequence,
            m.role,
            contentPlain,
            contentHtml,
            thinking,
            blocksJson,
            sourcesJson,
            now,
            messageHash,
            numericKey,
            branchTotal,
            branchIndex,
            isActive,
            profileId
          );
          inserted++;
          if (opts?.prune) {
            console.log(`[sync] inserted pwKey=${numericKey} role=${m.role} hash=${messageHash.slice(0, 6)}`);
          }
        }

        // 5.7.30: debug для pwKeys 41-50
        if (opts?.prune && numericKey && parseInt(numericKey, 10) >= 41 && parseInt(numericKey, 10) <= 50) {
          console.log(
            `[sync] pwKey=${numericKey} role=${m.role} ` +
              `existing=${existing ? 'yes' : 'no'} ` +
              `changed=${existing ? 'see-below' : 'insert'} ` +
              `isActive=${isActive} branchTotal=${branchTotal} branchIndex=${branchIndex} ` +
              `hash=${messageHash.slice(0, 8)}`
          );
        }

        parentHash = messageHash;
      }

      // 3. Пересчёт message_count по фактическому содержимому БД
      db.prepare(`
        UPDATE conversations
        SET message_count = (SELECT COUNT(*) FROM messages WHERE conversation_id = ?)
        WHERE id = ?
      `).run(convId, convId);

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    return { inserted, updated, total: incoming.length, hashedLegacy };
  }

  /**
   * Установить/снять pin (избранное) у диалога.
   * Используется Navigator при синхронизации списка из GigaChat (data-da_favorite).
   * listConversations() сортирует по pinned DESC — после этого избранные будут сверху.
   */
  /**
   * Синхронизировать pinned + position (порядок в сайдбаре GigaChat).
   * Вызывается из navigator:sync-conversations — pinned и position это один snapshot.
   * position: 0..N — индекс в DOM GigaChat (favorites сначала, recent потом).
   * listConversations сортирует: pinned DESC, position ASC, last_message_at DESC.
   */
  setConversationPositionAndPinned(
    convId: string,
    pinned: boolean,
    position: number,
  ): void {
    try {
      const r = this.db
        .prepare('UPDATE conversations SET pinned = ?, position = ? WHERE id = ?')
        .run(pinned ? 1 : 0, position, convId);
      console.log(
        `[GatewayCacheService] setConversationPositionAndPinned(${convId.slice(0, 8)}, pinned=${pinned}, pos=${position}) → rows changed: ${r.changes}`,
      );
    } catch (e) {
      console.warn('[GatewayCacheService] setConversationPositionAndPinned failed:', e);
    }
  }

  /** @deprecated Используй setConversationPositionAndPinned. Оставлен для обратной совместимости. */
  setConversationPinned(convId: string, pinned: boolean): void {
    try {
      const r = this.db
        .prepare('UPDATE conversations SET pinned = ? WHERE id = ?')
        .run(pinned ? 1 : 0, convId);
      console.log(
        `[GatewayCacheService] setConversationPinned(${convId.slice(0, 8)}, ${pinned}) → rows changed: ${r.changes}`,
      );
    } catch (e) {
      console.warn('[GatewayCacheService] setConversationPinned failed:', e);
    }
  }

    /**
   * Архивировать conversations профиля, которых нет в liveIds.
   * Те, что GigaChat больше не отдаёт — phantom (удалены в GigaChat) или за пределами
   * видимой пагинации. Скрываем из UI (archived=1), НЕ удаляем (данные целы).
   * Порог в handler'е (>50) защищает от случайного массового архивирования при баге scroll.
   */
  archiveConversationsNotIn(profileId: string, liveIds: Set<string>): number {
    try {
      const all = this.db
        .prepare('SELECT id FROM conversations WHERE profile_id = ? AND archived = 0')
        .all(profileId) as Array<{ id: string }>;
      const toArchive = all.filter((r) => !liveIds.has(r.id)).map((r) => r.id);
      if (toArchive.length === 0) return 0;
      const stmt = this.db.prepare('UPDATE conversations SET archived = 1 WHERE id = ?');
      let changed = 0;
      for (const id of toArchive) {
        const r = stmt.run(id);
        changed += Number(r.changes ?? 0);
      }
      console.log(`[GatewayCacheService] archiveConversationsNotIn(${profileId}): archived ${changed}/${all.length}`);
      return changed;
    } catch (e) {
      console.warn('[GatewayCacheService] archiveConversationsNotIn failed:', e);
      return 0;
    }
  }
  
  listConversations(profileId = 'default'): ConversationListItem[] {
    const rows = this.db
      .prepare(`
        SELECT id, title, message_count, updated_at, last_message_at, pinned, position
        FROM conversations
        WHERE archived = 0 AND profile_id = ?
        ORDER BY
          pinned DESC,
          COALESCE(position, 999999) ASC,
          COALESCE(last_message_at, updated_at) DESC
      `)
      .all(profileId) as Array<{
        id: string;
        title: string;
        message_count: number;
        updated_at: number;
        last_message_at: number | null;
        pinned: number;
        position: number | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      messageCount: r.message_count,
      position: r.position,
      updatedAt: r.updated_at,
      lastMessageAt: r.last_message_at ?? undefined,
      pinned: r.pinned === 1,
    }));
  }

  getConversation(convId: string): CachedConversation | null {
    const row = this.db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(convId) as any;
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at ?? undefined,
      messageCount: row.message_count,
      pinned: row.pinned === 1,
      archived: row.archived === 1,
    };
  }

  getMessages(convId: string): CachedMessage[] {
    const rows = this.db
      .prepare(`
        SELECT id, conversation_id, sequence, role, content_plain,
               content_html, thinking, blocks_json, sources_json, saved_at,
               message_hash, pw_key, branch_total, branch_index, is_active
        FROM messages
        WHERE conversation_id = ? AND is_active = 1
        ORDER BY sequence ASC
      `)
      .all(convId) as Array<{
        id: string;
        conversation_id: string;
        sequence: number;
        role: MessageRole;
        content_plain: string;
        content_html: string | null;
        thinking: string | null;
        blocks_json: string | null;
        sources_json: string | null;
        saved_at: number;
        message_hash: string | null;
        pw_key: string | null;
        branch_total: number | null;
        branch_index: number | null;
        is_active: number | null;
      }>;

    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      sequence: r.sequence,
      role: r.role,
      contentPlain: r.content_plain,
      contentHtml: r.content_html ?? undefined,
      thinking: r.thinking ?? undefined,
      sources: r.sources_json ? (JSON.parse(r.sources_json) as WebSource[]) : undefined,
      blocks: r.blocks_json ? (JSON.parse(r.blocks_json) as MessageBlock[]) : [],
      savedAt: r.saved_at,
      messageHash: r.message_hash ?? undefined,
      pwKey: r.pw_key ?? undefined,
      branchTotal: r.branch_total ?? 1,
      branchIndex: r.branch_index ?? 1,
      isActive: r.is_active ?? 1,
    }));
  }

  /** CASCADE удалит messages через FK */
  deleteConversation(convId: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(convId);
  }

  // ========== Поиск по hash (для IPC 5.5) ==========

  getMessageByHash(hash: string, profileId = 'default'): CachedMessage | null {
    const r = this.db
      .prepare(`
        SELECT id, conversation_id, sequence, role, content_plain,
               content_html, thinking, blocks_json, sources_json, saved_at,
               message_hash, pw_key
        FROM messages
        WHERE profile_id = ? AND message_hash = ?
      `)
      .get(profileId, hash) as
      | {
          id: string;
          conversation_id: string;
          sequence: number;
          role: MessageRole;
          content_plain: string;
          content_html: string | null;
          thinking: string | null;
          blocks_json: string | null;
          sources_json: string | null;
          saved_at: number;
          message_hash: string | null;
          pw_key: string | null;
        }
      | undefined;

    if (!r) return null;
    return {
      id: r.id,
      conversationId: r.conversation_id,
      sequence: r.sequence,
      role: r.role,
      contentPlain: r.content_plain,
      contentHtml: r.content_html ?? undefined,
      thinking: r.thinking ?? undefined,
      sources: r.sources_json ? (JSON.parse(r.sources_json) as WebSource[]) : undefined,
      blocks: r.blocks_json ? (JSON.parse(r.blocks_json) as MessageBlock[]) : [],
      savedAt: r.saved_at,
      messageHash: r.message_hash ?? undefined,
      pwKey: r.pw_key ?? undefined,
    };
  }

  markConversationSynced(convId: string): void {
    this.db
      .prepare('UPDATE conversations SET last_synced_at = ? WHERE id = ?')
      .run(Date.now(), convId);
  }

  // ========== Search ==========

  private hasFts(): boolean {
    const row = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'"
      )
      .get() as { name: string } | undefined;
    return !!row;
  }

  searchMessages(query: string, limit = 50, profileId = 'default'): SearchResult[] {
    if (!query.trim()) return [];

    if (this.hasFts()) {
      try {
        const rows = this.db
          .prepare(`
            SELECT
              m.conversation_id,
              c.title AS conversation_title,
              m.id AS message_id,
              m.role,
              snippet(messages_fts, 0, '<<', '>>', '...', 16) AS snippet,
              m.saved_at
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.message_id
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.profile_id = ? AND messages_fts MATCH ?
            ORDER BY m.saved_at DESC
            LIMIT ?
          `)
          .all(profileId, query, limit) as Array<{
            conversation_id: string;
            conversation_title: string;
            message_id: string;
            role: MessageRole;
            snippet: string;
            saved_at: number;
          }>;

        return rows.map((r) => ({
          conversationId: r.conversation_id,
          conversationTitle: r.conversation_title,
          messageId: r.message_id,
          role: r.role,
          snippet: r.snippet,
          savedAt: r.saved_at,
        }));
      } catch (e) {
        console.warn(
          '[GatewayCache] FTS5 search failed, fallback to LIKE:',
          (e as Error).message
        );
      }
    }

    // Fallback на LIKE
    const like = `%${query}%`;
    const rows = this.db
      .prepare(`
        SELECT
          m.conversation_id,
          c.title AS conversation_title,
          m.id AS message_id,
          m.role,
          substr(m.content_plain, 1, 200) AS snippet,
          m.saved_at
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.profile_id = ? AND m.content_plain LIKE ?
        ORDER BY m.saved_at DESC
        LIMIT ?
      `)
      .all(profileId, like, limit) as Array<{
        conversation_id: string;
        conversation_title: string;
        message_id: string;
        role: MessageRole;
        snippet: string;
        saved_at: number;
      }>;

    return rows.map((r) => ({
      conversationId: r.conversation_id,
      conversationTitle: r.conversation_title,
      messageId: r.message_id,
      role: r.role,
      snippet: r.snippet,
      savedAt: r.saved_at,
    }));
  }

  // ========== Stats ==========

  /** dbPath — передаётся из gatewayHandlers (там есть app.getPath('userData')) */
  async getStats(dbPath?: string): Promise<CacheStats> {
    const convCount =
      ((this.db.prepare('SELECT COUNT(*) as c FROM conversations').get() as any)
        ?.c as number) ?? 0;
    const msgCount =
      ((this.db.prepare('SELECT COUNT(*) as c FROM messages').get() as any)
        ?.c as number) ?? 0;
    const lastRow = this.db
      .prepare('SELECT MAX(saved_at) as t FROM messages')
      .get() as { t: number | null } | undefined;

    let dbSizeBytes = 0;
    if (dbPath) {
      try {
        const st = await fs.stat(dbPath);
        dbSizeBytes = st.size;
      } catch {
        /* файла ещё нет — ок */
      }
    }

    return {
      dbPath: dbPath ?? '',
      dbSizeBytes,
      conversationCount: convCount,
      messageCount: msgCount,
      lastUpdated: lastRow?.t ?? undefined,
    };
  }

  clearAll(): void {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM messages');
      this.db.exec('DELETE FROM conversations');
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ========== Export ==========

  /** exportDir — передаётся из gatewayHandlers (напр. Documents/wetothemoon/gateway-exports) */
  async exportMarkdown(convId: string, exportDir: string): Promise<string> {
    const conv = this.getConversation(convId);
    if (!conv) throw new Error(`Диалог ${convId} не найден в кэше`);
    const msgs = this.getMessages(convId);

    const lines: string[] = [];
    lines.push(`# ${conv.title}`);
    lines.push('');
    lines.push(`> Экспортировано: ${new Date().toISOString()}`);
    lines.push(`> ID диалога: \`${conv.id}\``);
    lines.push(`> Сообщений: ${msgs.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const m of msgs) {
      const ts = new Date(m.savedAt).toISOString();
      if (m.role === 'user') {
        lines.push(`## 👤 User <sub>${ts}</sub>`);
        lines.push('');
        lines.push(m.contentPlain);
        lines.push('');
      } else {
        lines.push(`## 🤖 Assistant <sub>${ts}</sub>`);
        lines.push('');
        if (m.thinking) {
          lines.push('<details><summary>💭 Thinking</summary>');
          lines.push('');
          lines.push(m.thinking);
          lines.push('');
          lines.push('</details>');
          lines.push('');
        }
        const hasCode = m.blocks.some((b) => b.type === 'code');
        if (hasCode) {
          for (const b of m.blocks) {
            if (b.type === 'code') {
              const lang = b.language || 'text';
              lines.push('```' + lang);
              lines.push(b.content);
              lines.push('```');
              lines.push('');
            } else {
              lines.push(b.content);
              lines.push('');
            }
          }
        } else {
          lines.push(m.contentPlain);
          lines.push('');
        }
      }
      lines.push('---');
      lines.push('');
    }

    await fs.mkdir(exportDir, { recursive: true });
    const fname = `${conv.id}_${slugify(conv.title)}.md`;
    const fullPath = path.join(exportDir, fname);
    await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
    console.log(`[GatewayCache] Markdown экспортирован: ${fullPath}`);
    return fullPath;
  }

    /**
   * 2.2.6: Удаляет "ghost"-записи (is_active=0), у которых нет активной пары
   * (того же conversation_id и pw_key с is_active=1).
   * Возвращает количество удаленных записей.
   */
  cleanupGhosts(convId?: string): number {
    const db = this.db;
    
    // Находим ID всех "сирот"
    const findGhostsQuery = `
      SELECT m1.id
      FROM messages m1
      WHERE m1.is_active = 0
        ${convId ? 'AND m1.conversation_id = ?' : ''}
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.conversation_id = m1.conversation_id
            AND m2.pw_key = m1.pw_key
            AND m2.is_active = 1
        )
    `;
    
    const ghosts = convId 
      ? db.prepare(findGhostsQuery).all(convId) as { id: string }[]
      : db.prepare(findGhostsQuery).all() as { id: string }[];

    if (ghosts.length === 0) return 0;

    const ids = ghosts.map(g => g.id);
    const placeholders = ids.map(() => '?').join(',');
    
    const result = db.prepare(
      `DELETE FROM messages WHERE id IN (${placeholders})`
    ).run(...ids);

    console.log(`[GatewayCache] cleanupGhosts: удалено ${result.changes} записей`);
    return Number(result.changes);
  }
}