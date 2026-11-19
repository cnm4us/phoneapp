-- Additive, call-independent audio messages. A message owns its processing lease/asset.
CREATE TABLE audio_messages (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sender_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 recipient_staff_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sender_label VARCHAR(160) NOT NULL,
 sender_role VARCHAR(32) CHARACTER SET ascii NOT NULL,
 request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state ENUM('pending','uploading','processing','available','failed','expired') NOT NULL DEFAULT 'pending',
 input_key VARCHAR(100) CHARACTER SET ascii NULL,
 output_key VARCHAR(100) CHARACTER SET ascii NULL,
 input_hash CHAR(64) CHARACTER SET ascii NULL,
 size_bytes INT UNSIGNED NULL,
 duration_ms INT UNSIGNED NULL,
 lease_key CHAR(36) CHARACTER SET ascii NULL,
 lease_until DATETIME(3) NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 failure_code VARCHAR(50) CHARACTER SET ascii NULL,
 created_at DATETIME(3) NOT NULL,
 published_at DATETIME(3) NULL,
 expires_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_message_request (sender_id,request_key),
 KEY ix_patient_messages (patient_id,created_at,id),
 KEY ix_message_worker (state,lease_until),
 FOREIGN KEY(patient_id) REFERENCES patients(id),
 FOREIGN KEY(sender_id) REFERENCES users(id),
 FOREIGN KEY(recipient_staff_id) REFERENCES users(id),
 CONSTRAINT ck_message_available CHECK(state<>'available' OR (output_key IS NOT NULL AND duration_ms IS NOT NULL AND published_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
-- migrate:split
CREATE TABLE message_media_grants (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 message_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 operation ENUM('upload','play') NOT NULL,
 used_at DATETIME(3) NULL,
 expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY(message_id) REFERENCES audio_messages(id),
 FOREIGN KEY(session_id) REFERENCES auth_sessions(id),
 KEY ix_media_grant_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
