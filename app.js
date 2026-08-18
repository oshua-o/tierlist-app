/* ---------- IndexedDB: Fotos bleiben lokal auf dem Gerät ---------- */
const DB_NAME = 'tierlist';
const STORE = 'photos';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- State ---------- */
let photos = {};      // name -> { blob, date, objectUrl }
let activeSpecies = null;
let showOnlyOpen = false;
let searchTerm = '';

const grid = document.getElementById('grid');
const statText = document.getElementById('statText');
const progressFill = document.getElementById('progressFill');
const toast = document.getElementById('toast');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function fmtDate(d) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

/* ---------- Rendering ---------- */
function render() {
  const term = searchTerm.trim().toLowerCase();
  grid.innerHTML = '';

  const list = SPECIES.filter(sp => {
    if (term && !sp.n.toLowerCase().includes(term) && !sp.s.toLowerCase().includes(term)) return false;
    if (showOnlyOpen && photos[sp.n]) return false;
    return true;
  });

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-msg">nichts gefunden</div>';
  }

  const frag = document.createDocumentFragment();
  list.forEach(sp => {
    const rec = photos[sp.n];
    const card = document.createElement('div');
    card.className = 'card ' + (rec ? 'filled' : 'empty');

    if (rec) {
      const img = document.createElement('img');
      img.src = rec.objectUrl;
      img.alt = sp.n;
      card.appendChild(img);

      const cap = document.createElement('div');
      cap.className = 'caption';
      cap.textContent = sp.n;
      card.appendChild(cap);

      const stamp = document.createElement('div');
      stamp.className = 'stamp';
      stamp.textContent = '✓';
      card.appendChild(stamp);

      card.addEventListener('click', () => openZoom(sp));
    } else {
      card.innerHTML = `
        <svg class="cam" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="#4a3a72" stroke-width="1.6"/><circle cx="12" cy="13" r="3.4" stroke="#4a3a72" stroke-width="1.6"/></svg>
        <div class="name">${sp.n}</div>
        <div class="sci">${sp.s}</div>
      `;
      card.addEventListener('click', () => openCapture(sp));
    }

    frag.appendChild(card);
  });
  grid.appendChild(frag);

  updateStats();
}

function updateStats() {
  const total = SPECIES.length;
  const done = SPECIES.filter(sp => photos[sp.n]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  statText.textContent = `${done} / ${total} (${pct}%)`;
  progressFill.style.width = pct + '%';
}

/* ---------- Capture sheet ---------- */
const captureBackdrop = document.getElementById('captureBackdrop');
const captureName = document.getElementById('captureName');
const captureSci = document.getElementById('captureSci');
const camInput = document.getElementById('camInput');
const libInput = document.getElementById('libInput');

function openCapture(sp) {
  activeSpecies = sp;
  captureName.textContent = sp.n;
  captureSci.textContent = sp.s;
  captureBackdrop.classList.add('open');
}
function closeCapture() {
  captureBackdrop.classList.remove('open');
}
document.getElementById('cancelCapture').addEventListener('click', closeCapture);
captureBackdrop.addEventListener('click', e => { if (e.target === captureBackdrop) closeCapture(); });

document.getElementById('btnCamera').addEventListener('click', () => { camInput.value = ''; camInput.click(); });
document.getElementById('btnLibrary').addEventListener('click', () => { libInput.value = ''; libInput.click(); });

async function handleFile(file) {
  if (!file || !activeSpecies) return;
  const sp = activeSpecies;
  const record = { name: sp.n, blob: file, date: Date.now() };
  await dbPut(record);
  const objectUrl = URL.createObjectURL(file);
  photos[sp.n] = { blob: file, date: record.date, objectUrl };
  closeCapture();
  showToast(`${sp.n} hinzugefügt`);
  render();
}

camInput.addEventListener('change', e => handleFile(e.target.files[0]));
libInput.addEventListener('change', e => handleFile(e.target.files[0]));

/* ---------- Zoom sheet ---------- */
const zoomBackdrop = document.getElementById('zoomBackdrop');
const zoomPhoto = document.getElementById('zoomPhoto');
const zoomName = document.getElementById('zoomName');
const zoomSci = document.getElementById('zoomSci');
const zoomDate = document.getElementById('zoomDate');

function openZoom(sp) {
  activeSpecies = sp;
  const rec = photos[sp.n];
  zoomPhoto.src = rec.objectUrl;
  zoomPhoto.alt = sp.n;
  zoomName.textContent = sp.n;
  zoomSci.textContent = sp.s;
  zoomDate.textContent = 'eingefügt am ' + fmtDate(new Date(rec.date));
  zoomBackdrop.classList.add('open');
}
function closeZoom() { zoomBackdrop.classList.remove('open'); }
document.getElementById('closeZoom').addEventListener('click', closeZoom);
zoomBackdrop.addEventListener('click', e => { if (e.target === zoomBackdrop) closeZoom(); });

document.getElementById('deleteBtn').addEventListener('click', async () => {
  if (!activeSpecies) return;
  const sp = activeSpecies;
  if (!confirm(`"${sp.n}" wirklich löschen?`)) return;
  await dbDelete(sp.n);
  if (photos[sp.n]) URL.revokeObjectURL(photos[sp.n].objectUrl);
  delete photos[sp.n];
  closeZoom();
  showToast(`${sp.n} gelöscht`);
  render();
});

/* ---------- Search & filter ---------- */
document.getElementById('searchInput').addEventListener('input', e => {
  searchTerm = e.target.value;
  render();
});
const filterBtn = document.getElementById('filterBtn');
filterBtn.addEventListener('click', () => {
  showOnlyOpen = !showOnlyOpen;
  filterBtn.setAttribute('aria-pressed', String(showOnlyOpen));
  filterBtn.textContent = showOnlyOpen ? 'alle' : 'noch nicht entdeckt';
  render();
});

/* ---------- Init ---------- */
async function init() {
  const records = await dbGetAll();
  records.forEach(r => {
    photos[r.name] = { blob: r.blob, date: r.date, objectUrl: URL.createObjectURL(r.blob) };
  });
  render();
}
init();

/* ---------- Service worker (Offline-Nutzung nach erstem Laden) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
