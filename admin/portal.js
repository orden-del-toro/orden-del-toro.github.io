(() => {
  'use strict';
  const form = document.getElementById('loginForm'), button = document.getElementById('connect');
  const input = document.getElementById('credential'), status = document.getElementById('loginStatus');
  const frame = document.getElementById('adminFrame');
  let session = null, channel = null, frameConnected = false;
  window.addEventListener('message', event => {
    if(event.source!==frame.contentWindow||event.data?.type!=='odt-admin-ready'||!channel||frameConnected)return;
    frameConnected=true;
    frame.dataset.connected='true';
    frame.contentWindow.postMessage({type:'odt-admin-connect'},'*',[channel.port2]);
  });
  function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
  function signOut() {
    channel?.port1.close(); channel = null; session = null; frameConnected = false;
    frame.removeAttribute('srcdoc');
    input.value = '';
    document.getElementById('workspace').hidden = true;
    document.getElementById('login').hidden = false;
    button.disabled = false; message('Sesión cerrada.');
  }
  document.getElementById('signOut').addEventListener('click', signOut);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (button.disabled) return;
    const token = input.value.trim(); input.value = '';
    if (!token.startsWith('github_pat_')) return message('Usá una credencial de acceso detallado de GitHub; el enlace de configuración está abajo.', true);
    button.disabled = true; message('Verificando tu cuenta y cargando el administrador privado…');
    try {
      const candidate = ODTMobileGitHub.createSession(ODTMobileGitHub.createApi(token));
      const { html, account } = await candidate.connect();
      session = candidate;
      document.getElementById('account').textContent = account;
      document.getElementById('login').hidden = true;
      document.getElementById('workspace').hidden = false;
      channel?.port1.close(); channel = new MessageChannel(); frameConnected = false;
      const current = channel, currentSession = session;
      current.port1.onmessage = async ({ data }) => {
        if (channel !== current || !data || typeof data.id !== 'number') return;
        try {
          const result = data.op === 'request' ? await currentSession.request(data.args)
            : data.op === 'asset' ? await currentSession.asset(data.args?.path) : (() => { throw new Error('Operación no permitida.'); })();
          if (channel === current) current.port1.postMessage({ id: data.id, result });
        } catch (error) {
          if (channel === current) current.port1.postMessage({ id: data.id, error: error.message || 'No se pudo completar la operación.' });
        }
      };
      current.port1.start();
      frame.srcdoc = html;
      message('');
    } catch (error) { session = null; message(error.message || 'No se pudo abrir Admin.', true); }
    finally { button.disabled = false; }
  });
  // No se persisten credenciales en cookies, almacenamiento local ni direcciones URL.
  window.addEventListener('pagehide', () => { channel?.port1.close(); channel = null; session = null; frame.removeAttribute('srcdoc'); });
})();
