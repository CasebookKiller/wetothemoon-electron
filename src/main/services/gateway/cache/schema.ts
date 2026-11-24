// src/main/services/gateway/cache/schema.ts

export const SCHEMA_VERSION = 11;

export const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER,
  message_count INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  profile_id TEXT NOT NULL DEFAULT 'default',
  position INTEGER
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_pinned
  ON conversations(pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_profile
  ON conversations(profile_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content_plain TEXT NOT NULL,
  content_html TEXT,
  thinking TEXT,
  blocks_json TEXT,
  saved_at INTEGER NOT NULL,
  profile_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_seq
  ON messages(conversation_id, sequence);

CREATE INDEX IF NOT EXISTS idx_messages_saved_at
  ON messages(saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_profile
  ON messages(profile_id);
`;

export const CREATE_FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content_plain,
  conversation_id UNINDEXED,
  message_id UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(content_plain, conversation_id, message_id)
  VALUES (new.content_plain, new.conversation_id, new.id);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts
  SET content_plain = new.content_plain
  WHERE message_id = new.id;
END;
`;


// ───────── Миграция v3: file_blobs + message_files ─────────

export const CREATE_FILES_SQL = `
CREATE TABLE IF NOT EXISTS file_blobs (
  sha256 TEXT PRIMARY KEY,
  content_text TEXT,
  content_path TEXT,
  content_size_bytes INTEGER NOT NULL,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('text', 'image', 'binary')),
  mime TEXT,
  created_at INTEGER NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_file_blobs_created
  ON file_blobs(created_at);

CREATE INDEX IF NOT EXISTS idx_file_blobs_refcount
  ON file_blobs(ref_count);

CREATE TABLE IF NOT EXISTS message_files (
  file_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  chip_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  size_display TEXT,
  mime_display TEXT,
  blob_sha256 TEXT NOT NULL,
  fetch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fetch_status IN ('pending', 'ok', 'failed')),
  fetch_error TEXT,
  fetched_at INTEGER,
  last_accessed_at INTEGER,
  origin_url TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (blob_sha256) REFERENCES file_blobs(sha256),
  UNIQUE(file_id, conversation_id, message_hash, chip_index)
);

CREATE INDEX IF NOT EXISTS idx_message_files_conv
  ON message_files(conversation_id);

CREATE INDEX IF NOT EXISTS idx_message_files_hash
  ON message_files(message_hash);

CREATE INDEX IF NOT EXISTS idx_message_files_sha
  ON message_files(blob_sha256);

CREATE INDEX IF NOT EXISTS idx_message_files_name
  ON message_files(name);

CREATE INDEX IF NOT EXISTS idx_message_files_status
  ON message_files(fetch_status);

-- ref_count инкремент при вставке message_files
CREATE TRIGGER IF NOT EXISTS message_files_ai AFTER INSERT ON message_files BEGIN
  UPDATE file_blobs SET ref_count = ref_count + 1 WHERE sha256 = new.blob_sha256;
END;

-- ref_count декремент при удалении message_files (в т.ч. через CASCADE диалога)
CREATE TRIGGER IF NOT EXISTS message_files_ad AFTER DELETE ON message_files BEGIN
  UPDATE file_blobs SET ref_count = ref_count - 1 WHERE sha256 = old.blob_sha256;
END;
`;