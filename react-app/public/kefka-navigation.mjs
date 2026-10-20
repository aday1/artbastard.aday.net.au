// Preserve both surfaces so navigation does not unload controller state.
if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  try {
    const response = await fetch('/api/kefka/surfaces', { cache: 'no-store' });
    if (response.ok && (await response.json()).enabled === true) {
      for (const link of document.querySelectorAll('[data-open-console]')) {
        link.addEventListener('click', async event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          try {
            const result = await fetch('/api/kefka/surfaces/console', { method: 'POST' });
            if (!result.ok) throw new Error('Launch failed');
          } catch {
            document.querySelector('#notice').textContent =
              'Could not open the full console. Try the ArtBastard Console launcher.';
          }
        });
      }
    }
  } catch {
    // A regular link still opens a separate console when the launcher is absent.
  }
}
