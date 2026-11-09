// ==========================================
// ⚡ ADAT-ARÉNA v2.0 Pro – Munkamenet & Logika
// ==========================================

// 1. ÁLLAPOT & KÉTMONITOROS HIBRID SZINKRON (BroadcastChannel + LocalStorage fallback)
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('adat_arena_sync') : null;
const isProjector = new URLSearchParams(window.location.search).get('mode') === 'projector';

let currentMode = 'speed'; // speed | numpad | hunt | office
let currentDifficulty = 'med'; // easy | med | hard
let timer = null;
let timeLeft = 60;
let gameActive = false;
let activePlayerName = "Vendég Játékos";

let totalTyped = 0;
let correctTyped = 0;
let errors = 0;
let score = 0;
let soundEnabled = localStorage.getItem('adat_arena_sound') !== 'false';

// Statisztikák és hiba-diagnosztika
let keyStats = {}; // { [char]: { attempts: 0, errors: 0 } }
let currentProjectorFilter = 'all';

// ------------------------------------------
// Web Audio API – Teljesen offline hangeffektek
// ------------------------------------------
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'key') {
      // Finom mechanikus billentyű-kattanás
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'error') {
      // Hiba buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      // Siker csilingelés (akkord)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'finish') {
      // Futam vége fanfár
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.15, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.4);
      });
    }
  } catch (err) {
    // Hanghiba figyelmen kívül hagyása
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('adat_arena_sound', soundEnabled);
  const btn = document.getElementById('btnSoundToggle');
  if (btn) btn.innerText = soundEnabled ? '🔊 Hang: Be' : '🔇 Hang: Ki';
  if (soundEnabled) playSound('key');
}

// ------------------------------------------
// Szöveg- és Adatállományok Nehézségi Szintek Szerint
// ------------------------------------------
const SPEED_TEXTS = {
  easy: [
    "alma fa kert ház fa út kék ég zöld fű",
    "a csendes faluban tiszta a levegő és szép a táj",
    "gyors adatbevitel pontos billentyűzet kezelés",
    "a jó adatrögzítő mindig figyel a részletekre",
    "kezdő gépíróként az alapsor a legfontosabb támaszunk"
  ],
  med: [
    "A számítógépes adatrögzítő munkája precíz billentyűhasználatot és folyamatos figyelmet igényel.",
    "A hibátlan adatbevitel és a gyors táblázatkezelés elengedhetetlen az irodai adminisztrációban.",
    "Minden egyes rögzített adat ellenőrzése biztosítja a nyilvántartások és bizonylatok pontosságát.",
    "A tízujjas vakírás segítségével a szemünk a forrásdokumentumon maradhat a munka teljes ideje alatt.",
    "Az elektronikus ügyintézés megköveteli az ügyféladatok, számlák és szerződések gyors feldolgozását.",
    "A helyes ujjrend betartása növeli a percenkénti leütésszámot és csökkenti a gépelési fáradtságot.",
    "A pontos adatrögzítés alapozza meg a vállalkozások és intézmények sikeres döntéshozatalát.",
    "A digitális világban az adatok biztonságos és pontos kezelése felelősségteljes szakmai feladat."
  ],
  hard: [
    "A 2026/II. negyedéves pénzügyi zárás során 48.750 Ft értékű ÁFA-különbözetet regisztráltunk.",
    "Az ügyfélszolgálati iktatóban (IKT-8942/2026) rögzítettük a beérkező megrendelőlapokat és szerződéseket.",
    "Kérjük a 8360 Keszthely, Fő tér 1. alatti székhelyű kft. bankszámlaszámának (11773456-02194850) ellenőrzését!",
    "Az Excel makrók és táblázatos lekérdezések automatizálják az adatelemzést: =FKERES(A2; Adatok!A:D; 4; HAMIS).",
    "A számlázási bizonylat keltezése: Keszthely, 2026. október 15. – Fizetési határidő: 8 banki nap."
  ]
};

let currentSpeedText = "";
let speedCharIndex = 0;

// Numpad tételek nehézségi szintek szerint
const NUMPAD_ITEMS = {
  easy: [
    { label: "Irányítószám Keszthely", val: "8360" },
    { label: "Cikkszám kód", val: "4401" },
    { label: "Tételszám", val: "1250" },
    { label: "Raktárkód", val: "9021" },
    { label: "Ár engedmény", val: "7500" },
    { label: "Bizonylat ID", val: "3150" }
  ],
  med: [
    { label: "Számla végösszeg", val: "14850" },
    { label: "Cikkszám kód", val: "902144" },
    { label: "Irányítószám", val: "8360" },
    { label: "Bizonylatszám", val: "770412" },
    { label: "ÁFA tartalom", val: "3150" },
    { label: "Vonalkód részlet", val: "59981240" },
    { label: "Tételszám kód", val: "440182" },
    { label: "Raktári lokáció", val: "20584" },
    { label: "Folyószámla végződés", val: "614022" },
    { label: "Engedmény összege", val: "8450" }
  ],
  hard: [
    { label: "IBAN számlaszám részlet", val: "1177345602" },
    { label: "EAN-13 vonalkód", val: "599812401892" },
    { label: "Nagyker bruttó ár", val: "1248750" },
    { label: "Adóazonosító jel", val: "8421095521" },
    { label: "Cégjegyzékszám kód", val: "2009087614" },
    { label: "Precíz tételsor", val: "984201735" }
  ]
};

let numpadIndex = 0;
let numpadInputBuffer = "";

// Alapértelmezett Hibavadász szókészlet
const DEFAULT_HUNT_ITEMS = [
  { id: 1, orig: "monitor", copy: "monitor" },
  { id: 2, orig: "számítógép", copy: "számíttógép" },
  { id: 3, orig: "billentyűzet", copy: "billentyuzet" },
  { id: 4, orig: "egérpad", copy: "egérpad" },
  { id: 5, orig: "dokumentum", copy: "dokumnetum" },
  { id: 6, orig: "táblázatkezelő", copy: "táblázatkezelő" },
  { id: 7, orig: "nyomtató", copy: "nyomtattó" },
  { id: 8, orig: "Keszthely", copy: "Keszthely" },
  { id: 9, orig: "szövegszerkesztő", copy: "szövegszerkesztö" },
  { id: 10, orig: "adatrögzítő", copy: "adatrögzítő" },
  { id: 11, orig: "8360", copy: "8360" },
  { id: 12, orig: "4401", copy: "4410" },
  { id: 13, orig: "Kovács Péter", copy: "Kovács Péter" },
  { id: 14, orig: "Horváth Zoltán", copy: "Horvát Zoltán" },
  { id: 15, orig: "12500 Ft", copy: "12500 Ft" },
  { id: 16, orig: "Számla #8942", copy: "Számla #8924" }
];
let activeHuntPlayItems = [];

