import { getResults, formatTime, showMessage, el } from './api.js';

const listEl = document.querySelector('#ranking');
const selects = ['laji', 'matka', 'allas'].map((name) => document.querySelector(`#ranking-${name}`));
let results = [];

// Jokaisen uimarin paras aika valitussa lajissa
function personalBests() {
  const [laji, matka, allas] = selects.map((s) => s.value);
  const bests = results
    .filter((r) => r.laji === laji && r.matka === Number(matka) && r.allas === Number(allas))
    .reduce((map, r) => {
      const key = `${r.uimari.toLowerCase()}-${r.syntymavuosi}`;
      if (!map.has(key) || r.aika < map.get(key).aika) map.set(key, r);
      return map;
    }, new Map());
  return [...bests.values()].sort((a, b) => a.aika - b.aika);
}

function render() {
  const items = personalBests().map((r, index) => el('li', {},
    el('span', { className: 'sija' }, `${index + 1}.`),
    el('span', {}, el('strong', {}, r.uimari), el('br'), el('span', { className: 'meta' }, `${r.seura} · ${new Date(r.pvm).toLocaleDateString('fi-FI')}`)),
    el('span', { className: 'time' }, formatTime(r.aika)),
  ));
  listEl.replaceChildren(...(items.length ? items : [el('li', {}, 'Tällä valinnalla ei ole vielä aikoja.')]));
}

async function load() {
  try {
    results = await getResults();
    render();
  } catch (error) {
    listEl.replaceChildren(el('li', {}, 'Ennätysten haku epäonnistui.'));
    showMessage(error.message, true);
  }
}

selects.forEach((s) => s.addEventListener('change', render));
load();
