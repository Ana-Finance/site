"""
Génère la musique de fond et les effets sonores (motion design) de la vidéo
par synthèse : aucun fichier externe, aucun droit d'auteur.

    python3 scripts/generate_audio.py            # écrit dans public/audio/

Dépendances : numpy, scipy.
La musique (120 BPM, 45 s) est calée sur le storyboard :
  0-4 s accroche (tension) · 4-10 s problème (montée) · 10 s drop sur le logo
  · 15-32 s démo (groove) · 32-40 s bénéfices (plein) · 40-45 s résolution.
"""

import os
import sys
import wave

import numpy as np
import scipy.signal as sg

SR = 44100
BPM = 120
BEAT = 60 / BPM  # 0,5 s
BAR = 4 * BEAT  # 2 s
rng = np.random.default_rng(7)

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(__file__), '..', 'public', 'audio'
)


# ── Outils ─────────────────────────────────────────────────────
def n_samples(d):
    return int(round(d * SR))


def time(d):
    return np.arange(n_samples(d)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, fc, order=2):
    nyq = SR / 2
    if kind == 'band':
        wn = [max(20, fc[0]) / nyq, min(fc[1], nyq * 0.98) / nyq]
    else:
        wn = min(fc, nyq * 0.98) / nyq
    sos = sg.butter(order, wn, btype=kind, output='sos')
    return sg.sosfilt(sos, x, axis=0)


def sweep_filter(x, centers, q=1.2):
    """Passe-bande dont la fréquence centrale varie dans le temps (par blocs)."""
    out = np.zeros_like(x)
    block = 256
    zi = None
    for i in range(0, len(x), block):
        fc = centers[min(i, len(centers) - 1)]
        lo, hi = fc / (1 + 1 / q), fc * (1 + 1 / q)
        sos = sg.butter(2, [max(30, lo) / (SR / 2), min(hi, SR / 2 * 0.95) / (SR / 2)], btype='band', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + block], zi = sg.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def exp_env(d, tau, attack=0.002):
    t = time(d)
    env = np.exp(-t / tau)
    a = n_samples(attack)
    if a > 0:
        env[:a] *= np.linspace(0, 1, a)
    return env


def reverb(x, decay=1.2, mix=0.25):
    """Réverbération simple : convolution par un bruit à décroissance exponentielle (stéréo)."""
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    n = n_samples(decay)
    t = np.arange(n) / SR
    out = np.zeros((len(x) + n - 1, 2))
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / decay)
        ir = filt(ir, 'low', 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = sg.fftconvolve(x[:, ch], ir)
    dry = np.zeros_like(out)
    dry[:len(x)] = x
    return dry * (1 - mix) + out * mix


def stereo(x, pan=0.0):
    """pan : -1 (gauche) → 1 (droite), scalaire ou tableau."""
    if x.ndim == 2:
        return x
    p = (np.asarray(pan) + 1) / 2
    return np.stack([x * np.cos(p * np.pi / 2), x * np.sin(p * np.pi / 2)], 1)


def fade(x, fin=0.003, fout=0.02):
    x = x.copy()
    a, b = n_samples(fin), n_samples(fout)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


def write(name, x, peak=0.8):
    x = stereo(np.asarray(x, dtype=np.float64))
    x = fade(x)
    m = np.max(np.abs(x))
    if m > 0:
        x = x * (peak / m)
    data = (np.clip(x, -1, 1) * 32767).astype('<i2')
    path = os.path.join(OUT, name)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'  {name:<16} {len(x) / SR:5.2f} s')


def chirp(f0, f1, d, curve='exp'):
    t = time(d)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(d):
    return rng.standard_normal(n_samples(d))


# ── Effets sonores ────────────────────────────────────────────
def sfx_pop(f0=1100, f1=520, d=0.2):
    body = chirp(f0, f1, d) * exp_env(d, 0.045)
    click = filt(noise(d), 'high', 3000) * exp_env(d, 0.004)
    return reverb(body + 0.25 * click, 0.6, 0.18)


def sfx_click():
    d = 0.08
    return filt(noise(d), 'high', 2000) * exp_env(d, 0.004) + 0.6 * np.sin(2 * np.pi * 3200 * time(d)) * exp_env(d, 0.008)


