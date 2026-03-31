const { Router } = require("express");
const sessionManager = require("../sessions/session.manager");
const router = Router();

// GET /api/metronome/sessions
router.get("/sessions", (req, res) => {
  res.json({ success: true, sessions: sessionManager.list() });
});

// POST /api/metronome/sessions  — { bpm, beatsPerMeasure }
router.post("/sessions", (req, res) => {
  const bpm = Number(req.body.bpm ?? 120);
  const beatsPerMeasure = Number(req.body.beatsPerMeasure ?? 4);

  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) {
    return res.status(400).json({ success: false, message: "BPM inválido (rango: 20–300)" });
  }
  if (![2, 3, 4, 6, 8].includes(beatsPerMeasure)) {
    return res.status(400).json({ success: false, message: "beatsPerMeasure inválido (2, 3, 4, 6, 8)" });
  }

  const session = sessionManager.create({ bpm, beatsPerMeasure });
  res.status(201).json({ success: true, session: session.toJSON() });
});

// GET /api/metronome/sessions/:id
router.get("/sessions/:id", (req, res) => {
  const session = sessionManager.get(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: "Sesión no encontrada" });
  }
  res.json({ success: true, session: session.toJSON() });
});

// DELETE /api/metronome/sessions/:id
router.delete("/sessions/:id", (req, res) => {
  const deleted = sessionManager.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Sesión no encontrada" });
  }
  res.json({ success: true, message: "Sesión eliminada" });
});

module.exports = router;
