import { createHash } from 'node:crypto';
import type { Connection } from 'mariadb';

// Stable, namespaced synthetic identifiers. No login subjects or tokens are seeded.
export function fixtureId(name: string): string {
  const hex = createHash('sha256').update(`phoneapp:synthetic:v1:${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const providerId = fixtureId('provider');
export const patientId = (letter: string): string => fixtureId(`patient-${letter}`);
export const patientUserId = (letter: string): string => fixtureId(`patient-user-${letter}`);

export async function seed(connection: Connection): Promise<void> {
  await connection.beginTransaction();
  try {
    // No UPDATE/DELETE: re-running cannot erase later changes or reactivate bindings.
    await connection.query("INSERT INTO users (id,display_name,role) SELECT ?,?,'practitioner' WHERE NOT EXISTS (SELECT 1 FROM users WHERE id=?)", [providerId, 'Synthetic Provider', providerId]);
    for (const letter of ['A', 'B', 'C']) {
      const patient = patientId(letter);
      const user = patientUserId(letter);
      await connection.query('INSERT INTO patients (id,display_name,external_identifier) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM patients WHERE id=?)', [patient, `Patient ${letter}`, `SYNTHETIC-${letter}`, patient]);
      await connection.query("INSERT INTO users (id,display_name,role) SELECT ?,?,'patient' WHERE NOT EXISTS (SELECT 1 FROM users WHERE id=?)", [user, `Synthetic Patient ${letter}`, user]);
      await connection.query("INSERT INTO patient_accounts (patient_id,user_id,relationship) SELECT ?,?,'self' WHERE NOT EXISTS (SELECT 1 FROM patient_accounts WHERE patient_id=? AND user_id=?)", [patient, user, patient, user]);
      await connection.query('INSERT INTO patient_assignments (patient_id,staff_user_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM patient_assignments WHERE patient_id=? AND staff_user_id=?)', [patient, providerId, patient, providerId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
