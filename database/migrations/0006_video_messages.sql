-- Expand the existing message table; retain IDs/FKs and the legacy SQL name.
ALTER TABLE audio_messages
 ADD COLUMN media_kind ENUM('audio','video') NOT NULL DEFAULT 'audio',
 ADD COLUMN output_mime VARCHAR(40) CHARACTER SET ascii NULL,
 ADD COLUMN output_bytes INT UNSIGNED NULL,
 ADD COLUMN video_width SMALLINT UNSIGNED NULL,
 ADD COLUMN video_height SMALLINT UNSIGNED NULL,
 ADD COLUMN video_fps DECIMAL(6,2) UNSIGNED NULL,
 ADD COLUMN thumbnail_key VARCHAR(100) CHARACTER SET ascii NULL,
 ADD COLUMN thumbnail_bytes INT UNSIGNED NULL,
 ADD CONSTRAINT ck_message_video CHECK(media_kind<>'video' OR state<>'available' OR (output_mime='video/mp4' AND output_bytes IS NOT NULL AND video_width>0 AND video_height>0 AND video_fps>0 AND video_fps<=30 AND thumbnail_key IS NOT NULL AND thumbnail_bytes IS NOT NULL));
-- migrate:split
ALTER TABLE message_media_grants MODIFY operation ENUM('upload','play','thumbnail') NOT NULL;
