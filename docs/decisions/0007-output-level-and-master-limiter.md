# ADR 0007 — Output level: a calibrated note at −3 dBFS and a master limiter

- **Status**: Accepted (bug `94e41524`, 2026-10-06). Amends ADR 0001 §2 (audio) — the master bus
  gains a limiter.
- **Date**: 2026-10-06
- **Context**: the owner: "the default piano sound even at 100 % sounds too quiet." Measured, it was:
  the MusyngKite soundfonts `smplr` loads are mastered around −24 dBFS (per-sample peaks
  0.024–0.096 across all seven `INSTRUMENTS`; the grand's median 0.064, its C4 0.030), and `smplr`'s
  default `extraGain` of 5 left one note at velocity 80 at **−22 dBFS** at 100 % volume (C4: −29).
  The synth fallback sat at −6 dBFS — the default instrument was 16 dB quieter than the fallback.
  The summed-gain headroom (`feaf5917`) was not the cause: it only touches groups.

## Decision

1. **One level, one constant.** `NOTE_PEAK_TARGET` = −3 dBFS is what one voice at
   `DEFAULT_VELOCITY` peaks at, at 100 % volume, on both paths. The synth's velocity curve is
   anchored on it; the soundfont gets `extraGain = SOUNDFONT_OUTPUT_GAIN` (≈ 45), derived from the
   measured typical sample peak. The volume slider keeps its 0–100 % range and squared curve, so the
   stored setting is unchanged.
2. **Groups keep their budget**, at a higher ceiling (`SUMMED_PEAK_CEILING` 0.85 → 0.95), budgeted
   on the typical sample. Every chord the app plays itself stays under full scale before the limiter.
3. **A master limiter for what no budget sees**: volume → `DynamicsCompressorNode` (hard knee
   −2 dBFS, 20:1, 1 ms attack, 100 ms release) → trim → destination. Held keys from a MIDI piano
   arrive one `noteOn` at a time and sum to ~+9 dBFS at the new level; before this they clipped on
   the synth (+6.8 dBFS) and only escaped on the soundfont by being 20 dB too quiet. The compressor's
   spec-defined make-up gain (`(1 / curve(0 dBFS)) ^ 0.6`, +1.14 dB here) is cancelled by the trim,
   so below the threshold the chain is exactly unity and the calibration holds.
4. **A start-up bypass.** A fresh `DynamicsCompressorNode` is not at rest: its detector starts at
   zero, so it ducks its first sound (Chromium: −16 dB over the first 10 ms, still about −3 dB at
   50 ms, settled by 250 ms). The note whose key press creates the context sits right there, so a
   parallel unity bypass carries the master for `LIMITER_SETTLE_S` (250 ms), then crossfades onto
   the limiter over 50 ms. That one-off quarter-second is unlimited.

## Measured (100 % volume, peak dBFS; `level.test.ts` renders, limiter at its static curve)

| | before | after |
| --- | --- | --- |
| synth, one note, v80 | −6.1 | −3.0 |
| soundfont, one note, v80 (typical sample) | −22.1 | −3.0 |
| soundfont, one note, v80 (C4 sample) | −28.7 | −9.6 |
| soundfont, one note, v80 (loudest sample in the kit) | −18.6 | −1.9 |
| synth, Cmaj7 at v88 (one group) | −3.5 | −2.6 |
| soundfont, Cmaj7 at v88 (one group) | −16.2 | −2.0 |
| synth, four held keys at v100 | **+6.8 (clips)** | −1.4 |
| soundfont, four held keys at v100 | −6.7 | −1.4 |

`e2e/output-level.spec.ts` checks the synth rows in Chromium's real `OfflineAudioContext`, with the
real compressor's attack and release.

## Consequences

- The top of the velocity range is flat: above ~velocity 92 one note already meets the group
  ceiling, and the limiter would flatten it anyway. A loud default costs that; lowering
  `NOTE_PEAK_TARGET` buys it back.
- The compressor's 6 ms look-ahead is 6 ms of latency, inside ADR 0001's 30 ms key-to-sound budget.
- The metronome click (−6 dBFS) is now 3 dB under a note instead of 16 dB over the soundfont; it is
  unchanged and stays audible.
- Rejected: a `WaveShaperNode` soft clipper (a hard bound, but it distorts every held chord instead
  of turning it down); extending the volume slider past 100 % (not needed once the soundfont is
  calibrated, and it would change the stored setting's meaning).
