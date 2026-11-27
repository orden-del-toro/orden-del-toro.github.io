(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ODTMobileGitHub = api;
})(globalThis, function () {
  'use strict';
  const OWNER = 'orden-del-toro', PRIVATE = 'admin-privado', PUBLIC = 'orden-del-toro.github.io';
  const OWNER_ID = 356025641;
  const statePaths = { config: 'state/data.json', guides: 'state/guides.json', community: 'state/community.json', requests: 'state/solicitudes.json' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const validId = id => /^[a-zA-Z0-9_-]{1,100}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  const validAsset = file => /^uploads\/[a-zA-Z0-9_.-]+$/.test(file) && !file.includes('..');
  function base64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(binary);
  }
  const encode = text => base64(new TextEncoder().encode(text));
  const decode = data => Uint8Array.from(atob(data.replace(/\s/g, '')), char => char.charCodeAt(0));
  function normalize(value) {
    if (typeof value === 'string') return value.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/(uploads\/)/i, '$1').replace(/^\/(uploads\/)/, '$1');
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]));
    return value;
  }
  function publicCommunity(data) {
    return { guidePatches: data.guidePatches || {}, communityGuides: Object.fromEntries(Object.entries(data.communityGuides || {})
      .filter(([, guide]) => guide.status === 'published')
      .map(([id, { voterIds, authorId, reviewedBy, ...guide }]) => [id, guide])) };
  }
  function createApi(token, fetcher = fetch) {
    return async (method, endpoint, body, { raw = false } = {}) => {
      if (!endpoint.startsWith('/repos/' + OWNER + '/') && endpoint !== '/user') throw new Error('Operación de GitHub no permitida.');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await fetcher('https://api.github.com' + endpoint, { method, cache: 'no-store', credentials: 'omit', signal: controller.signal,
          headers: { Authorization: 'Bearer ' + token, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        if (!response.ok) {
          const message = response.status === 401 ? 'La credencial venció o no es válida. Volvé a ingresar.'
            : response.status === 403 ? 'GitHub denegó el acceso. Revisá los permisos de Contenidos y los dos repositorios seleccionados.'
            : response.status === 404 ? 'No se pudo acceder al repositorio privado. Revisá la cuenta y los repositorios autorizados.'
            : [409, 422].includes(response.status) ? 'Hay cambios de otra sesión. Recargá los datos antes de volver a guardar; tu edición sigue en el formulario.'
            : 'GitHub no pudo completar la operación. Reintentá cuando se restablezca la conexión.';
          const error = new Error(message); error.status = response.status; throw error;
        }
        return raw ? response.text() : response.status === 204 ? null : response.json();
      } finally { clearTimeout(timer); }
    };
  }
  function createSession(api) {
    let snapshot, cache = new Map(), queue = Promise.resolve(), publication = { state: 'idle' }, loadedConfig = false;
    const prefix = repo => `/repos/${OWNER}/${repo}`;
    async function getSnapshot(repo) {
      const ref = await api('GET', prefix(repo) + '/git/ref/heads/main');
      const commit = await api('GET', prefix(repo) + '/git/commits/' + ref.object.sha);
      const tree = await api('GET', prefix(repo) + '/git/trees/' + commit.tree.sha + '?recursive=1');
      if (tree.truncated) throw new Error('El inventario del repositorio es demasiado grande para cargarlo completo. No se guardó ningún cambio.');
      return { head: ref.object.sha, tree: commit.tree.sha, files: new Map(tree.tree.filter(item => item.type === 'blob').map(item => [item.path, item])) };
    }
    async function raw(file, version = snapshot) {
      if (!version.files.has(file)) throw new Error('Falta un archivo del administrador privado: ' + file);
      return api('GET', prefix(PRIVATE) + '/contents/' + file.split('/').map(encodeURIComponent).join('/') + '?ref=' + version.head, undefined, { raw: true });
    }
    async function read(key) {
      const file = statePaths[key];
      if (!cache.has(file)) {
        const pending = raw(file).then(text => {
          const data = JSON.parse(text);
          if (key === 'requests' ? !Array.isArray(data) : !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El archivo guardado no tiene el formato esperado.');
          return data;
        });
        cache.set(file, pending);
        try { await pending; } catch (error) { cache.delete(file); throw error; }
      }
      return clone(await cache.get(file));
    }
    async function write(key, value) {
      const file = statePaths[key];
      if (!cache.has(file)) throw new Error('Primero deben cargarse los datos existentes antes de guardar.');
      const serialized = JSON.stringify(normalize(value), null, 2);
      const previous = JSON.stringify(normalize(await cache.get(file)), null, 2);
      if (serialized === previous) return { success: true, message: 'Los datos guardados en GitHub ya están actualizados.' };
      const saved = await api('PUT', prefix(PRIVATE) + '/contents/' + file, {
        message: 'Guardar cambios de Admin móvil', branch: 'main', sha: snapshot.files.get(file)?.sha, content: encode(serialized)
      });
      snapshot.head = saved.commit.sha;
      snapshot.files.set(file, { path: file, sha: saved.content.sha, type: 'blob' });
      cache.set(file, Promise.resolve(JSON.parse(serialized)));
      return { success: true, message: 'Cambios guardados en GitHub. Usá «Actualizar página en GitHub» para publicarlos.' };
    }
    function serial(task) {
      const result = queue.then(task); queue = result.catch(() => {}); return result;
    }
    async function connect() {
      const user = await api('GET', '/user');
      if (user.id !== OWNER_ID) throw new Error('Esta cuenta no está autorizada para administrar Orden del Toro.');
      const repo = await api('GET', prefix(PRIVATE));
      if (!repo.private || !repo.permissions?.push) throw new Error('Admin debe permanecer en un repositorio privado con permiso de escritura para tu cuenta.');
      const website = await api('GET', prefix(PUBLIC));
      if (!website.permissions?.push) throw new Error('La credencial necesita acceso al repositorio de la página.');
      snapshot = await getSnapshot(PRIVATE);
      const html = await raw('admin/bundle.html');
      await Promise.all(Object.keys(statePaths).map(read));
      return { html, account: user.login };
    }
    async function asset(file) {
      if (!validAsset(file) || !snapshot.files.has(file)) throw new Error('Imagen no disponible en el repositorio privado.');
      const blob = await api('GET', prefix(PRIVATE) + '/git/blobs/' + snapshot.files.get(file).sha);
      return { base64: blob.content.replace(/\s/g, ''), type: /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : /\.gif$/i.test(file) ? 'image/gif' : /\.avif$/i.test(file) ? 'image/avif' : 'image/jpeg' };
    }
    async function upload(data) {
      const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
      if (!extensions[data?.type] || typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64) || data.base64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4) throw new Error('La imagen debe ser PNG, JPG, WEBP, GIF o AVIF y pesar hasta 5 MB.');
      const file = 'uploads/' + Date.now() + '-' + crypto.randomUUID() + '.' + extensions[data.type];
      const result = await api('PUT', prefix(PRIVATE) + '/contents/' + file, { message: 'Guardar imagen de Admin', branch: 'main', content: data.base64 });
      snapshot.head = result.commit.sha; snapshot.files.set(file, { path: file, sha: result.content.sha });
      return { success: true, url: '/' + file };
    }
    function imagePaths(value, found = new Set()) {
      if (typeof value === 'string' && validAsset(value)) found.add(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(item => imagePaths(item, found));
      return found;
    }
    async function publish() {
      publication = { state: 'running', message: 'Publicando los datos guardados en GitHub…' };
      try {
        // Se publica una versión coherente de los cuatro archivos privados.
        const version = await getSnapshot(PRIVATE);
        const [config, guides, community] = await Promise.all(['config', 'guides', 'community'].map(async key => JSON.parse(await raw(statePaths[key], version))));
        const publicConfig = normalize(config); delete publicConfig.compSlots;
        const cleanCommunity = normalize(publicCommunity(community));
        const website = await getSnapshot(PUBLIC), entries = [];
        const files = { 'data.json': publicConfig, 'guides.json': normalize(guides), 'community-data.json': cleanCommunity,
          'publication.json': { stateCommit: version.head } };
        for (const [file, data] of Object.entries(files)) {
          const blob = await api('POST', prefix(PUBLIC) + '/git/blobs', { content: JSON.stringify(data, null, 2), encoding: 'utf-8' });
          if (website.files.get(file)?.sha !== blob.sha) entries.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const images = imagePaths([publicConfig, files['guides.json'], cleanCommunity]);
        for (const file of images) {
          const privateImage = version.files.get(file), publicImage = website.files.get(file);
          if (!privateImage) {
            if (!publicImage) throw new Error('Falta una imagen referenciada por la página: ' + file);
            continue;
          }
          if (publicImage?.sha === privateImage.sha) continue;
          const image = await api('GET', prefix(PRIVATE) + '/git/blobs/' + privateImage.sha);
          const blob = await api('POST', prefix(PUBLIC) + '/git/blobs', { content: image.content.replace(/\s/g, ''), encoding: 'base64' });
          entries.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
        }
        if (entries.length) {
          const tree = await api('POST', prefix(PUBLIC) + '/git/trees', { base_tree: website.tree, tree: entries });
          const commit = await api('POST', prefix(PUBLIC) + '/git/commits', { message: 'Actualizar Orden del Toro desde Admin móvil', tree: tree.sha, parents: [website.head] });
          await api('PATCH', prefix(PUBLIC) + '/git/refs/heads/main', { sha: commit.sha, force: false });
        }
        publication = { state: 'succeeded', url: 'https://orden-del-toro.github.io/', message: 'Cambios enviados a GitHub. La web se actualizará cuando termine el despliegue de Pages.' };
      } catch (error) { publication = { state: 'failed', message: error.message }; }
      return publication;
    }
    async function route({ path, method = 'GET', body }) {
      if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('..') || path.length > 250) throw new Error('Ruta no permitida.');
      if (path === '/api/github/publication') {
        if (method === 'GET') return clone(publication);
        if (method === 'POST') return publish();
      }
      if (path === '/api/upload' && method === 'POST') return upload(body);
      const key = path === '/api/config' ? 'config' : path === '/api/guides' ? 'guides' : null;
      if (key) {
        if (method === 'GET') {
          if(key==='config'&&loadedConfig){snapshot=await getSnapshot(PRIVATE);cache.clear();}
          if(key==='config')loadedConfig=true;
          return read(key);
        }
        if (method === 'POST') {
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Los datos no son válidos.');
          return write(key, body);
        }
      }
      if (path === '/api/solicitudes' && method === 'GET') {
        const current=await getSnapshot(PRIVATE),file=statePaths.requests;
        if(current.files.get(file)?.sha!==snapshot.files.get(file)?.sha){
          const value=JSON.parse(await raw(file,current));
          if(!Array.isArray(value))throw new Error('La bandeja guardada no tiene el formato esperado.');
          cache.set(file,Promise.resolve(value));snapshot.files.set(file,current.files.get(file));snapshot.head=current.head;
        }
        return read('requests');
      }
      const requestMatch = path.match(/^\/api\/solicitud\/([a-zA-Z0-9_-]+)$/);
      if (requestMatch && method === 'POST') {
        let items = await read('requests');
        if (body?.action === 'leer') items = items.map(item => String(item.id) === requestMatch[1] ? { ...item, leido: true } : item);
        else if (body?.action === 'eliminar') items = items.filter(item => String(item.id) !== requestMatch[1]);
        else throw new Error('Acción no válida.');
        return write('requests', items);
      }
      const match = path.match(/^\/api\/documents\/(guidePatches|communityGuides)(?:\/([a-zA-Z0-9_-]+))?$/);
      if (match) {
        const [, collection, id] = match, data = await read('community');
        if (method === 'GET' && !id) return data[collection] || {};
        if (!id || !validId(id)) throw new Error('Documento no válido.');
        data[collection] ||= {};
        if (method === 'DELETE') delete data[collection][id];
        else if (['PUT', 'PATCH'].includes(method) && body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
          if (method === 'PATCH' && !data[collection][id]) throw new Error('El documento ya no existe.');
          data[collection][id] = method === 'PATCH' || body.merge ? { ...data[collection][id], ...body.data } : body.data;
        } else throw new Error('Acción no válida.');
        return write('community', data);
      }
      throw new Error('Esta importación necesita el servidor de tu PC. La edición y publicación funcionan desde el celular.');
    }
    return { connect, request: args => serial(() => route(args)), asset: file => serial(() => asset(file)) };
  }
  return { createApi, createSession, base64, decode, normalize, publicCommunity, OWNER, PRIVATE, PUBLIC, OWNER_ID, statePaths };
});
