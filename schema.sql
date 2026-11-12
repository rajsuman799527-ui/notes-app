CREATE TABLE IF NOT EXISTS chatUsers (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE,
  displayName TEXT,
  tokenHash TEXT,
  codeHash TEXT,
  salt TEXT,
  presence TEXT,
  lastActive TEXT,
  lastPanicAt TEXT,
  backAt TEXT,
  typingUntil TEXT,
  typingChat TEXT,
  hideStatus INTEGER DEFAULT 0,
  failedAttempts INTEGER DEFAULT 0,
  lockedUntil TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_token ON chatUsers(tokenHash);

CREATE TABLE IF NOT EXISTS partnerships (
  id TEXT PRIMARY KEY,
  pairKey TEXT UNIQUE,
  userA TEXT,
  userB TEXT,
  requestedBy TEXT,
  status TEXT,
  blockedBy TEXT,
  mutedBy TEXT,
  createdAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_p_a ON partnerships(userA);
CREATE INDEX IF NOT EXISTS idx_p_b ON partnerships(userB);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  text TEXT,
  chatId TEXT,
  senderUid TEXT,
  replyToId TEXT,
  status TEXT,
  deleted INTEGER DEFAULT 0,
  hiddenFor TEXT,
  clientId TEXT,
  createdAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_m_chat ON messages(chatId, createdAt);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  emoji TEXT,
  messageId TEXT,
  chatId TEXT,
  uid TEXT
);
CREATE INDEX IF NOT EXISTS idx_r_msg ON reactions(messageId);

CREATE TABLE IF NOT EXISTS panicEvents (
  id TEXT PRIMARY KEY,
  uid TEXT,
  clearedAt TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS headMoves (
  id TEXT PRIMARY KEY,
  uid TEXT,
  positionId TEXT,
  message TEXT,
  enabled INTEGER DEFAULT 0,
  sensitivity INTEGER,
  UNIQUE(uid, positionId)
);

CREATE TABLE IF NOT EXISTS headMoveSettings (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE,
  enabled INTEGER DEFAULT 0,
  sensitivity INTEGER,
  sendInstantly INTEGER DEFAULT 0,
  partnerConsent INTEGER DEFAULT 0,
  setupDone INTEGER DEFAULT 0,
  neutralYaw REAL,
  neutralPitch REAL,
  neutralRoll REAL,
  tuneYaw REAL,
  tunePitch REAL,
  tuneRoll REAL
);
