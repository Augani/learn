# Lesson 09: Audio Representation

> **The one thing to remember**: Digital audio stores a continuous sound wave as
> a sequence of sampled numeric measurements. The two big knobs are how often you sample and how precisely each sample is stored.

---

## Start With Measuring a Moving Line

Imagine a smooth wave drawn on paper.

If you measure its height once every millisecond and write the numbers down, you no longer have the continuous wave itself. You have a list of samples that approximate it.

That is the core idea of digital audio.

---

## Sampling Rate

The **sampling rate** tells you how often the waveform is measured.

Examples:

- 44.1 kHz means 44,100 samples per second
- 48 kHz means 48,000 samples per second

More samples per second can capture higher-frequency detail, but also produce more data.

---

## Bit Depth

Each sample is stored with a fixed precision.

Examples:

- 16-bit audio
- 24-bit audio

Higher bit depth allows finer distinctions in amplitude and typically improves dynamic range.

So audio quality and storage both depend on:

- how often you sample
- how precisely you store each sample

---

## PCM: Raw Sample Storage

One common digital-audio representation is **PCM**: pulse-code modulation.

The useful beginner intuition is simple:

- take many amplitude samples over time
- store those sample values directly as numbers

PCM is common in uncompressed formats like WAV.

This is the audio equivalent of raw pixel data for images.

---

## Nyquist Intuition

One famous rule in digital audio is the Nyquist idea:

> To represent a frequency well, you need to sample at more than twice that frequency.

You do not need the full signal-processing proof here. The practical lesson is:

- higher-frequency signals require sufficiently high sample rates
- otherwise aliasing can occur

That is one reason common sample rates are chosen the way they are.

---

## Mono vs Stereo vs More Channels

Audio may contain:

- one channel: mono
- two channels: stereo
- many channels: surround or spatial formats

Each channel adds more sample data.

So total audio size depends on:

- sample rate
- bit depth
- number of channels
- duration

---

## Uncompressed Audio Gets Large Quickly

Even without doing full arithmetic, the pattern is clear:

- more samples per second
- more bits per sample
- more channels
- longer duration

all increase data size rapidly.

This is why audio compression formats are so common.

---

## Why Developers Should Care

Audio representation explains:

- why WAV files can be huge
- why sample-rate mismatches can break pipelines
- why audio conversion can change quality or size
- why ML audio systems and media apps care about sample rates and channel layouts explicitly

Even if you do not build audio software, understanding digital sampling strengthens your general intuition for representation.

---

## Common Misunderstandings

### “Digital audio stores the entire analog wave exactly”

No. It stores discrete sampled measurements.

### “More sample rate always means audibly better for every use case”

Not automatically. There are tradeoffs in size, hardware, and actual perceptual need.

### “Stereo just means louder” 

No. It means multiple channels, usually left and right.

---

## Hands-On Exercise

Inspect an audio file.

1. Find a WAV or PCM-based audio file.
2. Note its sample rate, bit depth, and channel count.
3. Estimate why its file size is larger than a compressed MP3 or AAC version of the same clip.
4. If you have a waveform viewer, zoom in and see that the signal is stored as discrete samples over time.

---

## Recap

- Digital audio represents sound as sampled numeric amplitudes.
- Sample rate controls how often the waveform is measured.
- Bit depth controls the precision of each sample.
- PCM is raw sample-based audio storage.
- Audio data size grows with sample rate, precision, channel count, and duration.

Next, we step back and ask the bigger question behind image and audio formats: how do systems reduce data size without losing too much of what matters?