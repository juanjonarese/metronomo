/**
 * SessionManager
 *
 * Maneja sesiones de metrónomo en memoria.
 * Cada sesión tiene su propio scheduler que emite beats con
 * un timestamp futuro (scheduledTime) para que los clientes
 * los programen con Web Audio API en lugar de reproducirlos
 * instantáneamente.
 *
 * El scheduler corre cada LOOKAHEAD_MS y agenda beats
 * hasta SCHEDULE_AHEAD_MS en el futuro. Esto absorbe el
 * jitter de red: aunque el mensaje llegue tarde, el beat
 * sigue en el futuro y el cliente lo programa con precisión.
 */

const LOOKAHEAD_MS = 25;       // intervalo del scheduler
const SCHEDULE_AHEAD_MS = 300; // qué tan lejos en el futuro se agenda

class Session {
  constructor(id, bpm = 120, beatsPerMeasure = 4) {
    this.id = id;
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    this.isRunning = false;
    this.clients = new Set();
    this._scheduler = null;
    this._nextBeatTime = null; // ms, reloj del servidor
    this._beatNumber = 0;
  }

  get msPerBeat() {
    return (60 / this.bpm) * 1000;
  }

  /**
   * Inicia el scheduler. emitFn(event, data) es el canal de salida
   * (io.to(sessionId).emit) — así Session no depende de socket.io.
   */
  start(emitFn) {
    if (this.isRunning) return;
    this.isRunning = true;
    this._beatNumber = 0;
    this._nextBeatTime = Date.now() + SCHEDULE_AHEAD_MS;

    this._scheduler = setInterval(() => {
      const horizon = Date.now() + SCHEDULE_AHEAD_MS;
      while (this._nextBeatTime < horizon) {
        emitFn("beat", {
          scheduledTime: this._nextBeatTime,   // ← hora del servidor en que debe sonar
          beatNumber: this._beatNumber,
          isDownbeat: this._beatNumber % this.beatsPerMeasure === 0,
          bpm: this.bpm,
        });
        this._nextBeatTime += this.msPerBeat;
        this._beatNumber++;
      }
    }, LOOKAHEAD_MS);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this._scheduler);
    this._scheduler = null;
    this._nextBeatTime = null;
    this._beatNumber = 0;
  }

  /** Cambia BPM; si está corriendo lo reinicia con el nuevo valor */
  setBpm(bpm, emitFn) {
    const wasRunning = this.isRunning;
    if (wasRunning) this.stop();
    this.bpm = bpm;
    if (wasRunning) this.start(emitFn);
  }

  toJSON() {
    return {
      id: this.id,
      bpm: this.bpm,
      beatsPerMeasure: this.beatsPerMeasure,
      isRunning: this.isRunning,
      clientCount: this.clients.size,
    };
  }
}

class SessionManager {
  constructor() {
    this._sessions = new Map();
  }

  create({ bpm = 120, beatsPerMeasure = 4 } = {}) {
    // ID corto legible, tipo "AB12CD"
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const session = new Session(id, bpm, beatsPerMeasure);
    this._sessions.set(id, session);
    return session;
  }

  get(id) {
    return this._sessions.get(id?.toUpperCase()) ?? null;
  }

  delete(id) {
    const session = this.get(id);
    if (!session) return false;
    session.stop();
    this._sessions.delete(id.toUpperCase());
    return true;
  }

  list() {
    return [...this._sessions.values()].map((s) => s.toJSON());
  }

  /** Limpia clientes desconectados de todas las sesiones */
  removeClient(socketId) {
    for (const session of this._sessions.values()) {
      session.clients.delete(socketId);
    }
  }
}

module.exports = new SessionManager();
