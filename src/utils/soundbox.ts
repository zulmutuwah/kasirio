/**
 * Modul Virtual Soundbox Kasirio
 * Membunyikan nada lonceng notifikasi (Web Audio API) dan ucapan vokal bahasa Indonesia (Web Speech API).
 */

class VirtualSoundbox {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Memainkan nada lonceng pembayaran digital (Dual Chime C6 & G6)
   */
  public playChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Bell 1: 1046.50 Hz (C6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Bell 2: 1567.98 Hz (G6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1567.98, now + 0.15);
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('[Virtual Soundbox] Web Audio tidak dapat diputar:', e);
    }
  }

  /**
   * Mengucapkan notifikasi pembayaran QRIS berhasil dengan suara vokal ramah
   */
  public announcePayment(amount: number, method: string = 'QRIS') {
    this.playChime();

    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Tunggu sedikit setelah lonceng
    setTimeout(() => {
      try {
        const formattedAmount = amount.toLocaleString('id-ID');
        const text = `Pembayaran ${method} sebesar ${formattedAmount} rupiah berhasil diterima.`;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.05; // Sedikit lebih responsif
        utterance.pitch = 1.0;

        // Cari suara Bahasa Indonesia jika ada
        const voices = window.speechSynthesis.getVoices();
        const indoVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
        if (indoVoice) {
          utterance.voice = indoVoice;
        }

        window.speechSynthesis.cancel(); // Bersihkan antrean lama
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[Virtual Soundbox Speech Error]', err);
      }
    }, 350);
  }

  /**
   * Mengucapkan pesan kustom (misal kembalian atau info pesanan)
   */
  public speak(message: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[Virtual Soundbox Error]', err);
    }
  }
}

export const soundbox = new VirtualSoundbox();
