(() => {
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  const meta = document.getElementById('themeColor');
  const media = matchMedia('(prefers-color-scheme: dark)');
  const labels = {
    en: { system: 'System appearance', light: 'Light appearance', dark: 'Dark appearance' },
    hr: { system: 'Izgled sustava', light: 'Svijetli izgled', dark: 'Tamni izgled' }
  };
  let preference = localStorage.getItem('still-theme') || 'system';
  const language = () => localStorage.getItem('still-lang') === 'hr' ? 'hr' : 'en';
  const actual = () => preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;

  function paint() {
    const appearance = actual();
    root.dataset.theme = appearance;
    root.dataset.themePreference = preference;
    root.style.colorScheme = appearance;
    meta?.setAttribute('content', appearance === 'dark' ? '#151d2a' : '#e9f0f5');
    if (!button) return;
    button.textContent = preference === 'system' ? '◐' : preference === 'dark' ? '☾' : '☀';
    button.title = labels[language()][preference];
    button.setAttribute('aria-label', labels[language()][preference]);
  }

  function cycle() {
    preference = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    localStorage.setItem('still-theme', preference);
    paint();
  }

  button?.addEventListener('click', cycle);
  media.addEventListener?.('change', () => { if (preference === 'system') paint(); });
  document.getElementById('language')?.addEventListener('change', () => setTimeout(paint, 0));
  paint();
})();
