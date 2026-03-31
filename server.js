const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

const metronomeRoutes = require("./routes/metronome.routes");
const registerSocketHandlers = require("./socket/metronome.socket");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(cors());
app.use(express.json());

// Frontend estático
app.use(express.static(path.join(__dirname, "public")));

// API
app.use("/api/metronome", metronomeRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Ruta no encontrada" });
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
