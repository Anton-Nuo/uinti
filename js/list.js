import { getResults, updateResult, deleteResult, formToResult, formatTime, limitDates, showMessage, el } from './api.js';
/*Terve*/
let results = [];
const listEl = document.querySelector('#tulokset');
const filters = {
  haku: document.querySelector('#haku'),
  laji: document.querySelector('#suodata-laji'),
  matka: document.querySelector('#suodata-matka'),
  allas: document.querySelector('#suodata-allas'),
  jarjestys: document.querySelector('#jarjestys'),
};
const editDialog = document.querySelector('#muokkausdialogi');
const editForm = document.querySelector('#muokkauslomake');
const deleteDialog = document.querySelector('#poistodialogi');
let deleteId = null;

function createCard(r) {
  return el('article', { className: 'card' },
    el('h3', {}, r.uimari),
    el('p', { className: 'meta' }, `${r.seura} · s. ${r.syntymavuosi}`),
    el('p', {}, el('span', { className: 'tag' }, `${r.matka} m ${r.laji.toLowerCase()}`), ' ', el('span', { className: 'tag' }, `${r.allas} m allas`)),
    el('p', { className: 'time' }, formatTime(r.aika)),
    el('p', { className: 'meta' }, `${r.kilpailu}, ${new Date(r.pvm).toLocaleDateString('fi-FI')}`),
    el('div', { className: 'actions' },
      el('button', { className: 'btn secondary', type: 'button', textContent: 'Muokkaa', dataset: { action: 'edit', id: r.id } }),
      el('button', { className: 'btn danger', type: 'button', textContent: 'Poista', dataset: { action: 'delete', id: r.id } }),
    ),
  );
}

function visibleResults() {
  const query = filters.haku.value.trim().toLowerCase();
  const [key, dir] = filters.jarjestys.value.split('-');
  const compare = { pvm: (a, b) => a.pvm.localeCompare(b.pvm), aika: (a, b) => a.aika - b.aika, uimari: (a, b) => a.uimari.localeCompare(b.uimari, 'fi') }[key];
  return results
    .filter((r) => `${r.uimari} ${r.seura}`.toLowerCase().includes(query))
    .filter((r) => !filters.laji.value || r.laji === filters.laji.value)
    .filter((r) => !filters.matka.value || r.matka === Number(filters.matka.value))
    .filter((r) => !filters.allas.value || r.allas === Number(filters.allas.value))
    .sort((a, b) => compare(a, b) * (dir === 'desc' ? -1 : 1));
}

function render() {
  const items = visibleResults();
  listEl.replaceChildren(...(items.length ? items.map(createCard) : [el('p', {}, 'Ei hakua vastaavia aikoja.')]));
}

async function load() {
  try {
    results = await getResults();
    render();
  } catch (error) {
    listEl.replaceChildren(el('p', {}, 'Aikojen haku epäonnistui. Avaa sivusto Live Serverillä, jotta db.json löytyy.'));
    showMessage(error.message, true);
  }
}

function openEdit(id) {
  const r = results.find((item) => String(item.id) === id);
  editForm.elements.id.value = r.id;
  for (const name of ['uimari', 'syntymavuosi', 'seura', 'kilpailu', 'pvm', 'laji', 'matka', 'allas']) editForm.elements[name].value = r[name];
  editForm.elements.aika.value = formatTime(r.aika);
  editDialog.showModal();
}

listEl.addEventListener('click', (event) => {
  const { action, id } = event.target.dataset;
  if (action === 'edit') openEdit(id);
  if (action === 'delete') {
    deleteId = id;
    const r = results.find((item) => String(item.id) === id);
    document.querySelector('#poistettava').textContent = `${r.uimari}, ${r.matka} m ${r.laji.toLowerCase()} ${formatTime(r.aika)}`;
    deleteDialog.showModal();
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = editForm.elements.id.value;
  try {
    const saved = await updateResult(id, formToResult(editForm));
    results = results.map((r) => (String(r.id) === id ? saved : r));
    render();
    editDialog.close();
    showMessage('Aika päivitetty.');
  } catch (error) {
    showMessage(`Tallennus epäonnistui: ${error.message}`, true);
  }
});

document.querySelector('#peruuta-muokkaus').addEventListener('click', () => editDialog.close());
document.querySelector('#peruuta-poisto').addEventListener('click', () => deleteDialog.close());

document.querySelector('#vahvista-poisto').addEventListener('click', async () => {
  try {
    await deleteResult(deleteId);
    results = results.filter((r) => String(r.id) !== deleteId);
    render();
    deleteDialog.close();
    showMessage('Aika poistettu.');
  } catch (error) {
    showMessage(`Poisto epäonnistui: ${error.message}`, true);
  }
});

filters.haku.addEventListener('input', render);
for (const key of ['laji', 'matka', 'allas', 'jarjestys']) filters[key].addEventListener('change', render);
limitDates(editForm);
load();
