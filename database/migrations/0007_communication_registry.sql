-- Preserve source identifiers and enforce patient consistency for each wrapper.
ALTER TABLE audio_messages ADD UNIQUE KEY uq_message_patient (id,patient_id);
-- migrate:split
CREATE TABLE communications (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 patient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 call_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 media_message_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_communication_call (call_id),
 UNIQUE KEY uq_communication_message (media_message_id),
 KEY ix_communication_patient (patient_id,created_at,id),
 KEY ix_communication_time (created_at,id),
 FOREIGN KEY (patient_id) REFERENCES patients(id),
 FOREIGN KEY (call_id,patient_id) REFERENCES calls(id,patient_id),
 FOREIGN KEY (media_message_id,patient_id) REFERENCES audio_messages(id,patient_id),
 CONSTRAINT ck_communication_source CHECK ((call_id IS NOT NULL)+(media_message_id IS NOT NULL)=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
-- migrate:split
INSERT INTO communications(id,patient_id,call_id,created_at)
 SELECT UUID(),c.patient_id,c.id,c.created_at FROM calls c;
-- migrate:split
INSERT INTO communications(id,patient_id,media_message_id,created_at)
 SELECT UUID(),m.patient_id,m.id,m.created_at FROM audio_messages m;
