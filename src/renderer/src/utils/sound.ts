let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

/** Play a soft "done" chime — two notes */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime

    // Note 1: higher pitch
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 880  // A5
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.0, now)
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.01)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Note 2: lower pitch with slight delay
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 1108  // C#6
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.10, now + 0.11)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.45)
  } catch {
    // Silently fail if audio not available
  }
}
