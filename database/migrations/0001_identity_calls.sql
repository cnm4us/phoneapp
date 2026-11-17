-- Append-only migration. Explicit statement boundaries; no startup schema sync.

CREATE TABLE users (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  display_name VARCHAR(160) NOT NULL,
  role ENUM('practitioner','rn','ma','admin','patient','caregiver') NOT NULL,
  status ENUM('disabled','active') NOT NULL DEFAULT 'disabled',
  auth_issuer VARCHAR(255) CHARACTER SET ascii NULL,
  auth_subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_auth_subject (auth_issuer, auth_subject),
  CONSTRAINT ck_user_auth CHECK ((auth_issuer IS NULL) = (auth_subject IS NULL)),
  CONSTRAINT ck_active_auth CHECK (status = 'disabled' OR auth_subject IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE patients (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  display_name VARCHAR(160) NULL,
  external_identifier VARCHAR(100) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_patient_external (external_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE patient_accounts (
patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  relationship ENUM('self','caregiver') NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (patient_id, user_id),
  KEY ix_patient_account_user (user_id, revoked_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE patient_assignments (
patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  staff_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (patient_id, staff_user_id),
  KEY ix_staff_directory (staff_user_id, revoked_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (staff_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE patient_phone_numbers (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  phone_e164 VARCHAR(16) CHARACTER SET ascii NOT NULL,
  owner_name VARCHAR(160) NULL,
  relationship VARCHAR(60) NOT NULL,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  sms_capable BOOLEAN NOT NULL DEFAULT FALSE,
  contact_permission ENUM('unknown','allowed','denied') NOT NULL DEFAULT 'unknown',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_phone_candidates (phone_e164),
  KEY ix_patient_phone (patient_id, is_preferred),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT ck_phone_e164 CHECK (phone_e164 REGEXP '^[+][1-9][0-9]{6,14}$'),
  CONSTRAINT ck_phone_bools CHECK (is_preferred IN (0,1) AND sms_capable IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE devices (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  installation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  platform ENUM('ios','android','web') NOT NULL,
  app_identifier VARCHAR(180) CHARACTER SET ascii NOT NULL,
  push_provider ENUM('none','apns_voip','fcm','expo') NOT NULL DEFAULT 'none',
  push_token_ciphertext BLOB NULL,
  push_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  last_seen_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_installation (app_identifier, installation_id),
  UNIQUE KEY uq_device_owner (id, user_id),
  UNIQUE KEY uq_device_token (push_provider, app_identifier, push_token_hash),
  KEY ix_user_devices (user_id, revoked_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_device_token CHECK ((push_token_ciphertext IS NULL) = (push_token_hash IS NULL)),
  CONSTRAINT ck_device_push CHECK (push_token_hash IS NULL OR push_provider <> 'none')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE calls (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  initiated_by_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_request_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('app_audio_video','app_audio','telephone') NOT NULL DEFAULT 'app_audio_video',
  state ENUM('created','ringing','accepted','connected','ended','declined','missed','canceled','failed') NOT NULL DEFAULT 'created',
  transcription_status ENUM('off','pending','processing','ready','partial','failed','deleted') NOT NULL DEFAULT 'off',
  recording_requested BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at DATETIME(3) NULL,
  connected_at DATETIME(3) NULL,
  ended_at DATETIME(3) NULL,
  observed_connected_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_call_patient (id, patient_id),
  UNIQUE KEY uq_call_request (initiated_by_user_id, client_request_key),
  KEY ix_patient_calls (patient_id, created_at, id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (initiated_by_user_id) REFERENCES users(id),
  CONSTRAINT ck_call_times CHECK ((answered_at IS NULL OR answered_at >= created_at) AND (connected_at IS NULL OR connected_at >= created_at) AND (ended_at IS NULL OR ended_at >= created_at) AND (ended_at IS NULL OR connected_at IS NULL OR ended_at >= connected_at)),
  CONSTRAINT ck_call_terminal CHECK (state NOT IN ('ended','declined','missed','canceled','failed') OR ended_at IS NOT NULL),
  CONSTRAINT ck_call_recording CHECK (recording_requested IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE call_participants (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  device_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  role_snapshot ENUM('practitioner','rn','ma','admin','patient','caregiver') NOT NULL,
  label_snapshot VARCHAR(160) NOT NULL,
  joined_at DATETIME(3) NULL,
  left_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_call_user (call_id, user_id),
  UNIQUE KEY uq_call_participant (call_id, id),
  KEY ix_user_history (user_id, created_at, call_id),
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (device_id, user_id) REFERENCES devices(id, user_id),
  CONSTRAINT ck_participant_times CHECK (left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE call_events (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  source VARCHAR(40) CHARACTER SET ascii NOT NULL,
  source_event_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_type VARCHAR(60) CHARACTER SET ascii NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_call_event (call_id, source, source_event_key),
  KEY ix_call_events (call_id, occurred_at, id),
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (call_id, participant_id) REFERENCES call_participants(call_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
