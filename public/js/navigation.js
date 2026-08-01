document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mobileNavigation = document.getElementById('mobileNavigation');
  const openIcon = mobileToggle?.querySelector('[data-menu-open-icon]');
  const closeIcon = mobileToggle?.querySelector('[data-menu-close-icon]');
  const desktopDropdowns = [...document.querySelectorAll('[data-nav-dropdown]')];

  function closeDesktopDropdowns(except = null) {
    desktopDropdowns.forEach((dropdown) => {
      if (dropdown === except) return;
      dropdown.querySelector('[data-dropdown-panel]')?.classList.add('hidden');
      const toggle = dropdown.querySelector('[data-dropdown-toggle]');
      toggle?.setAttribute('aria-expanded', 'false');
      dropdown.querySelector('[data-dropdown-chevron]')?.classList.remove('rotate-180');
    });
  }

  desktopDropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector('[data-dropdown-toggle]');
    const panel = dropdown.querySelector('[data-dropdown-panel]');
    const chevron = dropdown.querySelector('[data-dropdown-chevron]');

    toggle?.addEventListener('click', () => {
      const willOpen = panel.classList.contains('hidden');
      closeDesktopDropdowns(willOpen ? dropdown : null);
      panel.classList.toggle('hidden', !willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
      chevron?.classList.toggle('rotate-180', willOpen);
    });
  });

  function setMobileMenu(open) {
    if (!mobileToggle || !mobileNavigation) return;
    mobileNavigation.classList.toggle('hidden', !open);
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    openIcon?.classList.toggle('hidden', open);
    closeIcon?.classList.toggle('hidden', !open);
  }

  mobileToggle?.addEventListener('click', () => {
    setMobileMenu(mobileToggle.getAttribute('aria-expanded') !== 'true');
  });

  document.querySelectorAll('[data-mobile-submenu-toggle]').forEach((toggle) => {
    const submenu = document.getElementById(toggle.getAttribute('aria-controls'));
    const chevron = toggle.querySelector('[data-submenu-chevron]');
    toggle.addEventListener('click', () => {
      const willOpen = submenu.classList.contains('hidden');
      submenu.classList.toggle('hidden', !willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
      chevron?.classList.toggle('rotate-180', willOpen);
    });
  });

  mobileNavigation?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMobileMenu(false));
  });

  header?.addEventListener('click', (event) => {
    if (event.target.closest('#btnConnexionMobile, #btnInscriptionMobile')) {
      setMobileMenu(false);
    }
  });

  document.addEventListener('click', (event) => {
    if (!header?.contains(event.target)) {
      closeDesktopDropdowns();
      setMobileMenu(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeDesktopDropdowns();
    setMobileMenu(false);
    mobileToggle?.focus();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1280) setMobileMenu(false);
  });
});
