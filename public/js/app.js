// ── Init ─────────────────────────────────────────────────────────────────
const socket      = io(window.SERVER_URL || window.location.origin, {
  transports: ["websocket"],   // requerido en Cloudflare / proxies
});
const clockSync   = new ClockSync(socket);
const audioEngine = new AudioEngine();

// ── Estado ────────────────────────────────────────────────────────────────
const state = {
  sessionId:       null,
  bpm:             120,
  beatsPerMeasure: 4,
  isRunning:       false,
  clientCount:     1,
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id);

const elSyncStatus   = $("sync-status");
const elLobby        = $("lobby");
const elSession      = $("session");
const elSessionCode  = $("session-code");
const elClientCount  = $("client-count");
const elBpmDisplay   = $("bpm-display");
const elBpmSlider    = $("bpm-slider");
const elBeatCircle   = $("beat-circle");
const elBeatDots     = $("beat-dots");
const elBtnToggle    = $("btn-toggle");
const elBtnCreate    = $("btn-create");
const elBtnJoin      = $("btn-join");
const elBtnLeave     = $("btn-leave");
const elJoinCode     = $("join-code");
const elCreateBpm    = $("create-bpm");
const elCreateBeats  = $("create-beats");
const elBpmMinus     = $("bpm-minus");
const elBpmPlus      = $("bpm-plus");

// ── Pantallas ─────────────────────────────────────────────────────────────
function showScreen(name) {
  elLobby.classList.toggle("hidden", name !== "lobby");
  elSession.classList.toggle("hidden", name !== "session");
}

// ── Beat dots ─────────────────────────────────────────────────────────────
function renderBeatDots(count) {
  elBeatDots.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "beat-dot";
    elBeatDots.appendChild(dot);
  }
}

function activateBeat(beatNumber) {
  const index = beatNumber % state.beatsPerMeasure;
  elBeatDots.querySelectorAll(".beat-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

// ── BPM ───────────────────────────────────────────────────────────────────
function setBpm(bpm) {
  state.bpm = bpm;
  elBpmDisplay.textContent = bpm;
  elBpmSlider.value = bpm;
}

let bpmDebounceTimer = null;
function sendBpmUpdate(bpm) {
  clearTimeout(bpmDebounceTimer);
  bpmDebounceTimer = setTimeout(() => {
    socket.emit("update_bpm", { sessionId: state.sessionId, bpm });
  }, 200);
}

// ── Cliente count ─────────────────────────────────────────────────────────
function setClientCount(n) {
  state.clientCount = n;
  elClientCount.textContent = `${n} músico${n !== 1 ? "s" : ""}`;
}

// ── Visual del beat ───────────────────────────────────────────────────────
function triggerVisualBeat(isDownbeat) {
  elBeatCircle.classList.remove("pulse", "downbeat-pulse");
  // Reflow para reiniciar la animación aunque lleguen beats seguidos
  void elBeatCircle.offsetWidth;
  elBeatCircle.classList.add(isDownbeat ? "downbeat-pulse" : "pulse");
}

// ── Socket: conexión y sync ───────────────────────────────────────────────
socket.on("connect", async () => {
  elSyncStatus.textContent = "Sincronizando reloj...";
  elSyncStatus.dataset.state = "syncing";
  await clockSync.sync(8);
  elSyncStatus.textContent = "Conectado ✓";
  elSyncStatus.dataset.state = "ok";
  showScreen("lobby");
});

socket.on("disconnect", () => {
  elSyncStatus.textContent = "Desconectado — reconectando...";
  elSyncStatus.dataset.state = "error";
});

// ── Socket: beat ─────────────────────────────────────────────────────────
socket.on("beat", ({ scheduledTime, beatNumber, isDownbeat }) => {
  // Programar audio con precisión de sub-ms
  audioEngine.scheduleClick(scheduledTime, isDownbeat, clockSync);

  // Disparar visual exactamente cuando debe sonar (sin depender del audio API)
  const msUntilBeat = scheduledTime - clockSync.serverNow();
  setTimeout(() => {
    activateBeat(beatNumber);
    triggerVisualBeat(isDownbeat);
  }, Math.max(0, msUntilBeat));
});

// ── Socket: estado del metrónomo ──────────────────────────────────────────
socket.on("metronome_started", () => {
  state.isRunning = true;
  elBtnToggle.textContent = "■ Detener";
  elBtnToggle.dataset.running = "true";
});

socket.on("metronome_stopped", () => {
  state.isRunning = false;
  elBtnToggle.textContent = "▶ Iniciar";
  elBtnToggle.dataset.running = "false";
  elBeatDots.querySelectorAll(".beat-dot").forEach((d) => d.classList.remove("active"));
});

socket.on("bpm_updated", ({ bpm }) => setBpm(bpm));

socket.on("client_joined", ({ clientCount }) => setClientCount(clientCount));
socket.on("client_left",   ({ clientCount }) => setClientCount(clientCount));

// ── Acciones de lobby ─────────────────────────────────────────────────────
elBtnCreate.addEventListener("click", async () => {
  audioEngine.init();
  const bpm = Math.min(300, Math.max(20, parseInt(elCreateBpm.value) || 120));
  const beatsPerMeasure = parseInt(elCreateBeats.value) || 4;

  const res = await fetch("/api/metronome/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bpm, beatsPerMeasure }),
  });
  const { session } = await res.json();
  enterSession(session);
});

elBtnJoin.addEventListener("click", () => {
  audioEngine.init();
  const code = elJoinCode.value.trim().toUpperCase();
  if (!code) return;

  socket.emit("join_session", code, ({ error, session }) => {
    if (error) return showError(error);
    enterSession(session, false); // ya hizo join por socket
  });
});

elJoinCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") elBtnJoin.click();
});