// ==========================================
// 4. IRODAI PRÓBANAP (SZIMULÁCIÓS ÁLLOMÁSOK)
// ==========================================
let officeStage = 1; // 1: Ügyfél, 2: Számla, 3: Ellenőrzés
let officeStageData = {
  clientName: "Balaton Transz Kft.",
  clientAddress: "8360 Keszthely, Fő tér 4.",
  items: [
    { name: "Irodai papír A4 (500 ív)", code: "440182", price: "2490" },
    { name: "Toner kazetta HP-105", code: "902144", price: "18500" },
    { name: "Iratrendező mappa", code: "315020", price: "1250" }
  ],
  itemIndex: 0,
  subStage: 'code', // 'code' vagy 'price'
  checks: [
    { orig: "Számlaszám: SZ-2026/0412", copy: "Számlaszám: SZ-2026/0412" },
    { orig: "Adószám: 14850219-2-20", copy: "Adószám: 14850219-1-20" },
    { orig: "Fizetési mód: Átutalás", copy: "Fizetési mód: Készpénz" }
  ]
};

// ==========================================
// 2. INICIALIZÁLÁS & FÓKUSZVEZÉRLÉS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const soundBtn = document.getElementById('btnSoundToggle');
  if (soundBtn) soundBtn.innerText = soundEnabled ? '🔊 Hang: Be' : '🔇 Hang: Ki';

  if (isProjector) {
    document.getElementById('kioskContainer').style.display = 'none';
    document.getElementById('projectorView').style.display = 'flex';
    renderLeaderboard('projLbRows');
  } else {
    initWordsDatabase();
    setDifficulty('med');
    switchMode('speed');
    renderEditorTable();
  }
});

// Kétmonitoros szinkron fogadása (BroadcastChannel vagy Storage event)
function handleSyncMessage(data) {
  if (!data) return;
  const { type, payload } = data;
  if (type === 'PLAYER_START' && isProjector) {
    document.getElementById('projPlayerName').innerText = payload.name;
    document.getElementById('projCPM').innerText = '0 CPM';
    document.getElementById('projAcc').innerText = '100%';
    document.getElementById('projScore').innerText = '0';
  } else if (type === 'TICK' && isProjector) {
    document.getElementById('projCPM').innerText = payload.cpm + ' CPM';
    document.getElementById('projAcc').innerText = payload.acc + '%';
    document.getElementById('projScore').innerText = payload.score;
  } else if (type === 'NEW_RESULT' && isProjector) {
    renderLeaderboard('projLbRows');
  }
}

if (channel) {
  channel.onmessage = (event) => handleSyncMessage(event.data);
}
window.addEventListener('storage', (e) => {
  if (e.key === 'adat_arena_projector_sync' && e.newValue) {
    try {
      handleSyncMessage(JSON.parse(e.newValue));
    } catch (_) {}
  }
});

function broadcastSync(message) {
  if (channel) {
    try { channel.postMessage(message); } catch (_) {}
  }
  try {
    localStorage.setItem('adat_arena_projector_sync', JSON.stringify({
      ...message,
      _t: Date.now()
    }));
  } catch (_) {}
}

function openProjectorWindow() {
  const url = window.location.href.split('?')[0] + '?mode=projector';
  window.open(url, 'AdatArenaProjector', 'width=1200,height=800,menubar=no,toolbar=no');
}

// Kattintáskor a fókusz automatikusan visszaugrik a rejtett mezőre gépeléskor
window.addEventListener('click', (e) => {
  if (e.target.closest('input, button, select, textarea, .dataset-editor, .modal-content, a')) {
    return;
  }
  if (!isProjector && gameActive && (currentMode === 'speed' || currentMode === 'numpad' || currentMode === 'office')) {
    const input = document.getElementById('hiddenInput');
    if (input) input.focus();
  }
});

