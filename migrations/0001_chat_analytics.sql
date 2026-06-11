CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT,
  first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,

  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  country TEXT,
  city TEXT,

  total_messages INTEGER DEFAULT 0,
  last_intent TEXT,
  lead_temperature TEXT DEFAULT 'cold',
  package_interest TEXT DEFAULT 'unknown',
  objection TEXT,
  handoff_recommended INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,

  intent TEXT,
  answer_mode TEXT,
  lead_temperature TEXT,
  package_interest TEXT,
  objection TEXT,
  handoff_recommended INTEGER DEFAULT 0,

  kb_version TEXT,
  retrieved_chunks INTEGER,
  top_sources_json TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);

CREATE TABLE IF NOT EXISTS chat_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_payload_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);

CREATE TABLE IF NOT EXISTS lead_signals (
  signal_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,

  intent TEXT,
  lead_temperature TEXT,
  package_interest TEXT,
  objection TEXT,
  handoff_recommended INTEGER DEFAULT 0,

  lead_score INTEGER DEFAULT 0,
  signal_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);

CREATE TABLE IF NOT EXISTS content_gaps (
  gap_id TEXT PRIMARY KEY,
  session_id TEXT,

  question TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_intent
ON chat_messages(intent);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_seen
ON chat_sessions(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_lead_temperature
ON chat_sessions(lead_temperature);

CREATE INDEX IF NOT EXISTS idx_chat_events_session_event
ON chat_events(session_id, event_name);

CREATE INDEX IF NOT EXISTS idx_lead_signals_session
ON lead_signals(session_id);

CREATE INDEX IF NOT EXISTS idx_content_gaps_status
ON content_gaps(status);
