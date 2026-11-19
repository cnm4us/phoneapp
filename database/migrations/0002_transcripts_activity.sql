-- Append-only migration. Explicit statement boundaries; no startup schema sync.

CREATE TABLE consent_events (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  purpose ENUM('recording','transcription') NOT NULL,
  decision ENUM('granted','declined','revoked') NOT NULL,
  policy_version VARCHAR(80) CHARACTER SET ascii NOT NULL,
  source_event_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  call_offset_ms INT UNSIGNED NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_consent_event (call_id, participant_id, source_event_key),
  KEY ix_consent_timeline (call_id, participant_id, purpose, call_offset_ms),
  FOREIGN KEY (call_id, participant_id) REFERENCES call_participants(call_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE recording_assets (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status ENUM('pending','ready','partial','failed','deleted') NOT NULL DEFAULT 'pending',
  storage_backend VARCHAR(60) CHARACTER SET ascii NULL,
  object_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL,
  content_type VARCHAR(100) CHARACTER SET ascii NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  size_bytes BIGINT UNSIGNED NULL,
  start_offset_ms INT UNSIGNED NOT NULL DEFAULT 0,
  end_offset_ms INT UNSIGNED NULL,
  retention_expires_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_call_asset (call_id, id),
  KEY ix_asset_retention (status, retention_expires_at),
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (call_id, participant_id) REFERENCES call_participants(call_id, id),
  CONSTRAINT ck_asset_interval CHECK (end_offset_ms IS NULL OR end_offset_ms >= start_offset_ms),
  CONSTRAINT ck_asset_ready CHECK (status NOT IN ('ready','partial') OR (storage_backend IS NOT NULL AND object_key IS NOT NULL AND end_offset_ms IS NOT NULL)),
  CONSTRAINT ck_asset_deleted CHECK (status <> 'deleted' OR (deleted_at IS NOT NULL AND object_key IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE transcription_jobs (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dedupe_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(60) CHARACTER SET ascii NULL,
  status ENUM('queued','running','completed','failed','canceled') NOT NULL DEFAULT 'queued',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  lease_expires_at DATETIME(3) NULL,
  failure_code VARCHAR(80) CHARACTER SET ascii NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_job_request (call_id, dedupe_key),
  UNIQUE KEY uq_call_job (call_id, id),
  KEY ix_job_queue (status, lease_expires_at, created_at),
  FOREIGN KEY (call_id) REFERENCES calls(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE transcript_versions (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_by_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  supersedes_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  version_number INT UNSIGNED NOT NULL,
  review_status ENUM('draft','reviewed') NOT NULL DEFAULT 'draft',
  change_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_transcript_version (call_id, version_number),
  UNIQUE KEY uq_call_transcript (call_id, id),
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (call_id, job_id) REFERENCES transcription_jobs(call_id, id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (call_id, supersedes_id) REFERENCES transcript_versions(call_id, id),
  CONSTRAINT ck_transcript_version CHECK (version_number > 0),
  CONSTRAINT ck_transcript_revision CHECK (supersedes_id IS NULL OR (supersedes_id <> id AND change_reason IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE transcript_segments (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  transcript_version_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  sequence_number INT UNSIGNED NOT NULL,
  start_offset_ms INT UNSIGNED NOT NULL,
  end_offset_ms INT UNSIGNED NOT NULL,
  speaker_label VARCHAR(160) NOT NULL,
  role_snapshot ENUM('practitioner','rn','ma','admin','patient','caregiver') NULL,
  attribution_uncertain BOOLEAN NOT NULL DEFAULT TRUE,
  text MEDIUMTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_segment_order (transcript_version_id, sequence_number),
  FOREIGN KEY (call_id, transcript_version_id) REFERENCES transcript_versions(call_id, id),
  FOREIGN KEY (call_id, participant_id) REFERENCES call_participants(call_id, id),
  CONSTRAINT ck_segment_interval CHECK (end_offset_ms >= start_offset_ms),
  CONSTRAINT ck_segment_uncertain CHECK (attribution_uncertain IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE activity_observations (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  staff_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  activity_type ENUM('app_call','manual','text_composition','text_reading','chart_review','coordination') NOT NULL,
  source VARCHAR(40) CHARACTER SET ascii NOT NULL,
  source_event_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NOT NULL,
  observed_seconds INT UNSIGNED NOT NULL,
  purpose VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_activity_source (source, source_event_key, staff_user_id),
  KEY ix_staff_activity (staff_user_id, started_at, ended_at),
  KEY ix_patient_activity (patient_id, started_at),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (staff_user_id) REFERENCES users(id),
  FOREIGN KEY (call_id, patient_id) REFERENCES calls(id, patient_id),
  CONSTRAINT ck_activity_interval CHECK (ended_at >= started_at AND observed_seconds <= TIMESTAMPDIFF(SECOND, started_at, ended_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- migrate:split

CREATE TABLE activity_reviews (
id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  observation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reviewer_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  decision ENUM('reviewed','approved','excluded','corrected') NOT NULL,
  reviewed_seconds INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_activity_reviews (observation_id, created_at, id),
  FOREIGN KEY (observation_id) REFERENCES activity_observations(id),
  FOREIGN KEY (reviewer_user_id) REFERENCES users(id),
  CONSTRAINT ck_excluded_seconds CHECK (decision <> 'excluded' OR reviewed_seconds = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
