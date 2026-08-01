document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('authModal');
  const openButtons = [document.getElementById('btnConnexion'), document.getElementById('btnConnexionMobile')];
  const registerButtons = [document.getElementById('btnInscription'), document.getElementById('btnInscriptionMobile')];
  const closeButton = document.getElementById('closeModal');
  const loginTab = document.getElementById('tabConnexion');
  const registerTab = document.getElementById('tabInscription');
  const loginContent = document.getElementById('contentConnexion');
  const registerContent = document.getElementById('contentInscription');
  const dialogContent = modal?.querySelector('[data-auth-dialog-content]');
  const pageRegions = [
    document.querySelector('header'),
    document.querySelector('main'),
    document.querySelector('footer'),
  ].filter(Boolean);
  const activeTabClasses = ['border-fantasy-gold', 'text-fantasy-gold', 'bg-fantasy-brown/50'];
  const inactiveTabClasses = ['border-transparent', 'text-fantasy-gold-light', 'bg-fantasy-darkest/30'];
  let previouslyFocusedElement = null;

  if (!modal || !loginTab || !registerTab) return;

  function openModal(tab = 'login') {
    previouslyFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    pageRegions.forEach((region) => { region.inert = true; });
    document.body.style.overflow = 'hidden';
    if (tab === 'register') registerTab.click();
    else loginTab.click();
    window.requestAnimationFrame(() => {
      const firstField = tab === 'register'
        ? document.getElementById('registerPrenom')
        : document.getElementById('loginEmail');
      (firstField || dialogContent)?.focus();
    });
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    pageRegions.forEach((region) => { region.inert = false; });
    document.body.style.overflow = '';
    previouslyFocusedElement?.focus();
    previouslyFocusedElement = null;
  }

  openButtons.filter(Boolean).forEach((button) => button.addEventListener('click', () => openModal()));
  registerButtons.filter(Boolean).forEach((button) => button.addEventListener('click', () => openModal('register')));
  document.querySelectorAll('[data-open-auth]').forEach((button) => {
    button.addEventListener('click', () => openModal(button.dataset.openAuth === 'register' ? 'register' : 'login'));
  });
  closeButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

  function setTabState(activeTab, inactiveTab, activeContent, inactiveContent) {
    activeTab.classList.remove(...inactiveTabClasses);
    activeTab.classList.add(...activeTabClasses);
    inactiveTab.classList.remove(...activeTabClasses);
    inactiveTab.classList.add(...inactiveTabClasses);
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.tabIndex = 0;
    inactiveTab.setAttribute('aria-selected', 'false');
    inactiveTab.tabIndex = -1;
    activeContent.hidden = false;
    inactiveContent.hidden = true;
  }

  loginTab.addEventListener('click', () => {
    setTabState(loginTab, registerTab, loginContent, registerContent);
  });

  registerTab.addEventListener('click', () => {
    setTabState(registerTab, loginTab, registerContent, loginContent);
  });

  [loginTab, registerTab].forEach((tab, index, tabs) => {
    tab.addEventListener('keydown', (event) => {
      let targetIndex = null;
      if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = tabs.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      tabs[targetIndex].click();
      tabs[targetIndex].focus();
    });
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusableElements = [...modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.closest('[hidden]'));
    if (!focusableElements.length) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  const password = document.getElementById('registerPassword');
  const confirmation = document.getElementById('registerPasswordConfirm');
  confirmation?.addEventListener('input', () => {
    confirmation.setCustomValidity(password.value === confirmation.value ? '' : 'Les mots de passe ne correspondent pas.');
  });

  const requestedTab = new URLSearchParams(window.location.search).get('auth');
  if (requestedTab === 'login' || requestedTab === 'register') openModal(requestedTab);
  window.openModalInscription = () => openModal('register');
});
