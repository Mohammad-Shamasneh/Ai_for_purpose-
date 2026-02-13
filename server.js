const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

// --- مسارات ملفات ---
const uploadDir = path.join(__dirname, "uploads");
const dataFile = path.join(__dirname, "data.json");
fs.mkdirSync(uploadDir, { recursive: true });

// --- تحميل/حفظ البلاغات ---
function loadReports() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf-8"));
  } catch {
    return [];
  }
}
function saveReports(reports) {
  fs.writeFileSync(dataFile, JSON.stringify(reports, null, 2), "utf-8");
}
let reports = loadReports();

// --- إعداد رفع الملفات ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const original = file.originalname || `audio_${Date.now()}.webm`;
    const safe = original.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// ✅ يخلي ملفات الصوت قابلة للعرض/التشغيل من المتصفح
app.use("/uploads", express.static(uploadDir));

// --- API: استقبال SOS ---
app.post("/api/sos", upload.single("audio"), (req, res) => {
  const { lat, lng, accuracy, timestamp } = req.body;

  const item = {
    id: Date.now().toString(),
    timestamp: timestamp || new Date().toISOString(),
    lat: lat || null,
    lng: lng || null,
    accuracy: accuracy || null,
    file: req.file?.filename || null,
    fileUrl: req.file?.filename ? `/uploads/${req.file.filename}` : null
  };

  reports.unshift(item); // newest first
  saveReports(reports);

  console.log("SOS received:", item);

  res.json({ ok: true, saved: item });
});

// ✅ API: عرض البلاغات كـ JSON (للدashboard)
app.get("/api/reports", (req, res) => {
  res.json({ ok: true, reports });
});

// ✅ Dashboard “شكل حلو”
app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Catch Up | SOS Dashboard</title>
  <style>
    body{margin:0;font-family:system-ui,Segoe UI,Arial;background:#0b0f1a;color:#fff}
    header{padding:18px 16px;border-bottom:1px solid rgba(255,255,255,.08);
      background:linear-gradient(135deg, rgba(30,136,229,.22), rgba(229,57,53,.18));
      position:sticky;top:0;backdrop-filter:blur(10px)}
    .wrap{max-width:980px;margin:0 auto;padding:16px}
    .title{display:flex;align-items:center;gap:10px}
    .badge{font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.10)}
    .grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:14px}
    .card{background:#121a2b;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;
      box-shadow:0 18px 50px rgba(0,0,0,.35)}
    .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between}
    .muted{opacity:.8;font-size:13px;line-height:1.6}
    .btn{border:0;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer}
    .primary{background:#1e88e5;color:#fff}
    .danger{background:#e53935;color:#fff}
    audio{width:100%;margin-top:10px}
    .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px}
    a{color:#90caf9;text-decoration:none}
    .empty{padding:20px;text-align:center;opacity:.85}
    .small{font-size:12px;opacity:.75}
    @media (min-width: 860px){
      .grid{grid-template-columns:1fr 1fr}
    }
  </style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="row">
      <div class="title">
        <h2 style="margin:0">SOS Dashboard</h2>
        <span class="badge" id="count">0 بلاغ</span>
        <span class="pill">Auto refresh</span>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn primary" id="refresh">تحديث</button>
        <button class="btn danger" id="clear">حذف الكل (محلي)</button>
      </div>
    </div>
    <div class="muted">هنا رح تشوف كل تسجيلات SOS مع تشغيل الصوت والموقع (إن وُجد).</div>
  </div>
</header>

<div class="wrap">
  <div id="list" class="grid"></div>
  <div id="empty" class="empty" style="display:none">لا يوجد بلاغات بعد.</div>
  <p class="small">ملاحظة: التخزين في Render (الخطة المجانية) ممكن يروح بعد Restart. للمنتج الحقيقي استخدم Storage خارجي.</p>
</div>

<script>
  async function fetchReports(){
    const res = await fetch('/api/reports');
    const data = await res.json();
    return data.reports || [];
  }

  function fmtTime(ts){
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  }

  function cardHtml(r){
    const loc = (r.lat && r.lng) ? \`📍 \${Number(r.lat).toFixed(6)}, \${Number(r.lng).toFixed(6)} (±\${Math.round(Number(r.accuracy||0))}m)\` : "📍 لا يوجد موقع";
    const maps = (r.lat && r.lng) ? \`https://www.google.com/maps?q=\${r.lat},\${r.lng}\` : null;

    return \`
      <div class="card">
        <div class="row">
          <div>
            <div class="pill">🕒 \${fmtTime(r.timestamp)}</div>
            <div class="muted" style="margin-top:8px">\${loc} \${maps ? \`- <a href="\${maps}" target="_blank">فتح على الخريطة</a>\` : ""}</div>
          </div>
          <div class="muted">ID: \${r.id}</div>
        </div>

        \${r.fileUrl ? \`
          <audio controls src="\${r.fileUrl}"></audio>
          <div class="muted">الملف: <a href="\${r.fileUrl}" target="_blank">\${r.file}</a></div>
        \` : \`<div class="muted">لا يوجد ملف صوت</div>\`}

      </div>
    \`;
  }

  async function render(){
    const list = document.getElementById('list');
    const empty = document.getElementById('empty');
    const count = document.getElementById('count');

    const reports = await fetchReports();
    count.textContent = \`\${reports.length} بلاغ\`;

    if(!reports.length){
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    list.innerHTML = reports.map(cardHtml).join("");
  }

  document.getElementById('refresh').addEventListener('click', render);

  // حذف محلي (فقط يمسح data.json والuploads على السيرفر)
  document.getElementById('clear').addEventListener('click', async () => {
    if(!confirm("متأكد بدك تحذف كل البلاغات؟")) return;
    const res = await fetch('/api/clear', { method: 'POST' });
    await res.json().catch(()=>{});
    render();
  });

  // تحديث كل 10 ثواني
  render();
  setInterval(render, 10000);
</script>
</body>
</html>`);
});

// ✅ مسح البلاغات (اختياري للعرض)
app.post("/api/clear", (req, res) => {
  try {
    // امسح الملفات
    for (const r of reports) {
      if (r.file) {
        const p = path.join(uploadDir, r.file);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  } catch {}
  reports = [];
  saveReports(reports);
  res.json({ ok: true });
});

// ✅ Render PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
