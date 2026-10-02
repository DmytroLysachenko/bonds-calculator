export const THEME_STORAGE_KEY = 'bonds-calculator-theme';

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  try {
    const stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const resolved = theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : theme === 'system' ? 'light' : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  } catch {}
})();`;
