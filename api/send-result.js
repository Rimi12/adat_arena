// ==========================================
// Vercel szerverfüggvény: Adat-Aréna eredmény küldése e-mailben
// Szolgáltató: Resend (https://resend.com) – REST API, külső csomag nélkül
// Szükséges környezeti változók (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  – a Resend API kulcs (re_...)
//   MAIL_FROM       – feladó, pl. "Adat-Aréna <adatarena@sajatdomain.hu>"
//                     (ellenőrzött domain nélkül csak "onboarding@resend.dev" használható,
//                      és ekkor a Resend CSAK a fiók tulajdonosának címére kézbesít!)
// ==========================================

// Egyszerű, memóriában tárolt korlátozás visszaélés ellen (példányonként)
const kuldesiNaplo = new Map();
const LIMIT_PER_PERC = 5;

function htmlKodol(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rovidit(str, max) {
  return String(str == null ? '' : str).slice(0, max);
}

function ervenyesEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function levelHtml(r) {
  const sor = (cimke, ertek) =>
    `<tr><td style="padding:6px 10px;color:#475569;">${cimke}</td><td style="padding:6px 10px;font-weight:bold;color:#0f172a;">${ertek}</td></tr>`;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#0b0f19;color:#38bdf8;padding:16px 20px;font-size:20px;font-weight:bold;">
      ⚡ ADAT-ARÉNA – Eredménylap
    </div>
    <div style="padding:18px 20px;">
      <p style="margin:0 0 12px 0;color:#0f172a;">Kedves <strong>${htmlKodol(r.name)}</strong>!</p>
      <p style="margin:0 0 14px 0;color:#334155;">Köszönjük, hogy kipróbáltad a Zöldmező EGYMI számítógépes adatrögzítő kioszkját. Íme az eredményed:</p>
      <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;">
        ${sor('Játékmód / szint', `${htmlKodol(r.mode)} (${htmlKodol(r.difficulty)})`)}
        ${sor('Sebesség', `${htmlKodol(r.cpm)} leütés/perc`)}
        ${sor('Pontosság', `${htmlKodol(r.acc)}%`)}
        ${sor('Pontszám', `${htmlKodol(r.score)} pont`)}
        ${sor('Minősítés', htmlKodol(r.rank))}
        ${sor('Időpont', htmlKodol(r.date))}
      </table>
      <div style="margin-top:14px;padding:10px 12px;border-left:4px solid #22c55e;background:#f0fdf4;color:#14532d;">
        🎯 <strong>Erősség:</strong> ${htmlKodol(r.strength)}
      </div>
      <div style="margin-top:8px;padding:10px 12px;border-left:4px solid #f59e0b;background:#fffbeb;color:#78350f;">
        ⚠️ <strong>Gyakorlandó:</strong> ${htmlKodol(r.weakness)}
      </div>
      <p style="margin:16px 0 0 0;color:#64748b;font-size:12px;">
        Ezt a levelet azért kaptad, mert a kioszkon megadtad az e-mail címedet. A címet nem tároljuk.<br>
        Zöldmező Utcai EGYMI – Keszthely
      </p>
    </div>
  </div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Csak POST kérés engedélyezett.' });
  }

  const apiKulcs = process.env.RESEND_API_KEY;
  const felado = process.env.MAIL_FROM || 'Adat-Aréna <onboarding@resend.dev>';
  if (!apiKulcs) {
    return res.status(503).json({ ok: false, error: 'Az e-mail küldés még nincs beállítva a szerveren (hiányzó RESEND_API_KEY).' });
  }

  // Korlátozás IP címenként
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ismeretlen';
  const most = Date.now();
  const naplo = (kuldesiNaplo.get(ip) || []).filter(t => most - t < 60000);
  if (naplo.length >= LIMIT_PER_PERC) {
    return res.status(429).json({ ok: false, error: 'Túl sok küldés, kérlek várj egy percet!' });
  }
  naplo.push(most);
  kuldesiNaplo.set(ip, naplo);

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const email = String((body && body.email) || '').trim();
  const r = (body && body.result) || {};

  if (!ervenyesEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Érvénytelen e-mail cím.' });
  }

  // Csak a várt mezőket, hosszkorláttal használjuk fel (tetszőleges tartalom nem küldhető)
  const eredmeny = {
    name: rovidit(r.name || 'Vendég Játékos', 60),
    mode: rovidit(r.mode, 20),
    difficulty: rovidit(r.difficulty, 20),
    cpm: Number.parseInt(r.cpm, 10) || 0,
    acc: Math.min(100, Math.max(0, Number.parseInt(r.acc, 10) || 0)),
    score: Number.parseInt(r.score, 10) || 0,
    rank: rovidit(r.rank, 40),
    strength: rovidit(r.strength, 140),
    weakness: rovidit(r.weakness, 140),
    date: rovidit(r.date, 40)
  };

  try {
    const valasz = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKulcs}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: felado,
        to: [email],
        subject: `Adat-Aréna eredményed: ${eredmeny.score} pont – ${eredmeny.rank}`,
        html: levelHtml(eredmeny)
      })
    });

    if (!valasz.ok) {
      const hibaSzoveg = await valasz.text().catch(() => '');
      console.error('Resend hiba:', valasz.status, hibaSzoveg);
      return res.status(502).json({ ok: false, error: 'Az e-mail szolgáltató elutasította a küldést.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Küldési hiba:', err);
    return res.status(500).json({ ok: false, error: 'Szerverhiba az e-mail küldésekor.' });
  }
};
