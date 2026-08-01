let validationSummaryScheduled = false;
let generatedFieldId = 0;

function fieldLabel(field) {
  const label = field.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim();
  return label || field.getAttribute('aria-label') || field.name || 'Champ';
}

function ensureFieldId(field) {
  if (!field.id) {
    generatedFieldId += 1;
    field.id = `formField-${generatedFieldId}`;
  }
  return field.id;
}

function removeValidationSummary(form) {
  form.querySelector('[data-validation-summary]')?.remove();
}

function showValidationSummary(form) {
  validationSummaryScheduled = false;
  removeValidationSummary(form);
  const invalidFields = [...form.querySelectorAll(':invalid')]
    .filter((field) => field.type !== 'hidden');
  if (!invalidFields.length) return;

  const summary = document.createElement('div');
  summary.dataset.validationSummary = '';
  summary.tabIndex = -1;
  summary.setAttribute('role', 'alert');
  summary.className = 'mb-5 rounded-lg border-2 border-fantasy-red bg-fantasy-red/10 p-4 text-fantasy-gold-light';

  const title = document.createElement('p');
  title.className = 'font-bold text-fantasy-gold';
  title.textContent = invalidFields.length > 1
    ? `${invalidFields.length} champs doivent être vérifiés.`
    : 'Un champ doit être vérifié.';
  summary.append(title);

  const list = document.createElement('ul');
  list.className = 'mt-2 list-disc space-y-1 pl-5';
  invalidFields.forEach((field) => {
    field.setAttribute('aria-invalid', 'true');
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${ensureFieldId(field)}`;
    link.className = 'underline decoration-fantasy-orange underline-offset-2';
    link.textContent = `${fieldLabel(field)} : ${field.validationMessage}`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      field.focus();
    });
    item.append(link);
    list.append(item);
  });
  summary.append(list);
  form.prepend(summary);
  summary.focus();
}

document.addEventListener('invalid', (event) => {
  const form = event.target.form;
  if (!form || validationSummaryScheduled) return;
  validationSummaryScheduled = true;
  window.setTimeout(() => showValidationSummary(form), 0);
}, true);

document.addEventListener('input', (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)
    && !(field instanceof HTMLTextAreaElement)
    && !(field instanceof HTMLSelectElement)) return;
  if (field.validity.valid) field.removeAttribute('aria-invalid');
});

document.querySelectorAll('form[data-presence-required]').forEach((form) => {
  const saturday = form.elements.presentSaturday;
  const sunday = form.elements.presentSunday;
  const updatePresenceValidity = () => {
    const valid = saturday.checked || sunday.checked;
    saturday.setCustomValidity(valid ? '' : 'Sélectionnez au moins un jour de présence.');
  };
  saturday.addEventListener('change', updatePresenceValidity);
  sunday.addEventListener('change', updatePresenceValidity);
  form.addEventListener('submit', (event) => {
    updatePresenceValidity();
    if (!saturday.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
});