// ==========================================
// 3. NEHÉZSÉGI SZINTEK KEZELÉSE
// ==========================================
function setDifficulty(diff) {
  currentDifficulty = diff;
  ['easy', 'med', 'hard'].forEach(d => {
    const btn = document.getElementById('diffBtn-' + d);
    if (btn) {
      if (d === diff) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  if (currentMode === 'speed' && !gameActive) {
    const list = SPEED_TEXTS[currentDifficulty] || SPEED_TEXTS.med;
    currentSpeedText = list[Math.floor(Math.random() * list.length)];
    renderSpeedText();
  } else if (currentMode === 'numpad' && !gameActive) {
    numpadIndex = 0;
    numpadInputBuffer = "";
    loadNumpadItem();
  }
}

// ==========================================
// 4. JÁTÉKMÓDOK KEZELÉSE
// ==========================================
function switchMode(mode) {
  if (gameActive) {
    clearInterval(timer);
    gameActive = false;
  }
  currentMode = mode;

  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  const activeCard = document.getElementById('modeCard-' + mode);
  if (activeCard) activeCard.classList.add('active');

  const speedView = document.getElementById('view-speed');
  const numpadView = document.getElementById('view-numpad');
  const huntView = document.getElementById('view-hunt');
  const officeView = document.getElementById('view-office');
  const handsContainer = document.getElementById('handsContainer');

  speedView.style.display = mode === 'speed' ? 'block' : 'none';
  numpadView.style.display = mode === 'numpad' ? 'flex' : 'none';
  huntView.style.display = mode === 'hunt' ? 'block' : 'none';
  if (officeView) officeView.style.display = mode === 'office' ? 'block' : 'none';

  // Billentyűzetek és kéz-diagram vizuális állapota
  const qwertzKb = document.getElementById('qwertzKb');
  const numpadKb = document.getElementById('numpadKb');
  if (handsContainer) handsContainer.style.display = (mode === 'hunt') ? 'none' : 'flex';

  if (qwertzKb && numpadKb) {
    if (mode === 'speed') {
      qwertzKb.style.opacity = '1';
      numpadKb.style.opacity = '0.25';
    } else if (mode === 'numpad') {
      qwertzKb.style.opacity = '0.25';
      numpadKb.style.opacity = '1';
    } else if (mode === 'office') {
      qwertzKb.style.opacity = '1';
      numpadKb.style.opacity = '1';
    } else {
      qwertzKb.style.opacity = '0.25';
      numpadKb.style.opacity = '0.25';
    }
  }

  // Előkészítjük a kezdő nézeteket
  if (mode === 'speed') {
    const list = SPEED_TEXTS[currentDifficulty] || SPEED_TEXTS.med;
    currentSpeedText = list[Math.floor(Math.random() * list.length)];
    renderSpeedText();
  } else if (mode === 'numpad') {
    numpadIndex = 0;
    numpadInputBuffer = "";
    loadNumpadItem();
  } else if (mode === 'hunt') {
    loadNewHuntSet();
  } else if (mode === 'office') {
    initOfficeMode();
  }

  clearKeyboardHighlights();

  // Kezdő réteg megjelenítése
  document.getElementById('startOverlay').style.display = 'flex';
  const nameInput = document.getElementById('playerNameInputMain');
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
  }
}

// ==========================================
// 5. JÁTÉK INDÍTÁSA
// ==========================================
function startTheGame() {
  const nameInput = document.getElementById('playerNameInputMain');
  activePlayerName = (nameInput && nameInput.value.trim()) || "Vendég Játékos";

  document.getElementById('startOverlay').style.display = 'none';

  broadcastSync({
    type: 'PLAYER_START',
    payload: { name: activePlayerName }
  });

  clearInterval(timer);
  timeLeft = (currentMode === 'office') ? 90 : 60;
  totalTyped = 0;
  correctTyped = 0;
  errors = 0;
  score = 0;
  keyStats = {};
  gameActive = true;
  speedCharIndex = 0;
  numpadIndex = 0;
  numpadInputBuffer = "";

  updateHUD();

  if (currentMode === 'speed') {
    const list = SPEED_TEXTS[currentDifficulty] || SPEED_TEXTS.med;
    currentSpeedText = list[Math.floor(Math.random() * list.length)];
    renderSpeedText();
    highlightTargetChar(currentSpeedText[0]);
    focusHiddenInput();
  } else if (currentMode === 'numpad') {
    loadNumpadItem();
    focusHiddenInput();
  } else if (currentMode === 'hunt') {
    loadNewHuntSet();
  } else if (currentMode === 'office') {
    startOfficeStage(1);
    focusHiddenInput();
  }

  playSound('success');

  timer = setInterval(() => {
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function focusHiddenInput() {
  const input = document.getElementById('hiddenInput');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function updateHUD() {
  const maxTime = (currentMode === 'office') ? 90 : 60;
  const elapsedSec = maxTime - timeLeft;
  const elapsedMins = elapsedSec > 0 ? elapsedSec / 60 : 1 / 60;
  const cpm = Math.round(correctTyped / elapsedMins);
  const acc = totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;

  document.getElementById('hudTime').innerText = timeLeft + 's';
  document.getElementById('hudCPM').innerText = cpm;
  document.getElementById('hudAcc').innerText = acc + '%';
  document.getElementById('hudScore').innerText = score;

  broadcastSync({
    type: 'TICK',
    payload: { cpm, acc, score }
  });
}

// ==========================================
// 6. GÉPÍRÓ SPRINT MOTOR
// ==========================================
function renderSpeedText() {
  const box = document.getElementById('view-speed');
  if (!box) return;
  box.innerHTML = '';
  [...currentSpeedText].forEach((char, idx) => {
    const span = document.createElement('span');
    span.className = 'char' + (idx === speedCharIndex ? ' current' : (idx < speedCharIndex ? ' done' : ''));
    span.innerText = char;
    box.appendChild(span);
  });
}

function recordKeyStat(targetChar, isSuccess) {
  if (!targetChar) return;
  const k = targetChar.toLowerCase();
  if (!keyStats[k]) keyStats[k] = { attempts: 0, errors: 0 };
  keyStats[k].attempts++;
  if (!isSuccess) keyStats[k].errors++;
}

function handleSpeedInput(char) {
  if (speedCharIndex >= currentSpeedText.length) return;
  const targetChar = currentSpeedText[speedCharIndex];
  const spans = document.getElementById('view-speed').querySelectorAll('.char');
  totalTyped++;

  if (char === targetChar) {
    correctTyped++;
    score += 2;
    recordKeyStat(targetChar, true);
    playSound('key');

    if (spans[speedCharIndex]) {
      spans[speedCharIndex].className = 'char done';
    }
    speedCharIndex++;

    if (speedCharIndex < currentSpeedText.length) {
      if (spans[speedCharIndex]) {
        spans[speedCharIndex].className = 'char current';
      }
      highlightTargetChar(currentSpeedText[speedCharIndex]);
    } else {
      score += 25;
      playSound('success');
      const list = SPEED_TEXTS[currentDifficulty] || SPEED_TEXTS.med;
      currentSpeedText = list[Math.floor(Math.random() * list.length)];
      speedCharIndex = 0;
      renderSpeedText();
      highlightTargetChar(currentSpeedText[0]);
    }
  } else {
    errors++;
    score = Math.max(0, score - 2);
    recordKeyStat(targetChar, false);
    playSound('error');
    if (spans[speedCharIndex]) {
      spans[speedCharIndex].classList.add('error');
      setTimeout(() => {
        if (spans[speedCharIndex] && speedCharIndex < currentSpeedText.length) {
          spans[speedCharIndex].classList.remove('error');
        }
      }, 250);
    }
  }
  updateHUD();
}

// ==========================================
// 7. NUMPAD SZÁMLÁZÓ MOTOR
// ==========================================
function loadNumpadItem() {
  const items = NUMPAD_ITEMS[currentDifficulty] || NUMPAD_ITEMS.med;
  const item = items[numpadIndex % items.length];
  const labelEl = document.getElementById('numpadItemLabel');
  const targetEl = document.getElementById('numpadTarget');
  const entryEl = document.getElementById('numpadEntry');

  if (labelEl) labelEl.innerText = `${(numpadIndex % items.length) + 1} / ${items.length} TÉTEL – ${item.label}`;
  if (targetEl) targetEl.innerText = item.val;
  if (entryEl) entryEl.innerText = numpadInputBuffer;

  const nextChar = item.val[numpadInputBuffer.length];
  highlightTargetChar(nextChar || 'enter');
}

function handleNumpadInput(char) {
  const items = NUMPAD_ITEMS[currentDifficulty] || NUMPAD_ITEMS.med;
  const currentTarget = items[numpadIndex % items.length].val;
  totalTyped++;

  if (/[0-9]/.test(char)) {
    const expectedChar = currentTarget[numpadInputBuffer.length];
    if (char === expectedChar) {
      numpadInputBuffer += char;
      correctTyped++;
      score += 2;
      recordKeyStat(expectedChar, true);
      playSound('key');
      const entryEl = document.getElementById('numpadEntry');
      if (entryEl) entryEl.innerText = numpadInputBuffer;

      if (numpadInputBuffer === currentTarget) {
        highlightTargetChar('enter');
      } else {
        highlightTargetChar(currentTarget[numpadInputBuffer.length] || 'enter');
      }
    } else {
      errors++;
      score = Math.max(0, score - 1);
      recordKeyStat(expectedChar, false);
      playSound('error');
      const entryEl = document.getElementById('numpadEntry');
      if (entryEl) {
        entryEl.classList.add('shake');
        setTimeout(() => entryEl.classList.remove('shake'), 250);
      }
    }
  }
  updateHUD();
}

// ==========================================
// 8. IRODAI PRÓBANAP MOTOR
// ==========================================
let officeText = "";
let officeCharIndex = 0;

function initOfficeMode() {
  officeStage = 1;
  updateOfficeStepPills();
  const container = document.getElementById('officeStageContainer');
  if (!container) return;
  container.innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.5rem; text-align:center;">
      <h3 style="color:var(--primary); margin-bottom:0.5rem;">Üdvözöljük a Zöldmező Irodai Próbanapján!</h3>
      <p style="color:var(--text-muted); max-width:600px; margin:0 auto 1.5rem auto;">
        3 életszerű feladat vár rád: 1. Ügyféladatok bevitele (QWERTZ) &bull; 2. Számlatételek rögzítése (Numpad) &bull; 3. Számlaellenőrzés (Hibavadász).
      </p>
      <div style="font-size:1.1rem; color:var(--accent);">Kattints a fenti "Futam Indítása" gombra a kezdéshez!</div>
    </div>
  `;
}

function updateOfficeStepPills() {
  [1, 2, 3].forEach(step => {
    const pill = document.getElementById('officeStep' + step);
    if (!pill) return;
    pill.classList.remove('active', 'done');
    if (officeStage === step) pill.classList.add('active');
    else if (officeStage > step) pill.classList.add('done');
  });
}

function startOfficeStage(stageNum) {
  officeStage = stageNum;
  updateOfficeStepPills();
  const container = document.getElementById('officeStageContainer');
  if (!container) return;

  const qwertzKb = document.getElementById('qwertzKb');
  const numpadKb = document.getElementById('numpadKb');

  if (stageNum === 1) {
    // 1. Állomás: Ügyféladatok (QWERTZ)
    if (qwertzKb && numpadKb) {
      qwertzKb.style.opacity = '1';
      numpadKb.style.opacity = '0.25';
    }
    officeText = `${officeStageData.clientName} - ${officeStageData.clientAddress}`;
    officeCharIndex = 0;
    container.innerHTML = `
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.25rem;">
        <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
          1. Feladat: Ügyféltörzs Rögzítés (QWERTZ)
        </div>
        <div id="officeSpeedTarget" class="speed-target-box" style="margin-bottom:0.75rem;"></div>
      </div>
    `;
    renderOfficeSpeedText();
    highlightTargetChar(officeText[0]);
  } else if (stageNum === 2) {
    // 2. Állomás: Számlatételek (Numpad)
    if (qwertzKb && numpadKb) {
      qwertzKb.style.opacity = '0.25';
      numpadKb.style.opacity = '1';
    }
    officeStageData.itemIndex = 0;
    officeStageData.subStage = 'code';
    numpadInputBuffer = '';
    renderOfficeNumpadStage();
  } else if (stageNum === 3) {
    // 3. Állomás: Bizonylatellenőrzés (Hibavadász)
    if (qwertzKb && numpadKb) {
      qwertzKb.style.opacity = '0.25';
      numpadKb.style.opacity = '0.25';
    }
    clearKeyboardHighlights();
    renderOfficeHuntStage();
  }
}

function renderOfficeSpeedText() {
  const box = document.getElementById('officeSpeedTarget');
  if (!box) return;
  box.innerHTML = '';
  [...officeText].forEach((char, idx) => {
    const span = document.createElement('span');
    span.className = 'char' + (idx === officeCharIndex ? ' current' : (idx < officeCharIndex ? ' done' : ''));
    span.innerText = char;
    box.appendChild(span);
  });
}

function handleOfficeSpeedInput(char) {
  if (officeCharIndex >= officeText.length) return;
  const targetChar = officeText[officeCharIndex];
  const spans = document.getElementById('officeSpeedTarget')?.querySelectorAll('.char');
  totalTyped++;

  if (char === targetChar) {
    correctTyped++;
    score += 2;
    recordKeyStat(targetChar, true);
    playSound('key');

    if (spans && spans[officeCharIndex]) {
      spans[officeCharIndex].className = 'char done';
    }
    officeCharIndex++;

    if (officeCharIndex < officeText.length) {
      if (spans && spans[officeCharIndex]) {
        spans[officeCharIndex].className = 'char current';
      }
      highlightTargetChar(officeText[officeCharIndex]);
    } else {
      // 1. Állomás kész!
      score += 40;
      playSound('success');
      startOfficeStage(2);
    }
  } else {
    errors++;
    score = Math.max(0, score - 2);
    recordKeyStat(targetChar, false);
    playSound('error');
    if (spans && spans[officeCharIndex]) {
      spans[officeCharIndex].classList.add('error');
      setTimeout(() => {
        if (spans && spans[officeCharIndex] && officeCharIndex < officeText.length) {
          spans[officeCharIndex].classList.remove('error');
        }
      }, 250);
    }
  }
  updateHUD();
}

function renderOfficeNumpadStage() {
  const container = document.getElementById('officeStageContainer');
  if (!container) return;

  const item = officeStageData.items[officeStageData.itemIndex];
  const isCode = officeStageData.subStage === 'code';
  const label = isCode ? `Cikkszám: ${item.name}` : `Egységár (${item.name})`;
  const targetVal = isCode ? item.code : item.price;

  container.innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.25rem;">
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
        2. Feladat: Számlatétel rögzítés (${officeStageData.itemIndex + 1} / ${officeStageData.items.length}) – ${label}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:1rem; border-radius:8px;">
        <div style="font-size:1.8rem; font-family:monospace; color:var(--accent); font-weight:bold;">${targetVal}</div>
        <div id="officeNumpadEntry" style="font-size:2rem; font-family:monospace; color:var(--success); min-width:120px; text-align:right;">${numpadInputBuffer}</div>
      </div>
      <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--text-muted);">
        Üsd be a számokat, majd a tétel végén nyomj <strong>ENTER</strong>-t!
      </div>
    </div>
  `;
  const nextChar = targetVal[numpadInputBuffer.length];
  highlightTargetChar(nextChar || 'enter');
}

function handleOfficeNumpadInput(char) {
  const item = officeStageData.items[officeStageData.itemIndex];
  const isCode = officeStageData.subStage === 'code';
  const targetVal = isCode ? item.code : item.price;
  totalTyped++;

  if (/[0-9]/.test(char)) {
    const expectedChar = targetVal[numpadInputBuffer.length];
    if (char === expectedChar) {
      numpadInputBuffer += char;
      correctTyped++;
      score += 2;
      recordKeyStat(expectedChar, true);
      playSound('key');
      const entryEl = document.getElementById('officeNumpadEntry');
      if (entryEl) entryEl.innerText = numpadInputBuffer;

      if (numpadInputBuffer === targetVal) {
        highlightTargetChar('enter');
      } else {
        highlightTargetChar(targetVal[numpadInputBuffer.length] || 'enter');
      }
    } else {
      errors++;
      score = Math.max(0, score - 1);
      recordKeyStat(expectedChar, false);
      playSound('error');
      const entryEl = document.getElementById('officeNumpadEntry');
      if (entryEl) {
        entryEl.classList.add('shake');
        setTimeout(() => entryEl.classList.remove('shake'), 250);
      }
    }
  }
  updateHUD();
}

function handleOfficeNumpadEnter() {
  const item = officeStageData.items[officeStageData.itemIndex];
  const isCode = officeStageData.subStage === 'code';
  const targetVal = isCode ? item.code : item.price;
  totalTyped++;

  if (numpadInputBuffer === targetVal) {
    correctTyped++;
    score += 15;
    playSound('success');
    numpadInputBuffer = '';

    if (isCode) {
      officeStageData.subStage = 'price';
      renderOfficeNumpadStage();
    } else {
      officeStageData.itemIndex++;
      officeStageData.subStage = 'code';
      if (officeStageData.itemIndex < officeStageData.items.length) {
        renderOfficeNumpadStage();
      } else {
        // 2. Állomás kész!
        score += 50;
        startOfficeStage(3);
      }
    }
  } else {
    errors++;
    playSound('error');
    const entryEl = document.getElementById('officeNumpadEntry');
    if (entryEl) {
      entryEl.classList.add('shake');
      setTimeout(() => entryEl.classList.remove('shake'), 250);
    }
  }
  updateHUD();
}

function renderOfficeHuntStage() {
  const container = document.getElementById('officeStageContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.25rem;">
      <div style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
        3. Feladat: Bizonylat Revízió – Jelöld be az eltérő tételeket!
      </div>
      <table class="hunt-table" style="margin-bottom:1rem;">
        <thead>
          <tr>
            <th style="width:50px; text-align:center;">Hiba?</th>
            <th>Eredeti Bizonylat</th>
            <th>Rögzített Másolat</th>
            <th style="width:100px; text-align:center;">Állapot</th>
          </tr>
        </thead>
        <tbody>
          ${officeStageData.checks.map((c, idx) => `
            <tr class="hunt-row" id="offHuntRow-${idx}" onclick="toggleOfficeHuntCheck(${idx})">
              <td style="text-align:center;">
                <input type="checkbox" class="hunt-checkbox" id="offChk-${idx}" onclick="event.stopPropagation()">
              </td>
              <td><strong>${c.orig}</strong></td>
              <td style="font-family:monospace; color:var(--accent); font-size:1.1rem;">${c.copy}</td>
              <td id="offRes-${idx}" style="text-align:center; font-size:0.85rem; color:var(--text-muted);">-</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="text-align:center;">
        <button class="btn-primary" onclick="verifyOfficeHunt()">Dokumentum Lezárása & Befejezés</button>
      </div>
    </div>
  `;
}

function toggleOfficeHuntCheck(idx) {
  const chk = document.getElementById('offChk-' + idx);
  if (chk) {
    chk.checked = !chk.checked;
    playSound('key');
  }
}

function verifyOfficeHunt() {
  let stageErrors = 0;
  officeStageData.checks.forEach((c, idx) => {
    const chk = document.getElementById('offChk-' + idx);
    const resCell = document.getElementById('offRes-' + idx);
    const isDifferent = c.orig !== c.copy;
    const userMarked = chk ? chk.checked : false;

    totalTyped++;
    if (userMarked === isDifferent) {
      correctTyped++;
      score += 25;
      if (resCell) {
        resCell.innerHTML = '<span style="color:var(--success); font-weight:bold;">✓ Helyes</span>';
      }
    } else {
      errors++;
      stageErrors++;
      score = Math.max(0, score - 15);
      if (resCell) {
        resCell.innerHTML = '<span style="color:var(--danger); font-weight:bold;">✗ Téves</span>';
      }
    }
  });

  if (stageErrors === 0) {
    score += 100; // Hibátlan irodai zárás bónusz
    playSound('finish');
  } else {
    playSound('key');
  }
  updateHUD();

  setTimeout(() => {
    endGame();
  }, 1000);
}

// ==========================================
// 9. INPUT FIGYELŐK (Hidden Input + Keydown)
// ==========================================
const hiddenInput = document.getElementById('hiddenInput');
if (hiddenInput) {
  hiddenInput.addEventListener('input', (e) => {
    if (!gameActive) return;
    const val = e.target.value;
    if (!val || val.length === 0) return;
    const typedChar = val.slice(-1);
    e.target.value = '';

    if (currentMode === 'speed') {
      handleSpeedInput(typedChar);
    } else if (currentMode === 'numpad') {
      handleNumpadInput(typedChar);
    } else if (currentMode === 'office') {
      if (officeStage === 1) handleOfficeSpeedInput(typedChar);
      else if (officeStage === 2) handleOfficeNumpadInput(typedChar);
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) {
    if (e.target.id !== 'hiddenInput') return;
  }

  if (!gameActive) return;

  if (currentMode === 'numpad') {
    const items = NUMPAD_ITEMS[currentDifficulty] || NUMPAD_ITEMS.med;
    const currentTarget = items[numpadIndex % items.length].val;
    if (e.key === 'Enter') {
      e.preventDefault();
      totalTyped++;
      if (numpadInputBuffer === currentTarget) {
        correctTyped++;
        score += 30;
        playSound('success');
        numpadIndex++;
        numpadInputBuffer = '';
        loadNumpadItem();
        updateHUD();
      } else {
        errors++;
        score = Math.max(0, score - 5);
        playSound('error');
        const entryEl = document.getElementById('numpadEntry');
        if (entryEl) {
          entryEl.classList.add('shake');
          setTimeout(() => entryEl.classList.remove('shake'), 250);
        }
        updateHUD();
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (numpadInputBuffer.length > 0) {
        numpadInputBuffer = numpadInputBuffer.slice(0, -1);
        const entryEl = document.getElementById('numpadEntry');
        if (entryEl) entryEl.innerText = numpadInputBuffer;
        highlightTargetChar(currentTarget[numpadInputBuffer.length] || 'enter');
        playSound('key');
      }
    }
  } else if (currentMode === 'office') {
    if (officeStage === 2) {
      const item = officeStageData.items[officeStageData.itemIndex];
      const isCode = officeStageData.subStage === 'code';
      const targetVal = isCode ? item.code : item.price;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleOfficeNumpadEnter();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (numpadInputBuffer.length > 0) {
          numpadInputBuffer = numpadInputBuffer.slice(0, -1);
          const entryEl = document.getElementById('officeNumpadEntry');
          if (entryEl) entryEl.innerText = numpadInputBuffer;
          highlightTargetChar(targetVal[numpadInputBuffer.length] || 'enter');
          playSound('key');
        }
      }
    }
  }
});

// ==========================================
// 10. BILLENTYŰZET ÉS INTERAKTÍV KÉZ-DIAGRAM KIEMELÉS
// ==========================================
function clearKeyboardHighlights() {
  document.querySelectorAll('.key').forEach(k => {
    k.classList.remove('active-target', 'active-shift');
  });
  document.querySelectorAll('.finger-tip').forEach(f => {
    f.classList.remove('active-finger', 'active-shift-finger');
  });
}

// Ujj-kiosztás tízujjas vakíráshoz (Magyar QWERTZ és Numpad)
const FINGER_MAP = {
  // Bal kisujj (Pinky)
  '0': 'finger-lp', '1': 'finger-lp', 'q': 'finger-lp', 'a': 'finger-lp', 'í': 'finger-lp', 'y': 'finger-lp',
  // Bal gyűrűs (Ring)
  '2': 'finger-lr', 'w': 'finger-lr', 's': 'finger-lr', 'x': 'finger-lr',
  // Bal középső (Middle)
  '3': 'finger-lm', 'e': 'finger-lm', 'd': 'finger-lm', 'c': 'finger-lm',
  // Bal mutató (Index)
  '4': 'finger-li', '5': 'finger-li', 'r': 'finger-li', 't': 'finger-li',
  'f': 'finger-li', 'g': 'finger-li', 'v': 'finger-li', 'b': 'finger-li',
  // Hüvelykujjak (Thumbs - Szóköz)
  ' ': 'finger-rth',

  // Jobb mutató (Index)
  '6': 'finger-ri', '7': 'finger-ri', 'z': 'finger-ri', 'u': 'finger-ri',
  'h': 'finger-ri', 'j': 'finger-ri', 'n': 'finger-ri', 'm': 'finger-ri',
  // Jobb középső (Middle)
  '8': 'finger-rm', 'i': 'finger-rm', 'k': 'finger-rm', ',': 'finger-rm',
  // Jobb gyűrűs (Ring)
  '9': 'finger-rr', 'o': 'finger-rr', 'l': 'finger-rr', '.': 'finger-rr',
  // Jobb kisujj (Pinky)
  'ö': 'finger-rp', 'ü': 'finger-rp', 'ó': 'finger-rp', 'ő': 'finger-rp', 'ú': 'finger-rp',
  'p': 'finger-rp', 'é': 'finger-rp', 'á': 'finger-rp', 'ű': 'finger-rp',
  '-': 'finger-rp', '+': 'finger-rp', '/': 'finger-rp', 'enter': 'finger-rp', '↵': 'finger-rp'
};

// Numpad ujjrend (Jobb kéz zóna)
const NUMPAD_FINGER_MAP = {
  '1': 'finger-ri', '4': 'finger-ri', '7': 'finger-ri',
  '2': 'finger-rm', '5': 'finger-rm', '8': 'finger-rm', '/': 'finger-rm',
  '3': 'finger-rr', '6': 'finger-rr', '9': 'finger-rr', '*': 'finger-rr',
  '0': 'finger-rth', ',': 'finger-rm', '.': 'finger-rm',
  '+': 'finger-rp', '-': 'finger-rp', 'enter': 'finger-rp', '↵': 'finger-rp'
};

function highlightHands(char, isNumpad) {
  if (!char) return;
  const lower = char.toLowerCase();
  const isUpper = char !== lower && char === char.toUpperCase();

  let targetFingerId = isNumpad ? NUMPAD_FINGER_MAP[lower] : FINGER_MAP[lower];
  if (!targetFingerId) {
    if (char === ' ') targetFingerId = 'finger-rth';
    else if (char === '↵' || lower === 'enter') targetFingerId = 'finger-rp';
  }

  if (targetFingerId) {
    const fingerEl = document.getElementById(targetFingerId);
    if (fingerEl) fingerEl.classList.add('active-finger');
  }

  // Nagybetű esetén az ellenoldali Shift ujját (kisujj) is megvilágítjuk
  if (isUpper && !isNumpad) {
    const leftHandLetters = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'y', 'x', 'c', 'v', 'í'];
    const shiftFingerId = leftHandLetters.includes(lower) ? 'finger-rp' : 'finger-lp';
    const shiftFingerEl = document.getElementById(shiftFingerId);
    if (shiftFingerEl) shiftFingerEl.classList.add('active-shift-finger');
  }
}

function highlightTargetChar(char) {
  clearKeyboardHighlights();
  if (!char) return;

  const isNumpadActive = (currentMode === 'numpad') || (currentMode === 'office' && officeStage === 2);

  if (isNumpadActive) {
    const numpadContainer = document.getElementById('numpadKb');
    if (!numpadContainer) return;
    const lower = char.toLowerCase();
    let selector = `[data-key="${lower}"]`;
    if (char === '↵' || lower === 'enter') selector = `[data-key="enter"]`;

    const keyEl = numpadContainer.querySelector(selector);
    if (keyEl) keyEl.classList.add('active-target');

    highlightHands(char, true);
    return;
  }

  // QWERTZ billentyűzet kiemelés
  const qwertzContainer = document.getElementById('qwertzKb');
  if (!qwertzContainer) return;

  const isUpper = char !== char.toLowerCase() && char === char.toUpperCase();
  const lower = char.toLowerCase();

  let selector = `[data-key="${lower}"]`;
  if (char === ' ') selector = `[data-key=" "]`;
  if (char === '↵' || lower === 'enter') selector = `[data-key="enter"]`;

  const keyEl = qwertzContainer.querySelector(selector);
  if (keyEl) keyEl.classList.add('active-target');

  if (isUpper) {
    const leftHandLetters = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'y', 'x', 'c', 'v', 'í'];
    const shiftSelector = leftHandLetters.includes(lower)
      ? '[data-key="shift-right"]'
      : '[data-key="shift-left"]';

    const shiftKey = qwertzContainer.querySelector(shiftSelector);
    if (shiftKey) shiftKey.classList.add('active-shift');
  }

  highlightHands(char, false);
}

// ==========================================
// 11. HIBAVADÁSZ: JÁTÉK ÉS SZERKESZTŐ
// ==========================================
function getStoredWords() {
  try {
    const raw = localStorage.getItem('adat_arena_hunt_words');
    return raw ? JSON.parse(raw) : DEFAULT_HUNT_ITEMS;
  } catch (_) {
    return DEFAULT_HUNT_ITEMS;
  }
}

function initWordsDatabase() {
  if (!localStorage.getItem('adat_arena_hunt_words')) {
    localStorage.setItem('adat_arena_hunt_words', JSON.stringify(DEFAULT_HUNT_ITEMS));
  }
}

function loadNewHuntSet() {
  const words = getStoredWords();
  if (!words || words.length === 0) return;

  activeHuntPlayItems = [...words].sort(() => 0.5 - Math.random()).slice(0, 5);

  const tbody = document.getElementById('huntPlayTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  activeHuntPlayItems.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hunt-row';
    tr.id = `hunt-row-${index}`;
    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="hunt-checkbox" id="chk-${index}" onclick="event.stopPropagation()">
      </td>
      <td><strong>${item.orig}</strong></td>
      <td style="font-family: monospace; font-size: 1.15rem; color: var(--accent);">${item.copy}</td>
      <td id="res-cell-${index}" style="text-align: center; font-size:0.85rem; color: var(--text-muted);">-</td>
    `;
    tr.addEventListener('click', () => {
      const chk = document.getElementById(`chk-${index}`);
      if (chk && !chk.disabled) {
        chk.checked = !chk.checked;
        playSound('key');
      }
    });
    tbody.appendChild(tr);
  });
}

function verifyHuntBatch() {
  if (!gameActive) {
    alert("A futam még nem indult el! Kattints a fenti 'Futam Indítása' gombra.");
    return;
  }

  let batchCorrect = 0;
  activeHuntPlayItems.forEach((item, index) => {
    const chk = document.getElementById(`chk-${index}`);
    const resCell = document.getElementById(`res-cell-${index}`);
    const isDifferent = item.orig !== item.copy;
    const userMarked = chk ? chk.checked : false;

    totalTyped++;

    if (userMarked === isDifferent) {
      correctTyped++;
      score += 20;
      batchCorrect++;
      if (resCell) {
        resCell.innerHTML = '<span style="color:var(--success); font-weight:bold;">✓ Helyes</span>';
      }
    } else {
      errors++;
      score = Math.max(0, score - 10);
      if (resCell) {
        resCell.innerHTML = '<span style="color:var(--danger); font-weight:bold;">✗ Téves</span>';
      }
    }

    if (chk) chk.disabled = true;
  });

  if (batchCorrect === activeHuntPlayItems.length) {
    score += 50; // Hibátlan tételcsoport bónusz
    playSound('success');
  } else {
    playSound('error');
  }

  updateHUD();

  setTimeout(() => {
    if (gameActive) loadNewHuntSet();
  }, 1200);
}

function renderEditorTable() {
  const tbody = document.getElementById('wordsEditorBody');
  if (!tbody) return;
  const words = getStoredWords();
  tbody.innerHTML = '';

  words.forEach((item, index) => {
    const isErr = item.orig !== item.copy;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="editor-inline-input" value="${item.orig}" onchange="updateWordField(${index}, 'orig', this.value)"></td>
      <td><input type="text" class="editor-inline-input" value="${item.copy}" onchange="updateWordField(${index}, 'copy', this.value)"></td>
      <td style="text-align:center;">
        <span style="color:${isErr ? 'var(--danger)' : 'var(--success)'}; font-weight:bold;">
          ${isErr ? 'Eltérés' : 'Egyező'}
        </span>
      </td>
      <td style="text-align:center;">
        <button class="btn-sm-del" onclick="deleteWord(${index})">Törlés</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateWordField(index, field, value) {
  const words = getStoredWords();
  if (words[index]) {
    words[index][field] = value.trim();
    localStorage.setItem('adat_arena_hunt_words', JSON.stringify(words));
    renderEditorTable();
  }
}

function addNewHuntWord() {
  const origInput = document.getElementById('newOrigWord');
  const copyInput = document.getElementById('newCopyWord');
  const orig = origInput ? origInput.value.trim() : '';
  const copy = copyInput ? copyInput.value.trim() : '';

  if (!orig || !copy) {
    alert("Kérlek mindkét mezőt töltsd ki az új tételhez!");
    return;
  }

  const words = getStoredWords();
  words.unshift({ id: Date.now(), orig, copy });
  localStorage.setItem('adat_arena_hunt_words', JSON.stringify(words));

  if (origInput) origInput.value = '';
  if (copyInput) copyInput.value = '';
  renderEditorTable();
  loadNewHuntSet();
  playSound('success');
}

function deleteWord(index) {
  const words = getStoredWords();
  words.splice(index, 1);
  localStorage.setItem('adat_arena_hunt_words', JSON.stringify(words));
  renderEditorTable();
  loadNewHuntSet();
}

function restoreDefaultWords() {
  if (confirm("Biztosan visszaállítod az eredeti alapértelmezett szókészletet?")) {
    localStorage.setItem('adat_arena_hunt_words', JSON.stringify(DEFAULT_HUNT_ITEMS));
    renderEditorTable();
    loadNewHuntSet();
    playSound('success');
  }
}

// ==========================================
// 12. LEZÁRÁS, DIAGNOSZTIKA, MATRICA & RANGLISTA
// ==========================================
function analyzeDiagnostics() {
  // Hiba és erősség elemzés
  const keys = Object.keys(keyStats);
  let worstChar = null;
  let worstErrors = 0;
  let mostAccurateZone = "Alapsor (ASDF-JKLÉ)";

  keys.forEach(k => {
    if (keyStats[k].errors > worstErrors) {
      worstErrors = keyStats[k].errors;
      worstChar = k;
    }
  });

  let strengthText = "Stabil ritmustartás és megbízható alapsor-kezelés";
  let weaknessText = "Kiváló pontosság, nincs kiugró hibás zóna!";

  if (worstChar && worstErrors > 0) {
    const disp = worstChar === ' ' ? 'Szóköz' : (worstChar === 'enter' ? 'Enter' : `"${worstChar.toUpperCase()}"`);
    weaknessText = `${disp} betű (${worstErrors} tévesztés) – érdemes az ujjrendet átnézni`;
  }

  if (currentMode === 'numpad') {
    strengthText = "Kiváló számbillentyűzeti sebesség és 5-ös tájékozódási pont";
  } else if (currentMode === 'office') {
    strengthText = "Kiváló többcsatornás irodai alkalmazkodóképesség";
  }

  const elStr = document.getElementById('stkStrength');
  const elWk = document.getElementById('stkWeakness');
  if (elStr) elStr.innerText = strengthText;
  if (elWk) elWk.innerText = weaknessText;
}

function endGame() {
  clearInterval(timer);
  gameActive = false;
  clearKeyboardHighlights();

  const maxTime = (currentMode === 'office') ? 90 : 60;
  const elapsedSec = maxTime - timeLeft;
  const elapsedMins = elapsedSec > 0 ? elapsedSec / 60 : 1;
  const finalCPM = Math.round(correctTyped / elapsedMins);
  const finalAcc = totalTyped > 0 ? Math.round((correctTyped / totalTyped) * 100) : 100;

  playSound('finish');

  // Adatok beírása a matricára
  document.getElementById('stkName').innerText = activePlayerName;
  document.getElementById('stkCPM').innerText = finalCPM + ' CPM';
  document.getElementById('stkAcc').innerText = finalAcc + '%';
  document.getElementById('stkScore').innerText = score;
  document.getElementById('stkDate').innerText = new Date().toISOString().slice(0, 10);

  // Hivatalos minősítés a rendszerdokumentáció alapján
  let rank = "Gyakornok Adatrögzítő";
  if (finalCPM >= 180 && finalAcc >= 95) {
    rank = "Mester Adatrögzítő 🏆";
  } else if (finalCPM >= 120) {
    rank = "Haladó Adatrögzítő ⭐";
  } else if (currentMode === 'hunt' || currentMode === 'office') {
    if (score >= 120) rank = "Mester Adatrögzítő 🏆";
    else if (score >= 60) rank = "Haladó Adatrögzítő ⭐";
  }
  document.getElementById('stkRank').innerText = rank;

  // Diagnosztikai elemzés futtatása
  analyzeDiagnostics();

  // Mentés a helyi ranglistára (TOP 100)
  const leaderboard = JSON.parse(localStorage.getItem('adat_arena_lb') || '[]');
  const modeLabels = {
    speed: 'Sprint',
    numpad: 'Numpad',
    hunt: 'Vadász',
    office: 'Próbanap'
  };
  const diffLabels = {
    easy: 'Kezdő',
    med: 'Haladó',
    hard: 'Bajnok'
  };

  leaderboard.push({
    name: activePlayerName,
    mode: modeLabels[currentMode] || currentMode,
    difficulty: diffLabels[currentDifficulty] || 'Haladó',
    cpm: finalCPM,
    acc: finalAcc,
    score: score,
    rank: rank,
    date: new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
    isoDate: new Date().toLocaleString('hu-HU')
  });

  leaderboard.sort((a, b) => b.score - a.score || b.cpm - a.cpm);
  localStorage.setItem('adat_arena_lb', JSON.stringify(leaderboard));

  broadcastSync({ type: 'NEW_RESULT' });

  // Megjelenítjük a záró modált
  document.getElementById('resultModal').classList.add('open');
}

function closeResultAndShowStart() {
  document.getElementById('resultModal').classList.remove('open');
  document.getElementById('startOverlay').style.display = 'flex';
  const nameInput = document.getElementById('playerNameInputMain');
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
  }
}

// Ranglista szűrés és megjelenítés a kivetítőn
function filterProjectorLB(mode, btn) {
  currentProjectorFilter = mode;
  document.querySelectorAll('.lb-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLeaderboard('projLbRows');
}

function renderLeaderboard(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const rawLb = JSON.parse(localStorage.getItem('adat_arena_lb') || '[]');
  box.innerHTML = '';

  let filtered = rawLb;
  if (currentProjectorFilter && currentProjectorFilter !== 'all') {
    filtered = rawLb.filter(item => item.mode === currentProjectorFilter);
  }

  if (filtered.length === 0) {
    box.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">Még nincs rögzített eredmény ebben a kategóriában.</div>';
    return;
  }

  filtered.slice(0, 10).forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (idx === 0 ? ' top-1' : '');
    const badge = entry.mode ? ` <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${entry.mode})</span>` : '';
    row.innerHTML = `
      <div>${idx + 1}.</div>
      <div>${entry.name}${badge}</div>
      <div>${entry.cpm} CPM</div>
      <div><strong>${entry.score} pont</strong></div>
    `;
    box.appendChild(row);
  });
}

function resetLeaderboard() {
  if (confirm("Biztosan törölni szeretnéd a kioszk ranglistáját?")) {
    localStorage.removeItem('adat_arena_lb');
    if (isProjector) renderLeaderboard('projLbRows');
    broadcastSync({ type: 'NEW_RESULT' });
    playSound('key');
  }
}

// ==========================================
// 13. EXCEL / CSV EXPORT TANÁROKNAK ÉS DIÁKOKNAK
// ==========================================
function exportLeaderboardCSV() {
  const leaderboard = JSON.parse(localStorage.getItem('adat_arena_lb') || '[]');
  if (!leaderboard || leaderboard.length === 0) {
    alert("Nincs még exportálható eredmény a ranglistán!");
    return;
  }

  // Pontosvesszővel elválasztott, UTF-8 BOM formátum a magyar Excelhez
  const headers = ["Helyezés", "Név", "Játékmód", "Nehézségi szint", "Leütés (CPM)", "Pontosság (%)", "Pontszám", "Minősítés", "Rögzítés ideje"];
  const rows = leaderboard.map((item, idx) => [
    idx + 1,
    `"${(item.name || '').replace(/"/g, '""')}"`,
    item.mode || 'Sprint',
    item.difficulty || 'Haladó',
    item.cpm,
    item.acc,
    item.score,
    `"${(item.rank || '').replace(/"/g, '""')}"`,
    `"${item.isoDate || item.date || ''}"`
  ]);

  const csvContent = "\uFEFF" + [
    headers.join(";"),
    ...rows.map(r => r.join(";"))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `AdatArena_Eredmenyek_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  playSound('success');
}