elJoinCode.addEventListener("input", () => {
  elJoinCode.value = elJoinCode.value.toUpperCase();
});

// ── Acciones de sesión ────────────────────────────────────────────────────
elBtnLeave.addEventListener("click", () => {
  socket.emit("leave_session", state.sessionId);
  state.sessionId = null;
  state.isRunning = false;
  showScreen("lobby");
});

elBtnToggle.addEventListener("click", async () => {
  await audioEngine.resume();
  if (state.isRunning) {
    socket.emit("stop_metronome", state.sessionId);
  } else {
    socket.emit("start_metronome", state.sessionId);
  }
});

// Slider de BPM
elBpmSlider.addEventListener("input", () => {
  const bpm = parseInt(elBpmSlider.value);
  setBpm(bpm);
  sendBpmUpdate(bpm);
});

elBpmMinus.addEventListener("click", () => {
  const bpm = Math.max(20, state.bpm - 1);
  setBpm(bpm);
  sendBpmUpdate(bpm);
});

elBpmPlus.addEventListener("click", () => {
  const bpm = Math.min(300, state.bpm + 1);
  setBpm(bpm);
  sendBpmUpdate(bpm);
});

// Tap tempo — tocar el círculo marca el tempo
let tapTimes = [];
elBeatCircle.addEventListener("click", () => {
  const now = Date.now();
  tapTimes.push(now);
  if (tapTimes.length > 8) tapTimes.shift();
  if (tapTimes.length < 2) return;

  const intervals = [];
  for (let i = 1; i < tapTimes.length; i++) {
    intervals.push(tapTimes[i] - tapTimes[i - 1]);
  }
  const avg = intervals.reduce((a, b) => a + b) / intervals.length;
  const bpm = Math.round(60000 / avg);

  if (bpm >= 20 && bpm <= 300) {
    setBpm(bpm);
    sendBpmUpdate(bpm);
  }
});

// Copiar código de sesión
elSessionCode.addEventListener("click", () => {
  navigator.clipboard.writeText(elSessionCode.textContent).catch(() => {});
  elSessionCode.classList.add("copied");
  setTimeout(() => elSessionCode.classList.remove("copied"), 1200);
});

// ── Helpers ───────────────────────────────────────────────────────────────
function enterSession(session, needSocketJoin = true) {
  state.sessionId       = session.id;
  state.bpm             = session.bpm;
  state.beatsPerMeasure = session.beatsPerMeasure;
  state.isRunning       = session.isRunning;

  elSessionCode.textContent      = session.id;
  setBpm(session.bpm);
  setClientCount(session.clientCount);
  renderBeatDots(session.beatsPerMeasure);
  elBtnToggle.textContent        = session.isRunning ? "■ Detener" : "▶ Iniciar";
  elBtnToggle.dataset.running    = session.isRunning;

  // Al crear sesión via REST todavía hay que hacer join por socket
  if (needSocketJoin) {
    socket.emit("join_session", session.id, () => {});
  }

  showScreen("session");
}

function showError(msg) {
  // Simple: alert por ahora, se puede mejorar con un toast
  alert(msg);
}
