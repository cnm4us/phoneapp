#!/usr/bin/env python3
"""Provision only this project's local databases/accounts; never print SQL/secrets."""
import os
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / '.env.database'
MUTABLE = ('users', 'patients', 'patient_accounts', 'patient_assignments',
           'patient_phone_numbers', 'devices', 'calls', 'call_participants',
           'recording_assets', 'transcription_jobs')
APPEND_ONLY = ('call_events', 'consent_events', 'transcript_versions',
               'transcript_segments', 'activity_observations', 'activity_reviews')


def admin(sql):
    result = subprocess.run(['sudo', '-n', 'mariadb', '--protocol=socket',
                             '--batch', '--skip-column-names'], input=sql,
                            text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Scoped MariaDB administration failed; SQL/credentials withheld')
    return result.stdout.strip()


def main():
    grants_only = sys.argv[1:] == ['--grants']
    if sys.argv[1:] and not grants_only:
        raise RuntimeError('Usage: provision-database.py [--grants]')
    keys = ('PHONEAPP_RUNTIME_PASSWORD', 'PHONEAPP_MIGRATION_PASSWORD', 'PHONEAPP_TEST_PASSWORD')
    if not CONFIG.exists():
        if grants_only:
            raise RuntimeError('Provision first')
        count = admin("SELECT (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('phoneapp','phoneapp_test')) + (SELECT COUNT(*) FROM mysql.user WHERE User IN ('phoneapp_app','phoneapp_migrate','phoneapp_test'));")
        if count != '0':
            raise RuntimeError('Project names already exist without matching local configuration; inspect before provisioning')
        values = {key: secrets.token_hex(32) for key in keys}
        content = 'PHONEAPP_DB_SOCKET=/run/mysqld/mysqld.sock\n' + ''.join(f'{key}={values[key]}\n' for key in keys)
        with os.fdopen(os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
            file.write(content)
    if CONFIG.stat().st_mode & 0o077:
        raise RuntimeError('Database secret file must have mode 600')
    values = dict(line.split('=', 1) for line in CONFIG.read_text().splitlines() if '=' in line and not line.startswith('#'))
    if any(len(values.get(key, '')) != 64 or any(c not in '0123456789abcdef' for c in values[key]) for key in keys):
        raise RuntimeError('Expected locally generated hexadecimal passwords')
    if not grants_only:
        sql = [f'CREATE DATABASE IF NOT EXISTS `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;' for db in ('phoneapp', 'phoneapp_test')]
        for user, key in zip(('phoneapp_app', 'phoneapp_migrate', 'phoneapp_test'), keys):
            sql.append(f"CREATE USER IF NOT EXISTS '{user}'@'localhost' IDENTIFIED BY '{values[key]}';")
        sql.extend([
            "GRANT SELECT ON phoneapp.* TO 'phoneapp_app'@'localhost';",
            "GRANT ALL PRIVILEGES ON phoneapp.* TO 'phoneapp_migrate'@'localhost';",
            "GRANT ALL PRIVILEGES ON phoneapp_test.* TO 'phoneapp_test'@'localhost';",
        ])
        admin('\n'.join(sql))
        print('Provisioned Phoneapp dev/test databases and local scoped identities; credentials in .env.database (600).')
    else:
        # New tables receive write privileges only after explicit review here.
        admin('\n'.join(
            f"GRANT SELECT, INSERT{', UPDATE' if table in MUTABLE else ''} ON phoneapp.`{table}` TO 'phoneapp_app'@'localhost';"
            for table in MUTABLE + APPEND_ONLY))
        print('Granted scoped runtime writes; migration ledger and immutable history remain protected.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
