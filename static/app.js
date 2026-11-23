(() => {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  const saved = (() => { try { return localStorage.getItem('safa-theme'); } catch { return null; } })();
  const initial = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const update = (theme) => {
    root.dataset.theme = theme;
    if (button) { button.querySelector('.theme-icon').textContent = theme === 'light' ? '☾' : '☀'; button.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'); }
  };
  update(initial);
  button?.addEventListener('click', () => { const next = root.dataset.theme === 'light' ? 'dark' : 'light'; update(next); try { localStorage.setItem('safa-theme', next); } catch {} });
})();
