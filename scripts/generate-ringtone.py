#!/usr/bin/env python3
"""Generate Phoneapp's original two-note alert; no downloaded/licensed media."""
import math
from pathlib import Path
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 22050
DURATION = 2.4
samples = []
for index in range(round(RATE * DURATION)):
    time = index / RATE
    value = 0.0
    for start in (0.0, 0.55):
        local = time - start
        if 0 <= local < 0.35:
            envelope = min(1.0, local / 0.012, (0.35 - local) / 0.04)
            value += 0.19 * envelope * (math.sin(2 * math.pi * 540 * local) + math.sin(2 * math.pi * 720 * local)) / 2
    samples.append(struct.pack('<h', round(value * 32767)))
for relative in ('modules/phoneapp-audio/ios/Resources/incoming.wav',
                 'modules/phoneapp-audio/android/src/main/res/raw/phoneapp_incoming.wav'):
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(b''.join(samples))
    print(f'Generated {relative}: mono PCM, {RATE} Hz, {DURATION}s')
