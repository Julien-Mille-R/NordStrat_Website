document.querySelectorAll('[data-game-select]').forEach((select) => {
  const preview = document.getElementById(select.getAttribute('aria-controls'));
  const image = preview?.querySelector('[data-game-preview-image]');
  const placeholder = preview?.querySelector('[data-game-preview-placeholder]');
  if (!preview || !image || !placeholder) return;

  function updatePreview() {
    const selectedOption = select.options[select.selectedIndex];
    const imageUrl = selectedOption?.dataset.imageUrl || '';
    image.src = imageUrl;
    image.classList.toggle('hidden', !imageUrl);
    placeholder.classList.toggle('hidden', Boolean(imageUrl));
  }

  select.addEventListener('change', updatePreview);
  updatePreview();
});
