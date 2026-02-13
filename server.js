const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

// ✅ صفحة فحص بسيطة (عشان لما تفتح الرابط بالمتصفح ما يطلع Cannot GET /)
app.get("/", (req, res) => {
  res.send("OK - SOS server is running");
});

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

// (اختياري) حد أعلى لحجم الصوت 15MB
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.post("/api/sos", upload.single("audio"), (req, res) => {
  const { lat, lng, accuracy, timestamp } = req.body;

  console.log("SOS received:", {
    timestamp,
    lat,
    lng,
    accuracy,
    file: req.file?.filename
  });

  res.json({
    ok: true,
    savedAs: req.file?.filename,
    received: { timestamp, lat, lng, accuracy }
  });
});

// ✅ لازم Render: يستخدم PORT اللي بيعطيك إياه
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
