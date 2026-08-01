const memberDialogOpeners = new Map();

document.querySelectorAll('[data-open-member]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(`memberDialog-${button.dataset.openMember}`);
    if (!dialog) return;
    memberDialogOpeners.set(dialog.id, button);
    dialog.showModal();
  });
});

document.querySelectorAll('[data-close-member]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`memberDialog-${button.dataset.closeMember}`)?.close();
  });
});

document.querySelectorAll('dialog[id^="memberDialog-"]').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => memberDialogOpeners.get(dialog.id)?.focus());
});
