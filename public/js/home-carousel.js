const carousel = document.getElementById('carousel');

if (carousel && carousel.children.length > 1) {
  const carouselContainer = document.getElementById('newsCarousel');
  const slides = carousel.children.length;
  const dots = [...document.querySelectorAll('[data-carousel-index]')];
  const counter = document.getElementById('newsCarouselCounter');
  const autoplayButton = document.getElementById('carouselAutoplay');
  const autoplayLabel = autoplayButton?.querySelector('[data-carousel-autoplay-label]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let autoplay;
  let autoplayPaused = reducedMotion.matches;

  const showSlide = (nextIndex) => {
    index = (nextIndex + slides) % slides;
    carousel.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
    });
    counter.textContent = `${index + 1} / ${slides}`;
  };

  const updateAutoplayButton = () => {
    autoplayButton?.setAttribute('aria-pressed', String(autoplayPaused));
    if (autoplayLabel) autoplayLabel.textContent = autoplayPaused ? 'Lecture' : 'Pause';
  };

  const stopAutoplay = () => window.clearInterval(autoplay);
  const startAutoplay = () => {
    stopAutoplay();
    if (autoplayPaused || document.hidden) return;
    autoplay = window.setInterval(() => showSlide(index + 1), 6000);
  };

  const pauseAfterInteraction = () => {
    autoplayPaused = true;
    stopAutoplay();
    updateAutoplayButton();
  };

  document.getElementById('next')?.addEventListener('click', () => {
    showSlide(index + 1);
    pauseAfterInteraction();
  });
  document.getElementById('prev')?.addEventListener('click', () => {
    showSlide(index - 1);
    pauseAfterInteraction();
  });
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      showSlide(Number(dot.dataset.carouselIndex));
      pauseAfterInteraction();
    });
  });

  autoplayButton?.addEventListener('click', () => {
    autoplayPaused = !autoplayPaused;
    updateAutoplayButton();
    startAutoplay();
  });

  carouselContainer.addEventListener('mouseenter', stopAutoplay);
  carouselContainer.addEventListener('mouseleave', startAutoplay);
  carouselContainer.addEventListener('focusin', stopAutoplay);
  carouselContainer.addEventListener('focusout', (event) => {
    if (!carouselContainer.contains(event.relatedTarget)) startAutoplay();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });
  reducedMotion.addEventListener('change', (event) => {
    autoplayPaused = event.matches;
    updateAutoplayButton();
    startAutoplay();
  });
  updateAutoplayButton();
  startAutoplay();
}
