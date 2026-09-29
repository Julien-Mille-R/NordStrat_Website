(() => {
  const form = document.getElementById('news-editor-form');
  const editor = document.getElementById('news-editor-content');
  const input = document.getElementById('news-editor-input');
  const counter = document.getElementById('news-editor-counter');
  const preview = document.getElementById('news-editor-preview');
  const previewContent = document.getElementById('news-editor-preview-content');

  if (!form || !editor || !input) return;

  const updateInput = () => {
    input.value = editor.innerHTML.trim();

    const text = editor.innerText.replace(/\u00a0/g, ' ').trim();

    if (counter) {
      counter.textContent = `${text.length.toLocaleString('fr-FR')} caractère${text.length > 1 ? 's' : ''}`;
    }
  };

  const restoreSelection = () => {
    editor.focus();
  };

  const createLink = () => {
    const url = window.prompt('Adresse du lien :');

    if (!url) return;

    const trimmedUrl = url.trim();

    if (!/^https?:\/\//i.test(trimmedUrl) && !/^mailto:/i.test(trimmedUrl)) {
      window.alert('Le lien doit commencer par https:// ou mailto:');
      return;
    }

    document.execCommand('createLink', false, trimmedUrl);
    updateInput();
  };

  document.querySelectorAll('[data-editor-command]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });

    button.addEventListener('click', () => {
      const command = button.dataset.editorCommand;
      const value = button.dataset.editorValue || null;

      restoreSelection();

      if (command === 'createLink') {
        createLink();
        return;
      }

      document.execCommand(command, false, value);
      updateInput();
    });
  });

  editor.addEventListener('input', updateInput);

  editor.addEventListener('paste', () => {
    window.setTimeout(updateInput, 0);
  });

  document.querySelector('[data-editor-action="preview"]')?.addEventListener('click', () => {
    updateInput();

    previewContent.innerHTML = editor.innerHTML;
    preview.classList.remove('hidden');
    preview.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
  });

  document.querySelector('[data-editor-action="close-preview"]')?.addEventListener('click', () => {
    preview.classList.add('hidden');
    preview.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
  });

  preview?.addEventListener('click', (event) => {
    if (event.target === preview) {
      preview.classList.add('hidden');
      preview.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
    }
  });

  form.addEventListener('submit', () => {
    updateInput();
  });

  updateInput();
})();