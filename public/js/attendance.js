const attendanceBoxes = document.querySelectorAll('input[name="attendedPlayerIds"]');

document.getElementById('checkAll')?.addEventListener('click', () => {
  attendanceBoxes.forEach((box) => { box.checked = true; });
});
document.getElementById('uncheckAll')?.addEventListener('click', () => {
  attendanceBoxes.forEach((box) => { box.checked = false; });
});
document.querySelectorAll('[data-cancel-registration]').forEach((button) => {
  button.addEventListener('click', (event) => {
    const message = `Confirmer l’annulation de l’inscription de ${button.dataset.playerLabel} ?\n\nVous devrez prévenir cette personne à l’adresse ${button.dataset.playerEmail}.`;
    if (!window.confirm(message)) event.preventDefault();
  });
});
