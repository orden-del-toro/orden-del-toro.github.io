(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ODTGuidePatches = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizePatch(value) {
    const text = String(value || '').trim();
    const matches = [...text.matchAll(/\b(\d{1,2}[._]\d{1,2}(?:[._]\d{1,2})?)\b/g)];
    const versions = [...new Set(matches.map(match => match[1].replace(/_/g, '.')))];
    return versions.length === 1 ? versions[0] : '';
  }

  function patchKey(value) {
    return normalizePatch(value).replace(/\./g, '_');
  }

  function specIdFromKey(key) {
    return String(key || '').replace(/-\d+(?:[._]\d+){1,2}$/, '');
  }

  function storeImportedGuide(guides, specId, guide) {
    const baseId = specIdFromKey(specId);
    const patch = normalizePatch(guide.patch);
    if (!baseId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseId) || !patch) {
      throw new Error('La guía importada debe tener una especialización y un parche detectado válidos.');
    }
    // Reutiliza las claves antiguas si ya pertenecen a esa versión. Otra
    // versión de la misma especialización conserva su propia entrada.
    const existing = Object.keys(guides).find(key =>
      specIdFromKey(key) === baseId && normalizePatch(guides[key]?.patch) === patch);
    const key = existing || `${baseId}-${patchKey(patch)}`;
    const previous = guides[key] || {};
    const imported = { ...guide, specId: baseId, patch };
    if (guide.contentType === 'mythic-plus') {
      // El editor público tiene un árbol de Raid y otro de Míticas+.
      // Una importación M+ no borra el árbol de Raid ya guardado.
      guides[key] = { ...imported, ...previous, specId: baseId, patch,
        talentsMythicPlus: guide.talentsMythicPlus || '',
        talentImageMythic: guide.talentImageMythic || '',
        mythicPlus: imported };
    } else {
      guides[key] = { ...imported,
        talentsMythicPlus: previous.talentsMythicPlus || guide.talentsMythicPlus || '',
        talentImageMythic: previous.talentImageMythic || guide.talentImageMythic || '',
        ...(previous.mythicPlus ? { mythicPlus: previous.mythicPlus } : {}) };
    }
    return { key, guide: guides[key] };
  }

  const patchQueues = new WeakMap();
  function ensureGuidePatch(db, patchValue, options = {}) {
    const result = (patchQueues.get(db) || Promise.resolve()).then(() => registerGuidePatch(db, patchValue, options));
    patchQueues.set(db, result.catch(() => {}));
    return result;
  }
  async function registerGuidePatch(db, patchValue, options = {}) {
    const patch = normalizePatch(patchValue);
    if (!patch) throw new Error('No se pudo identificar un parche único para la guía.');
    const collection = db.collection('guidePatches');
    const snapshot = await collection.get();
    const matches = snapshot.docs.filter(doc => normalizePatch(doc.data().name) === patch);
    matches.sort((a, b) => Number(b.data().active !== false) - Number(a.data().active !== false)
      || a.id.localeCompare(b.id));
    // El ID determinista evita duplicados también entre importaciones simultáneas.
    const ref = collection.doc(matches[0]?.id || `patch-${patchKey(patch)}`);
      const current = await ref.get();
      const timestamp = new Date().toISOString();
      if (current.exists) {
        const changes = {};
        if (current.data().active === false) changes.active = true;
        if (Object.keys(changes).length) await ref.update({ ...changes, updatedAt: timestamp });
        return { id: ref.id, name: current.data().name || patch, patch, created: false };
      }
      await ref.set({
        name: patch, active: true,
        order: options.order ?? snapshot.docs.length,
        createdAt: timestamp, updatedAt: timestamp,
        createdBy: options.userId || ''
      });
      return { id: ref.id, name: patch, patch, created: true };
  }

  function mergeGuidePatches(patches, guides) {
    const unique = new Map();
    const inactive = new Set();
    for (const item of patches || []) {
      const key = patchKey(item.name);
      if (!key) continue;
      if (item.active === false) { inactive.add(key); continue; }
      if (!unique.has(key)) unique.set(key, { ...item, key });
    }
    for (const guide of Object.values(guides || {})) {
      const key = patchKey(guide?.patch);
      if (key && !inactive.has(key) && !unique.has(key)) unique.set(key, {
        key, name: normalizePatch(guide.patch), active: true, order: 999999, source: 'guides', expansion: guide.expansion || ''
      });
    }
    return [...unique.values()].sort((a, b) => (Number(a.order ?? 999999) - Number(b.order ?? 999999))
      || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  return { normalizePatch, patchKey, specIdFromKey, storeImportedGuide, ensureGuidePatch, mergeGuidePatches };
});
