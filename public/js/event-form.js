const eventDate = document.querySelector('#event-date');
const registrationDeadline = document.querySelector('#registration-deadline');

function synchronizeDeadlineLimit() {
  if (!eventDate || !registrationDeadline) return;
  registrationDeadline.max = eventDate.value || '';
  if (eventDate.value && registrationDeadline.value >= eventDate.value) {
    registrationDeadline.setCustomValidity('La fin des inscriptions doit précéder la rencontre.');
  } else {
    registrationDeadline.setCustomValidity('');
  }
}

eventDate?.addEventListener('input', synchronizeDeadlineLimit);
registrationDeadline?.addEventListener('input', synchronizeDeadlineLimit);
synchronizeDeadlineLimit();
