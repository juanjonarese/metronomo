/**
 * AudioEngine — motor de audio basado en Web Audio API.
 *
 * La clave está en scheduleClick():
 *   1. Convierte scheduledTime (reloj servidor, ms) a segundos del AudioContext
 *      usando el offset calculado por ClockSync.
 *   2. Programa el oscilador exactamente en ese punto futuro.
 *
 * El AudioContext tiene su propio hilo de audio separado del JS,
 * por eso .start(time) tiene precisión sub-milisegundo aunque
 * el main thread esté ocupado.
 *
 * IMPORTANTE: init() debe llamarse dentro de un evento de usuario
 * (click, tap) — el navegador bloquea la creación de AudioContext
 * sin gesto previo (política de autoplay).
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /** Necesario en iOS/Safari: el contexto arranca suspendido. */
  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  /**
   * Programa un click para que suene exactamente en scheduledTime.
   *
   * @param {number} scheduledTime - ms del reloj del servidor
   * @param {boolean} isDownbeat   - downbeat suena más agudo y fuerte
   * @param {ClockSync} clockSync
   */
  scheduleClick(scheduledTime, isDownbeat, clockSync) {
    if (!this.ctx) return;

    const secondsUntilBeat = (scheduledTime - clockSync.serverNow()) / 1000;

    // Si el beat ya pasó (mensaje llegó tarde y ya no hay margen) ignorar.
    if (secondsUntilBeat < -0.01) return;

    const audioTime = this.ctx.currentTime + Math.max(0, secondsUntilBeat);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Downbeat: más agudo y fuerte; beat normal: más suave
    osc.frequency.value = isDownbeat ? 1400 : 880;
    gain.gain.setValueAtTime(isDownbeat ? 1.0 : 0.6, audioTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(audioTime);
    osc.stop(audioTime + 0.07);
  }
}
