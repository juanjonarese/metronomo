/**
 * Handlers de socket.io para el metrónomo sincronizado.
 *
 * FLUJO DE SINCRONIZACIÓN (NTP simplificado):
 *   1. Cliente emite  sync_request  { clientSent: Date.now() }
 *   2. Servidor emite sync_response { clientSent, serverTime }
 *   3. Cliente calcula:
 *        latency = (Date.now() - clientSent) / 2
 *        offset  = serverTime + latency - Date.now()
 *        serverNow() = Date.now() + offset
 *   4. Cliente repite varios rounds y promedia el offset.
 *
 * FLUJO DEL BEAT:
 *   Servidor emite  beat { scheduledTime, beatNumber, isDownbeat, bpm }
 *   Cliente convierte scheduledTime → AudioContext.currentTime y programa
 *   el sonido ahí. Aunque el mensaje llegue tarde, el beat está en el
 *   futuro (SCHEDULE_AHEAD_MS) y la programación es precisa.
 */

const sessionManager = require("../sessions/session.manager");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[socket] conectado: ${socket.id}`);

    // ─── Sincronización de reloj (NTP) ───────────────────────────────────
    socket.on("sync_request", (clientSent) => {
      socket.emit("sync_response", {
        clientSent,
        serverTime: Date.now(),
      });
    });

    // ─── Sesiones ─────────────────────────────────────────────────────────
    socket.on("join_session", (sessionId, callback) => {
      const session = sessionManager.get(sessionId);
      if (!session) {
        return callback?.({ error: "Sesión no encontrada" });
      }
      socket.join(session.id);
      session.clients.add(socket.id);
      socket.to(session.id).emit("client_joined", {
        clientId: socket.id,
        clientCount: session.clients.size,
      });
      callback?.({ success: true, session: session.toJSON() });
    });

    socket.on("leave_session", (sessionId, callback) => {
      _leaveSession(socket, sessionId);
      callback?.({ success: true });
    });

    // ─── Control del metrónomo ────────────────────────────────────────────
    socket.on("start_metronome", (sessionId, callback) => {
      const session = sessionManager.get(sessionId);
      if (!session) return callback?.({ error: "Sesión no encontrada" });
      if (session.isRunning) return callback?.({ error: "Ya está corriendo" });

      session.start((event, data) => io.to(session.id).emit(event, data));
      io.to(session.id).emit("metronome_started", session.toJSON());
      callback?.({ success: true });
    });

    socket.on("stop_metronome", (sessionId, callback) => {
      const session = sessionManager.get(sessionId);
      if (!session) return callback?.({ error: "Sesión no encontrada" });

      session.stop();
      io.to(session.id).emit("metronome_stopped");
      callback?.({ success: true });
    });

    socket.on("update_bpm", ({ sessionId, bpm }, callback) => {
      const session = sessionManager.get(sessionId);
      if (!session) return callback?.({ error: "Sesión no encontrada" });
      if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) {
        return callback?.({ error: "BPM inválido (rango: 20–300)" });
      }

      session.setBpm(bpm, (event, data) => io.to(session.id).emit(event, data));
      io.to(session.id).emit("bpm_updated", {
        bpm: session.bpm,
        isRunning: session.isRunning,
      });
      callback?.({ success: true, bpm: session.bpm });
    });

    // ─── Desconexión ──────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[socket] desconectado: ${socket.id}`);
      // Salir de todas las sesiones en que estaba
      for (const session of sessionManager._sessions.values()) {
        if (session.clients.has(socket.id)) {
          _leaveSession(socket, session.id);
        }
      }
    });

    // ─── Helpers ──────────────────────────────────────────────────────────
    function _leaveSession(socket, sessionId) {
      const session = sessionManager.get(sessionId);
      if (!session) return;
      socket.leave(session.id);
      session.clients.delete(socket.id);
      io.to(session.id).emit("client_left", {
        clientId: socket.id,
        clientCount: session.clients.size,
      });
      // Si no quedan clientes, pausar el metrónomo automáticamente
      if (session.clients.size === 0) {
        session.stop();
      }
    }
  });
}

module.exports = registerSocketHandlers;
