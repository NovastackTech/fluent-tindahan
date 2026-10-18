/**
 * Offline-first audio & haptic feedback for barcode scans and POS actions.
 * Synthesizes a clean POS barcode scanner beep via Web Audio API.
 */
export function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime); // Standard 1.8kHz retail scanner pitch

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Non-fatal if browser blocks autoplay or audio context
  }

  // Haptic feedback for mobile phones
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(60);
    } catch {
      // Ignore vibration error
    }
  }
}