def sfx_typing(d=2.1):
    out = np.zeros(n_samples(d) + SR // 10)
    t = 0.0
    while t < d:
        n = n_samples(0.05)
        tick = filt(noise(0.05), 'band', (1500, 5000)) * exp_env(0.05, 0.006)
        thock = np.sin(2 * np.pi * 180 * time(0.05)) * exp_env(0.05, 0.01)
        i = n_samples(t)
        out[i:i + n] += (tick + 0.5 * thock) * rng.uniform(0.55, 1.0)
        t += rng.uniform(0.055, 0.095)
    return stereo(out, 0.15)


def sfx_whoosh(d=0.7, f0=300, f_peak=3200, f1=900, pan_from=-0.6, pan_to=0.6):
    n = n_samples(d)
    x = np.linspace(0, 1, n)
    centers = np.where(x < 0.45, f0 * (f_peak / f0) ** (x / 0.45), f_peak * (f1 / f_peak) ** ((x - 0.45) / 0.55))
    sig = sweep_filter(noise(d), centers, q=1.5)
    env = np.sin(np.pi * np.clip(x / 0.45, 0, 1) / 2) ** 2 * np.where(x < 0.45, 1, np.exp(-(x - 0.45) * 7))
    return reverb(stereo(sig * env, np.linspace(pan_from, pan_to, n)), 0.8, 0.2)


def sfx_riser(d=1.6):
    n = n_samples(d)
    x = np.linspace(0, 1, n)
    nz = sweep_filter(noise(d), 200 * (7000 / 200) ** x, q=2.5)
    tone = sg.sawtooth(2 * np.pi * np.cumsum(220 * (4 ** x) * (1 + 0.01 * np.sin(2 * np.pi * 6 * time(d)))) / SR)
    tone = filt(tone, 'low', 3000)
    env = x ** 2.2
    return reverb(stereo((nz * 0.8 + tone * 0.35) * env), 0.6, 0.15)


def sfx_impact():
    d = 2.4
    sub = chirp(80, 36, d) * exp_env(d, 0.7, 0.003)
    thump = np.sin(2 * np.pi * 140 * time(d)) * exp_env(d, 0.06)
    crack = filt(noise(d), 'low', 4000) * exp_env(d, 0.07)
    shimmer = filt(noise(d), 'high', 6000) * exp_env(d, 0.6, 0.05) * 0.15
    return reverb(sub + 0.6 * thump + 0.5 * crack + shimmer, 2.2, 0.32)


def sfx_shine():
    d = 1.2
    out = np.zeros(n_samples(d))
    for _ in range(14):
        f = rng.uniform(2600, 8000)
        start = rng.uniform(0, 0.35)
        dd = d - start
        partial = np.sin(2 * np.pi * f * time(dd)) * exp_env(dd, rng.uniform(0.12, 0.3), 0.01)
        out[n_samples(start):n_samples(start) + len(partial)] += partial * rng.uniform(0.3, 1)
    out += filt(noise(d), 'high', 7000) * exp_env(d, 0.25, 0.08) * 0.6
    return reverb(stereo(out, np.linspace(-0.5, 0.5, len(out))), 1.4, 0.35)


def bell(f, d=1.0, tau=0.35):
    t = time(d)
    e = exp_env(d, tau, 0.002)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * exp_env(d, tau / 2)
            + 0.15 * np.sin(2 * np.pi * 2.76 * f * t) * exp_env(d, tau / 3)) * e


def sfx_success():
    d = 1.4
    out = np.zeros(n_samples(d))
    for f, start in [(midi(88), 0.0), (midi(95), 0.09), (midi(100), 0.18)]:
        b = bell(f, d - start, 0.4)
        out[n_samples(start):n_samples(start) + len(b)] += b * (0.9 if start else 1)
    return reverb(out, 1.4, 0.3)


def sfx_check(note):
    d = 0.7
    return reverb(bell(midi(note), d, 0.18), 0.8, 0.22)


def sfx_drop():
    d = 0.35
    body = chirp(170, 65, d) * exp_env(d, 0.09)
    tap = filt(noise(d), 'low', 1500) * exp_env(d, 0.02)
    return reverb(body + 0.5 * tap, 0.5, 0.12)


def sfx_alert():
    d = 1.0
    t = time(d)
    tone = np.sign(np.sin(2 * np.pi * 110 * t)) + np.sign(np.sin(2 * np.pi * 116.5 * t))
    tone = filt(tone, 'low', 900)
    trem = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 9 * t))
    glitch = filt(noise(d), 'band', (800, 3000)) * (rng.uniform(0, 1, len(t)) > 0.995).cumsum() % 2
    env = np.minimum(1, t / 0.03) * np.exp(-t * 2.2)
    return reverb((tone * trem + 0.25 * glitch) * env, 0.6, 0.15)


