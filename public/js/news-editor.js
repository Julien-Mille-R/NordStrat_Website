(() => {
  const form = document.getElementById('news-editor-form');
  const editor = document.getElementById('news-editor-content');
  const input = document.getElementById('news-editor-input');
  const counter = document.getElementById('news-editor-counter');
  const preview = document.getElementById('news-editor-preview');
  const previewContent = document.getElementById('news-editor-preview-content');

  if (!form || !editor || !input) return;

  let savedRange = null;

  const isRangeInsideEditor = (range) => (
    editor.contains(range.commonAncestorContainer)
  );

  const saveSelection = () => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (isRangeInsideEditor(range)) {
      savedRange = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedRange) {
      editor.focus();
      return false;
    }

    const selection = window.getSelection();

    editor.focus();

    selection.removeAllRanges();
    selection.addRange(savedRange);

    return true;
  };

  const updateInput = () => {
    input.value = editor.innerHTML.trim();

    const text = editor.innerText.replace(/\u00a0/g, ' ').trim();

    if (counter) {
      counter.textContent =
        `${text.length.toLocaleString('fr-FR')} caractère${text.length > 1 ? 's' : ''}`;
    }
  };

  /*
   * Retourne le bloc principal contenant un nœud.
   *
   * Exemple :
   * <p>Bonjour <strong>Jean</strong></p>
   *                  ↑
   *              retourne <p>
   */
  const getBlockElement = (node) => {
    if (!node) return null;

    let element = node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node;

    while (element && element !== editor) {
      const tag = element.tagName?.toLowerCase();

      if (
        [
          'p',
          'div',
          'h2',
          'h3',
          'blockquote',
          'li',
        ].includes(tag)
      ) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  };

  /*
   * Récupère les blocs concernés par la sélection.
   */
  const getSelectedBlocks = () => {
    if (!savedRange) return [];

    const range = savedRange;

    if (!isRangeInsideEditor(range)) {
      return [];
    }

    const blocks = [];
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_ELEMENT,
    );

    let currentNode = walker.nextNode();

    while (currentNode) {
      const tag = currentNode.tagName?.toLowerCase();

      if (
        [
          'p',
          'div',
          'h2',
          'h3',
          'blockquote',
          'li',
        ].includes(tag)
      ) {
        try {
          if (
            range.intersectsNode(currentNode)
            && !blocks.includes(currentNode)
          ) {
            blocks.push(currentNode);
          }
        } catch {
          // Ignore les nœuds qui ne peuvent pas être testés.
        }
      }

      currentNode = walker.nextNode();
    }

    /*
     * Si la sélection est simplement à l'intérieur d'un bloc,
     * intersectionsNode() peut ne pas toujours suffire.
     */
    if (blocks.length === 0) {
      const startBlock = getBlockElement(range.startContainer);

      if (startBlock) {
        blocks.push(startBlock);
      }
    }

    return blocks;
  };

  /*
   * Applique un titre H2 ou H3 aux blocs sélectionnés.
   */
  const formatSelectedBlocks = (tagName) => {
    if (!restoreSelection()) {
      return;
    }

    const blocks = getSelectedBlocks();

    if (blocks.length === 0) {
      window.alert('Placez le curseur dans un paragraphe ou sélectionnez du texte.');
      return;
    }

    blocks.forEach((block) => {
      if (block === editor) return;

      const newBlock = document.createElement(tagName);

      while (block.firstChild) {
        newBlock.appendChild(block.firstChild);
      }

      block.replaceWith(newBlock);
    });

    updateInput();
    saveSelection();
  };

  /*
   * Transforme les blocs sélectionnés en liste.
   */
  const formatSelectedList = (listType) => {
    if (!restoreSelection()) {
        return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (!isRangeInsideEditor(range)) {
        return;
    }

    if (range.collapsed) {
        window.alert(
        'Placez le curseur dans une ligne ou sélectionnez les lignes à mettre en liste.',
        );
        return;
    }

    const command = listType === 'ol'
        ? 'insertOrderedList'
        : 'insertUnorderedList';

    const success = document.execCommand(command, false, null);

    if (!success) {
        console.warn(`La commande ${command} n'a pas pu être exécutée.`);
        return;
    }

    updateInput();
    saveSelection();
  };

  const createLink = () => {
    restoreSelection();

    const url = window.prompt('Adresse du lien :');

    if (!url) {
      return;
    }

    const trimmedUrl = url.trim();

    if (
      !/^https?:\/\//i.test(trimmedUrl)
      && !/^mailto:/i.test(trimmedUrl)
    ) {
      window.alert('Le lien doit commencer par https:// ou mailto:');
      return;
    }

    document.execCommand('createLink', false, trimmedUrl);

    updateInput();
    saveSelection();
  };

  /*
   * Sauvegarde la sélection lorsque l'utilisateur travaille
   * dans l'éditeur.
   */
  editor.addEventListener('mouseup', saveSelection);
  editor.addEventListener('keyup', saveSelection);

  editor.addEventListener('input', () => {
    saveSelection();
    updateInput();
  });

  /*
   * Gestion des boutons de la toolbar.
   */
  document.querySelectorAll('[data-editor-command]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      saveSelection();

      /*
       * Empêche le bouton de prendre le focus et donc de perdre
       * la sélection dans l'éditeur.
       */
      event.preventDefault();
    });

    button.addEventListener('click', () => {
      const command = button.dataset.editorCommand;
      const value = button.dataset.editorValue || null;

      /*
       * H2 / H3 :
       * gestion directe des blocs plutôt que formatBlock().
       */
      if (command === 'formatBlock' && value === 'h2') {
        formatSelectedBlocks('h2');
        return;
      }

      if (command === 'formatBlock' && value === 'h3') {
        formatSelectedBlocks('h3');
        return;
      }

      /*
       * Listes :
       * gestion directe des blocs.
       */
      if (command === 'insertUnorderedList') {
        formatSelectedList('ul');
        return;
      }

      if (command === 'insertOrderedList') {
        formatSelectedList('ol');
        return;
      }

      restoreSelection();

      if (command === 'createLink') {
        createLink();
        return;
      }

      const success = document.execCommand(command, false, value);

      if (!success) {
        console.warn(`La commande ${command} n'a pas pu être exécutée.`);
      }

      updateInput();
      saveSelection();
    });
  });

  /*
   * Gestion du collage.
   */
  editor.addEventListener('paste', () => {
    window.setTimeout(() => {
      updateInput();
      saveSelection();
    }, 0);
  });

  /*
   * Aperçu.
   */
  document
    .querySelector('[data-editor-action="preview"]')
    ?.addEventListener('click', () => {
      updateInput();

      previewContent.innerHTML = editor.innerHTML;
      preview.classList.remove('hidden');
      preview.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden');
    });

  document
    .querySelector('[data-editor-action="close-preview"]')
    ?.addEventListener('click', () => {
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

  /*
   * Avant envoi, synchronise toujours le HTML avec le textarea.
   */
  form.addEventListener('submit', () => {
    updateInput();
  });

  updateInput();
})();