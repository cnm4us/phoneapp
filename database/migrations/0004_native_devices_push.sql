-- Additive expansion: legacy browser sessions remain supported.
ALTER TABLE devices ADD COLUMN push_environment ENUM('production','sandbox') NULL;
-- migrate:split
ALTER TABLE auth_sessions ADD COLUMN device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD KEY ix_session_device (device_id), ADD FOREIGN KEY (device_id) REFERENCES devices(id);
-- migrate:split
ALTER TABLE call_runtime ADD COLUMN caller_device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD COLUMN answered_device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD FOREIGN KEY (caller_device_id) REFERENCES devices(id), ADD FOREIGN KEY (answered_device_id) REFERENCES devices(id);
-- migrate:split
CREATE TABLE device_credentials (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 used_at DATETIME(3) NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 response_ciphertext BLOB NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY ix_refresh_device (device_id),
 FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
-- migrate:split
CREATE TABLE push_deliveries (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 state ENUM('pending','sending','accepted','failed','expired') NOT NULL DEFAULT 'pending',
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 available_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 last_error VARCHAR(80) CHARACTER SET ascii NULL,
 UNIQUE KEY uq_call_device_push (call_id,device_id),
 KEY ix_push_work (state,available_at),
 FOREIGN KEY (call_id) REFERENCES calls(id),
 FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
