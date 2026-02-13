const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());

// ✅ (اختياري) لو بدك تستقبل JSON بغير حالة multer
app.use(express.json({ limit: "1mb" }));

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

// --- Helpers ---
function safeJsonParse(maybeJson, fallback) {
  if (maybeJson == null) return fallback;
  if (Array.isArray(maybeJson) || typeof maybeJson === "object") return maybeJson;
  const s = String(maybeJson).trim();
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// ✅ API: استقبال SOS (معدل)
app.post("/api/sos", upload.single("audio"), (req, res) => {
  const {
    lat,
    lng,
    accuracy,
    timestamp,
    transcript,
    agencies,
    priority,
    tags
  } = req.body;

  const agenciesArr = safeJsonParse(agencies, []);
  const tagsArr = safeJsonParse(tags, []);

  const item = {
    id: Date.now().toString(),
    timestamp: timestamp || new Date().toISOString(),

    // موقع (اختياري)
    lat: lat ?? null,
    lng: lng ?? null,
    accuracy: accuracy ?? null,

    // ملف الصوت
    file: req.file?.filename || null,
    fileUrl: req.file?.filename ? `/uploads/${req.file.filename}` : null,

    // ✅ الجديد: نص وتصنيف
    transcript: (transcript || "").toString(),
    agencies: Array.isArray(agenciesArr) ? agenciesArr : [],
    priority: (priority || "low").toString(),
    tags: Array.isArray(tagsArr) ? tagsArr : []
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

// ✅ Dashboard “شكل حلو” (معدل لعرض transcript/priority/agencies/tags)
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
    .title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
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
    .pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    a{color:#90caf9;text-decoration:none}
    .empty{padding:20px;text-align:center;opacity:.85}
    .small{font-size:12px;opacity:.75}
    .box{background:#0f1626;border:1px solid #2a3657;border-radius:12px;padding:10px;margin-top:10px;white-space:pre-wrap}
    .prio-critical{background:rgba(255,0,0,.18);border:1px solid rgba(255,0,0,.35)}
    .prio-high{background:rgba(255,193,7,.14);border:1px solid rgba(255,193,7,.30)}
    .prio-medium{background:rgba(30,136,229,.14);border:1px solid rgba(30,136,229,.30)}
    .prio-low{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
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
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" id="refresh">تحديث</button>
        <button class="btn danger" id="clear">حذف الكل (محلي)</button>
      </div>
    </div>
    <div class="muted">هنا رح تشوف كل تسجيلات SOS مع تشغيل الصوت + النص + التصنيف.</div>
  </div>
</header>

<div class="wrap">
  <div id="list" class="grid"></div>
  <div id="empty" class="empty" style="display:none">لا يوجد بلاغات بعد.</div>
  <p class="small">ملاحظة: التخزين في Render (الخطة المجانية) ممكن يروح بعد Restart. للمنتج الحقيقي استخدم Storage خارجي.</p>
</div>

<script>
  const mapAr = {
    ambulance: "إسعاف",
    police: "شرطة",
    civil_defense: "دفاع مدني",
    unknown: "غير معروف"
  };

  async function fetchReports(){
    const res = await fetch('/api/reports');
    const data = await res.json();
    return data.reports || [];
  }

  function fmtTime(ts){
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  }

  function prioClass(p){
    p = (p||"").toLowerCase();
    if(p==="critical") return "prio-critical";
    if(p==="high") return "prio-high";
    if(p==="medium") return "prio-medium";
    return "prio-low";
  }

  function agenciesPretty(arr){
    if(!Array.isArray(arr) || !arr.length) return "—";
    return arr.map(x => mapAr[x] || x).join("، ");
  }

  function tagsPretty(arr){
    if(!Array.isArray(arr) || !arr.length) return "—";
    return arr.slice(0,10).join("، ");
  }

  function cardHtml(r){
    const hasLoc = (r.lat && r.lng);
    const loc = hasLoc ? \`📍 \${Number(r.lat).toFixed(6)}, \${Number(r.lng).toFixed(6)} (±\${Math.round(Number(r.accuracy||0))}m)\` : "📍 لا يوجد موقع";
    const maps = hasLoc ? \`https://www.google.com/maps?q=\${r.lat},\${r.lng}\` : null;

    const p = (r.priority || "low").toLowerCase();

    return \`
      <div class="card \${prioClass(p)}">
        <div class="row">
          <div>
            <div class="pill">🕒 \${fmtTime(r.timestamp)}</div>
            <div class="muted" style="margin-top:8px">\${loc} \${maps ? \`- <a href="\${maps}" target="_blank">فتح على الخريطة</a>\` : ""}</div>
          </div>
          <div class="muted">ID: \${r.id}</div>
        </div>

        <div class="pills">
          <div class="pill">الجهات: \${agenciesPretty(r.agencies)}</div>
          <div class="pill">الأولوية: \${p || "—"}</div>
        </div>

        <div class="box">النص: \${(r.transcript || "—")}</div>
        <div class="muted">وسوم: \${tagsPretty(r.tags)}</div>

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

  document.getElementById('clear').addEventListener('click', async () => {
    if(!confirm("متأكد بدك تحذف كل البلاغات؟")) return;
    const res = await fetch('/api/clear', { method: 'POST' });
    await res.json().catch(()=>{});
    render();
  });

  render();
  setInterval(render, 10000);
</script>
</body>
</html>`);
});

// ✅ مسح البلاغات (اختياري للعرض)
app.post("/api/clear", (req, res) => {
  try {
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