def sfx_counter(d=2.3, start_rate=26, end_rate=4):
    out = np.zeros(n_samples(d) + SR // 10)
    t = 0.0
    while t < d:
        p = t / d
        rate = start_rate * (end_rate / start_rate) ** p
        tick = np.sin(2 * np.pi * 2600 * time(0.03)) * exp_env(0.03, 0.003) + 0.3 * filt(noise(0.03), 'high', 5000) * exp_env(0.03, 0.002)
        i = n_samples(t)
        out[i:i + len(tick)] += tick * (1 - 0.5 * p)
        t += 1 / rate
    return stereo(out, 0.0)


def sfx_send():
    d = 0.3
    t = time(d)
    f = np.where(t < 0.09, 480 * (1500 / 480) ** (t / 0.09), 1500)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(d, 0.06)
    return reverb(body, 0.5, 0.2)


# ── Musique ──────────────────────────────────────────────────
TOTAL = 45.0
N = n_samples(TOTAL + 2.5)
mix = np.zeros((N, 2))


def add(buf, sig, at, gain=1.0):
    sig = stereo(sig) if sig.ndim == 1 else sig
    i = n_samples(at)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[:j - i] * gain


def saw_voice(f, d, detune_cents=7):
    t = time(d)
    voices = []
    for side, cents in ((0, -detune_cents), (1, detune_cents)):
        ff = f * 2 ** (cents / 1200)
        voices.append(sg.sawtooth(2 * np.pi * ff * t + rng.uniform(0, 6)) + 0.5 * sg.sawtooth(2 * np.pi * ff * 1.003 * t))
    return np.stack(voices, 1)


def pad_chord(notes, d, cutoff):
    sig = sum(saw_voice(midi(n), d) for n in notes) / len(notes)
    sig = filt(sig, 'low', cutoff, 2)
    env = np.minimum(1, time(d) / 0.35) * np.minimum(1, (d - time(d)) / 0.4)
    return sig * env[:, None]


def kick():
    d = 0.45
    t = time(d)
    f = 45 + 105 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(d, 0.18)
    return body + 0.3 * filt(noise(d), 'high', 3000) * exp_env(d, 0.003)


def clap():
    d = 0.3
    x = np.zeros(n_samples(d))
    for off in (0.0, 0.012, 0.024):
        b = filt(noise(d - off), 'band', (900, 2600)) * exp_env(d - off, 0.012 if off < 0.02 else 0.11)
        x[n_samples(off):n_samples(off) + len(b)] += b
    return reverb(x, 0.7, 0.25)


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    return filt(noise(d), 'high', 7500) * exp_env(d, 0.08 if open_ else 0.015)


def pluck(f, d=0.3):
    t = time(d)
    x = sg.sawtooth(2 * np.pi * f * t) * 0.6 + np.sin(2 * np.pi * f * 2 * t) * 0.4
    return filt(x, 'low', 3200) * exp_env(d, 0.12)


def bass_note(f, d):
    t = time(d)
    x = np.tanh(2.2 * np.sin(2 * np.pi * f * t)) * 0.7 + np.sin(2 * np.pi * f / 2 * t) * 0.5
    return x * exp_env(d, 0.16, 0.004)


def tick(f):
    d = 0.06
    return np.sin(2 * np.pi * f * time(d)) * exp_env(d, 0.008)


CH = {
    'Am9': [57, 60, 64, 67, 71],
    'Fmaj7': [53, 57, 60, 64],
    'E': [52, 56, 59, 64],
    'Cadd9': [55, 60, 64, 67, 74],
    'G6': [55, 59, 62, 64, 67],
}
ROOT = {'Am9': 45, 'Fmaj7': 41, 'E': 40, 'Cadd9': 36, 'G6': 43}

# Grille d'accords (une mesure = 2 s)
bars = ['Am9', 'Fmaj7', 'Am9', 'Fmaj7', 'E']  # 0-10 s
cycle = ['Fmaj7', 'Cadd9', 'G6', 'Am9']
while len(bars) < 23:
    bars.append(cycle[(len(bars) - 5) % 4])

pads = np.zeros_like(mix)
drums = np.zeros_like(mix)
bass = np.zeros_like(mix)
arp = np.zeros_like(mix)
ticks = np.zeros_like(mix)

for b, name in enumerate(bars):
    start = b * BAR
    if start >= TOTAL:
        break
    notes = CH[name]
    # Pad : sombre au début, s'ouvre jusqu'au drop puis lumineux
    if start < 4:
        cutoff, gain = 700, 0.5
    elif start < 10:
        cutoff, gain = 900 + (start - 4) * 300, 0.6
    elif start < 32:
        cutoff, gain = 2600, 0.55
    else:
        cutoff, gain = 3800, 0.6
    d = BAR + 0.5
    if b == 4:
        d = BAR - 0.45  # coupure juste avant le drop (9,55 s)
    if start >= 44:
        d = 3.0  # accord final qui résonne
    add(pads, pad_chord(notes, d, cutoff), start, gain)

    for beat in range(4):
        tb = start + beat * BEAT
        if tb >= TOTAL:
            break
        # Accroche : tic-tac d'horloge
        if tb < 4:
            add(ticks, stereo(tick(1900 if beat % 2 == 0 else 1450), -0.3 if beat % 2 else 0.3), tb, 0.5)
        # Problème : basse pulsée en croches, montée
        if 4 <= tb < 9.5:
            for e in range(2):
                add(bass, bass_note(midi(ROOT[name]), BEAT / 2), tb + e * BEAT / 2, 0.45 + (tb - 4) * 0.04)
            for s in range(4):
                if tb >= 6:
                    add(drums, stereo(hat(), 0.25), tb + s * BEAT / 4, 0.12 + (tb - 6) * 0.03)
        # Drop à 10 s : kick, basse, hats, arpège
        if 10 <= tb < 44:
            add(drums, kick(), tb, 0.95)
            add(drums, stereo(hat(True), -0.2), tb + BEAT / 2, 0.22)
            if tb >= 15 and beat in (1, 3):
                add(drums, clap(), tb, 0.45)
            for e in range(2):
                add(bass, bass_note(midi(ROOT[name]), BEAT / 2), tb + e * BEAT / 2, 0.6)
            for s in range(4):
                if s % 2 == 1:
                    add(drums, stereo(hat(), 0.3), tb + s * BEAT / 4, 0.12)
                tones = sorted(notes[:4]) + [n + 12 for n in sorted(notes[:4])]
                pattern = [0, 2, 4, 6, 7, 5, 3, 1]
                k = (beat * 4 + s) % len(pattern)
                octave = 12 if tb >= 32 else 0
                f = midi(tones[pattern[k]] + octave)
                gain_arp = 0.16 if 15 <= tb < 32 else 0.22
                add(arp, stereo(pluck(f), 0.4 if s % 2 else -0.4), tb + s * BEAT / 4, gain_arp)

# Effet « pompe » (sidechain) sur pad et basse à partir du drop
t_all = np.arange(N) / SR
since_beat = np.mod(t_all - 10, BEAT)
duck = np.where(t_all >= 10, 1 - 0.55 * np.exp(-since_beat / 0.11), 1.0)
pads *= duck[:, None]
bass *= duck[:, None]

# Écho ping-pong sur l'arpège
delay = n_samples(BEAT * 0.75)
arp_fx = arp.copy()
for k_, g in enumerate([0.45, 0.25, 0.12]):
    shifted = np.zeros_like(arp)
    shifted[delay * (k_ + 1):] = arp[:-delay * (k_ + 1)]
    arp_fx[:, k_ % 2] += shifted[:, k_ % 2] * g * 2

mix = pads * 0.55 + filt(bass, 'low', 900) * 0.7 + drums * 0.8 + filt(arp_fx, 'high', 300) * 0.8 + ticks * 0.6
mix = reverb(mix, 1.6, 0.12)[:N]
# Normalisation puis saturation douce (seuls les transitoires les plus forts sont arrondis)
mix = mix / np.percentile(np.abs(mix), 99.9) * 0.9
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix[:n_samples(TOTAL)]
# Fondu de sortie sur la dernière seconde et demie
fo = n_samples(1.5)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('Effets sonores :')
    write('pop.wav', sfx_pop(), 0.55)
    write('pop-high.wav', sfx_pop(1500, 800, 0.18), 0.5)
    write('click.wav', sfx_click(), 0.55)
    write('typing.wav', sfx_typing(2.1), 0.4)
    write('whoosh.wav', sfx_whoosh(), 0.55)
    write('whoosh-soft.wav', sfx_whoosh(0.55, 400, 2200, 700, 0.5, -0.5), 0.4)
    write('riser.wav', sfx_riser(), 0.55)
    write('impact.wav', sfx_impact(), 0.95)
    write('shine.wav', sfx_shine(), 0.4)
    write('success.wav', sfx_success(), 0.55)
    for i, note in enumerate([84, 86, 88, 91]):
        write(f'check-{i + 1}.wav', sfx_check(note), 0.45)
    write('drop.wav', sfx_drop(), 0.7)
    write('alert.wav', sfx_alert(), 0.45)
    write('counter.wav', sfx_counter(), 0.3)
    write('send.wav', sfx_send(), 0.5)
    print('Musique :')
    write('music.wav', mix, 0.85)
