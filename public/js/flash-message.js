document.addEventListener('DOMContentLoaded', () => {
  const flashMessage = document.getElementById('flashMessage');
  if (!flashMessage) return;

  const closeButton = flashMessage.querySelector('[data-flash-close]');
  const progress = flashMessage.querySelector('[data-flash-progress]');
  const displayDuration = 5000;
  let removalTimer;
  let remainingDuration = displayDuration;
  let timerStartedAt;

  function removeFlashMessage() {
    window.clearTimeout(removalTimer);
    flashMessage.classList.add('opacity-0', '-translate-y-3', 'pointer-events-none');
    flashMessage.classList.remove('opacity-100', 'translate-y-0');
    window.setTimeout(() => flashMessage.remove(), 300);
  }

  function pauseRemovalTimer() {
    if (!removalTimer) return;
    window.clearTimeout(removalTimer);
    removalTimer = null;
    remainingDuration -= Date.now() - timerStartedAt;
    if (progress) {
      progress.style.width = window.getComputedStyle(progress).width;
      progress.style.transition = 'none';
    }
  }

  function startRemovalTimer() {
    if (flashMessage.dataset.autoDismiss !== 'true' || removalTimer) return;
    timerStartedAt = Date.now();
    if (progress) {
      progress.style.transition = `width ${Math.max(remainingDuration, 0)}ms linear`;
      window.requestAnimationFrame(() => {
        progress.style.width = '0%';
      });
    }
    removalTimer = window.setTimeout(removeFlashMessage, Math.max(remainingDuration, 0));
  }

  window.requestAnimationFrame(() => {
    flashMessage.classList.remove('opacity-0', '-translate-y-3');
    flashMessage.classList.add('opacity-100', 'translate-y-0');

  });

  closeButton?.addEventListener('click', removeFlashMessage);
  flashMessage.addEventListener('mouseenter', pauseRemovalTimer);
  flashMessage.addEventListener('mouseleave', startRemovalTimer);
  flashMessage.addEventListener('focusin', pauseRemovalTimer);
  flashMessage.addEventListener('focusout', startRemovalTimer);
  startRemovalTimer();
});
