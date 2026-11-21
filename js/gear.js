
/*
 * ===== RENDERIZADO DE EQUIPO (GEAR) — IMPLEMENTACIÓN ÚNICA =====
 * Esto reemplaza cuatro parches previos que se pisaban entre sí
 * (cada uno redefinía renderGearForPreview/odtRefreshWowhead y agregaba su
 * propio wrapper sobre renderSpecDetail), lo que producía:
 *   - íconos de encantamiento duplicados o ausentes
 *   - el nombre del encantamiento desplazado
 *   - el tooltip de Wowhead abriéndose y cerrándose en loop
 * Ahora hay un solo lugar que genera este HTML para toda la app.
 */
(function () {
  'use strict';

  const ENCHANT_FALLBACK_ICON = 'https://wow.zamimg.com/images/wow/icons/large/inv_enchant_armor.jpg';
  const LEFT_LABELS = new Set(['Casco', 'Cuello', 'Hombros', 'Capa', 'Pecho', 'Brazaletes', 'Arma 1', 'Arma 2']);
  const RIGHT_LABELS = new Set(['Manos', 'Cintura', 'Pantalones', 'Pies', 'Anillo 1', 'Anillo 2', 'Abalorio 1', 'Abalorio 2']);

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeLabel(v) {
    const s = String(v || '').trim();
    if (s === 'Piernas') return 'Pantalones';
    if (s === 'Botas') return 'Pies';
    return s;
  }

  /* ---------- Lectura de datos que vienen de Guides ---------- */

  function normalizeSlotGems(slot) {
    if (!slot) return [];
    const result = [];

    const add = (g) => {
      if (!g) return;
      const gem = typeof g === 'string'
        ? { name: g, icon: '' }
        : {
            name: g.name || '',
            icon: g.icon || g.iconUrl || '',
            id: String(g.id || g.itemId || g.itemID || g.wowheadId || '').trim(),
            wowheadUrl: g.wowheadUrl || g.url || g.link || g.href || ''
          };
      if (!(gem.icon || gem.name)) return;
      if (result.some(x => (gem.icon && x.icon === gem.icon) || (gem.name && x.name === gem.name))) return;
      result.push(gem);
    };

    if (Array.isArray(slot.extras)) slot.extras.filter(x => x && x.type === 'gem').forEach(add);
    if (Array.isArray(slot.gems)) slot.gems.forEach(add);

    const names = String(slot.gemsNames || '').split(',').map(s => s.trim()).filter(Boolean);
    const icons = String(slot.gemsIcons || '').split(',').map(s => s.trim()).filter(Boolean);
    if (names.length || icons.length) {
      const n = Math.max(names.length, icons.length);
      Array.from({ length: n }, (_, i) => ({ name: names[i] || '', icon: icons[i] || '' })).forEach(add);
    }

    if (slot.gem || slot.gemIcon) add({ name: slot.gem || '', icon: slot.gemIcon || '' });

    return result;
  }

  function normalizeModifier(extra) {
    if (!extra) return null;
    const item = {
      name: extra.name || extra.item || '',
      icon: extra.icon || extra.iconUrl || '',
      id: String(extra.id || extra.itemId || extra.itemID || extra.wowheadId || extra.wowheadID || '').trim(),
      wowheadUrl: extra.wowheadUrl || extra.url || extra.link || extra.href || ''
    };
    return item.name || item.icon || item.id || item.wowheadUrl ? item : null;
  }

  function isCraftingModifier(item) {
    const text = [item && item.name, item && item.tooltip, item && item.description, item && item.wowheadUrl].join(' ');
    return /\b(?:optional\s+crafting\s+reagent|optional\s+reagent|crafting\s+reagent|profession\s+reagent|missive|embellishment|crafted|crafting)\b|\b(?:armor|armour)\s+(?:kit|patch)\b|\bpatch(?:es)?\b/i.test(text);
  }

  function uniqueModifiers(items) {
    const seen = new Set();
    return items.filter(item => {
      if (!item) return false;
      const key = item.id ? 'id:' + item.id
        : item.wowheadUrl ? 'url:' + item.wowheadUrl.toLowerCase()
        : item.name ? 'name:' + item.name.trim().toLowerCase()
        : item.icon ? 'icon:' + item.icon.toLowerCase() : '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeSlotEnchantments(slot) {
    if (!slot) return [];
    const enchants = [];
    if (Array.isArray(slot.extras)) {
      slot.extras.filter(x => x && String(x.type || '').toLowerCase() === 'enchant').forEach(extra => {
        const item = normalizeModifier(extra);
        if (item && !isCraftingModifier(item)) enchants.push(item);
      });
    }

    const legacy = normalizeModifier({
      name: slot.enchant,
      icon: slot.enchantIcon,
      id: slot.enchantId || slot.enchantItemId || slot.enchantWowheadId,
      wowheadUrl: slot.enchantWowheadUrl || slot.enchantUrl
    });
    if (legacy && !isCraftingModifier(legacy)) enchants.push(legacy);
    return uniqueModifiers(enchants);
  }

  function normalizeSlotEnchant(slot) {
    return normalizeSlotEnchantments(slot)[0] || null;
  }

  function normalizeSlotOtherExtras(slot) {
    if (!slot) return [];
    const others = [];
    if (Array.isArray(slot.extras)) {
      slot.extras.filter(x => {
        const type = String(x && x.type || '').toLowerCase();
        return type === 'other' || (type === 'enchant' && isCraftingModifier(x));
      }).forEach(extra => {
        const item = normalizeModifier(extra);
        if (item) others.push(item);
      });
    }
    const legacy = normalizeModifier({
      name: slot.enchant,
      icon: slot.enchantIcon,
      id: slot.enchantId || slot.enchantItemId || slot.enchantWowheadId,
      wowheadUrl: slot.enchantWowheadUrl || slot.enchantUrl
    });
    if (legacy && isCraftingModifier(legacy)) others.push(legacy);
    return uniqueModifiers(others);
  }

  /* Extras normalizados (gemas, todos los encantamientos y otros objetos) de un slot. */
  function normalizeSlotExtras(slot) {
    const gems = normalizeSlotGems(slot).map(g => Object.assign({ type: 'gem' }, g));
    const enchants = normalizeSlotEnchantments(slot).map(x => Object.assign({ type: 'enchant' }, x));
    const others = normalizeSlotOtherExtras(slot).map(x => Object.assign({ type: 'other' }, x));
    return uniqueModifiers([...gems, ...enchants, ...others]);
  }
  window.normalizeSlotExtras = normalizeSlotExtras;

  /* ---------- Enlaces / tooltips de Wowhead ---------- */

  function wowheadLink(item, type) {
    const t = type || 'item';
    const raw = String(item && (item.wowheadUrl || item.url || item.link || item.href) || '').trim();
    if (raw) {
      const m = raw.match(/(?:item|spell|quest|npc|achievement|object)[=\/](\d+)/i);
      if (m) {
        const kind = (raw.match(/(item|spell|quest|npc|achievement|object)[=\/]/i) || [, t])[1].toLowerCase();
        return { href: raw, data: kind + '=' + m[1] };
      }
      return { href: raw, data: '' };
    }
    const id = item && (item.id || item.itemId || item.itemID || item.spellId || item.enchantId);
    if (id) return { href: 'https://www.wowhead.com/' + t + '=' + encodeURIComponent(id), data: t + '=' + encodeURIComponent(id) };
    return { href: '', data: '' };
  }

  /* ---------- HTML de gemas / encantamientos ---------- */

  function gemMarkup(gem) {
    if (!gem) return '';
    if (gem.icon) {
      const wh = wowheadLink(gem, 'item');
      const dataAttr = wh.data ? ' data-wowhead="' + esc(wh.data) + '"' : '';
      return '<a class="gear-modifier-gem"' + dataAttr +
        ' href="' + esc(wh.href || '#') + '" target="_blank" rel="noopener noreferrer" title="' + esc(gem.name || 'Gema') + '">' +
        '<img src="' + esc(gem.icon) + '" alt="" loading="lazy"></a>';
    }
    if (gem.id) {
      return '<a class="gear-modifier-gem" href="https://www.wowhead.com/item=' + esc(gem.id) + '" target="_blank" rel="noopener noreferrer"' +
        ' data-wowhead="item=' + esc(gem.id) + '" data-wh-iconize-link="true" data-wh-rename-link="false"' +
        ' title="' + esc(gem.name || 'Gema') + '"></a>';
    }
    return '';
  }

  /* Siempre devuelve un ícono (propio o genérico) para que el slot nunca
     quede sin recuadro de ícono. Si el nombre es el placeholder que genera
     Guides ("Encantamiento #12345"), le pedimos a Wowhead que lo reemplace
     por el nombre real apenas resuelva el tooltip. */
  function enchantMarkup(enchant) {
    if (!enchant || (!enchant.name && !enchant.icon && !enchant.id && !enchant.wowheadUrl)) return '';

    const id = String(enchant.id || '').trim();
    const icon = String(enchant.icon || '').trim();
    const rawName = String(enchant.name || '').trim();
    const name = rawName || (id ? ('Encantamiento #' + id) : 'Encantamiento');
    const href = String(enchant.wowheadUrl || '').trim() || (id ? ('https://www.wowhead.com/item=' + id) : '#');

    // OJO: nunca pedir data-wh-rename-link="true" acá. Wowhead reemplaza
    // todo el contenido interno del link al renombrar, y eso borra el
    // <span> del ícono que armamos nosotros mismos (era la causa de que el
    // ícono desapareciera solo en los encantamientos con nombre placeholder,
    // como "Encantamiento #243991"). Mostramos siempre nuestro propio
    // ícono + nombre, sin que Wowhead pueda tocar ese contenido.
    const dataAttr = id
      ? ' data-wowhead="item=' + esc(id) + '" data-wh-iconize-link="false" data-wh-rename-link="false"'
      : '';

    return '<a class="gear-modifier-enchant"' + dataAttr +
      ' href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" title="' + esc(name) + '">' +
      '<span class="gear-modifier-enchant-icon"><img src="' + esc(icon || ENCHANT_FALLBACK_ICON) + '" alt="" loading="lazy"></span>' +
      '<span class="gear-modifier-enchant-name">' + esc(name) + '</span>' +
      '</a>';
  }

  /* ---------- Grilla principal de equipo ---------- */

  function renderGearForPreview(slots) {
    const valid = Array.isArray(slots) ? slots : [];
    const left = [];
    const right = [];

    valid.forEach(s => {
      if (!s) return;
      if (s.isSeparator) {
        const l = normalizeLabel(s.label);
        if (l === 'Armas') left.push(s);
        else if (l === 'Abalorios') right.push(s);
        return;
      }
      const l = normalizeLabel(s.label);
      const copy = Object.assign({}, s, { label: l });
      if (LEFT_LABELS.has(l)) left.push(copy);
      else if (RIGHT_LABELS.has(l)) right.push(copy);
      else if (s.col === 'left') left.push(copy);
      else if (s.col === 'right') right.push(copy);
    });

    const hasItem = s => !!(s && !s.isSeparator && String(s.name || '').trim());

    function renderColumn(items) {
      if (!items.some(hasItem)) return '';
      return '<div class="gear-column">' + items.map(s => {
        if (s.isSeparator) {
          return '<div class="gear-slot separator"><span class="separator-label">' + esc(s.label || '') + '</span><span class="separator-line"></span></div>';
        }
        if (!hasItem(s)) return '';

        const item = {
          name: String(s.name || ''),
          icon: String(s.icon || ''),
          wowheadUrl: String(s.wowheadUrl || s.wowheadURL || s.url || s.link || s.href || ''),
          id: s.wowheadId || s.wowheadID || s.itemId || s.itemID || s.id || ''
        };
        const wh = wowheadLink(item, 'item');
        const dataAttr = item.id ? ' data-wowhead="item=' + esc(item.id) + '" data-wh-iconize-link="false"' : '';
        const iconInner = item.icon
          ? '<img src="' + esc(item.icon) + '" alt="' + esc(item.name) + '" loading="lazy">'
          : '<span class="placeholder">—</span>';

        const iconLink = '<a class="item-link gear-wowhead-link"' + dataAttr +
          ' href="' + esc(wh.href || '#') + '" target="_blank" rel="noopener noreferrer" title="' + esc(item.name) + '">' + iconInner + '</a>';
        const nameLink = '<a class="item-link gear-wowhead-link"' + dataAttr +
          ' data-wh-rename-link="true" href="' + esc(wh.href || '#') + '" target="_blank" rel="noopener noreferrer" title="' + esc(item.name) + '">' +
          esc(item.name || ('Objeto #' + item.id)) + '</a>';

        const extras = normalizeSlotExtras(s);
        const gemsHtml = extras.filter(x => x.type === 'gem').map(gemMarkup).join('');
        const enchantHtml = extras.filter(x => x.type === 'enchant').map(enchantMarkup).join('');
        const otherHtml = extras.filter(x => x.type === 'other').map(gemMarkup).join('');
        const mods = (gemsHtml || enchantHtml || otherHtml) ? '<div class="gear-modifiers-inline">' + gemsHtml + enchantHtml + otherHtml + '</div>' : '';

        return '<div class="gear-slot">' +
          '<div class="icon-wrapper"><div class="item-icon">' + iconLink + '</div></div>' +
          '<div class="item-info"><div class="item-name">' + nameLink + '</div>' + mods +
          '<div class="item-meta">' +
            (s.label ? '<span class="slot-label">' + esc(s.label) + '</span>' : '') +
            (s.stats ? '<span class="stats">' + esc(s.stats) + '</span>' : '') +
            (s.popularity != null ? '<span class="popularity">' + esc(s.popularity) + '%</span>' : '') +
            (s.parses != null ? '<span class="parses">' + esc(s.parses) + ' parses</span>' : '') +
          '</div></div></div>';
      }).join('') + '</div>';
    }

    return '<div class="gear-grid">' + renderColumn(left) + renderColumn(right) + '</div>';
  }
  window.renderGearForPreview = renderGearForPreview;

  /* ---------- Overlay "Gemas y encantamientos" ---------- */

  window.openEnchantOverlay = function () {
    const overlay = document.getElementById('enchantOverlay');
    const container = document.getElementById('enchantContainer');
    if (!overlay || !container) return;

    const guide = window._currentGuideData || {};
    const slots = Array.isArray(guide.gearSlots) ? guide.gearSlots : [];

    const gemRows = [];
    const enchantRows = [];

    slots.forEach(slot => {
      if (!slot || slot.isSeparator) return;
      const gemList = normalizeSlotGems(slot);
      if (gemList.length) gemRows.push({ slot: slot.label || '', gems: gemList });
      const enchant = normalizeSlotEnchant(slot);
      if (enchant) enchantRows.push(Object.assign({ slot: slot.label || '' }, enchant));
    });

    let html = '<div class="enchant-overlay-list">';

    html += '<div class="enchant-overlay-group"><div class="enchant-overlay-group-title">Gemas</div>';
    if (gemRows.length) {
      html += '<div class="enchant-overlay-items">' + gemRows.map(row => {
        const icons = row.gems.map(g => g.icon ? '<img src="' + esc(g.icon) + '" alt="" title="' + esc(g.name || 'Gema') + '" loading="lazy">' : '').filter(Boolean).join('');
        if (!icons) return '';
        return '<div class="enchant-overlay-item"><span class="enchant-overlay-slot">' + esc(row.slot) + '</span><span class="enchant-overlay-gem-icons">' + icons + '</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="enchant-overlay-empty">No hay gemas configuradas.</div>';
    }
    html += '</div>';

    html += '<div class="enchant-overlay-group"><div class="enchant-overlay-group-title">Encantamientos</div>';
    if (enchantRows.length) {
      html += '<div class="enchant-overlay-items">' + enchantRows.map(row => {
        const icon = row.icon || ENCHANT_FALLBACK_ICON;
        const name = row.name || (row.id ? ('Encantamiento #' + row.id) : 'Encantamiento');
        return '<div class="enchant-overlay-item">' +
          '<span class="enchant-overlay-slot">' + esc(row.slot) + '</span>' +
          '<span class="enchant-overlay-enchant">' +
            '<img src="' + esc(icon) + '" alt="" loading="lazy">' +
            '<span>' + esc(name) + '</span>' +
          '</span>' +
        '</div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="enchant-overlay-empty">No hay encantamientos configurados.</div>';
    }
    html += '</div></div>';

    container.innerHTML = html;
    overlay.classList.add('open');
    scheduleWowheadRefresh(100);
  };

  window.closeOverlay = function (id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('open');
  };

  /* ---------- Refresh de tooltips de Wowhead ----------
     Se dispara SOLO después de renderizar contenido nuevo, nunca en
     mouseover (eso era lo que hacía que el tooltip parpadeara: cada hover
     forzaba un refreshLinks() que Wowhead interpretaba como "recién
     insertado", cerrando y reabriendo el tooltip en loop). */

  let lastWowheadCount = -1;

  function refreshWowheadTooltips() {
    try {
      const count = document.querySelectorAll('[data-wowhead]').length;
      if (!count || count === lastWowheadCount) return;
      if (window.WH && WH.Tooltips && typeof WH.Tooltips.refreshLinks === 'function') {
        WH.Tooltips.refreshLinks();
        lastWowheadCount = count;
      } else if (typeof $WowheadPower !== 'undefined' && typeof $WowheadPower.refreshLinks === 'function') {
        $WowheadPower.refreshLinks();
        lastWowheadCount = count;
      }
    } catch (e) {}
  }
  window.odtRefreshWowhead = refreshWowheadTooltips;

  function scheduleWowheadRefresh(delay) {
    setTimeout(refreshWowheadTooltips, delay || 0);
  }

  if (typeof window.renderSpecDetail === 'function') {
    const originalRenderSpecDetail = window.renderSpecDetail;
    window.renderSpecDetail = function () {
      lastWowheadCount = -1;
      const result = originalRenderSpecDetail.apply(this, arguments);
      scheduleWowheadRefresh(250);
      return result;
    };
  }

  /* ---------- Carga de guías desde /api/guides ---------- */

  async function loadGuidesFromAdmin() {
    if (document.querySelector('meta[name="odt-hosting"][content="github-pages"]')) return;
    try {
      const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
      const res = await fetch(origin + '/api/guides', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const guides = await res.json();
      if (!guides || typeof guides !== 'object') throw new Error('Respuesta de /api/guides inválida');

      if (!window.CONFIG || typeof window.CONFIG !== 'object') window.CONFIG = {};
      CONFIG.guides = guides;
      window._odtGuidesFromAdmin = true;
      console.log('[ODT] Guías cargadas desde /api/guides:', Object.keys(guides));

      if (window._selectedGuidesSpecId && typeof window.renderSpecDetail === 'function') {
        window.renderSpecDetail(window._selectedGuidesSpecId);
      }
    } catch (e) {
      console.warn('[ODT] /api/guides no disponible; se mantiene la fuente ya cargada.', e);
    }
  }
  window.odtReloadGuidesFromAdmin = loadGuidesFromAdmin;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGuidesFromAdmin, { once: true });
  } else {
    loadGuidesFromAdmin();
  }
})();
