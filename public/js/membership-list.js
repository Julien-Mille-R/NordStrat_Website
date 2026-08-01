const membershipSearch = document.getElementById('membershipSearch');
const membershipStatusFilter = document.getElementById('membershipStatusFilter');
const membershipRows = [...document.querySelectorAll('.membership-row')];
const membershipEmptyState = document.getElementById('membershipEmptyState');
const membershipDialogOpeners = new Map();

function filterMembershipRows() {
  const query = membershipSearch.value.trim().toLocaleLowerCase('fr-FR');
  const selectedStatus = membershipStatusFilter.value;
  let visibleRows = 0;

  membershipRows.forEach((row) => {
    const matchesSearch = !query || row.dataset.search.includes(query);
    const matchesStatus = !selectedStatus || row.dataset.status === selectedStatus;
    const visible = matchesSearch && matchesStatus;
    row.classList.toggle('hidden', !visible);
    if (visible) visibleRows += 1;
  });
  membershipEmptyState.classList.toggle('hidden', visibleRows !== 0);
}

membershipSearch?.addEventListener('input', filterMembershipRows);
membershipStatusFilter?.addEventListener('change', filterMembershipRows);

document.querySelectorAll('[data-open-membership]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(`membershipDialog-${button.dataset.openMembership}`);
    if (!dialog) return;
    membershipDialogOpeners.set(dialog.id, button);
    dialog.showModal();
  });
});

document.querySelectorAll('[data-close-membership]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`membershipDialog-${button.dataset.closeMembership}`)?.close();
  });
});

document.querySelectorAll('dialog[id^="membershipDialog-"]').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => membershipDialogOpeners.get(dialog.id)?.focus());
});

document.querySelectorAll('.membership-form').forEach((form) => {
  const statusInput = form.elements.status;
  const paymentMethodInput = form.elements.paymentMethod;

  function updatePaymentMethodState() {
    const paymentRequired = statusInput.value === 'paid';
    paymentMethodInput.disabled = !paymentRequired;
    paymentMethodInput.required = paymentRequired;
    if (!paymentRequired) paymentMethodInput.value = '';
  }

  statusInput.addEventListener('change', updatePaymentMethodState);
  updatePaymentMethodState();

  form.addEventListener('submit', (event) => {
    const nextStatus = statusInput.value;
    const previousStatus = form.dataset.currentStatus;
    const removesPayment = ['paid', 'exempted'].includes(previousStatus)
      && ['unpaid', 'cancelled'].includes(nextStatus);
    if (removesPayment && !window.confirm('Confirmer le retrait de l’état cotisé pour ce membre ?')) {
      event.preventDefault();
    }
  });
});
