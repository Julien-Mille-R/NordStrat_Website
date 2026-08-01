const favoriteGameInputs = [...document.querySelectorAll('input[name="gameIds"]')];

function updateFavoriteGameInputs() {
  const selectedCount = favoriteGameInputs.filter((input) => input.checked).length;
  favoriteGameInputs.forEach((input) => {
    input.disabled = selectedCount >= 3 && !input.checked;
  });
}

favoriteGameInputs.forEach((input) => {
  input.addEventListener('change', updateFavoriteGameInputs);
});
updateFavoriteGameInputs();

const accountTabs = [...document.querySelectorAll('[data-account-tab]')];
const accountPanels = [...document.querySelectorAll('[data-account-panel]')];

function activateAccountTab(tabKey, updateUrl = true) {
  if (!accountTabs.some((tab) => tab.dataset.accountTab === tabKey)) return;

  accountTabs.forEach((tab) => {
    const active = tab.dataset.accountTab === tabKey;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.classList.toggle('bg-fantasy-gold', active);
    tab.classList.toggle('text-fantasy-darkest', active);
    tab.classList.toggle('text-fantasy-gold-light', !active);
  });

  accountPanels.forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== tabKey;
  });

  if (updateUrl) {
    window.history.replaceState(null, '', `#${tabKey}`);
  }
}

accountTabs.forEach((tab) => {
  tab.addEventListener('click', () => activateAccountTab(tab.dataset.accountTab));
  tab.addEventListener('keydown', (event) => {
    const currentIndex = accountTabs.indexOf(tab);
    let targetIndex = null;
    if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % accountTabs.length;
    if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + accountTabs.length) % accountTabs.length;
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = accountTabs.length - 1;
    if (targetIndex === null) return;
    event.preventDefault();
    const targetTab = accountTabs[targetIndex];
    activateAccountTab(targetTab.dataset.accountTab);
    targetTab.focus();
  });
});

accountTabs.forEach((tab, index) => { tab.tabIndex = index === 0 ? 0 : -1; });
const requestedAccountTab = window.location.hash.slice(1);
if (requestedAccountTab) activateAccountTab(requestedAccountTab, false);
