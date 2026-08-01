const submittingForms = new WeakMap();

function submissionLabel(form, submitter) {
  if (submitter?.dataset.loadingText) return submitter.dataset.loadingText;
  if (form.enctype === 'multipart/form-data') return 'Téléversement en cours…';
  return 'Traitement en cours…';
}

function submitControls(form) {
  return [...form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]')];
}

function showSubmittingState(form, submitter, state) {
  if (!form.isConnected || !submittingForms.has(form)) return;

  form.setAttribute('aria-busy', 'true');
  submitControls(form).forEach((control) => {
    control.setAttribute('aria-disabled', 'true');
    control.classList.add('submission-control-locked');
  });

  if (submitter instanceof HTMLButtonElement) {
    const spinner = document.createElement('span');
    spinner.className = 'submission-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = submissionLabel(form, submitter);
    submitter.replaceChildren(spinner, label);
    submitter.classList.add('submission-button-active');
  } else if (submitter instanceof HTMLInputElement) {
    submitter.value = submissionLabel(form, submitter);
  }

  state.status.textContent = submissionLabel(form, submitter);
}

function resetSubmittingState(form) {
  const state = submittingForms.get(form);
  if (!state) return;

  window.clearTimeout(state.visualTimer);
  form.removeAttribute('aria-busy');
  submitControls(form).forEach((control) => {
    control.removeAttribute('aria-disabled');
    control.classList.remove('submission-control-locked', 'submission-button-active');
  });

  if (state.submitter instanceof HTMLButtonElement) {
    state.submitter.replaceChildren(
      ...state.originalContent.map((node) => node.cloneNode(true)),
    );
  } else if (state.submitter instanceof HTMLInputElement) {
    state.submitter.value = state.originalValue;
  }

  state.status.remove();
  submittingForms.delete(form);
}

document.querySelectorAll('form[method="POST" i]:not([data-no-loading])').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (submittingForms.has(form)) {
      event.preventDefault();
      return;
    }

    const submitter = event.submitter
      || form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');

    queueMicrotask(() => {
      if (event.defaultPrevented || submittingForms.has(form)) return;

      const status = document.createElement('span');
      status.className = 'sr-only';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = submissionLabel(form, submitter);
      form.append(status);

      const state = {
        submitter,
        status,
        originalContent: submitter instanceof HTMLButtonElement
          ? [...submitter.childNodes].map((node) => node.cloneNode(true))
          : [],
        originalValue: submitter instanceof HTMLInputElement ? submitter.value : '',
        visualTimer: null,
      };
      submittingForms.set(form, state);

      // Le blocage est immédiat, l’animation ne s’affiche que si la réponse tarde.
      form.setAttribute('aria-busy', 'true');
      submitControls(form).forEach((control) => {
        control.setAttribute('aria-disabled', 'true');
      });
      state.visualTimer = window.setTimeout(
        () => showSubmittingState(form, submitter, state),
        350,
      );
    });
  });
});

window.addEventListener('pageshow', () => {
  document.querySelectorAll('form[aria-busy="true"]').forEach(resetSubmittingState);
});
