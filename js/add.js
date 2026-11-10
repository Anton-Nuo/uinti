import { addResult, formToResult, limitDates, today, showMessage } from './api.js';

const form = document.querySelector('#lisayslomake');
limitDates(form);
form.elements.pvm.value = today();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await addResult(formToResult(form));
    form.reset();
    form.elements.pvm.value = today();
    showMessage('Aika tallennettu! Näet sen tuloslistassa.');
  } catch (error) {
    showMessage(`Tallennus epäonnistui: ${error.message}`, true);
  }
});
