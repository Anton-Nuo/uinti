// Tietokanta on tiedosto db.json.
// Lukeminen: fetch('db.json') tai valittu tiedosto. Kirjoittaminen: File System Access API.
const DB_URL = 'db.json';

// ---- Tiedostokahvan säilytys IndexedDB:ssä (kahva säilyy sivujen välillä) ----
const openIdb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('uintiajat', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('kv');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function kv(mode, action) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const request = action(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

let fileHandle = null;
const handleReady = kv('readonly', (store) => store.get('handle'))
  .then((handle) => { fileHandle = handle ?? null; })
  .catch(() => {});
const permission = { mode: 'readwrite' };
async function hasAccess() {
  await handleReady;
  return Boolean(fileHandle) && (await fileHandle.queryPermission(permission)) === 'granted';
}

// ---- Tietokannan luku ja kirjoitus ----
async function readDb() {
  if (await hasAccess()) return JSON.parse(await (await fileHandle.getFile()).text());
  const response = await fetch(DB_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`db.json:n lukeminen epäonnistui (${response.status})`);
  return response.json();
}

async function writeDb(db) {
  await handleReady;
  if (!fileHandle) await pickFile();
  let writable;
  try {
    writable = await fileHandle.createWritable();
  } catch (error) {
    if (!['NotAllowedError', 'SecurityError'].includes(error.name)) throw error;
    if ((await fileHandle.requestPermission(permission)) !== 'granted') throw new Error('Muokkauslupaa ei annettu. Salli tiedoston muokkaus.');
    writable = await fileHandle.createWritable();
  }
  await writable.write(JSON.stringify(db, null, 2));
  await writable.close();
  await updateButton();
}

// ---- CRUD ----
export async function getResults() {
  return (await readDb()).ajat;
}

export async function addResult(data) {
  const db = await readDb();
  const result = { id: Math.max(0, ...db.ajat.map((r) => r.id)) + 1, ...data };
  db.ajat.push(result);
  await writeDb(db);
  return result;
}

export async function updateResult(id, data) {
  const db = await readDb();
  const index = db.ajat.findIndex((r) => String(r.id) === String(id));
  if (index === -1) throw new Error('Aikaa ei löytynyt');
  db.ajat[index] = { ...db.ajat[index], ...data };
  await writeDb(db);
  return db.ajat[index];
}

export async function deleteResult(id) {
  const db = await readDb();
  db.ajat = db.ajat.filter((r) => String(r.id) !== String(id));
  await writeDb(db);
}

// ---- Yhdistä db.json -painike ----
const dbButton = document.querySelector('#db-yhteys');

async function updateButton() {
  if (!dbButton) return;
  const connected = await hasAccess();
  dbButton.textContent = connected ? 'db.json yhdistetty ✓' : 'Yhdistä db.json';
  dbButton.classList.toggle('connected', connected);
}

// Tiedoston valinta (vaatii käyttäjän toiminnon, esim. painikkeen tai tallennuksen)
async function pickFile() {
  if (!('showOpenFilePicker' in window)) throw new Error('Selain ei tue tiedostoon kirjoitusta. Käytä Chromea tai Edgeä.');
  try {
    [fileHandle] = await showOpenFilePicker({ mode: 'readwrite', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Tiedoston valinta tai muokkausluvan antaminen peruttiin. Valitse projektin db.json ja paina lupakyselyssä "Muokkaa tiedostoa".');
    throw error;
  }
  await kv('readwrite', (store) => store.put(fileHandle, 'handle')).catch(() => {});
  await updateButton();
}

dbButton?.addEventListener('click', async () => {
  try {
    await handleReady;
    if (fileHandle && !(await hasAccess())) {
      if ((await fileHandle.requestPermission(permission)) !== 'granted') throw new Error('Muokkauslupaa ei annettu.');
      await updateButton();
    } else {
      await pickFile();
    }
    showMessage('Tietokantatiedosto yhdistetty.');
  } catch (error) {
    showMessage(error.message, true);
  }
});
updateButton();

// ---- Apufunktiot ----
// Aika tallennetaan sadasosasekunteina (esim. "1:05.32" -> 6532)
export function parseTime(text) {
  const [minutes, seconds] = text.includes(':') ? text.split(':') : ['0', text];
  return Math.round((Number(minutes) * 60 + Number(seconds)) * 100);
}

export function formatTime(hundredths) {
  const minutes = Math.floor(hundredths / 6000);
  const seconds = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
  return minutes ? `${minutes}:${seconds}` : seconds.replace(/^0(?=\d)/, '');
}

export function formToResult(form) {
  const f = new FormData(form);
  return {
    uimari: f.get('uimari').trim(),
    syntymavuosi: Number(f.get('syntymavuosi')),
    seura: f.get('seura').trim(),
    kilpailu: f.get('kilpailu').trim(),
    pvm: f.get('pvm'),
    laji: f.get('laji'),
    matka: Number(f.get('matka')),
    allas: Number(f.get('allas')),
    aika: parseTime(f.get('aika').trim()),
  };
}

export const today = () => new Date().toISOString().slice(0, 10);

export function limitDates(form) {
  form.elements.pvm.max = today();
  form.elements.syntymavuosi.max = new Date().getFullYear();
}

let timer;
export function showMessage(text, isError = false) {
  const box = document.querySelector('#ilmoitus');
  box.textContent = text;
  box.classList.toggle('virhe', isError);
  if (!box.matches(':popover-open')) box.showPopover();
  clearTimeout(timer);
  timer = setTimeout(() => box.hidePopover(), 4000);
}

export function el(tag, props = {}, ...children) {
  const { dataset, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  Object.assign(node.dataset, dataset);
  node.append(...children);
  return node;
}
