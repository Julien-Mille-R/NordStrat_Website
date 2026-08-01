const workspace = document.getElementById('bookingWorkspace');
const discussionRegion = document.getElementById('bookingDiscussionRegion');
const discussionPanels = [...document.querySelectorAll('[data-discussion-panel]')];
const mobileDiscussionLayout = window.matchMedia('(max-width: 1023px)');
let activeDiscussionId = null;

function discussionTrigger(tableId) {
  return document.getElementById(`tableDiscussionTrigger-${tableId}`);
}

function setMobilePageLock(locked) {
  document.body.classList.toggle('overflow-hidden', locked && mobileDiscussionLayout.matches);
}

function openDiscussion(panel) {
  if (!workspace || !discussionRegion || !panel) return;

  discussionPanels.forEach((candidate) => {
    const isActive = candidate === panel;
    candidate.hidden = !isActive;
    discussionTrigger(candidate.dataset.discussionPanel)?.setAttribute('aria-expanded', String(isActive));
  });
  activeDiscussionId = panel.dataset.discussionPanel;
  discussionRegion.classList.add('is-open');
  setMobilePageLock(true);
  panel.focus({ preventScroll: true });
}

function closeDiscussion({ restoreFocus = true } = {}) {
  if (!workspace || !discussionRegion || !activeDiscussionId) return;

  const trigger = discussionTrigger(activeDiscussionId);
  discussionPanels.forEach((panel) => { panel.hidden = true; });
  trigger?.setAttribute('aria-expanded', 'false');
  discussionRegion.classList.remove('is-open');
  setMobilePageLock(false);

  const url = new URL(window.location.href);
  url.searchParams.delete('discussion');
  url.hash = '';
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  activeDiscussionId = null;
  if (restoreFocus) trigger?.focus({ preventScroll: true });
}

document.querySelectorAll('[data-close-discussion]').forEach((button) => {
  button.addEventListener('click', () => closeDiscussion());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeDiscussionId) closeDiscussion();
});

mobileDiscussionLayout.addEventListener('change', () => {
  setMobilePageLock(Boolean(activeDiscussionId));
});

const autoOpenPanel = discussionPanels.find((panel) => panel.hasAttribute('data-auto-open'));
if (autoOpenPanel) openDiscussion(autoOpenPanel);
