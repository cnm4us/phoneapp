#!/usr/bin/env python3
"""Inspect local EAS preview artifacts without printing signing or device secrets."""
import argparse
import json
from pathlib import Path
import plistlib
import subprocess
import struct
import zipfile

APP_ID = 'com.bawebtech.phoneapp.poc'


def signed_entitlements(binary):
    # Physical arm64 preview: read the LC_CODE_SIGNATURE entitlement slot.
    assert binary[:4] == bytes.fromhex('cffaedfe')
    count = struct.unpack_from('<I', binary, 16)[0]
    offset = 32
    for _ in range(count):
        command, size = struct.unpack_from('<II', binary, offset)
        if command == 0x1d:
            start, length = struct.unpack_from('<II', binary, offset + 8)
            signature = binary[start:start + length]
            magic, _, slots = struct.unpack_from('>III', signature, 0)
            assert magic == 0xfade0cc0
            for index in range(slots):
                kind, position = struct.unpack_from('>II', signature, 12 + index * 8)
                if kind == 5:
                    magic, length = struct.unpack_from('>II', signature, position)
                    assert magic == 0xfade7171
                    return plistlib.loads(signature[position + 8:position + length])
        offset += size
    raise AssertionError('Missing signed entitlement metadata')


def check_ios(path, expected_team):
    with zipfile.ZipFile(path) as package:
        info_path = next(n for n in package.namelist()
                         if n.startswith('Payload/') and n.count('/') == 2
                         and n.endswith('.app/Info.plist'))
        root = info_path[:-len('Info.plist')]
        info = plistlib.loads(package.read(info_path))
        decoded = subprocess.run(
            ['openssl', 'cms', '-verify', '-inform', 'DER', '-noverify'],
            input=package.read(root + 'embedded.mobileprovision'),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
        # CMS signature is checked; this is not Apple trust-chain/device acceptance.
        profile = plistlib.loads(decoded)
        entitlements = profile['Entitlements']
        team = entitlements['com.apple.developer.team-identifier']
        assert info['CFBundleIdentifier'] == APP_ID
        assert info.get('DTPlatformName') == 'iphoneos'
        assert entitlements['aps-environment'] == 'production'
        assert entitlements['application-identifier'] == team + '.' + APP_ID
        assert not expected_team or team == expected_team
        assert not entitlements.get('get-task-allow', False)
        assert profile.get('ProvisionedDevices')
        assert {'audio', 'voip'}.issubset(info.get('UIBackgroundModes', []))
        bundles = [n for n in package.namelist() if n.startswith(root) and n.endswith('.jsbundle')]
        assert bundles and package.getinfo(bundles[0]).file_size > 100_000
        binary = package.read(root + info['CFBundleExecutable'])
        signed = signed_entitlements(binary)
        assert signed.get('aps-environment') == 'production'
        assert signed.get('application-identifier') == team + '.' + APP_ID
        assert b'PhoneappCallingDelegate' in binary
        assert b'PhoneappMediaObserver' in binary
        return dict(platform='ios', physical_device_build=True,
                    production_push_entitlement=True, app_identifier_matches=True,
                    expected_team_matches=True if expected_team else None,
                    code_signature_entitlements_match=True, bundled_javascript=True,
                    native_call_handlers_present=True,
                    registered_device_count=len(profile['ProvisionedDevices']),
                    handset_delivery_tested=False)


def check_android(path):
    with zipfile.ZipFile(path) as package:
        bundles = [n for n in package.namelist() if n.endswith('index.android.bundle')]
        assert bundles and package.getinfo(bundles[0]).file_size > 100_000
        manifest = package.read('AndroidManifest.xml')
        for value in (APP_ID, 'android.permission.MANAGE_OWN_CALLS',
                      'android.permission.FOREGROUND_SERVICE_PHONE_CALL'):
            assert value.encode() in manifest or value.encode('utf-16le') in manifest
        dex = b''.join(package.read(n) for n in package.namelist() if n.endswith('.dex'))
        for name in ('PhoneappCallingModule', 'PhoneappMessagingService',
                     'PhoneappConnectionService', 'CallForegroundService'):
            assert name.encode() in dex
        return dict(platform='android', bundled_javascript=True,
                    native_call_handlers_present=True, handset_delivery_tested=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ios', type=Path)
    parser.add_argument('--android', type=Path)
    parser.add_argument('--expected-team-id')
    args = parser.parse_args()
    if not args.ios and not args.android:
        parser.error('Supply --ios and/or --android with a local package path.')
    try:
        checks = []
        if args.ios:
            checks.append(check_ios(args.ios, args.expected_team_id))
        if args.android:
            checks.append(check_android(args.android))
        print(json.dumps(dict(result='PASS', checks=checks)))
        return 0
    except Exception:
        print('Native package check failed; signing/profile contents suppressed.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
