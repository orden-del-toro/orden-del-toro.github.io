(function () {
  'use strict';

  const root = document.getElementById('app');
  const pages = [
    ['home', 'pages/home.html'],
    ['roster', 'pages/roster.html'],
    ['raid', 'pages/raid.html'],
    ['guides', 'pages/guides.html'],
    ['recruitment', 'pages/recruitment.html'],
    ['media', 'pages/media.html'],
    ['about', 'pages/about.html']
  ];

  async function fetchText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
  }

  function appendHtml(target, html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    target.appendChild(template.content.cloneNode(true));
  }

  async function loadProject() {
    try {
      const iconsHtml = await fetchText('partials/icons.html');

      const iconsTemplate = document.createElement('template');
      iconsTemplate.innerHTML = iconsHtml.trim();

      document.body.insertBefore(
        iconsTemplate.content.cloneNode(true),
        document.body.firstChild
      );

      for (const [, file] of pages) {
        appendHtml(root, await fetchText(file));
      }

      appendHtml(document.body, await fetchText('partials/overlays.html'));
      appendHtml(document.body, await fetchText('partials/footer.html'));

      await loadScript('js/guide-patches.js?v=20261113-fixed-guide-size');
      await loadScript('js/app.js?v=20261121-media-paragraphs');
      await loadScript('js/firebase.js');
      await loadScript('js/navigation.js');
      await loadScript('js/gear.js');
      await loadScript('js/community.js?v=20261006-3');
    } catch (error) {
      console.error('[ODT] No se pudo cargar el proyecto modular:', error);
      root.innerHTML = '<div style="padding:40px;color:#e6c989;font-family:Inter,sans-serif">No se pudo cargar la interfaz. Revisa que el sitio esté servido por HTTP/HTTPS y no abierto directamente como archivo local.</div>';
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(script);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProject, { once: true });
  } else {
    loadProject();
  }
})();
