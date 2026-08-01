document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll('[data-submit-on-change]').forEach((field) => {
  field.addEventListener('change', () => field.form?.requestSubmit());
});
