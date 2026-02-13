const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

// مكان حفظ الملفات
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = (file.originalname || `audio_${Date.now()}.webm`).replace(/[^\w.-]/g, "_");
    cb(null, safe);
  }
});
const upload = multer({ storage });

app.post("/api/sos", upload.single("audio"), (req, res) => {
  const { lat, lng, accuracy, timestamp } = req.body;
  console.log("SOS received:", { timestamp, lat, lng, accuracy, file: req.file?.filename });
  res.json({
    ok: true,
    savedAs: req.file?.filename,
    received: { timestamp, lat, lng, accuracy }
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
