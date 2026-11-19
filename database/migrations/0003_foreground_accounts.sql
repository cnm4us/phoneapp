-- Additive prototype authentication and foreground call coordination.
CREATE TABLE enrollment_codes (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  redeemed_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_enrollment_user (user_id, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split
CREATE TABLE auth_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_sessions_user (user_id, revoked_at, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split
CREATE TABLE call_runtime (
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  caller_session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  answered_session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ring_expires_at DATETIME(3) NOT NULL,
  call_expires_at DATETIME(3) NOT NULL,
  segment_started_at DATETIME(3) NULL,
  observed_connected_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (caller_session_id) REFERENCES auth_sessions(id),
  FOREIGN KEY (answered_session_id) REFERENCES auth_sessions(id),
  CONSTRAINT ck_runtime_deadlines CHECK (call_expires_at >= ring_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split
CREATE TABLE call_presence (
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_report_at DATETIME(3) NULL,
  PRIMARY KEY (call_id, participant_id),
  FOREIGN KEY (call_id, participant_id) REFERENCES call_participants(call_id, id),
  CONSTRAINT ck_presence_connected CHECK (connected IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
