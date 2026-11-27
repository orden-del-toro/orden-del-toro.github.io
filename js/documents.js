(function (root) {
  'use strict';
  const staticHosting = () => document.querySelector('meta[name="odt-hosting"]')?.content === 'github-pages';
  const unavailable = 'El sitio publicado todavía no tiene un receptor de envíos configurado. No se envió ni se guardó la información en Admin.';
  async function request(url, method = 'GET', data) {
    const response = await fetch(url, { method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-ODT-Local-Admin': 'documents' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    let result;
    try { result = await response.json(); }
    catch { throw new Error('No se pudo leer la respuesta. Comprobá que el servidor local esté actualizado y reiniciado.'); }
    if (!response.ok) throw new Error(result.error || result.message || `HTTP ${response.status}`);
    return result;
  }
  function snapshot(id, value) { return { id, exists: value !== undefined, data: () => value }; }
  async function sendRequest(data) {
    if (staticHosting()) throw new Error(unavailable);
    return request('/api/solicitud', 'POST', data);
  }
  function create({ admin = false } = {}) {
    async function records(name) {
      if (name === 'solicitudes') {
        if (!admin) throw new Error('La bandeja es privada.');
        const items = await request('/api/solicitudes');
        return Object.fromEntries(items.map(item => [String(item.id), item]));
      }
      if (admin) return request('/api/documents/' + name);
      const data = staticHosting()
        ? await request(new URL('community-data.json', document.baseURI).href)
        : await request('/community-data.json');
      return data[name] || {};
    }
    function collection(name, filters = [], count = Infinity) {
      if (!['guidePatches', 'communityGuides', 'solicitudes'].includes(name)) throw new Error('Colección desconocida.');
      return {
        where(field, operator, value) {
          if (operator !== '==') throw new Error('Filtro no admitido.');
          return collection(name, [...filters, [field, value]], count);
        },
        limit(value) { return collection(name, filters, value); },
        async get() {
          const values = await records(name);
          const docs = Object.entries(values).filter(([, item]) => filters.every(([field, value]) => item[field] === value))
            .slice(0, count).map(([id, item]) => snapshot(id, item));
          return { docs, empty: !docs.length };
        },
        async add(value) {
          if (name === 'solicitudes') return sendRequest(value);
          if (staticHosting()) throw new Error(unavailable);
          if (!admin && name === 'communityGuides') return request('/api/community-guides', 'POST', value);
          const id = crypto.randomUUID();
          await this.doc(id).set(value);
          return { id };
        },
        doc(id) {
          const url = '/api/documents/' + name + '/' + encodeURIComponent(id);
          return {
            id,
            async get() { return snapshot(id, (await records(name))[id]); },
            async set(data, options) {
              if (!admin || staticHosting()) throw new Error('Los cambios requieren el administrador local.');
              return request(url, 'PUT', { data, merge: Boolean(options?.merge) });
            },
            async update(data) {
              if (name === 'solicitudes' && admin) return request('/api/solicitud/' + encodeURIComponent(id), 'POST', { action: 'leer' });
              if (!admin || staticHosting()) throw new Error('Los cambios requieren el administrador local.');
              return request(url, 'PATCH', { data });
            },
            async delete() {
              if (name === 'solicitudes' && admin) return request('/api/solicitud/' + encodeURIComponent(id), 'POST', { action: 'eliminar' });
              if (!admin || staticHosting()) throw new Error('Los cambios requieren el administrador local.');
              return request(url, 'DELETE');
            }
          };
        }
      };
    }
    return { collection };
  }
  async function vote(id, visitorId) {
    if (staticHosting()) throw new Error(unavailable);
    return request('/api/community-guides/' + encodeURIComponent(id) + '/vote', 'POST', { visitorId });
  }
  root.ODTDocuments = { create, sendRequest, vote };
})(globalThis);
