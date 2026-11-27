
// ==========================================
// DATOS PÚBLICOS Y API LOCAL
// ==========================================
const db = ODTDocuments.create();
let guidePatchOptions = [];
let guidePatchOptionsLoaded = false;

// ==========================================
// DETALLE DE IMAGEN (modal)
// ==========================================
let imageZoomScale = 1;
let imageZoomX = 0;
let imageZoomY = 0;
let imageZoomPointers = new Map();
let imageZoomGesture = null;

function formatMediaDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function formatMediaStory(value) {
  return String(value || '').replace(/\r\n?/g, '\n')
    .split(/(\n[ \t]*\n(?:[ \t]*\n)*)/)
    .map((part,index) => index % 2 ? part : `<p>${escapeHomeValue(part)}</p>`).join('');
}

function openImageDetail(index) {
  const media = CONFIG.media || [];
  const item = media[index];
  if (!item) return;
  
  const overlay = document.getElementById('imageDetailOverlay');
  const content = document.getElementById('imageDetailContent');
  
  content.innerHTML = `
    <article class="odt-image-article">
      <section class="odt-image-article-hero" id="imageZoomStage" aria-label="Portada de la noticia">
        <img id="imageZoomTarget" src="${escapeHomeValue(item.imageUrl || '')}" alt="${escapeHomeValue(item.name || 'Imagen de la galería')}" draggable="false">
        <div class="odt-image-article-shade" aria-hidden="true"></div>
        <button type="button" class="odt-image-article-close" onclick="closeImageDetail()" aria-label="Cerrar noticia">×</button>
        <div class="odt-image-article-heading">
          <span class="odt-image-article-kicker">CRÓNICA DE LA HERMANDAD</span>
          <h1>${escapeHomeValue(item.name || 'Imagen sin título')}</h1>
          ${item.date ? `<time datetime="${escapeHomeValue(item.date)}">${escapeHomeValue(formatMediaDate(item.date))}</time>` : ''}
        </div>
        <div class="odt-image-zoom-controls" aria-label="Controles de zoom">
          <button type="button" onclick="changeImageZoom(-1)" aria-label="Alejar imagen">−</button>
          <span id="imageZoomReadout" aria-live="polite">100%</span>
          <button type="button" onclick="changeImageZoom(1)" aria-label="Acercar imagen">+</button>
          <button type="button" class="odt-image-zoom-reset" onclick="resetImageZoom()">RESTABLECER</button>
        </div>
      </section>
      <section class="odt-image-article-copy" id="odtImageArticleCopy" aria-label="Historia de la imagen">
        <div class="odt-image-article-copy-inner">
          <div class="odt-image-article-byline">HISTORIA · ORDEN DEL TORO</div>
          <div class="odt-image-article-story">${formatMediaStory(item.description || 'Esta imagen todavía no tiene una historia o descripción.')}</div>
        </div>
      </section>
    </article>
  `;

  resetImageZoom();
  setupImageZoom();
  
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateImageZoom() {
  const image = document.getElementById('imageZoomTarget');
  const readout = document.getElementById('imageZoomReadout');
  if (!image || !readout) return;
  image.style.transform = `translate(${imageZoomX}px, ${imageZoomY}px) scale(${imageZoomScale})`;
  image.style.cursor = imageZoomScale > 1 ? (imageZoomGesture ? 'grabbing' : 'grab') : 'default';
  readout.textContent = `${Math.round(imageZoomScale * 100)}%`;
}

function setImageZoom(scale, centerX, centerY) {
  const stage = document.getElementById('imageZoomStage');
  const image = document.getElementById('imageZoomTarget');
  if (!stage || !image) return;
  const previousScale = imageZoomScale;
  imageZoomScale = Math.max(1, Math.min(5, scale));

  if (centerX !== undefined && centerY !== undefined && imageZoomScale !== previousScale) {
    const bounds = stage.getBoundingClientRect();
    const localX = centerX - (bounds.left + bounds.width / 2);
    const localY = centerY - (bounds.top + bounds.height / 2);
    const ratio = imageZoomScale / previousScale;
    imageZoomX = localX - (localX - imageZoomX) * ratio;
    imageZoomY = localY - (localY - imageZoomY) * ratio;
  }

  if (imageZoomScale === 1) imageZoomX = imageZoomY = 0;
  const maxX = image.offsetWidth * (imageZoomScale - 1) / 2;
  const maxY = image.offsetHeight * (imageZoomScale - 1) / 2;
  imageZoomX = Math.max(-maxX, Math.min(maxX, imageZoomX));
  imageZoomY = Math.max(-maxY, Math.min(maxY, imageZoomY));
  updateImageZoom();
}

function changeImageZoom(direction) {
  setImageZoom(imageZoomScale + direction * 0.5);
}

function resetImageZoom() {
  imageZoomScale = 1;
  imageZoomX = imageZoomY = 0;
  imageZoomPointers = new Map();
  imageZoomGesture = null;
  updateImageZoom();
}

function setupImageZoom() {
  const stage = document.getElementById('imageZoomStage');
  const image = document.getElementById('imageZoomTarget');
  if (!stage || !image) return;

  stage.onpointerdown = event => {
    if (event.target !== image) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    imageZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (imageZoomPointers.size === 1) {
      imageZoomGesture = {
        type: 'drag', x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY,
        moved: false
      };
    } else if (imageZoomPointers.size === 2) {
      const points = [...imageZoomPointers.values()];
      imageZoomGesture = { type: 'pinch', moved: true };
    }
    updateImageZoom();
  };
  stage.onpointermove = event => {
    if (!imageZoomPointers.has(event.pointerId)) return;
    const previous = imageZoomPointers.get(event.pointerId);
    imageZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (imageZoomGesture && Math.hypot(event.clientX - imageZoomGesture.startX, event.clientY - imageZoomGesture.startY) > 5) {
      imageZoomGesture.moved = true;
    }
    if (imageZoomPointers.size === 1 && imageZoomGesture?.type === 'drag' && imageZoomScale > 1) {
      imageZoomX += event.clientX - previous.x;
      imageZoomY += event.clientY - previous.y;
      setImageZoom(imageZoomScale);
    }
    if (imageZoomGesture) imageZoomGesture.x = event.clientX;
    if (imageZoomGesture) imageZoomGesture.y = event.clientY;
  };
  const endPointer = event => {
    imageZoomPointers.delete(event.pointerId);
    if (imageZoomPointers.size === 1) {
      const point = [...imageZoomPointers.values()][0];
      imageZoomGesture = { type: 'drag', x: point.x, y: point.y, startX: point.x, startY: point.y, moved: true };
    } else if (!imageZoomPointers.size) {
      imageZoomGesture = null;
      updateImageZoom();
    }
  };
  stage.onpointerup = endPointer;
  stage.onpointercancel = endPointer;
}

function closeImageDetail() {
  document.getElementById('imageDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ==========================================
// NAVEGACIÓN POR PESTAÑAS
// ==========================================
function navigate(page, updateUrl = true) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Mostrar la página seleccionada
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    console.error('Página no encontrada:', 'page-' + page);
    return;
  }

  // Actualizar enlaces del menú
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (updateUrl) {
    const nextHash = '#' + page;
    if (window.location.hash !== nextHash) window.history.pushState({ page }, '', nextHash);
  }

  // Cerrar menú móvil
  document.getElementById('mainNav').classList.remove('open');

  // Scroll al inicio
  window.scrollTo(0, 0);

  // Renderizar contenido dinámico si es necesario
  if (page === 'roster') renderFullRoster();
  else memberShowcase?.setActive(false);
  if (page === 'raid') renderFullRaid();
  if (page === 'media') renderFullGallery();
  // M+ tiene contenido estático, no necesita renderizado
}

// ==========================================
// CARGA DE DATOS DESDE EL SERVIDOR
// ==========================================
let CONFIG = null;
let rosterLoadState = 'loading';

// Lista de clases (para filtros y modales)
const CLASSES = [
  { name: 'Guerrero', color: '#C79C6E', abbr: 'GU' },
  { name: 'Paladín', color: '#F58CBA', abbr: 'PA' },
  { name: 'Cazador', color: '#ABD473', abbr: 'CZ' },
  { name: 'Pícaro', color: '#FFF569', abbr: 'PI' },
  { name: 'Sacerdote', color: '#FFFFFF', abbr: 'SA' },
  { name: 'Caballero de la Muerte', color: '#C41F3B', abbr: 'DK' },
  { name: 'Chamán', color: '#0070DE', abbr: 'CH' },
  { name: 'Mago', color: '#69CCF0', abbr: 'MA' },
  { name: 'Brujo', color: '#9482C9', abbr: 'BR' },
  { name: 'Monje', color: '#00FF96', abbr: 'MO' },
  { name: 'Druida', color: '#FF7D0A', abbr: 'DR' },
  { name: 'Cazador de Demonios', color: '#A330C9', abbr: 'DH' },
  { name: 'Evocador', color: '#33937F', abbr: 'EV' }
];

function normalizeClassName(className) {
  return String(className || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const CLASS_LOOKUP = CLASSES.reduce((map, c) => {
  map[normalizeClassName(c.name)] = c;
  return map;
}, {});

function getClassInfo(className) {
  const cls = CLASS_LOOKUP[normalizeClassName(className)];
  return cls ? { color: cls.color, abbr: cls.abbr } : { color: '#ffffff', abbr: '' };
}

// ==========================================
// DATOS POR DEFECTO (cuando no hay servidor ni archivos)
// ==========================================
const DEFAULT_CONFIG = {
  roster: {
    tanks: [
      { name: 'Tanque1', ilvl: 610, spec: 'Protección', note: 'Tanque principal', armoryUrl: '#', class: { name: 'Guerrero', color: '#C79C6E', abbr: 'GU' } },
      { name: 'Tanque2', ilvl: 605, spec: 'Venganza', note: '', armoryUrl: '#', class: { name: 'Cazador de Demonios', color: '#A330C9', abbr: 'DH' } }
    ],
    healers: [
      { name: 'Sanador1', ilvl: 608, spec: 'Restauración', note: 'Jefe de sanadores', armoryUrl: '#', class: { name: 'Druida', color: '#FF7D0A', abbr: 'DR' } },
      { name: 'Sanador2', ilvl: 600, spec: 'Sagrado', note: '', armoryUrl: '#', class: { name: 'Sacerdote', color: '#FFFFFF', abbr: 'SA' } }
    ],
    dps: [
      { name: 'DPS1', ilvl: 612, spec: 'Furia', note: '', armoryUrl: '#', class: { name: 'Guerrero', color: '#C79C6E', abbr: 'GU' } },
      { name: 'DPS2', ilvl: 609, spec: 'Bestias', note: '', armoryUrl: '#', class: { name: 'Cazador', color: '#ABD473', abbr: 'CZ' } },
      { name: 'DPS3', ilvl: 607, spec: 'Arcano', note: '', armoryUrl: '#', class: { name: 'Mago', color: '#69CCF0', abbr: 'MA' } }
    ]
  },
  progress: {
    raids: [
      { name: 'Palacio Nerub-Ar', nm: 8, hc: 8, mm: 4, icon: 'https://cdn.altertime.es/dd799e30-9c15-4c67-a781-d5baeb2eacce.jfif' },
      { name: 'Liberación Minahonda', nm: 8, hc: 8, mm: 3, icon: 'https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/5P86SZQ4X2TF1740440514552.png' },
      { name: 'Forja de Maná Omega', nm: 8, hc: 1, mm: 0, icon: 'https://static.wikia.nocookie.net/es_wowpedia/images/d/de/Dimensius.png/revision/latest?cb=20250920205025' }
    ]
  },
  schedule: [
    { day: 'Lunes', time: '20:00', note: '' },
    { day: 'Viernes', time: '21:00', note: '' }
  ],
  recruitment: {
    dps: ['Guerrero', 'Cazador', 'Mago'],
    healers: ['Sacerdote', 'Druida'],
    tanks: ['Cazador de Demonios']
  },
  media: [
    { id: 1, name: 'Ejemplo 1', date: '2025-01-01', description: 'Imagen de ejemplo', imageUrl: 'https://via.placeholder.com/150?text=Ejemplo+1' },
    { id: 2, name: 'Ejemplo 2', date: '2025-01-02', description: 'Otra imagen', imageUrl: 'https://via.placeholder.com/150?text=Ejemplo+2' },
    { id: 3, name: 'Ejemplo 3', date: '2025-01-03', description: '', imageUrl: 'https://via.placeholder.com/150?text=Ejemplo+3' },
    { id: 4, name: 'Ejemplo 4', date: '2025-01-04', description: '', imageUrl: 'https://via.placeholder.com/150?text=Ejemplo+4' }
  ],
  mplus: { title: 'ACTIVIDADES', subtitle: 'Actividad de hermandad', items: [] }
};

async function loadConfig() {
  rosterLoadState = 'loading';
  memberShowcase?.update([], {status:rosterLoadState});
  const origin = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  if (window.location.protocol === 'file:') {
    console.warn('Página abierta desde file://, intentando cargar datos desde el servidor local en http://localhost:3000');
  }

  // 1) Intentar cargar desde el servidor si está disponible
  let loaded = false;
  try {
    if (!document.querySelector('meta[name="odt-hosting"][content="github-pages"]')) {
      const apiRes = await fetch(origin + '/api/config', { cache: 'no-store' });
      if (apiRes.ok) {
        CONFIG = await apiRes.json();
        loaded = true;
      }
    }
  } catch (e) {
    console.warn(`No se pudo cargar ${origin}/api/config, usando archivos locales...`, e);
  }

  // 2) Si no se cargó desde el servidor, intentar data.json local
  if (!loaded) {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (res.ok) {
        CONFIG = await res.json();
        loaded = true;
      } else {
        throw new Error('data.json no encontrado');
      }
    } catch (e) {
      console.warn('No se pudo cargar data.json, intentando con config.json...', e);
    }
  }

  // 3) Fallback a config.json si data.json no funcionó
  if (!loaded) {
    try {
      const res2 = await fetch('config.json', { cache: 'no-store' });
      if (res2.ok) {
        CONFIG = await res2.json();
        loaded = true;
      } else {
        throw new Error('config.json no encontrado');
      }
    } catch (e2) {
      console.warn('No se encontró config.json, usando datos por defecto.', e2);
      CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  rosterLoadState = loaded ? 'ready' : 'error';

  // Asegurar propiedades mínimas
  if (!CONFIG.media) CONFIG.media = [];
  if (!CONFIG.guides) CONFIG.guides = {};
  if (!CONFIG.progress) CONFIG.progress = { raids: [] };
  if (!Array.isArray(CONFIG.progress.raids)) CONFIG.progress.raids = [];

  // 4) Cargar guides.json (si existe)
  try {
    const guidesRes = await fetch('guides.json', { cache: 'no-store' });
    if (guidesRes.ok) {
      const guides = await guidesRes.json();
      CONFIG.guides = guides;
    } else {
      throw new Error('guides.json no encontrado');
    }
  } catch (e) {
    console.warn('No se encontró guides.json, usando datos internos (SPEC_DETAILS).', e);
    // Ya tenemos SPEC_DETAILS en el código
  }

  console.log('CONFIG cargada:', CONFIG.progress && CONFIG.progress.raids ? CONFIG.progress.raids : 'sin raids');
  renderAll();
  startRosterCarousel();
}

function renderAll() {
  renderRoster();          // Núcleo (portada)
  renderFullRaid();        // Página RAID (para que la fuente de datos esté disponible)
  renderProgress();        // Progreso de banda (portada)
  renderRaidStatus();      // Estado de raid (panel alternativo)
  renderSchedule();        // Horarios (portada)
  renderRecruitment();     // Reclutamiento (portada)
  renderActivities();      // Actividades (portada)
  renderFullRoster();      // Presentación de miembros
  renderGallery();         // Galería portada
  renderFullGallery();     // Página MEDIA
  renderHomeHighlights();
}

function escapeHomeValue(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderHomeHighlights() {
  const rosterCount = document.getElementById('homeRosterCount');
  if (rosterCount) rosterCount.textContent = getAllRosterMembers().length.toLocaleString('es');

  const schedule = Array.isArray(CONFIG?.schedule) ? CONFIG.schedule : [];
  const weekday = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const weekdayIndex = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
  const now = new Date();
  const today = (now.getDay() + 6) % 7;
  const nextSchedule = schedule.map((item, index) => {
    const dayIndex = weekdayIndex[weekday(item.day)];
    if (dayIndex === undefined) return { item, index, delta: 99 };
    let delta = (dayIndex - today + 7) % 7;
    const timeMatch = String(item.time || '').match(/(?:^|\D)(\d{1,2}):(\d{2})/);
    if (delta === 0 && timeMatch) {
      const scheduledMinutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
      if (scheduledMinutes < now.getHours() * 60 + now.getMinutes()) delta = 7;
    }
    return { item, index, delta };
  }).sort((a, b) => a.delta - b.delta || a.index - b.index)[0]?.item;

  const day = document.getElementById('homeNextRaidDay');
  const time = document.getElementById('homeNextRaidTime');
  const note = document.getElementById('homeNextRaidNote');
  if (day) day.textContent = nextSchedule?.day ? String(nextSchedule.day).toUpperCase() : '—';
  if (time) time.textContent = nextSchedule?.time || 'Sin horario configurado';
  if (note) {
    const noteValue = String(nextSchedule?.note || '').trim();
    const timeValue = String(nextSchedule?.time || '');
    const showNote = noteValue && !timeValue.toLowerCase().includes(noteValue.toLowerCase());
    note.textContent = showNote ? noteValue : '';
    note.hidden = !showNote;
  }

  const raids = Array.isArray(CONFIG?.progress?.raids) ? CONFIG.progress.raids : [];
  const requestedIndex = Number(CONFIG?.progress?.homeRaidIndex);
  const homeRaidIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < raids.length ? requestedIndex : 0;
  const raid = raids[homeRaidIndex];
  const value = document.getElementById('homeRaidProgressValue');
  const difficulty = document.getElementById('homeRaidProgressDifficulty');
  const bar = document.getElementById('homeRaidProgressBar');
  const name = document.getElementById('homeRaidProgressName');
  const track = bar?.closest('[role="progressbar"]');
  if (!raid) {
    if (value) value.textContent = '—';
    if (difficulty) difficulty.textContent = 'SIN DATOS';
    if (bar) bar.style.width = '0%';
    if (name) name.textContent = 'Sin progreso configurado';
    if (track) track.setAttribute('aria-valuenow', '0');
    return;
  }

  const progressDifficulty = Number(raid.mm) > 0
    ? { label: 'MÍTICO', count: Number(raid.mm) }
    : Number(raid.hc) > 0
      ? { label: 'HEROICO', count: Number(raid.hc) }
      : { label: 'NORMAL', count: Number(raid.nm) || 0 };
  const total = Array.isArray(raid.bosses) && raid.bosses.length
    ? raid.bosses.length
    : Math.max(Number(raid.nm) || 0, Number(raid.hc) || 0, Number(raid.mm) || 0);
  const defeated = total ? Math.min(total, progressDifficulty.count) : 0;
  const pct = total ? Math.round(defeated / total * 100) : 0;
  if (value) value.textContent = total ? `${defeated} / ${total}` : '—';
  if (difficulty) difficulty.textContent = total ? progressDifficulty.label : 'SIN DATOS';
  if (bar) bar.style.width = `${pct}%`;
  if (name) name.textContent = total ? (raid.name || 'Progreso de la hermandad') : 'Sin encuentros configurados';
  if (track) track.setAttribute('aria-valuenow', String(pct));
}

// ==========================================
// RENDERIZADO DE GALERÍAS (imágenes subidas)
// ==========================================

function renderGallery() {
  const container = document.getElementById('galleryContainer');
  if (!container) return;
  const media = Array.isArray(CONFIG.media) ? CONFIG.media : [];
  
  if (media.length === 0) {
    container.innerHTML = '<div class="odt-gallery-empty">Todavía no hay imágenes publicadas en la galería.</div>';
    return;
  }

  const items = media.slice(0, 3);
  let html = '';
  items.forEach((item, index) => {
    let imgUrl = String(item.imageUrl || '');
    if (!imgUrl) return;
    const alt = escapeHomeValue(item.name || 'Imagen de la hermandad');
    const title = escapeHomeValue(item.name || 'Registro de la hermandad');
    const description = escapeHomeValue(item.description || '');
    const date = escapeHomeValue(formatMediaDate(item.date));
    html += `
      <button class="odt-news-card" type="button" onclick="openImageDetail(${index})" aria-label="Ver ${title}">
        <span class="odt-news-image"><img src="${escapeHomeValue(imgUrl)}" alt="${alt}" loading="lazy"><span class="odt-news-category">GALERÍA</span><span class="odt-news-open" aria-hidden="true">↗</span></span>
        <span class="odt-news-copy"><span class="odt-news-title">${title}</span>${description ? `<span class="odt-news-description">${description}</span>` : ''}${date ? `<span class="odt-news-date">${date}</span>` : ''}</span>
      </button>
    `;
  });
  container.innerHTML = html || '<div class="odt-gallery-empty">Todavía no hay imágenes publicadas en la galería.</div>';
}

function renderFullGallery() {
  const container = document.getElementById('galleryFullContainer');
  if (!container) return;
  const media = CONFIG.media || [];
  
  if (media.length === 0) {
    container.innerHTML = `
      <p style="grid-column:1/-1;color:var(--text-dim);font-style:italic;text-align:center;">No hay imágenes en la galería.</p>
    `;
    return;
  }

  let html = '';
  media.forEach((item, index) => {
    const imgUrl = escapeHomeValue(item.imageUrl || 'https://via.placeholder.com/150?text=Sin+imagen');
    const alt = escapeHomeValue(item.name || 'Imagen');
    const classNum = (index % 4) + 1;
    html += `
      <div class="gallery-thumb gt${classNum}" onclick="openImageDetail(${index})" style="cursor:pointer;">
        <img src="${imgUrl}" alt="${alt}">
        <div class="overlay">${escapeHomeValue(item.name || 'Sin título')}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ===== ROSTER DE PORTADA CON PAGINACIÓN Y CARRUSEL AUTOMÁTICO =====
let rosterPage = 0;
const ROSTER_PER_PAGE = 9;
let rosterInterval = null;
let isTransitioning = false;

// Mapeo de rangos a orden (más alto = más importante)
const RANK_ORDER = {
  'jefe': 110,
  'líder': 105,
  'capitan': 100,
  'capitán': 100,
  'oficial': 90,
  'teniente': 80,
  'heraldo': 70,
  'core': 60,
  'veterano': 50,
  'miembro': 40,
  'aspirante': 30,
  'recluta': 20,
  'invitado': 10
};

function getRankWeight(rank) {
  if (!rank) return 0;
  const lower = rank.toLowerCase().trim();
  // Buscar coincidencia exacta o parcial
  for (const [key, weight] of Object.entries(RANK_ORDER)) {
    if (lower.includes(key)) return weight;
  }
  // Si no coincide, asignar peso según la longitud (fallback)
  return 40;
}

function getAllMembers() {
  const d = CONFIG.roster || {};
  const all = [];

  if (Array.isArray(d.members) && d.members.length > 0) {
    all.push(...d.members);
  } else {
    if (d.tanks) all.push(...d.tanks);
    if (d.healers) all.push(...d.healers);
    if (d.dps) all.push(...d.dps);
  }

  all.sort((a, b) => {
    const wa = getRankWeight(a.rank);
    const wb = getRankWeight(b.rank);
    if (wa !== wb) return wb - wa;
    return (a.name || '').localeCompare(b.name || '');
  });
  return all;
}

function changeRosterPage(delta) {
  if (isTransitioning) return;
  const all = getAllMembers();
  const totalPages = Math.ceil(all.length / ROSTER_PER_PAGE) || 1;
  const newPage = Math.max(0, Math.min(totalPages - 1, rosterPage + delta));
  if (newPage === rosterPage) return;
  rosterPage = newPage;
  renderRoster(true);
}

function renderRoster(animate = false) {
  const container = document.getElementById('rosterContainer');
  if (!container) return;
  
  const allMembers = getAllMembers();
  const totalPages = Math.ceil(allMembers.length / ROSTER_PER_PAGE) || 1;
  if (rosterPage >= totalPages) rosterPage = Math.max(0, totalPages - 1);
  
  const start = rosterPage * ROSTER_PER_PAGE;
  const pageMembers = allMembers.slice(start, start + ROSTER_PER_PAGE);
  
  let html = '';
  
  if (pageMembers.length === 0) {
    html = `<p style="color:var(--text-dim);font-style:italic;text-align:center;padding:20px;">No hay miembros en el roster.</p>`;
  } else {
    pageMembers.forEach(member => {
      const rank = member.rank || 'Miembro';
      const { color } = getClassInfo(member.class?.name);
      const name = member.name || 'Sin nombre';
      const safeName = name.replace(/'/g, "\\'");
      
      html += `<div class="roster-row" onclick="openPlayerDetail('${safeName}')">`;
      html += `<span class="class-dot" style="background:${color};"></span>`;
      html += `<span class="roster-name">${name}</span>`;
      html += `<span class="roster-rank" style="color:var(--gold-light);font-size:12px;font-weight:500;">${rank}</span>`;
      html += `</div>`;
    });
  }
  
  // Aplicar animación de fade si se solicita
  if (animate) {
    container.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    container.style.opacity = '0';
    container.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      container.innerHTML = html;
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
      renderRosterPager(totalPages);
    }, 300);
  } else {
    container.innerHTML = html;
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
    renderRosterPager(totalPages);
  }
}

function renderRosterPager(totalPages) {
  const pager = document.getElementById('rosterPager');
  if (!pager) return;

  if (totalPages <= 1) {
    pager.innerHTML = '';
    return;
  }

  let pagerHtml = '<div class="roster-pager-inner">';
  for (let i = 0; i < totalPages; i++) {
    const active = i === rosterPage ? 'active' : '';
    pagerHtml += `<button type="button" class="pager-dot ${active}" onclick="goRosterPage(${i})" aria-label="Página ${i + 1}"></button>`;
  }
  pagerHtml += '</div>';
  pager.innerHTML = pagerHtml;
}

function goRosterPage(page) {
  if (isTransitioning) return;
  const all = getAllMembers();
  const totalPages = Math.ceil(all.length / ROSTER_PER_PAGE) || 1;
  const newPage = Math.max(0, Math.min(totalPages - 1, page));
  if (newPage === rosterPage) return;
  rosterPage = newPage;
  renderRoster(true);
}

function startRosterCarousel() {
  if (rosterInterval) clearInterval(rosterInterval);
  const all = getAllMembers();
  const totalPages = Math.ceil(all.length / ROSTER_PER_PAGE) || 1;
  if (totalPages <= 1) return;

  // Inicializar primera página sin animación
  renderRoster(false);

  rosterInterval = setInterval(() => {
    if (isTransitioning) return;
    isTransitioning = true;
    const nextPage = (rosterPage + 1) % totalPages;
    rosterPage = nextPage;
    renderRoster(true);
    setTimeout(() => {
      isTransitioning = false;
    }, 500);
  }, 5000); // 5 segundos
}

function stopRosterCarousel() {
  if (rosterInterval) {
    clearInterval(rosterInterval);
    rosterInterval = null;
  }
}

// ---- PRESENTACION DE MIEMBROS ----
let memberShowcase = null;

function getAllRosterMembers() {
  const d = CONFIG.roster || {};
  const rolesMap = { tanks: 'Tanque', healers: 'Sanador', dps: 'DPS' };
  let allMembers = [];

  if (Array.isArray(d.members) && d.members.length > 0) {
    allMembers = d.members.map(member => ({
      ...member,
      role: member.role || '',
      roleKey: member.roleKey || ''
    }));
  } else {
    Object.keys(rolesMap).forEach(roleKey => {
      if (Array.isArray(d[roleKey])) {
        d[roleKey].forEach(member => {
          allMembers.push({
            ...member,
            role: member.role || rolesMap[roleKey],
            roleKey: member.roleKey || roleKey
          });
        });
      }
    });
  }

  return allMembers;
}

function renderFullRoster() {
  const root = document.getElementById('memberShowcase');
  if (!root) return;
  memberShowcase ||= ODTMemberShowcase.create(root, {onRetry: () => loadConfig()});
  memberShowcase.update(getAllRosterMembers(), {status: rosterLoadState});
  memberShowcase.setActive(document.getElementById('page-roster').classList.contains('active'));
}

// Modal compartido con el nucleo de Inicio.
function openPlayerDetail(playerName) {
  const d = CONFIG.roster || {};
  const normalizedTarget = String(playerName || '').trim().toLowerCase();
  let member = null;
  let roleKey = '';

  if (Array.isArray(d.members) && d.members.length > 0) {
    member = d.members.find(m => String(m.name || '').trim().toLowerCase() === normalizedTarget);
  }

  if (!member) {
    const rolesMap = { tanks: 'Tanque', healers: 'Sanador', dps: 'DPS' };
    for (const key of Object.keys(rolesMap)) {
      const found = d[key]?.find(m => String(m.name || '').trim().toLowerCase() === normalizedTarget);
      if (found) {
        member = found;
        roleKey = key;
        break;
      }
    }
  }

  if (!member) {
    alert('Jugador no encontrado');
    return;
  }

  const overlay = document.getElementById('playerDetailOverlay');
  const content = document.getElementById('playerDetailContent');
  
  const { color } = getClassInfo(member.class?.name);
  const spec = member.spec || 'Sin especificar';
  const ilvlText = member.ilvl ? member.ilvl : 'Sin datos';
  const roleValue = member.role || member.rank || 'Sin asignar';
  const roleText = member.role || member.rank || '';
  const attendanceCount = Math.max(0, Number(member.raidAttendance?.count) || 0);
  const armoryUrl = member.armoryUrl || '#';
  const className = member.class?.name || 'Desconocido';
  
  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:16px;">
      <div style="width:64px;height:64px;border-radius:50%;background:${color};border:2px solid var(--border);flex-shrink:0;"></div>
      <div>
        <div style="font-family:'Cinzel',serif;font-size:22px;color:var(--gold-light);">${member.name}</div>
        ${roleText ? `<div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">Rol: ${roleText}</div>` : `<div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">${member.rank || 'Miembro'}</div>`}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="background:var(--bg-alt);padding:12px;border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:'Oswald',sans-serif;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;">Clase</div>
        <div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">${className}</div>
      </div>
      <div style="background:var(--bg-alt);padding:12px;border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:'Oswald',sans-serif;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;">Especialización</div>
        <div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">${spec}</div>
      </div>
      <div style="background:var(--bg-alt);padding:12px;border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:'Oswald',sans-serif;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;">iLvl</div>
        <div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">${ilvlText}</div>
      </div>
      <div style="background:var(--bg-alt);padding:12px;border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:'Oswald',sans-serif;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;">Rol</div>
        <div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--text-muted);margin-top:6px;">${roleValue}</div>
      </div>
      <div style="background:var(--bg-alt);padding:12px;border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:'Oswald',sans-serif;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;">Asistencias de raid</div>
        <div style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--gold-light);margin-top:6px;">${attendanceCount || 'Sin datos'}</div>
      </div>
    </div>
    ${armoryUrl && armoryUrl !== '#' ? `
      <div style="margin-top:16px;text-align:center;">
        <a href="${armoryUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 30px;border:1px solid var(--gold);border-radius:4px;color:var(--gold-light);font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:0.04em;text-decoration:none;transition:background 0.2s;" onmouseover="this.style.background='rgba(201,162,79,0.12)'" onmouseout="this.style.background='transparent'">
          🔗 Ver en Armory
        </a>
      </div>
    ` : ''}
  `;
  
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayerDetail() {
  document.getElementById('playerDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ---- PROGRESO ----
function renderProgress() {
  const container = document.getElementById('progressContainer');
  if (!container) return;

  const raids = Array.isArray(CONFIG.progress.raids) ? CONFIG.progress.raids : [];
  let html = '';
  raids.forEach(raid => {
    html += `<div class="raid-card"><div class="raid-name">${raid.name}</div><div class="difficulty-list">`;
    const diffs = [
      { label: 'NM', value: raid.nm, max: 8 },
      { label: 'HC', value: raid.hc, max: 8 },
      { label: 'MM', value: raid.mm, max: 8 }
    ];
    diffs.forEach(d => {
      const pct = (d.value / d.max) * 100;
      const label = d.value === 0 && d.max === 8 ? 'Próx.' : `${d.value}/${d.max}`;
      html += `<div class="difficulty-row">
        <span class="difficulty-label">${d.label}</span>
        <div class="difficulty-bar"><span style="width:${pct}%"></span></div>
        <span class="difficulty-value ${d.value === 0 && d.max === 8 ? 'soon' : ''}">${label}</span>
      </div>`;
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

// ---- PROGRESO COMPLETO (página Raid) ----
function renderFullRaid() {
  const container = document.getElementById('raidFullContainer');
  if (!container) return;

  const raids = Array.isArray(CONFIG?.progress?.raids) ? CONFIG.progress.raids : [];
  if (!raids.length) {
    container.innerHTML = '<div class="raid-empty">No hay progreso de raid disponible.</div>';
    return;
  }

  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeUrl = value => /^(https?:\/\/|uploads\/)/i.test(String(value || '').trim()) ? String(value).trim() : '';
  const getBosses = raid => Array.isArray(raid?.bosses) && raid.bosses.length
    ? raid.bosses
    : Array.from({ length: Math.max(1, Number(raid?.nm) || Number(raid?.hc) || Number(raid?.mm) || 8) }, (_, i) => ({ name: `Encuentro ${String(i + 1).padStart(2, '0')}`, image: '', subtitle: '' }));

  const buildRaidCard = (raid, raidIndex, selectedDifficulty) => {
    const bosses = getBosses(raid);
    const total = bosses.length;
    const difficulties = [
      { key: 'nm', label: 'Normal', value: Math.max(0, Math.min(total, Number(raid.nm) || 0)) },
      { key: 'hc', label: 'Heroico', value: Math.max(0, Math.min(total, Number(raid.hc) || 0)) },
      { key: 'mm', label: 'Mítico', value: Math.max(0, Math.min(total, Number(raid.mm) || 0)) }
    ];
    const current = difficulties.find(d => d.key === selectedDifficulty) || difficulties.find(d => d.value > 0 && d.key === 'mm') || difficulties.find(d => d.value > 0 && d.key === 'hc') || difficulties[0];
    const progress = current.value;
    const pct = total ? Math.round((progress / total) * 100) : 0;
    const icon = safeUrl(raid.heroImage) || safeUrl(raid.icon);
    const raidTitle = escapeHtml(raid.name || 'Raid');
    const description = escapeHtml(raid.description || 'Estrategias, progreso y preparación de Orden del Toro.');
    const expansion = escapeHtml(raid.expansion || 'CONTENIDO DE RAID');
    const season = escapeHtml(raid.season || 'TEMPORADA ACTUAL');

    const encounterRows = bosses.map((boss,i) => {
      const done = i < progress;
      const sub = escapeHtml(boss.subtitle || (done ? 'Derrotado por la hermandad' : 'Pendiente'));
      const bossIcon = safeUrl(boss.image) || safeUrl(raid.icon);
      return `
        <div class="raid-encounter">
          <span class="raid-encounter-num">${String(i+1).padStart(2,'0')}</span>
          ${bossIcon ? `<img class="raid-encounter-icon" src="${bossIcon}" alt="">` : `<div class="raid-encounter-icon"></div>`}
          <div>
            <div class="raid-encounter-name">${escapeHtml(boss.name || `Encuentro ${i + 1}`)}</div>
            <div class="raid-encounter-sub">${sub}</div>
          </div>
          <div class="raid-encounter-status ${done ? 'done' : ''}">${done ? '1/1 · OK' : '0/1 · PENDIENTE'}</div>
          <button class="raid-guide-btn" type="button" onclick="event.stopPropagation(); openRaidEncounterGuide(${raidIndex}, ${i});">VER GUÍA</button>
        </div>`;
    }).join('');

    return `
      <section class="raid-dashboard">
        <aside class="raid-side">
          <div class="raid-side-title">CONTENIDO</div>
          <div class="raid-filter-label">EXPANSIÓN</div>
          <select class="raid-filter-select" aria-label="Expansión">
            <option>The War Within</option>
            <option>Midnight</option>
          </select>

          <div class="raid-filter-label">TEMPORADA</div>
          <select class="raid-filter-select" aria-label="Temporada">
            <option>Temporada actual</option>
            <option>Histórico</option>
          </select>

          <div class="raid-side-title" style="margin-top:18px;">RAIDS</div>
          <div class="raid-list">
            ${raids.map((r,idx)=>{
              const bossTotal = getBosses(r).length;
              const val = Math.min(bossTotal, Math.max(Number(r.mm)||0, Number(r.hc)||0, Number(r.nm)||0));
              const p = Math.round((val/bossTotal)*100);
              return `
                <div class="raid-list-item ${idx===raidIndex?'active':''}" onclick="renderSelectedRaid(${idx})">
                  ${r.icon ? `<img class="raid-list-icon" src="${r.icon}" alt="">` : `<div class="raid-list-icon"></div>`}
                  <div>
                    <div class="raid-list-name">${escapeHtml(r.name)}</div>
                    <div class="raid-list-progress">${val}/${bossTotal} · ${idx===raidIndex?'SELECCIONADA':'PROGRESO'}</div>
                    <div class="raid-mini-bar"><span style="width:${p}%"></span></div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </aside>

        <main class="raid-main">
          <div class="raid-main-hero" style="${icon ? `--raid-cover:url('${icon}')` : ''}">
            <div class="raid-main-hero-content">
              <div class="raid-main-kicker">${expansion}</div>
              <h3 class="raid-main-title">${raidTitle}</h3>
              <div class="raid-main-sub">${description}</div>
              <div class="raid-difficulty-tabs">
                ${difficulties.map(d => `<button type="button" class="raid-difficulty-tab ${d.key===current.key?'active':''}" onclick="renderSelectedRaid(${raidIndex}, '${d.key}')">${d.label} · ${d.value}/${total}</button>`).join('')}
              </div>
            </div>
          </div>

          <div class="raid-progress-strip">
            <div class="raid-progress-head">
              <div class="raid-progress-label">PROGRESO DE LA HERMANDAD (${current.label})</div>
              <div class="raid-progress-count">${progress}/${total}</div>
            </div>
            <div class="raid-progress-bar"><span style="width:${pct}%"></span></div>
            <div class="raid-progress-meta"><span>${pct}% completado</span><span>${progress>=total?'COMPLETADO':'EN PROGRESO'}</span></div>
          </div>

          <div class="raid-encounters-head">
            <div class="raid-encounters-title">ENCUENTROS</div>
            <div class="raid-encounters-meta">${total} JEFES · ${current.label.toUpperCase()}</div>
          </div>
          <div class="raid-encounter-list">${encounterRows}</div>
          <div id="raidGuidePreview" class="raid-guide-preview"></div>
        </main>

        <aside class="raid-right">
          <div class="raid-right-title">RESUMEN DE PROGRESO</div>
          <div class="raid-summary-big">
            <div class="raid-summary-number">${progress}/${total}</div>
            <div class="raid-summary-label">${current.label}</div>
          </div>
          <div class="raid-stat-grid">
            <div class="raid-stat"><strong>${current.value}</strong><span>Derrotados</span></div>
            <div class="raid-stat"><strong>${Math.max(0,total-current.value)}</strong><span>Pendientes</span></div>
            <div class="raid-stat"><strong>${pct}%</strong><span>Progreso</span></div>
          </div>

          <div class="raid-right-title" style="margin-top:6px;">RECURSOS</div>
          <div class="raid-resource-list">${(Array.isArray(raid.resources) && raid.resources.length ? raid.resources : [{icon:'G',title:'Guías de encuentros',subtitle:'Selecciona un jefe para ver su guía',url:''}]).map(resource => {
            const url = safeUrl(resource.url);
            return `<div class="raid-resource" ${url ? `data-resource-url="${escapeHtml(url)}" onclick="window.open(this.dataset.resourceUrl, '_blank', 'noopener')"` : `onclick="document.getElementById('raidGuidePreview')?.scrollIntoView({behavior:'smooth'})"`}>
              <div class="raid-resource-main"><div class="raid-resource-icon">${escapeHtml(resource.icon || 'R')}</div><div><div class="raid-resource-title">${escapeHtml(resource.title || 'Recurso')}</div><div class="raid-resource-sub">${escapeHtml(resource.subtitle || '')}</div></div></div><div class="raid-resource-arrow">›</div>
            </div>`;
          }).join('')}</div>
        </aside>
      </section>`;
  };

  window.renderSelectedRaid = function(index, difficulty){
    const safe = Math.max(0, Math.min(raids.length-1, Number(index)||0));
    const currentRaid = raids[safe];
    container.innerHTML = buildRaidCard(currentRaid, safe, difficulty);
  };

  window.openRaidEncounterGuide = function(raidIndex, bossIndex){
    const raid = raids[raidIndex];
    const boss = getBosses(raid)[bossIndex] || {};
    const bossName = escapeHtml(boss.name || `Encuentro ${bossIndex+1}`);
    const target = document.getElementById('raidGuidePreview');
    if (!target) return;

    const video = boss.video ? (() => {
      const m = String(boss.video).match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
      return m ? `<div class="raid-guide-video"><iframe src="https://www.youtube.com/embed/${m[1]}" allowfullscreen></iframe></div>` : '';
    })() : '';

    target.innerHTML = `
      <div class="raid-guide-preview-head">
        <div>
          <div class="raid-main-kicker">GUÍA DE ENCUENTRO</div>
          <h4>${bossName}</h4>
        </div>
        <button class="raid-guide-close" type="button" onclick="document.getElementById('raidGuidePreview').classList.remove('open')">CERRAR</button>
      </div>
      ${video}
      <div class="raid-guide-block">
        <h5>RESUMEN</h5>
          <p>${escapeHtml(boss.summary || 'La guía todavía no está cargada. Puedes añadirla desde Admin > Progreso.')}</p>
      </div>
      <div class="raid-guide-block">
        <h5>RESPONSABILIDADES</h5>
        <div class="raid-role-grid">
          <div class="raid-role-box"><strong>Tanques</strong><p>${escapeHtml(boss.roles?.tank || 'Responsabilidades de tanques.')}</p></div>
          <div class="raid-role-box"><strong>Sanadores</strong><p>${escapeHtml(boss.roles?.healer || 'Responsabilidades de sanadores.')}</p></div>
          <div class="raid-role-box"><strong>DPS</strong><p>${escapeHtml(boss.roles?.dps || 'Responsabilidades de DPS.')}</p></div>
        </div>
      </div>`;
    target.classList.add('open');
    target.scrollIntoView({behavior:'smooth',block:'start'});
  };

  window.renderSelectedRaid(0);
}

function renderRaidStatus() {
  const container = document.getElementById('raidStatusContainer');
  if (!container) return;
  const raids = Array.isArray(CONFIG.progress.raids) ? CONFIG.progress.raids : [];
  const totalRaids = raids.length;
  const normal = raids.reduce((sum, raid) => sum + (raid.nm || 0), 0);
  const heroico = raids.reduce((sum, raid) => sum + (raid.hc || 0), 0);
  const mitico = raids.reduce((sum, raid) => sum + (raid.mm || 0), 0);
  const html = `
    <div><div class="stat-label">RAIDS ACTIVAS</div><div class="stat-value">${totalRaids}</div><div class="stat-sub">Progreso real</div></div>
    <div><div class="stat-label">NORMAL</div><div class="stat-value">${normal}/24</div><div class="stat-sub">Jefes derrotados</div></div>
    <div><div class="stat-label">HEROICO</div><div class="stat-value">${heroico}/24</div><div class="stat-sub">Omega próximamente</div></div>
    <div><div class="stat-label">MÍTICO</div><div class="stat-value">${mitico}/24</div><div class="stat-sub">Omega próximamente</div></div>
  `;
  container.innerHTML = html;
}

// ---- HORARIOS ----
function renderSchedule() {
  const container = document.getElementById('scheduleContainer');
  const raidContainer = document.getElementById('raidScheduleContainer');
  if (!container && !raidContainer) return;
  const schedule = Array.isArray(CONFIG.schedule) ? CONFIG.schedule : [];
  const renderItem = item => `<div class="odt-schedule-item"><span class="odt-schedule-day">${escapeHomeValue((item.day || '').toUpperCase())}</span><span class="odt-schedule-time">${escapeHomeValue(item.time || '')}</span>${item.note ? `<span class="odt-schedule-note">${escapeHomeValue(item.note)}</span>` : ''}</div>`;
  if (container) container.innerHTML = schedule.map(renderItem).join('');
  if (raidContainer) {
    const week = [
      ['lunes', 'LUNES'], ['martes', 'MARTES'], ['miercoles', 'MIÉRCOLES'],
      ['jueves', 'JUEVES'], ['viernes', 'VIERNES'], ['sabado', 'SÁBADO'], ['domingo', 'DOMINGO']
    ];
    const dayKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const dayKeys = new Set(week.map(([key]) => key));
    const eventMarkup = item => {
      const rawTime = String(item.time || 'Horario por confirmar').trim();
      const parts = rawTime.split('·').map(part => part.trim()).filter(Boolean);
      const type = parts.length > 1 ? parts.shift() : 'RAID';
      const eventTime = parts.length ? parts.join(' · ') : rawTime;
      const zoneMatch = eventTime.match(/\b(ST|UTC[+-]\d{1,2})\s*$/i);
      const cleanTime = zoneMatch ? eventTime.slice(0, zoneMatch.index).trim() : eventTime;
      const note = item.note && !rawTime.toLowerCase().includes(String(item.note).toLowerCase())
        ? `<span class="odt-week-event-note">${escapeHomeValue(item.note)}</span>`
        : '';
      return `<article class="odt-week-event"><div class="odt-week-event-header"><span class="odt-week-event-type">${escapeHomeValue(type)}</span><span class="odt-week-event-mark" aria-hidden="true">◆</span></div><div class="odt-week-event-time">${escapeHomeValue(cleanTime || 'Hora a confirmar')}</div>${zoneMatch ? `<div class="odt-week-event-zone">${escapeHomeValue(zoneMatch[1].toUpperCase())}</div>` : ''}${note}</article>`;
    };
    const columns = week.map(([key, label]) => {
      const events = schedule.filter(item => dayKey(item.day) === key);
      return `<section class="odt-week-day${events.length ? ' has-events' : ''}"><h4>${label}</h4><div class="odt-week-day-events">${events.length ? events.map(eventMarkup).join('') : '<span class="odt-week-empty">—</span>'}</div></section>`;
    }).join('');
    const otherEvents = schedule.filter(item => !dayKeys.has(dayKey(item.day)));
    raidContainer.innerHTML = schedule.length
      ? `<div class="odt-week-grid">${columns}</div>${otherEvents.length ? `<div class="odt-week-other"><strong>OTROS HORARIOS</strong>${otherEvents.map(renderItem).join('')}</div>` : ''}`
      : '<p class="odt-support-empty">No hay horarios configurados.</p>';
  }
}

// ---- RECLUTAMIENTO ----
function renderRecruitment() {
  const container = document.getElementById('recruitmentContainer');
  if (!container) return;
  const r = CONFIG.recruitment;
  const colors = { dps: '#0070DE', healers: '#FFFFFF', tanks: '#C41F3B' };
  const labels = { dps: 'DPS', healers: 'SANADORES', tanks: 'TANQUE' };
  let html = '';
  ['dps', 'healers', 'tanks'].forEach(key => {
    if (r[key] && r[key].length > 0) {
      html += `<div class="odt-recruitment-row"><div class="recruit-label">${labels[key]}</div><div class="recruit-tags">`;
      r[key].forEach(item => {
        if (typeof item === 'string') {
          const cls = CLASSES.find(c => c.name === item);
          item = { name: item, color: cls ? cls.color : colors[key] };
        }
        const name = item.name || 'Clase';
        const color = item.color || colors[key];
        html += `<span class="recruit-tag"><span class="tag-dot" style="background:${color}"></span>${name}</span>`;
      });
      html += `</div></div>`;
    }
  });
  container.innerHTML = html;
}

// ---- ACTIVIDADES ----
function renderActivities() {
  const titleEl = document.getElementById('activitiesPanelTitle');
  const subtitleEl = document.getElementById('activitiesSubtitle');
  const container = document.getElementById('activitiesContainer');
  const cta = document.getElementById('activitiesCta');
  if (!container) return;
  const m = CONFIG.mplus || { title: 'ACTIVIDADES', subtitle: 'Actividad de hermandad', items: [] };
  if (titleEl) titleEl.textContent = m.title || 'ACTIVIDADES';
  if (subtitleEl) subtitleEl.textContent = m.subtitle || '';
  let html = '';
  const items = Array.isArray(m.items) ? m.items : [];
  if (items.length === 0) {
    html = `<div class="key-row"><span class="key-level">ACT</span><span class="key-name">Sin actividades configuradas</span><span class="key-time">—</span></div>`;
  } else {
    items.forEach(item => {
      const key = item.key || 'ACT';
      const name = item.name || 'Actividad';
      const time = item.time || '';
      html += `<div class="key-row"><span class="key-level">${key}</span><span class="key-name">${name}</span><span class="key-time">${time}</span></div>`;
    });
  }
  container.innerHTML = html;
  if (cta) {
    cta.textContent = (m.ctaLabel || 'COORDINAR ACTIVIDADES').toUpperCase();
    if (m.ctaUrl) cta.href = m.ctaUrl;
  }
}

// ==========================================
// GUÍAS - CATÁLOGO DE ESPECIALIZACIONES
// ==========================================
function spec(cls,abbr,color,name,role,summary,philosophy,picks,priority,note){
  const id=(cls+'-'+name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
  return {id,cls,abbr,color,name,role,summary,philosophy,picks,priority,note};
}
const ROLE_LABEL={tanque:'TANQUE',sanador:'SANADOR',dps:'DPS'};

const SPECS = [
  spec('Guerrero','GU','#C79C6E','Armas','dps','Especialista en objetivo único con sangrados y ejecuciones letales.','Mantén Profundidad de Heridas activo en todo momento y descarga Ejecutar agresivamente bajo el 35% de vida del objetivo; usa Golpe Colosal para sincronizar tu ventana de daño.',['Golpe Mortal (Mortal Strike)','Golpe Colosal (Colossus Smash)','Tempestad de Espadas (Bladestorm)','Avatar'],['Crítico','Maestría','Velocidad','Versatilidad'],'La Maestría potencia el sangrado de Profundidad de Heridas — no la subestimes aunque el Crítico encabece la lista.'),
  spec('Guerrero','GU','#C79C6E','Furia','dps','Build agresivo de doble arma centrado en mantener Enfurecer activo.','Encadena Sed de Sangre y Arremetida para generar y gastar Furia sin parar; usa Imprudencia junto a Tempestad de Espadas para tu ventana de burst.',['Sed de Sangre (Bloodthirst)','Arremetida (Rampage)','Imprudencia (Recklessness)','Tempestad de Espadas (Bladestorm)'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad acelera tu generación de Furia y tu ciclo de Enfurecer, por lo que suele ir primero.'),
  spec('Guerrero','GU','#C79C6E','Protección','tanque','Tanque de mitigación activa basado en Bloqueo y absorción de daño.','Alterna Golpe de Escudo y Bloqueo de Escudo para generar amenaza y reducir daño entrante; usa Ignorar el Dolor de forma proactiva antes de golpes grandes.',['Golpe de Escudo (Shield Slam)','Bloqueo de Escudo (Shield Block)','Ignorar el Dolor (Ignore Pain)','Avatar'],['Velocidad','Maestría','Versatilidad','Crítico'],'La Velocidad mejora tu generación de Furia para mantener Ignorar el Dolor activo de forma constante.'),
  spec('Paladín','PA','#F58CBA','Sagrado','sanador','Sanador de área con curación reactiva y picos de sanación crítica.','Mantén Bendición de la Luz Sagrada en objetivos clave y usa tus cooldowns de banda en torno a fases de daño en área predecibles.',['Luz Sagrada (Holy Light)','Palabra de Gloria (Word of Glory)','Aura de Luz','Apoteosis (Avenging Wrath)'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad te da más lanzamientos por minuto, clave para cubrir daño en área sostenido.'),
  spec('Paladín','PA','#F58CBA','Protección','tanque','Tanque de bloqueo activo con fuerte mitigación física.','Prioriza Juicio para generar Poder Sagrado y descarga Escudo del Justo para mantener tu Bloqueo siempre activo.',['Escudo del Justo (Shield of the Righteous)','Juicio (Judgment)','Bastión de la Luz','Defensor Avenger'],['Maestría','Velocidad','Versatilidad','Crítico'],'La Maestría aumenta directamente tu probabilidad de Bloqueo, el corazón de tu mitigación.'),
  spec('Paladín','PA','#F58CBA','Reprensión','dps','DPS de cuerpo a cuerpo con picos de daño sagrado mediante Poder Sagrado.','Acumula Poder Sagrado con Golpe del Cruzado y gástalo en Veredicto Final; sincroniza Cruzada con tus ventanas de daño en banda.',['Veredicto Final (Final Verdict)','Cruzada (Crusade)','Llama Sagrada (Wake of Ashes)','Justicia Divina'],['Velocidad','Crítico','Versatilidad','Maestría'],'La Velocidad acelera tu generación de Poder Sagrado y por tanto tu frecuencia de Veredicto Final.'),
  spec('Cazador','CZ','#ABD473','Bestias','dps','DPS centrado en tu mascota, con daño sostenido y fácil movilidad.','Mantén Disparo Cobra entre cooldowns para alimentar el daño de tu mascota y sincroniza Furia Bestial con Llamada de la Naturaleza.',['Furia Bestial (Bestial Wrath)','Disparo Cobra (Cobra Shot)','Llamada de la Naturaleza (Call of the Wild)','Matar Cobra'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad reduce tu tiempo entre cast de Disparo Cobra, acelerando todo tu ciclo de daño.'),
  spec('Cazador','CZ','#ABD473','Puntería','dps','DPS a distancia de ventanas de burst con Disparo Certero.','Acumula Precisión y descarga Lluvia de Flechas durante tu ventana de Crepitación para maximizar objetivos golpeados por Disparo Certero.',['Disparo Certero (Aimed Shot)','Lluvia de Flechas (Rapid Fire)','Crepitación (Trick Shots)','Tiro de Doble Etiqueta'],['Crítico','Maestría','Velocidad','Versatilidad'],'El Crítico potencia directamente tus ventanas de Disparo Certero, tu mayor fuente de daño.'),
  spec('Cazador','CZ','#ABD473','Supervivencia','dps','DPS cuerpo a cuerpo híbrido con bombas y golpes de veneno.','Coloca Bomba de Fuego Salvaje antes de pulls grandes y enlaza tu rotación de melee alrededor de Asalto Coordinado.',['Bomba de Fuego Salvaje (Wildfire Bomb)','Asalto Coordinado (Coordinated Assault)','Mordisco de Serpiente (Raptor Strike)','Grito de Caza'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Velocidad acorta tu tiempo de reutilización de Bomba de Fuego Salvaje, tu mayor fuente de daño en área.'),
  spec('Pícaro','PI','#FFF569','Asesinato','dps','DPS de veneno y sangrado con foco en objetivo único.','Mantén Veneno Mortal y Cuchillada al máximo de aplicaciones antes de descargar Puñalada Trapera; sincroniza Vendetta con tus burst windows.',['Puñalada Trapera (Envenom)','Vendetta','Emboscada (Ambush)','Veneno Mortal (Deadly Poison)'],['Crítico','Maestría','Velocidad','Versatilidad'],'La Maestría aumenta el daño de tus venenos, el núcleo de tu rotación de sangrado.'),
  spec('Pícaro','PI','#FFF569','Forajido','dps','DPS versátil con generación de Puntos de Combate mediante Tirar los Huesos.','Reaplica Tirar los Huesos buscando combinaciones fuertes y descarga Despachar como finisher principal en objetivo único.',['Tirar los Huesos (Roll the Bones)','Despachar (Dispatch)','Entre Cejas (Between the Eyes)','Adrenalina'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Velocidad acelera tu generación de energía, dándote más reaplicaciones de Tirar los Huesos por minuto.'),
  spec('Pícaro','PI','#FFF569','Sutileza','dps','DPS de sigilo con ventanas de daño explosivo desde las sombras.','Sincroniza Danza de Sombras con Símbolos de la Muerte para maximizar tus golpes críticos de Puñalada Sombría.',['Puñalada Sombría (Shadowstrike)','Danza de Sombras (Shadow Dance)','Símbolos de la Muerte','Golpe Final (Eviscerate)'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico maximiza el daño de tus ventanas explosivas durante Danza de Sombras.'),
  spec('Sacerdote','SA','#FFFFFF','Disciplina','sanador','Sanador híbrido que cura mediante el daño con Atonement.','Mantén Escudo de Poder rotando entre el grupo y usa Castigo/Penitencia para convertir daño en sanación constante.',['Escudo de Poder (Power Word: Shield)','Atonement','Castigo (Smite)','Éxtasis (Rapture)'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad te permite reaplicar Escudo de Poder a más objetivos por minuto.'),
  spec('Sacerdote','SA','#FFFFFF','Sagrado','sanador','Sanador reactivo con fuertes picos de sanación crítica.','Aprovecha Apoteosis durante fases de daño pesado y mantén Resurgir activo en el tanque para suavizar picos de daño.',['Sanación Mayor (Heal)','Resurgir (Renew)','Apoteosis (Apotheosis)','Halo'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico amplifica directamente tus picos de sanación, el sello de este estilo de juego.'),
  spec('Sacerdote','SA','#FFFFFF','Sombra','dps','DPS de dolencias con un ciclo de Locura entre Vacío y Forma Sombría.','Mantén Plaga Devoradora y Locura Mental activos en todo momento, gastando Locura en Explosión Mental cuando esté disponible.',['Forma de Vacío (Voidform)','Plaga Devoradora (Devouring Plague)','Locura Mental (Mind Flay: Insanity)','Explosión Mental'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad acelera el tickeo de tus dolencias y tu generación de Locura.'),
  spec('Caballero de la Muerte','CM','#C41F3B','Sangre','tanque','Tanque de auto-sanación mediante Golpe de la Muerte.','Gasta Poder Rúnico en Golpe de la Muerte cuando tu vida esté baja y mantén Marca de Sangre activo para amenaza en área.',['Golpe de la Muerte (Death Strike)','Marca de Sangre (Blood Boil)','Escudo Óseo (Bone Shield)','Festín de Almas'],['Velocidad','Maestría','Versatilidad','Crítico'],'La Maestría aumenta tu Escudo de Sangre, una de tus principales fuentes de absorción.'),
  spec('Caballero de la Muerte','CM','#C41F3B','Escarcha','dps','DPS de cuerpo a cuerpo con golpes helados de doble arma.','Mantén Pacto de Hielo activo y descarga Aniquilar repetidamente, reservando Aliento del Wyrm de Escarcha para pulls grandes.',['Aniquilar (Obliterate)','Pacto de Hielo (Pillar of Frost)','Golpe de Escarcha (Frostscythe)','Aliento del Wyrm de Escarcha'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico potencia tus golpes de Aniquilar, tu mayor fuente de daño en objetivo único.'),
  spec('Caballero de la Muerte','CM','#C41F3B','Profano','dps','DPS de plaga y no-muertos con daño sostenido a través del tiempo.','Aplica Plaga Vil para acumular cargas de Sed de Hueso y detona Apocalipsis junto a tu Ejército de los Muertos.',['Plaga Vil (Festering Strike)','Apocalipsis (Apocalypse)','Ejército de los Muertos','Explosión de Plaga Vil'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Maestría amplifica el daño de tus dolencias y golpes de no-muerto, el núcleo de tu rotación.'),
  spec('Chamán','CH','#0070DE','Elemental','dps','DPS a distancia con picos de daño mediante Descarga de Lava.','Acumula Maelström y descarga Shock de Tierra junto a Vigilante de Tormentas para maximizar tus ventanas de daño.',['Descarga de Lava (Lava Burst)','Shock de Tierra (Earth Shock)','Vigilante de Tormentas (Stormkeeper)','Ascenso'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico amplifica tus picos de Descarga de Lava, garantizados en crítico bajo ciertas condiciones.'),
  spec('Chamán','CH','#0070DE','Mejora','dps','DPS de cuerpo a cuerpo con doble arma y daño elemental añadido.','Mantén Conmoción activo en el objetivo y usa Ascenso para convertir tu rotación en daño elemental puro durante la ventana.',['Conmoción (Stormstrike)','Golpe de Lava (Lava Lash)','Ascenso (Ascendance)','Doble Filo Elemental'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Maestría aumenta el daño elemental añadido a tus golpes físicos, clave en esta especialización.'),
  spec('Chamán','CH','#0070DE','Restauración','sanador','Sanador de área con fuerte sanación residual mediante totems.','Mantén Cadena de Curación rotando en grupos de daño en área y coloca tus totems antes de fases predecibles de daño.',['Cadena de Curación (Chain Heal)','Lluvia Curativa (Healing Rain)','Totem de Aguas Espirituales','Ascenso'],['Maestría','Velocidad','Crítico','Versatilidad'],'La Maestría incrementa tu sanación cuanto más bajo esté de vida el objetivo, recompensando una buena lectura de daño.'),
  spec('Mago','MA','#69CCF0','Arcano','dps','DPS de gestión de maná con ciclos de carga y descarga (burn/conserve).','Acumula cargas de Poder Arcano durante tu fase de conservación y descárgalas en Sobrecarga Arcana para tu ventana de burst.',['Andanada Arcana (Arcane Barrage)','Sobrecarga Arcana (Arcane Surge)','Misiles Arcanos (Arcane Missiles)','Toque Arcano'],['Crítico','Maestría','Velocidad','Versatilidad'],'El Crítico y la Maestría trabajan juntos para maximizar el daño de tus ventanas de Poder Arcano.'),
  spec('Mago','MA','#69CCF0','Fuego','dps','DPS de picos críticos mediante la proc de Calor Intenso.','Busca procs de Calor Intenso para lanzar Piromancia gratuita y sincroniza Combustión con tus mayores ventanas de crítico garantizado.',['Combustión (Combustion)','Piromancia (Pyroblast)','Calor Intenso (Hot Streak)','Bola de Fuego (Fireball)'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico es la base absoluta de esta especialización: más crítico significa más procs de Calor Intenso.'),
  spec('Mago','MA','#69CCF0','Escarcha','dps','DPS con control de movimiento y picos de daño mediante Lanza de Hielo.','Mantén Forma de Hielo para tu ventana principal y dispara Lanza de Hielo en objetivos con Vulnerabilidad al Frío aplicada.',['Lanza de Hielo (Ice Lance)','Forma de Hielo (Icy Veins)','Cometa de Hielo (Comet Storm)','Cono de Frío'],['Crítico','Maestría','Velocidad','Versatilidad'],'El Crítico potencia tus golpes garantizados de Lanza de Hielo sobre objetivos congelados.'),
  spec('Brujo','BR','#9482C9','Aflicción','dps','DPS de dolencias con daño sostenido sobre múltiples objetivos.','Mantén Corrupción y Agonía activos en todos los objetivos relevantes e invoca a Darkglare durante fases de daño pesado.',['Corrupción (Corruption)','Agonía (Agony)','Golpe Maléfico (Malefic Rapture)','Invocar Darkglare'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Velocidad acelera el tickeo de tus dolencias, la fuente principal de tu daño sostenido.'),
  spec('Brujo','BR','#9482C9','Demonología','dps','DPS de invocación con ventanas de daño centradas en el Tirano Demoníaco.','Acumula diablillos y mascotas antes de invocar al Tirano Demoníaco, que amplifica el daño de todos tus demonios activos.',['Mano de Gul’dan (Hand of Gul’dan)','Invocar Diablillos (Call Dreadstalkers)','Tirano Demoníaco (Demonic Tyrant)','Carnicero Implacable'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad acelera tu generación de Furia Demoníaca, clave para invocar más demonios por minuto.'),
  spec('Brujo','BR','#9482C9','Destrucción','dps','DPS de picos de daño mediante Caos Incinerante cargado con Fragmentos de Alma.','Acumula Fragmentos de Alma con Inmolar y Conflagrar, y descárgalos en Caos Incinerante durante tu ventana de Vagabundo Infernal.',['Caos Incinerante (Chaos Bolt)','Inmolar (Immolate)','Vagabundo Infernal (Summon Infernal)','Conflagrar'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico amplifica directamente el daño de Caos Incinerante, tu mayor inversión de recursos.'),
  spec('Monje','MO','#00FF96','Maestro Cervecero','tanque','Tanque de mitigación basado en absorción mediante Cerveza Negra.','Alterna Niebla Purificadora y Escudo de Cerveza Negra para suavizar picos de daño físico y mantén Aliento de Fuego activo para amenaza.',['Escudo de Cerveza Negra (Celestial Brew)','Niebla Purificadora (Purifying Brew)','Aliento de Fuego (Breath of Fire)','Postura del Tigre Borracho'],['Versatilidad','Velocidad','Maestría','Crítico'],'La Versatilidad reduce todo el daño que recibes de forma plana, complementando tu mitigación activa.'),
  spec('Monje','MO','#00FF96','Tejedor de Niebla','sanador','Sanador móvil con sanación continua mediante Niebla Revitalizante.','Canaliza Niebla Revitalizante en el tanque para generar Chi y gasta en Esencia Envolvente o Loto Renovador según la situación.',['Niebla Revitalizante (Soothing Mist)','Esencia Envolvente (Enveloping Mist)','Loto Renovador (Renewing Mist)','Invocar Xuen'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico potencia tus sanaciones directas, esenciales para reaccionar a picos de daño repentinos.'),
  spec('Monje','MO','#00FF96','Viento Errante','dps','DPS de combos rápidos con artes marciales y elementos.','Construye Chi con Golpe del Tigre y gástalo en Patada Giratoria o Golpe del Loto Blanco según el número de objetivos.',['Golpe del Tigre (Tiger Palm)','Patada Giratoria (Spinning Crane Kick)','Golpe del Loto Blanco (Fists of Fury)','Tormenta, Tierra y Fuego'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico maximiza tus combos de golpes rápidos, el corazón de tu daño por minuto.'),
  spec('Druida','DR','#FF7D0A','Equilibrio','dps','DPS a distancia que alterna entre energía Lunar y Solar (Eclipse).','Alterna entre Ráfaga Lunar y Bola de Fuego Solar para activar tus Eclipses y descarga Furia Estelar en grupos de enemigos.',['Furia Estelar (Starfall)','Bola de Fuego Solar (Starsurge)','Eclipse','Empoderamiento Cósmico'],['Velocidad','Crítico','Maestría','Versatilidad'],'La Velocidad acelera tu ciclo de Eclipse, permitiéndote alcanzar tus picos de daño con más frecuencia.'),
  spec('Druida','DR','#FF7D0A','Feral','dps','DPS cuerpo a cuerpo felino con sangrados y puntos de combate.','Mantén Desgarro activo en el objetivo y gasta puntos de combo en Mutilar, reservando Furia Salvaje para tus pulls más importantes.',['Desgarro (Rip)','Mutilar (Shred)','Furia Salvaje (Berserk)','Encarnación: Avatar del Rey Salvaje'],['Crítico','Maestría','Versatilidad','Velocidad'],'El Crítico amplifica tanto tus golpes directos como tus sangrados, ambos pilares de tu daño.'),
  spec('Druida','DR','#FF7D0A','Guardián','tanque','Tanque resistente con mitigación pasiva alta y picos de absorción.','Mantén Piel de Hierro activo de forma casi constante y usa Frenesí de Sangre antes de pulls grandes para reducir el daño entrante.',['Carnicero (Mangle)','Piel de Hierro (Ironfur)','Frenesí de Sangre (Berserk)','Forma de Oso de las Tierras Salvajes'],['Versatilidad','Maestría','Velocidad','Crítico'],'La Versatilidad reduce todo el daño entrante de forma plana, complementando tu alta mitigación pasiva.'),
  spec('Druida','DR','#FF7D0A','Restauración','sanador','Sanador de mantenimiento con fuerte sanación residual (HoT).','Mantén Florecimiento Vital en el tanque y Crecimiento Salvaje en el grupo durante fases de daño en área para maximizar tu sanación pasiva.',['Florecimiento Vital (Lifebloom)','Crecimiento Salvaje (Wild Growth)','Resurgimiento (Rejuvenation)','Árbol de la Vida'],['Maestría','Crítico','Velocidad','Versatilidad'],'La Maestría incrementa el efecto de tus sanaciones residuales, el núcleo absoluto de este estilo de juego.'),
  spec('Cazador de Demonios','CD','#A330C9','Caos','dps','DPS de cuerpo a cuerpo ágil con daño de Caos puro.','Mantén Inmolación activo en área y descarga Hoja del Caos cuando tengas la mayor cantidad de Furia Demoníaca disponible.',['Hoja del Caos (Chaos Strike)','Danza de Cuchillas (Blade Dance)','Inmolación (Immolation Aura)','Metamorfosis'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico amplifica directamente el daño de Hoja del Caos, tu finisher principal.'),
  spec('Cazador de Demonios','CD','#A330C9','Venganza','tanque','Tanque demoníaco con mitigación activa mediante Picos Demoníacos.','Genera dolor con Marca Llameante y descárgalo en Devastación Infernal; activa Picos Demoníacos antes de golpes físicos grandes.',['Devastación Infernal (Fel Devastation)','Picos Demoníacos (Demon Spikes)','Marca Llameante (Sigil of Flame)','Metamorfosis'],['Versatilidad','Velocidad','Maestría','Crítico'],'La Versatilidad reduce el daño entrante de forma constante, complementando tus picos de mitigación activa.'),
  spec('Evocador','EV','#33937F','Devastación','dps','DPS a distancia con aliento elemental en área y picos de daño directo.','Alterna Aliento de Fuego Esmeralda con Disipación y reserva Aliento de Eternidad para tus ventanas de mayor número de objetivos.',['Aliento de Fuego Esmeralda (Fire Breath)','Disipación (Disintegrate)','Aliento de Eternidad (Eternity Surge)','Hidra Volcánica'],['Crítico','Velocidad','Maestría','Versatilidad'],'El Crítico potencia tanto tu daño directo como tus dolencias elementales por igual.'),
  spec('Evocador','EV','#33937F','Preservación','sanador','Sanador de eco y previsión con fuerte sanación en área predictiva.','Aplica Eco en objetivos antes de fases de daño previsibles y usa Aliento del Sueño para sanación en área sostenida.',['Eco (Echo)','Aliento del Sueño (Dream Breath)','Verdor (Verdant Embrace)','Tiempo Detenido'],['Crítico','Maestría','Velocidad','Versatilidad'],'El Crítico amplifica tus sanaciones directas y la duplicación que otorga Eco.'),
  spec('Evocador','EV','#33937F','Aumentación','dps','DPS de soporte que amplifica el daño de su grupo en lugar de competir por el suyo.','Mantén Visión de Ébano en tus mejores DPS y aplica Augurio antes de sus ventanas de cooldown para maximizar el daño del grupo.',['Visión de Ébano (Ebon Might)','Augurio (Prescience)','Aliento de Bronce','Tiempo Detenido'],['Velocidad','Maestría','Crítico','Versatilidad'],'La Velocidad te permite reaplicar tus buffs a más aliados con mayor frecuencia, maximizando tu valor de soporte.'),
];

// El importador de Archon también devuelve Devourer. Debe estar disponible
// en el selector para que su guía no quede guardada sin poder abrirse.
SPECS.push(spec('Cazador de Demonios','CD','#A330C9','Devourer','dps',
  'Equipo y talentos de la guía importada para el parche seleccionado.','',[],[],''));

const CLASS_ICONS = {
  'Guerrero': 'https://wow.zamimg.com/images/wow/icons/large/class_warrior.jpg',
  'Paladín': 'https://wow.zamimg.com/images/wow/icons/large/class_paladin.jpg',
  'Cazador': 'https://wow.zamimg.com/images/wow/icons/large/class_hunter.jpg',
  'Pícaro': 'https://wow.zamimg.com/images/wow/icons/large/class_rogue.jpg',
  'Sacerdote': 'https://wow.zamimg.com/images/wow/icons/large/class_priest.jpg',
  'Caballero de la Muerte': 'https://wow.zamimg.com/images/wow/icons/large/class_death_knight.jpg',
  'Chamán': 'https://wow.zamimg.com/images/wow/icons/large/class_shaman.jpg',
  'Mago': 'https://wow.zamimg.com/images/wow/icons/large/class_mage.jpg',
  'Brujo': 'https://wow.zamimg.com/images/wow/icons/large/class_warlock.jpg',
  'Monje': 'https://wow.zamimg.com/images/wow/icons/large/class_monk.jpg',
  'Druida': 'https://wow.zamimg.com/images/wow/icons/large/class_druid.jpg',
  'Cazador de Demonios': 'https://wow.zamimg.com/images/wow/icons/large/class_demon_hunter.jpg',
  'Evocador': 'https://wow.zamimg.com/images/wow/icons/large/class_evoker.jpg'
};


const SPEC_ICONS = {
  'guerrero-armas':'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_swordandboard.jpg',
  'guerrero-furia':'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_focusedrage.jpg',
  'guerrero-proteccion':'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_defensivestance.jpg',
  'paladin-sagrado':'https://wow.zamimg.com/images/wow/icons/large/spell_holy_holybolt.jpg',
  'paladin-proteccion':'https://wow.zamimg.com/images/wow/icons/large/ability_paladin_shieldofthetemplar.jpg',
  'paladin-reprension':'https://wow.zamimg.com/images/wow/icons/large/spell_holy_crusaderstrike.jpg',
  'cazador-bestias':'https://wow.zamimg.com/images/wow/icons/large/ability_hunter_bestialdiscipline.jpg',
  'cazador-punteria':'https://wow.zamimg.com/images/wow/icons/large/ability_hunter_misdirection.jpg',
  'cazador-supervivencia':'https://wow.zamimg.com/images/wow/icons/large/ability_hunter_mongoosebite.jpg',
  'picaro-asesinato':'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_deadlybrew.jpg',
  'picaro-forajido':'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_sinistercalling.jpg',
  'picaro-sutileza':'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_shadowdance.jpg',
  'sacerdote-disciplina':'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerinfusion.jpg',
  'sacerdote-sagrado':'https://wow.zamimg.com/images/wow/icons/large/spell_holy_holybolt.jpg',
  'sacerdote-sombra':'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowform.jpg',
  'caballero-de-la-muerte-sangre':'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_bloodpresence.jpg',
  'caballero-de-la-muerte-escarcha':'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_frostpresence.jpg',
  'caballero-de-la-muerte-profano':'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_unholypresence.jpg',
  'chaman-elemental':'https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightningshield.jpg',
  'chaman-mejora':'https://wow.zamimg.com/images/wow/icons/large/spell_shaman_stormstrike.jpg',
  'chaman-restauracion':'https://wow.zamimg.com/images/wow/icons/large/spell_nature_magicimmunity.jpg',
  'mago-arcano':'https://wow.zamimg.com/images/wow/icons/large/spell_nature_starfall.jpg',
  'mago-fuego':'https://wow.zamimg.com/images/wow/icons/large/spell_fire_firebolt02.jpg',
  'mago-escarcha':'https://wow.zamimg.com/images/wow/icons/large/spell_frost_frostbolt02.jpg',
  'brujo-afliccion':'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_haunt.jpg',
  'brujo-demonologia':'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_metamorphosis.jpg',
  'brujo-destruccion':'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_rainoffire.jpg',
  'monje-maestro-cervecero':'https://wow.zamimg.com/images/wow/icons/large/spell_monk_blackoutkick.jpg',
  'monje-tejedor-de-niebla':'https://wow.zamimg.com/images/wow/icons/large/spell_monk_renewingmist.jpg',
  'monje-viento-errante':'https://wow.zamimg.com/images/wow/icons/large/spell_monk_dragonkick.jpg',
  'druida-equilibrio':'https://wow.zamimg.com/images/wow/icons/large/spell_nature_starfall.jpg',
  'druida-feral':'https://wow.zamimg.com/images/wow/icons/large/ability_druid_catform.jpg',
  'druida-guardian':'https://wow.zamimg.com/images/wow/icons/large/ability_racial_bearform.jpg',
  'druida-restauracion':'https://wow.zamimg.com/images/wow/icons/large/spell_nature_healingtouch.jpg',
  'cazador-de-demonios-caos':'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_metamorphosis.jpg',
  'cazador-de-demonios-venganza':'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_soulcleave.jpg',
  'evocador-devastacion':'https://wow.zamimg.com/images/wow/icons/large/classicon_evoker_devastation.jpg',
  'evocador-preservacion':'https://wow.zamimg.com/images/wow/icons/large/spell_evoker_reversion.jpg',
  'evocador-aumentacion':'https://wow.zamimg.com/images/wow/icons/large/spell_evoker_ebonmight.jpg'
};


function getSpecIconUrl(specObj){
  if(!specObj) return '';
  if(SPEC_ICONS[specObj.id]) return SPEC_ICONS[specObj.id];
  const key = String(specObj.id || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(SPEC_ICONS[key]) return SPEC_ICONS[key];
  const normalized = Object.keys(SPEC_ICONS).find(k => k === key || k.replace(/\s+/g,'-') === key);
  return normalized ? SPEC_ICONS[normalized] : (CLASS_ICONS[specObj.cls] || '');
}

const TALENT_URLS = {
  'Guerrero': 'https://www.wowhead.com/es/talent-calc/warrior',
  'Paladín': 'https://www.wowhead.com/es/talent-calc/paladin',
  'Cazador': 'https://www.wowhead.com/es/talent-calc/hunter',
  'Pícaro': 'https://www.wowhead.com/es/talent-calc/rogue',
  'Sacerdote': 'https://www.wowhead.com/es/talent-calc/priest',
  'Caballero de la Muerte': 'https://www.wowhead.com/es/talent-calc/death-knight',
  'Chamán': 'https://www.wowhead.com/es/talent-calc/shaman',
  'Mago': 'https://www.wowhead.com/es/talent-calc/mage',
  'Brujo': 'https://www.wowhead.com/es/talent-calc/warlock',
  'Monje': 'https://www.wowhead.com/es/talent-calc/monk',
  'Druida': 'https://www.wowhead.com/es/talent-calc/druid',
  'Cazador de Demonios': 'https://www.wowhead.com/es/talent-calc/demon-hunter',
  'Evocador': 'https://www.wowhead.com/es/talent-calc/evoker'
};

// ==========================================
// GUÍAS - NAVEGACIÓN
// ==========================================
function renderClassGrid(){
  const container = document.getElementById('classGroupsContainer');
  const classes = [...new Set(SPECS.map(s=>s.cls))];
  const patchOptions = getAvailableGuidePatches();
  const currentPatchKey = getCurrentGuidePatchKey(patchOptions);
  container.innerHTML = `
    <div class="class-grid-container">
      <div class="guides-upgrade-title">GUÍAS DE LA ORDEN</div>
      <div class="guides-upgrade-subtitle">Builds y recomendaciones para el contenido actual</div>
      <div class="guides-patch-bar">
        <span class="guides-patch-label">Parche</span>
        <select id="guidesPatchSelect" class="guides-patch-select">
          ${patchOptions.length ? patchOptions.map(pk => `<option value="${escapeGuideValue(pk)}" ${pk===currentPatchKey?'selected':''}>${escapeGuideValue(getGuidePatchLabel(pk))}</option>`).join('') : '<option value="">No hay parches activos</option>'}
        </select>
      </div>
      <div class="guides-class-grid">
        ${classes.map(cls => `
          <button class="guides-class-card" type="button" onclick="selectClass('${cls.replace(/'/g,"\\'")}')">
            <img class="guides-class-icon" src="${CLASS_ICONS[cls] || ''}" alt="${cls}" loading="lazy">
            <span class="guides-class-name">${cls}</span>
            <span class="guides-class-count">${SPECS.filter(s=>s.cls===cls).length} especializaciones</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  const patchSel = document.getElementById('guidesPatchSelect');
  if(patchSel){
    patchSel.addEventListener('change',()=>{
      window._selectedGuidesPatchKey = normalizePatchToKey(patchSel.value);
    });
  }
}

// La pestaña GUÍAS muestra las clases directamente. Al elegir una, abrimos
// el navegador clásico de especializaciones y conservamos el detalle original.
function renderGuidesLandingClasses(){
  const container = document.getElementById('guidesLandingClassGrid');
  if (!container) return;
  const classes = [...new Set(SPECS.map(s => s.cls))];
  container.innerHTML = `
    <div class="guides-class-grid">
      ${classes.map(cls => `
        <button class="guides-class-card" type="button" onclick="openClassGuides('${cls.replace(/'/g,"\\'")}')">
          <img class="guides-class-icon" src="${CLASS_ICONS[cls] || ''}" alt="" loading="lazy">
          <span class="guides-class-name">${cls}</span>
          <span class="guides-class-count">${SPECS.filter(s => s.cls === cls).length} especializaciones</span>
        </button>
      `).join('')}
    </div>`;
}

function openClassGuides(selectedClass){
  openGuides();
  selectClass(selectedClass);
}

function getAvailableGuidePatches(){
  if(guidePatchOptionsLoaded)return guidePatchOptions.map(p=>p.key);
  const fallback=new Map();
  Object.entries((CONFIG&&CONFIG.guides)||{}).forEach(([key,guide])=>{
    const patch=String(guide?.patch||'').trim()||String(key).match(/-(\d+(?:_\d+)*)$/)?.[1]?.replace(/_/g,'.')||'';
    if(patch){const normalized=normalizePatchToKey(patch);if(normalized)fallback.set(normalized,{key:normalized,name:patch,order:0});}
  });
  return [...fallback.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function escapeGuideValue(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function loadGuidePatchOptions(){
  try{
    const patchesRef=db.collection('guidePatches');
    let snapshot;
    try{snapshot=await patchesRef.where('active','==',true).get();}
    catch{snapshot=await patchesRef.get();}
    // Compatibilidad con parches antiguos que todavía no tenían `active`.
    // Se consulta todo solo si la consulta pública normal no encontró ninguno.
    if(snapshot.empty)snapshot=await patchesRef.get();
    guidePatchOptions=ODTGuidePatches.mergeGuidePatches(snapshot.docs.map(doc=>doc.data()), CONFIG?.guides);
    guidePatchOptionsLoaded=true;
  }catch(error){
    console.warn('[Guías] No se pudieron cargar los parches activos de Admin.',error);
    guidePatchOptions=ODTGuidePatches.mergeGuidePatches([], CONFIG?.guides);
    guidePatchOptionsLoaded=true;
  }
  const keys=getAvailableGuidePatches();
  if(!keys.includes(window._selectedGuidesPatchKey))window._selectedGuidesPatchKey=keys[keys.length-1]||'';
  return keys;
}

function getGuidePatchLabel(key){return guidePatchOptions.find(p=>p.key===key)?.name||String(key||'').replace(/_/g,'.');}
function getCurrentGuidePatchKey(keys=getAvailableGuidePatches()){
  if(keys.includes(window._selectedGuidesPatchKey))return window._selectedGuidesPatchKey;
  return keys[keys.length-1]||'';
}

function normalizePatchToKey(patch){
  const s = String(patch||'').trim();
  if(!s) return '';
  const versionKey = window.ODTGuidePatches?.patchKey(s);
  if(versionKey) return versionKey;
  return s.replace(/\s+/g,'').replace(/\./g,'_').toLocaleLowerCase();
}

function getGuideKeyCandidatesFor(selectedClass, specId, patchKey){
  // specId viene como `Guerrero-proteccion` (desde tu SPECS)
  const parts = String(specId||'').split('-');
  // className está en selectedClass, lo usamos para reconstruir
  // guide keys: `${className}-${specName}-${patch}` normalizado con '_' en vez de '.'
  const specName = parts.slice(1).join('-');
  const base = `${selectedClass}-${specName}`;
  const patchPart = patchKey ? `-${patchKey}` : '';
  return {
    key: `${base}${patchPart}`,
    baseKey: `${base}`
  };
}

function findGuideForSpecPatch(selectedClass,specId,patchKey){
  const guides=(CONFIG&&CONFIG.guides)||{},candidates=getGuideKeyCandidatesFor(selectedClass,specId,patchKey);
  const wantedBases=[specId,candidates.baseKey].map(x=>String(x).toLocaleLowerCase());
  const entries=Object.entries(guides).filter(([key,value])=>{
    if(!value||typeof value!=='object')return false;
    const versionMatch=String(key).match(/-(\d+(?:[._]\d+)*)$/),keyPatch=versionMatch?.[1]?.replace(/\./g,'_').toLocaleLowerCase()||'';
    const keyBase=versionMatch?String(key).slice(0,versionMatch.index):String(key);
    if(!wantedBases.includes(keyBase.toLocaleLowerCase()))return false;
    const valuePatch=normalizePatchToKey(value.patch||'');
    if(patchKey)return (valuePatch||keyPatch)===patchKey;
    return !valuePatch&&!keyPatch;
  });
  return entries.length?entries[0][1]:null;
}

function selectClass(selectedClass){
  document.getElementById('guidesGridView').style.display = 'block';
  document.getElementById('classGroupsContainer').style.display = 'none';
  document.getElementById('specGridContainer').style.display = 'block';
  document.getElementById('guidesDetailView').style.display = 'none';
  document.getElementById('guidesTopbarTitle').textContent = selectedClass;

  const patchOptions = getAvailableGuidePatches();
  const currentPatchKey = getCurrentGuidePatchKey(patchOptions);
  window._selectedGuidesPatchKey = currentPatchKey;
  window._selectedGuidesClassName = selectedClass;
  window._selectedGuidesSpecId = '';

  const container = document.getElementById('specGridContainer');
  const classSpecs = SPECS.filter(s => s.cls === selectedClass);
  container.innerHTML = `
    <div class="class-grid-container">
      <div class="guides-patch-bar">
        <span class="guides-patch-label">Parche</span>
        <select id="patchSelect" class="guides-patch-select">
          ${patchOptions.length?patchOptions.map(pk => `<option value="${escapeGuideValue(pk)}" ${pk===currentPatchKey?'selected':''}>${escapeGuideValue(getGuidePatchLabel(pk))}</option>`).join(''):'<option value="">No hay parches activos</option>'}
        </select>
      </div>
      <div class="guides-spec-header">
        <div>
          <h2 class="guides-spec-heading">${selectedClass}</h2>
          <div class="guides-spec-heading-sub">Seleccioná una especialización para abrir su guía.</div>
        </div>
        <span class="guides-detail-badge">${classSpecs.length} especializaciones</span>
      </div>
      <div class="guides-spec-grid">
        ${classSpecs.map(s => {
          const hasGuide=!!findGuideForSpecPatch(selectedClass,s.id,currentPatchKey);
          const availability=hasGuide?'GUÍA DISPONIBLE':(currentPatchKey?`SIN GUÍA · ${getGuidePatchLabel(currentPatchKey)}`:'SIN PARCHE ACTIVO');
          return `
          <button class="guides-spec-card" type="button" onclick="event.preventDefault(); event.stopPropagation(); openSpec('${s.id}'); return false;">
            <div class="guides-spec-card-top">
              <img class="guides-spec-icon" src="${SPEC_ICONS[s.id] || CLASS_ICONS[s.cls] || ''}" alt="${s.cls} ${s.name}" loading="lazy">
              <div>
                <div class="guides-spec-title">${s.name}</div>
                <div class="guides-spec-role">${ROLE_LABEL[s.role] || ''}</div>
              </div>
            </div>
            <div class="guides-spec-meta">
              <span>${s.role === 'tanque' ? 'Mitigación' : s.role === 'sanador' ? 'Curación' : 'Daño'}</span>
              <span class="guides-recommended">${availability}</span>
            </div>
          </button>
        `}).join('')}
      </div>
    </div>
  `;

  const patchSel = document.getElementById('patchSelect');
  if(patchSel){
    patchSel.addEventListener('change',()=>{
      window._selectedGuidesPatchKey = normalizePatchToKey(patchSel.value);
      selectClass(selectedClass);
    });
  }
}

function openSpec(id){
  // id como SPECS base: Guerrero-proteccion (SIN parche)
  const spec = SPECS.find(s=>s.id===id);
  if(!spec) return;

  window._selectedGuidesClassName = spec.cls;
  window._selectedGuidesSpecId = id;

  // patch desde selector (solo para mostrar/seleccionar el parche dentro del spec)
  const patchSel = document.getElementById('patchSelect');
  const patchKey = patchSel ? normalizePatchToKey(patchSel.value) : '';
  window._selectedGuidesPatchKey = patchKey;

  // Render detalle por spec base. Dentro de renderSpecDetail se aplicará el patch al leer CONFIG.guides.
  renderSpecDetail(id);
}



function openGuides(){
  document.getElementById('guidesOverlay').classList.add('open');
  renderClassGrid();
  document.body.style.overflow='hidden';
}

function closeGuides(){
  document.getElementById('guidesOverlay').classList.remove('open');
  document.body.style.overflow='';
}

// ==========================================
// DATOS DETALLADOS PARA CADA ESPECIALIZACIÓN
// ==========================================

const PROT_GEAR = [
  { id: 'cabeza', label: 'Casco', name: "Night Ender's Tusks", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_helmet_117.jpg', gem: 'Deadly Emerald', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg', stats: 'Mastery / Haste', popularity: 86.0, parses: 6300, col: 'left' },
  { id: 'cuello', label: 'Cuello', name: 'Barbed Ymirheim Choker', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_39.jpg', gem: 'Quick Ruby', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_31.jpg', stats: 'Crit / Haste', popularity: 31.0, parses: 2200, col: 'left' },
  { id: 'hombros', label: 'Hombros', name: "Night Ender's Pauldrons", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_shoulder_117.jpg', gem: 'Stommbound Armor Kit', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_01.jpg', stats: 'Mastery / Haste', popularity: 88.4, parses: 6300, col: 'left' },
  { id: 'capa', label: 'Capa', name: "Adherent's Silken Shroud", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_cape_18.jpg', gem: 'Chant of Leeching Fangs', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_enchant_armor.jpg', stats: 'Mastery / Haste', popularity: 21.2, parses: 1500, col: 'left' },
  { id: 'pecho', label: 'Pecho', name: "Night Ender's Breastplate", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_chest_chain_14.jpg', gem: "Forest Hunter's Armor Kit", gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_02.jpg', stats: 'Mastery / Haste', popularity: 88.0, parses: 6200, col: 'left' },
  { id: 'munecas', label: 'Brazaletes', name: "Spellbreaker's Bracers", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_bracer_16.jpg', gem: "Shaladrassil's Roots", gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg', stats: 'Mastery / Haste', popularity: 32.4, parses: 2300, col: 'left' },
  { id: 'sep-armas', label: 'Armas', isSeparator: true, col: 'left' },
  { id: 'arma', label: 'Arma', name: "Spellbreaker's Blade", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_sword_1h_blood_01.jpg', gem: 'Heart of Ancient Hunger', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg', stats: 'Mastery / Haste', popularity: 25.2, parses: 1800, col: 'left' },
  { id: 'escudo', label: 'Mano derecha', name: "Spellbreaker's Rebuke", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_shield_27.jpg', gem: 'Gaze of the Alnseer', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofthealnseer.jpg', stats: 'Mastery / Haste', popularity: 30.2, parses: 2100, col: 'left' },
  { id: 'manos', label: 'Manos', name: "Night Ender's Fists", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_gauntlets_83.jpg', gem: "Silvermoon's Alacrity", gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg', stats: 'Mastery / Haste', popularity: 36.1, parses: 2600, col: 'right' },
  { id: 'cinturon', label: 'Cintura', name: "Night Ender's Girdle", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_belt_48.jpg', gem: 'Omission of Light', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerwordshield.jpg', stats: 'Mastery / Haste', popularity: 22.2, parses: 1600, col: 'right' },
  { id: 'piernas', label: 'Pantalones', name: "Night Ender's Chausses", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_pants_19.jpg', gem: 'Omission of Void', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowwordpain.jpg', stats: 'Mastery / Haste', popularity: 88.2, parses: 6200, col: 'right' },
  { id: 'pies', label: 'Pies', name: "Night Ender's Greatboots", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_boots_chain_12.jpg', gem: "Silvermoon's Alacrity", gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg', stats: 'Mastery / Haste', popularity: 42.8, parses: 3000, col: 'right' },
  { id: 'anillo1', label: 'Anillo 1', name: 'Ring of Earthen Craftsmanship', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_77.jpg', gem: 'Deadly Emerald', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg', stats: 'Mastery / Haste', popularity: 41.1, parses: 2900, col: 'right' },
  { id: 'anillo2', label: 'Anillo 2', name: 'Band of the Shattered Soul', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_67.jpg', gem: 'Quick Ruby', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_31.jpg', stats: 'Mastery / Haste', popularity: 40.8, parses: 2800, col: 'right' },
  { id: 'sep-abalorios', label: 'Abalorios', isSeparator: true, col: 'right' },
  { id: 'abalorio1', label: 'Abalorio 1', name: 'Heart of Ancient Hunger', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_45.jpg', gem: 'Biss', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_32.jpg', stats: 'Mastery / Haste', popularity: 17.0, parses: 1200, col: 'right' },
  { id: 'abalorio2', label: 'Abalorio 2', name: 'Gaze of the Alnseer', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_74.jpg', gem: 'Biss', gemIcon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_32.jpg', stats: 'Mastery / Haste', popularity: 17.0, parses: 1200, col: 'right' }
];

const PROT_ENCHANTS = [
  { slot: 'Casco', item: 'Deadly Emerald', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg' },
  { slot: 'Hombros', item: 'Stommbound Armor Kit', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_01.jpg' },
  { slot: 'Pecho', item: "Forest Hunter's Armor Kit", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_02.jpg' },
  { slot: 'Brazaletes', item: "Shaladrassil's Roots", icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg' },
  { slot: 'Manos', item: "Silvermoon's Alacrity", icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg' },
  { slot: 'Cintura', item: 'Omission of Light', icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerwordshield.jpg' },
  { slot: 'Pantalones', item: 'Omission of Void', icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowwordpain.jpg' },
  { slot: 'Pies', item: "Silvermoon's Alacrity", icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg' },
  { slot: 'Capa', item: 'Chant of Leeching Fangs', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_enchant_armor.jpg' },
  { slot: 'Arma', item: 'Heart of Ancient Hunger', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg' },
  { slot: 'Mano derecha', item: 'Gaze of the Alnseer', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofthealnseer.jpg' },
  { slot: 'Anillo 1', item: 'Deadly Emerald', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg' },
  { slot: 'Anillo 2', item: 'Quick Ruby', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_31.jpg' },
  { slot: 'Abalorio 1', item: 'Biss', icon: '' },
  { slot: 'Abalorio 2', item: 'Biss', icon: '' }
];

const PROT_CONSUMABLES = [
  { type: 'Frasco', item: 'Frasco de Poder', effect: '+Crítico +Prisa', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_92.jpg' },
  { type: 'Poción', item: 'Poción de Combate', effect: '+Daño 25s', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_91.jpg' },
  { type: 'Comida', item: 'Festín de los Maestros', effect: '+Maestría +Versatilidad', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_food_100.jpg' },
  { type: 'Aceite Arma', item: 'Aceite de los Vientos', effect: '+Prisa', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_93.jpg' },
  { type: 'Runa', item: 'Runa de la Tormenta', effect: '+Crítico', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_scroll_05.jpg' }
];

const PROT_TALENT_HTML = `<div class="talent-tree-archon-wrapper"><div class="talent-tree talent-tree--compact"><div class="talent-tree--container talent-tree--container--default-layout">
<div data-kind="class" class="talent-tree__container talent-tree__container--class" style="--rows:10;--min-cols:9"><div class="talent-tree__container--height-limiter" data-expanded="true" data-kind="class" data-exportable="true"><div class="talent-tree__artwork talent-tree__artwork--class" style="background-image:url(https://assets.rpglogs.com/img/warcraft/talents/warrior-1.jpg)"></div><div class="talent-tree__description talent-tree__description--class"><div class="talent-tree__description__icon"><img class="sprite actor-sprite-Warrior" src="https://assets.rpglogs.com/img/warcraft/icons/actors.jpg?v=37" loading="lazy" alt=""></div><span class="talent-tree__description__label"><span class="talent-tree__description__label--kind Warrior">Class</span><span class="talent-tree__description__label--generic">Talents</span></span></div><div class="talent-tree__implementation talent-tree__implementation--expanded " data-expanded="true"><svg class="talent-tree__implementation__svg" xmlns="http://www.w3.org/2000/svg"><line x1="16.666666666666664%" y1="10%" x2="33.33333333333333%" y2="20%"></line><line x1="16.666666666666664%" y1="10%" x2="0%" y2="20%"></line><line x1="83.33333333333334%" y1="10%" x2="100%" y2="20%"></line><line x1="83.33333333333334%" y1="10%" x2="66.66666666666666%" y2="20%"></line><line x1="33.33333333333333%" y1="20%" x2="50%" y2="30%"></line><line x1="33.33333333333333%" y1="20%" x2="33.33333333333333%" y2="40%"></line><line x1="33.33333333333333%" y1="20%" x2="16.666666666666664%" y2="30%"></line><line x1="66.66666666666666%" y1="20%" x2="50%" y2="30%"></line><line x1="66.66666666666666%" y1="20%" x2="66.66666666666666%" y2="30%"></line><line x1="66.66666666666666%" y1="20%" x2="83.33333333333334%" y2="30%"></line><line x1="0%" y1="20%" x2="16.666666666666664%" y2="30%"></line><line x1="0%" y1="20%" x2="0%" y2="40%"></line><line x1="100%" y1="20%" x2="100%" y2="40%"></line><line x1="100%" y1="20%" x2="83.33333333333334%" y2="30%"></line><line x1="16.666666666666664%" y1="30%" x2="33.33333333333333%" y2="40%"></line><line x1="16.666666666666664%" y1="30%" x2="0%" y2="40%"></line><line x1="16.666666666666664%" y1="30%" x2="16.666666666666664%" y2="40%"></line><line x1="83.33333333333334%" y1="30%" x2="66.66666666666666%" y2="40%"></line><line x1="83.33333333333334%" y1="30%" x2="100%" y2="40%"></line><line x1="50%" y1="30%" x2="50%" y2="40%"></line><line x1="50%" y1="30%" x2="66.66666666666666%" y2="40%"></line><line x1="50%" y1="30%" x2="33.33333333333333%" y2="40%"></line><line x1="100%" y1="40%" x2="100%" y2="60%"></line><line x1="100%" y1="40%" x2="83.33333333333334%" y2="50%"></line><line x1="33.33333333333333%" y1="40%" x2="50%" y2="50%"></line><line x1="33.33333333333333%" y1="40%" x2="33.33333333333333%" y2="50%"></line><line x1="33.33333333333333%" y1="40%" x2="16.666666666666664%" y2="50%"></line><line x1="66.66666666666666%" y1="40%" x2="50%" y2="50%"></line><line x1="66.66666666666666%" y1="40%" x2="83.33333333333334%" y2="50%"></line><line x1="66.66666666666666%" y1="40%" x2="66.66666666666666%" y2="50%"></line><line x1="0%" y1="40%" x2="0%" y2="60%"></line><line x1="0%" y1="40%" x2="16.666666666666664%" y2="50%"></line><line x1="50%" y1="50%" x2="33.33333333333333%" y2="60%"></line><line x1="50%" y1="50%" x2="66.66666666666666%" y2="60%"></line><line x1="16.666666666666664%" y1="50%" x2="33.33333333333333%" y2="60%"></line><line x1="16.666666666666664%" y1="50%" x2="0%" y2="60%"></line><line x1="16.666666666666664%" y1="50%" x2="16.666666666666664%" y2="60%"></line><line x1="83.33333333333334%" y1="50%" x2="66.66666666666666%" y2="60%"></line><line x1="83.33333333333334%" y1="50%" x2="100%" y2="60%"></line><line x1="33.33333333333333%" y1="60%" x2="50%" y2="70%"></line><line x1="33.33333333333333%" y1="60%" x2="16.666666666666664%" y2="70%"></line><line x1="0%" y1="60%" x2="16.666666666666664%" y2="70%"></line><line x1="100%" y1="60%" x2="83.33333333333334%" y2="70%"></line><line x1="66.66666666666666%" y1="60%" x2="50%" y2="70%"></line><line x1="66.66666666666666%" y1="60%" x2="83.33333333333334%" y2="70%"></line><line x1="16.666666666666664%" y1="70%" x2="0%" y2="80%"></line><line x1="16.666666666666664%" y1="70%" x2="33.33333333333333%" y2="80%"></line><line x1="83.33333333333334%" y1="70%" x2="100%" y2="80%"></line><line x1="83.33333333333334%" y1="70%" x2="66.66666666666666%" y2="80%"></line><line x1="50%" y1="70%" x2="66.66666666666666%" y2="80%"></line><line x1="50%" y1="70%" x2="33.33333333333333%" y2="80%"></line><line x1="0%" y1="80%" x2="16.666666666666664%" y2="90%"></line><line x1="66.66666666666666%" y1="80%" x2="83.33333333333334%" y2="90%"></line><line x1="66.66666666666666%" y1="80%" x2="50%" y2="90%"></line><line x1="100%" y1="80%" x2="83.33333333333334%" y2="90%"></line><line x1="33.33333333333333%" y1="80%" x2="16.666666666666664%" y2="90%"></line><line x1="33.33333333333333%" y1="80%" x2="50%" y2="90%"></line><line x1="50%" y1="90%" x2="66.66666666666666%" y2="100%"></line><line x1="50%" y1="90%" x2="33.33333333333333%" y2="100%"></line><line x1="83.33333333333334%" y1="90%" x2="100%" y2="100%"></line><line x1="83.33333333333334%" y1="90%" x2="66.66666666666666%" y2="100%"></line><line x1="16.666666666666664%" y1="90%" x2="0%" y2="100%"></line><line x1="16.666666666666664%" y1="90%" x2="33.33333333333333%" y2="100%"></line></svg><div class="talent-tree__implementation__nodes">... (nodos) ...</div></div></div></div>
<div class="talent-tree__container talent-tree__container--hero" style="--rows: 3; --talent-count: 4;"><div class="talent-tree__hero-spacer"></div><div class="talent-tree__container--height-limiter" data-kind="hero"><div class="talent-tree__hero-title do-not-change-color-on-hover Warrior  ">Mountain Thane</div><div class="talent-tree__hero-icon"><span class=""><div class="talent-tree__hero-icon--wrapper "><img src="https://assets.rpglogs.com/img/warcraft/talents/hero/61_full.png" alt="Mountain Thane"></div></span></div><div class="talent-tree__hero-container talent-tree__hero-container--compact"><div class="talent-tree__implementation talent-tree__implementation--expanded " data-expanded="true"><div class="talent-tree__implementation__nodes"><div class="talent-tree__implementation__nodes--item" style="--row: 0; --posX: 50%;"><a class="talent-tree-node talent-tree-node-choice talent-tree-node-choice--selected " target="_blank" rel="noreferrer" href="https://www.wowhead.com/spell=438590?def=122407&amp;rank=1&amp;spellModifier=137048"><span class="tooltip__trigger talent-tree-node-choice__tooltip-trigger--active"><img src="https://assets.rpglogs.com/img/warcraft/abilities/ability_thunderking_overcharge.jpg" alt="Keep Your Feet on the Ground" loading="lazy"></span><div class="talent-tree-node-choice__overlay "></div></a></div><div class="talent-tree__implementation__nodes--item" style="--row: 1; --posX: 50%;"><span class="talent-tree-node talent-tree-node-choice talent-tree-node--inactive "><span class="tooltip__trigger talent-tree-node-choice__tooltip-trigger--inactive"><img src="https://assets.rpglogs.com/img/warcraft/abilities/warrior_talent_icon_stormbolt.jpg" alt="Storm Bolts" loading="lazy"><img src="https://assets.rpglogs.com/img/warcraft/abilities/spell_winston_bubble.jpg" alt="Storm Shield" loading="lazy"></span><div class="talent-tree-node-choice__overlay"></div></span></div><div class="talent-tree__implementation__nodes--item" style="--row: 2; --posX: 50%;"><span class="talent-tree-node talent-tree-node-choice talent-tree-node--inactive "><span class="tooltip__trigger talent-tree-node-choice__tooltip-trigger--inactive"><img src="https://assets.rpglogs.com/img/warcraft/abilities/spell_nature_stormreach.jpg" alt="Gathering Clouds" loading="lazy"><img src="https://assets.rpglogs.com/img/warcraft/abilities/inv_ability_mountainthanewarrior_thorimsmight.jpg" alt="Thorim's Might" loading="lazy"></span><div class="talent-tree-node-choice__overlay"></div></span></div><div class="talent-tree__implementation__nodes--item" style="--row: 3; --posX: 50%;"><a class="talent-tree-node talent-tree-node-choice talent-tree-node-choice--selected " target="_blank" rel="noreferrer" href="https://www.wowhead.com/spell=437079?def=122406&amp;rank=1&amp;spellModifier=137048"><span class="tooltip__trigger talent-tree-node-choice__tooltip-trigger--active"><img src="https://assets.rpglogs.com/img/warcraft/abilities/spell_lightning_lightningbolt01.jpg" alt="Flashing Skies" loading="lazy"></span><div class="talent-tree-node-choice__overlay "></div></a></div></div></div></div></div></div>
<div data-kind="spec" class="talent-tree__container talent-tree__container--spec" style="--rows:10;--min-cols:9"><div class="talent-tree__container--height-limiter" data-expanded="true" data-kind="spec" data-exportable="true"><div class="talent-tree__artwork talent-tree__artwork--spec" style="background-image:url(https://assets.rpglogs.com/img/warcraft/talents/warrior-3.jpg)"></div><div class="talent-tree__description talent-tree__description--spec"><div class="talent-tree__description__icon"><img class="sprite actor-sprite-Warrior-Protection" src="https://assets.rpglogs.com/img/warcraft/icons/actors.jpg?v=37" loading="lazy" alt=""></div><span class="talent-tree__description__label"><span class="talent-tree__description__label--kind Warrior">Spec</span><span class="talent-tree__description__label--generic">Talents</span></span></div><div class="talent-tree__implementation talent-tree__implementation--expanded " data-expanded="true"><svg class="talent-tree__implementation__svg" xmlns="http://www.w3.org/2000/svg">... (líneas) ...</svg><div class="talent-tree__implementation__nodes">... (nodos) ...</div></div></div></div>
</div></div></div>`;

// --- Construir SPEC_DETAILS ---
const SPEC_DETAILS = {};

SPECS.forEach(spec => {
  if (spec.id === 'guerrero-proteccion') {
    SPEC_DETAILS[spec.id] = {
      name: 'Guerrero · Protección',
      stats: { strength: 1500, haste: 1040, crit: 621, mastery: 381, versatility: 244 },
      gearSlots: PROT_GEAR,
      enchants: PROT_ENCHANTS,
      consumables: PROT_CONSUMABLES,
      talentHtml: PROT_TALENT_HTML // ya no se usará
    };
    return;
  }
  const p = spec.priority;
  const base = 1000;
  const stats = {
    strength: Math.floor(base * (1 + Math.random() * 0.2)),
    haste: Math.floor(base * (p[0] === 'Velocidad' ? 0.9 : p[0] === 'Crítico' ? 0.7 : 0.5)),
    crit: Math.floor(base * (p[0] === 'Crítico' ? 0.9 : p[0] === 'Velocidad' ? 0.7 : 0.5)),
    mastery: Math.floor(base * (p[0] === 'Maestría' ? 0.9 : p[0] === 'Versatilidad' ? 0.7 : 0.5)),
    versatility: Math.floor(base * (p[0] === 'Versatilidad' ? 0.9 : p[0] === 'Maestría' ? 0.7 : 0.5))
  };

  const gearSlots = [];
  const slotNames = ['Casco','Cuello','Hombros','Capa','Pecho','Brazaletes','Manos','Cintura','Pantalones','Pies','Anillo 1','Anillo 2','Abalorio 1','Abalorio 2'];
  const colMap = ['left','left','left','left','left','left','left','right','right','right','right','right','right','right'];
  const itemNames = ['Yelmo del Guardián','Colgante de Ymir','Hombreras del Asedio','Capa del Vigía','Coraza del Protector','Brazales del Muro','Guanteletes del Escudo','Cinturón del Bastión','Grebas del Titán','Botas del Guardián','Anillo de Artesanía','Sortija del Alma','Corazón de Hambre','Mirada del Alnseer'];
  const gemNames = ['Joya de '+p[0], 'Joya de '+p[1], 'Kit de Armadura', 'Encantamiento', 'Kit de Armadura', 'Raíces de Shaladrassil', 'Presteza de Lunargenta', 'Omisión de Luz', 'Omisión del Vacío', 'Presteza de Lunargenta', 'Joya de '+p[0], 'Joya de '+p[1], 'Biss', 'Biss'];
  const gemIcons = [
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_31.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_01.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_enchant_armor.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_armorkit_02.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_relics_idolofrejuvenation.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerwordshield.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowwordpain.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/spell_holy_elunesgrace.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_30.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_31.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_32.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelcrafting_gem_32.jpg'
  ];
  const itemIcons = [
    'https://wow.zamimg.com/images/wow/icons/large/inv_helmet_117.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_39.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_shoulder_117.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_misc_cape_18.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_chest_chain_14.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_bracer_16.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_gauntlets_83.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_belt_48.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_pants_19.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_boots_chain_12.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_77.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_ring_67.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_45.jpg',
    'https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_necklace_74.jpg'
  ];

  for (let i = 0; i < 14; i++) {
    const isSep = (i === 6 || i === 12);
    if (isSep) {
      gearSlots.push({ id: 'sep-' + i, label: i === 6 ? 'Armas' : 'Abalorios', isSeparator: true, col: colMap[i] });
    } else {
      gearSlots.push({
        id: 'slot-' + i,
        label: slotNames[i],
        name: itemNames[i % itemNames.length],
        icon: itemIcons[i % itemIcons.length],
        gem: gemNames[i % gemNames.length],
        gemIcon: gemIcons[i % gemIcons.length],
        stats: p[0] + ' / ' + p[1],
        popularity: 50 + Math.random() * 40,
        parses: Math.floor(1000 + Math.random() * 6000),
        col: colMap[i]
      });
    }
  }

  const enchants = gearSlots.filter(s => !s.isSeparator).map(s => ({
    slot: s.label,
    item: s.gem,
    icon: s.gemIcon
  }));

  const consumables = [
    { type: 'Frasco', item: 'Frasco de ' + p[0], effect: '+' + p[0] + ' +' + p[1], icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_92.jpg' },
    { type: 'Poción', item: 'Poción de Combate', effect: '+Daño 25s', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_91.jpg' },
    { type: 'Comida', item: 'Festín de los Maestros', effect: '+' + p[1] + ' +Versatilidad', icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_food_100.jpg' },
    { type: 'Aceite', item: 'Aceite de los Vientos', effect: '+' + p[0], icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_potion_93.jpg' },
    { type: 'Runa', item: 'Runa de la Tormenta', effect: '+' + p[1], icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_scroll_05.jpg' }
  ];

  SPEC_DETAILS[spec.id] = {
    name: spec.cls + ' · ' + spec.name,
    stats: stats,
    gearSlots: gearSlots,
    enchants: enchants,
    consumables: consumables,
    talentHtml: `<div class="talent-placeholder"><p>Árbol de talentos para ${spec.cls} · ${spec.name}</p><p style="font-size:13px;margin-top:8px;">Visualiza y edita en Wowhead.</p><a href="${TALENT_URLS[spec.cls] || 'https://www.wowhead.com/es/talent-calc'}" target="_blank" rel="noopener" class="talent-link">VER EN WOWHEAD →</a></div>`
  };
});

// ==========================================
// HELPERS DE RENDERIZADO DE GUÍAS
// ==========================================
function renderStatsForPreview(stats, configuredPriority) {
  const safe = stats || {};
  const priority = Array.isArray(configuredPriority) ? configuredPriority.filter(Boolean) : [];
  const values = priority.length
    ? priority.slice(0, 4).map((name, i) => [name, 4 - i, i + 1])
    : [
      ['Fuerza', safe.strength, 0],
      ['Celeridad', safe.haste, 0],
      ['Crítico', safe.crit, 0],
      ['Maestría', safe.mastery, 0],
      ['Versatilidad', safe.versatility, 0]
    ];
  const max = Math.max(1, ...values.map(([, value]) => Number(value) || 0));
  return `<div class="stats-container">
    ${values.map(([name, value, rank]) => {
      const numeric = Number(value) || 0;
      const width = Math.max(0, Math.min(100, (numeric / max) * 100));
      return `<div class="stat-item">
        <div class="stat-name">${name}</div>
        <div class="stat-value">${priority.length ? ('> ') : numeric}</div>
        <div class="stat-bar"><div class="fill" style="width:${width}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderGearForPreview(slots) {
  const valid = Array.isArray(slots) ? slots : [];
  const left = valid.filter(s => s.col === 'left');
  const right = valid.filter(s => s.col === 'right');

  const renderColumn = (items) => `
    <div class="gear-column">
      ${items.map(slot => {
        if (slot.isSeparator) {
          return `<div class="gear-slot separator">
            <span class="separator-label">${slot.label || ''}</span>
            <span class="separator-line"></span>
          </div>`;
        }

        const icon = slot.icon
          ? `<img src="${slot.icon}" alt="${slot.name || slot.label || ''}" loading="lazy">`
          : `<span class="placeholder">—</span>`;

        const gems = Array.isArray(slot.gems) ? slot.gems : [];
        const gemHtml = gems.map(g => `
          <span class="gem-item">
            ${g.icon ? `<img src="${g.icon}" alt="">` : ''}
            ${g.name || ''}
          </span>
        `).join('');

        const enchantHtml = slot.enchant
          ? `<span class="enchant-item">
              ${slot.enchantIcon ? `<img src="${slot.enchantIcon}" alt="">` : ''}
              ${slot.enchant}
            </span>`
          : '';

        return `<div class="gear-slot">
          <div class="icon-wrapper">
            <div class="item-icon">${icon}</div>
            ${gems.length ? `<div class="gem-slot">${gems[0].icon ? `<img src="${gems[0].icon}" alt="">` : '<span class="gem-placeholder">G</span>'}</div>` : ''}
          </div>
          <div class="item-info">
            <div class="item-name">${slot.name || 'Sin objeto'}</div>
            <div class="item-meta">
              <span class="slot-label">${slot.label || ''}</span>
              ${slot.stats ? `<span class="stats">${slot.stats}</span>` : ''}
              ${slot.popularity != null ? `<span class="popularity">${slot.popularity}%</span>` : ''}
              ${slot.parses != null ? `<span class="parses">${slot.parses} parses</span>` : ''}
            </div>
            ${(gemHtml || enchantHtml) ? `<div class="item-extras">${gemHtml}${enchantHtml}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  return `<div class="gear-grid">${renderColumn(left)}${renderColumn(right)}</div>`;
}

// ==========================================
// FUNCIÓN PRINCIPAL: RENDERIZAR DETALLE DE GUÍA (CON IMÁGENES DE TALENTOS)
// ==========================================
function renderSpecDetail(specId) {
  console.log('[renderSpecDetail] Iniciando para specId:', specId);
  
  // 1. Buscar la especialización en SPECS
  const spec = SPECS.find(s => s.id === specId);
  if (!spec) {
    console.error('[renderSpecDetail] Especialización no encontrada:', specId);
    document.getElementById('guidesDetailView').innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:40px;">Especialización no encontrada.</p>';
    document.getElementById('guidesGridView').style.display = 'none';
    document.getElementById('guidesDetailView').style.display = 'block';
    return;
  }
  console.log('[renderSpecDetail] Especialización encontrada:', spec);

  // Cada parche debe mostrar únicamente su propia guía, sin reutilizar datos
  // estáticos o una guía de otro parche cuando no hay coincidencia exacta.
  const patchKey = window._selectedGuidesPatchKey || '';
  const dataServer = findGuideForSpecPatch(spec.cls, specId, patchKey);
  const patchLabel = patchKey ? getGuidePatchLabel(patchKey) : 'sin parche';
  if (!dataServer) {
    const detail = document.getElementById('guidesDetailView');
    detail.innerHTML = `
      <div class="guides-empty-patch">
        <h2>${escapeGuideValue(spec.cls)} · ${escapeGuideValue(spec.name)}</h2>
        <p>No hay una guía cargada para <strong>${escapeGuideValue(patchLabel)}</strong>.</p>
      </div>`;
    document.getElementById('guidesGridView').style.display = 'none';
    detail.style.display = 'block';
    document.getElementById('guidesTopbarTitle').textContent = `${spec.cls} · ${spec.name}`;
    document.getElementById('guidesOverlay').scrollTop = 0;
    return;
  }

  console.log('[renderSpecDetail] Guía encontrada para parche:', patchLabel, dataServer);

  // Mantener la estructura que consume el render, pero sin mezclar defaults
  // de SPEC_DETAILS que podrían pertenecer a otra versión.
  const data = {
    ...dataServer,
    name: dataServer.name || `${spec.cls} · ${spec.name}`,
    stats: dataServer.stats || { strength: 0, haste: 0, crit: 0, mastery: 0, versatility: 0 },
    gearSlots: Array.isArray(dataServer.gearSlots) ? dataServer.gearSlots : [],
    enchants: Array.isArray(dataServer.enchants) ? dataServer.enchants : [],
    consumables: Array.isArray(dataServer.consumables) ? dataServer.consumables : [],
    talentImageRaid: dataServer.talentImageRaid || '',
    talentImageMythic: dataServer.talentImageMythic || ''
  };

  // 4. Reordenar gear slots (estructura fija)
  const LEFT_SLOTS = ['Casco', 'Cuello', 'Hombros', 'Capa', 'Pecho', 'Brazaletes', 'Arma 1', 'Arma 2'];
  const RIGHT_SLOTS = ['Manos', 'Cintura', 'Pantalones', 'Pies', 'Anillo 1', 'Anillo 2', 'Abalorio 1', 'Abalorio 2'];
  const ALL_SLOTS = [...LEFT_SLOTS, ...RIGHT_SLOTS];

  const slotMap = {};
  (data.gearSlots || []).forEach(slot => {
    if (slot.label === 'Armas') {
      slotMap['Arma 1'] = { ...slot, label: 'Arma 1' };
      if (!slotMap['Arma 2']) {
        slotMap['Arma 2'] = { label: 'Arma 2', name: '', icon: '', stats: '', popularity: null, parses: null, wowheadUrl: '', gems: [], gemsNames: '', gemsIcons: '', enchant: '', enchantIcon: '' };
      }
    } else {
      // Compatibilidad de nombres entre Admin/servidor y la nomenclatura visual del index.
      // Solo normaliza estas dos piezas para que no se pierdan al reordenar la guía.
      const visualLabel = slot.label === 'Piernas' ? 'Pantalones'
        : slot.label === 'Botas' ? 'Pies'
        : slot.label;
      slotMap[visualLabel] = { ...slot, label: visualLabel };
    }
  });

  ALL_SLOTS.forEach(label => {
    if (!slotMap[label]) {
      slotMap[label] = {
        label: label,
        name: '',
        icon: '',
        stats: '',
        popularity: null,
        parses: null,
        wowheadUrl: '',
        gems: [],
        gemsNames: '',
        gemsIcons: '',
        enchant: '',
        enchantIcon: ''
      };
    }
  });

  const reorderedSlots = [];
  LEFT_SLOTS.forEach(label => {
    const slot = slotMap[label];
    slot.col = 'left';
    reorderedSlots.push(slot);
  });
  const arma1Index = reorderedSlots.findIndex(s => s.label === 'Arma 1');
  if (arma1Index !== -1) {
    reorderedSlots.splice(arma1Index, 0, { isSeparator: true, label: 'Armas', col: 'left' });
  }
  RIGHT_SLOTS.forEach(label => {
    const slot = slotMap[label];
    slot.col = 'right';
    reorderedSlots.push(slot);
  });
  const abalorioIndex = reorderedSlots.findIndex(s => s.label === 'Abalorio 1');
  if (abalorioIndex !== -1) {
    reorderedSlots.splice(abalorioIndex, 0, { isSeparator: true, label: 'Abalorios', col: 'right' });
  }
  data.gearSlots = reorderedSlots;

  const iconUrl = CLASS_ICONS[spec.cls] || '';
  const specIconUrl = getSpecIconUrl(spec);
  // 5. Extraer gemas y encantamientos globales (para overlays)
  let globalGems = [], globalEnchants = [];
  data.gearSlots.forEach(slot => {
    if (slot.gems && slot.gems.length > 0) {
      slot.gems.forEach(g => globalGems.push({ name: g.name, icon: g.icon || '', stats: slot.stats || '', popularity: slot.popularity || null }));
    } else if (slot.gemsNames && slot.gemsIcons) {
      const names = slot.gemsNames.split(',').map(s => s.trim());
      const icons = slot.gemsIcons.split(',').map(s => s.trim());
      names.forEach((name, idx) => {
        if (name) globalGems.push({ name, icon: icons[idx] || '', stats: slot.stats || '', popularity: slot.popularity || null });
      });
    }
    if (slot.enchant && slot.enchant.trim() !== '') {
      globalEnchants.push({ slot: slot.label, item: slot.enchant, icon: slot.enchantIcon || '' });
    }
  });

  if (globalGems.length === 0 && data.enchants && data.enchants.length > 0) {
    const gemKeywords = ['gem', 'diamond', 'ruby', 'emerald', 'sapphire', 'topaz', 'peridot', 'garnet', 'jasper', 'amber', 'onyx', 'citrine', 'zircon', 'agate', 'jade'];
    data.enchants.forEach(item => {
      const lowerName = (item.item || '').toLowerCase();
      const isGem = gemKeywords.some(kw => lowerName.includes(kw));
      if (isGem) globalGems.push({ name: item.item, icon: item.icon || '', stats: '', popularity: null });
      else globalEnchants.push({ slot: item.slot || '—', item: item.item, icon: item.icon || '' });
    });
  }

  window._currentGems = globalGems;
  window._currentEnchants = globalEnchants;
  window._currentConsumables = data.consumables || [];
  window._currentGuideData = data;

  // 6. Verificar si hay datos de gear (mostrar o no la sección)
  const hasGearData = Array.isArray(data.gearSlots) && data.gearSlots.some(s => (s.name && s.name.trim() !== '') || (s.icon && s.icon.trim() !== ''));
  const gearNavHtml = hasGearData ? `<a href="#detail-gear">Gear</a>` : '';
  const gearSectionHtml = hasGearData ? `
    <div id="detail-gear" class="detail-section">
      <h2 class="section-title">Armadura &amp; Tier</h2>
      ${renderGearForPreview(data.gearSlots)}
    </div>` : '';

  // 7. Sección de talentos con imágenes
  const talentHtml = `
    <div id="detail-talents" class="detail-section">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #2b2619; padding-bottom: 12px; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
        <h2 class="section-title" style="border:none; margin:0; padding:0;">Talentos</h2>
        <div style="display:flex; gap:10px;">
          ${data.talentsRaid ? `<button class="panel-cta" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" onclick="navigator.clipboard.writeText('${data.talentsRaid}').then(() => alert('Código de Raid copiado al portapapeles.'));">Copiar Raid</button>` : ''}
          ${data.talentsMythicPlus ? `<button class="panel-cta" style="margin:0; padding:6px 12px; font-size:11px; cursor:pointer;" onclick="navigator.clipboard.writeText('${data.talentsMythicPlus}').then(() => alert('Código de Míticas+ copiado al portapapeles.'));">Copiar Míticas+</button>` : ''}
        </div>
      </div>
      <div id="talentImageContainer">
        ${data.talentImageRaid ? `<div class="guide-talent-frame"><img src="${data.talentImageRaid}" alt="Talentos Raid" /></div>` : ''}
        ${data.talentImageMythic ? `<div class="guide-talent-frame"><img src="${data.talentImageMythic}" alt="Talentos Míticas+" /></div>` : ''}
        ${(!data.talentImageRaid && !data.talentImageMythic) ? '<p style="color:var(--text-dim);font-style:italic;">No hay imágenes de talentos disponibles.</p>' : ''}
      </div>
    </div>
  `;

  // 8. Construir el HTML completo
  const detailHtml = `
    <div class="detail-breadcrumb"><a onclick="selectClass('${spec.cls}')">${spec.cls}</a> / ${spec.name}</div>
    <div class="detail-header">
      <img class="guides-detail-class-icon" src="${iconUrl}" alt="${spec.cls}" loading="lazy">
      <img class="guides-detail-spec-icon" src="${specIconUrl}" alt="${spec.name}" loading="lazy">
      <div>
        <div class="detail-title">${spec.cls} · ${spec.name}</div>
        <div class="detail-subtitle">${spec.role ? spec.role.toUpperCase() : ''} · GUÍA DE LA ORDEN</div>
        <div class="guides-detail-badges">
          <span class="guides-detail-badge gold">PARCHE ${patchLabel}</span>
          <span class="guides-detail-badge">${spec.role ? ROLE_LABEL[spec.role] : ''}</span>
        </div>
      </div>
    </div>
    <p class="detail-summary">${spec.summary || ''}</p>

    <nav class="detail-nav">
      <a href="#detail-stats">Estadísticas</a>
      <a href="#detail-talents">Talentos</a>
      ${gearNavHtml}
      <a href="#" onclick="openEnchantOverlay(); return false;">Gemas</a>
      <a href="#" onclick="openConsumableOverlay(); return false;">Consumibles</a>
    </nav>

    <div id="detail-stats" class="detail-section">
      <h2 class="section-title">Estadísticas</h2>
      ${renderStatsForPreview(data.stats, data.statsPriority)}
    </div>

    ${talentHtml}

    ${gearSectionHtml}

  `;

  // 9. Inyectar y mostrar
  document.getElementById('guidesDetailView').innerHTML = detailHtml;
  document.getElementById('guidesGridView').style.display = 'none';
  document.getElementById('guidesDetailView').style.display = 'block';
  document.getElementById('guidesTopbarTitle').textContent = spec.cls + ' · ' + spec.name;
  document.getElementById('guidesOverlay').scrollTop = 0;

  // 10. Recargar tooltips de Wowhead
  if (typeof $WowheadPower !== 'undefined') {
    setTimeout(() => { $WowheadPower.refreshLinks(); }, 100);
  }
}

// ==========================================
// FUNCIONES PARA ABRIR OVERLAYS DE GEMAS Y ENCANTAMIENTOS (ACTUALIZADAS)
// ==========================================
function openEnchantOverlay() { /* ... (sin cambios) */ }
function openConsumableOverlay() { /* ... (sin cambios) */ }
function closeOverlay(id) { /* ... (sin cambios) */ }

// ==========================================
// RECLUTAMIENTO Y PLAYERS OVERLAYS
// ==========================================
async function bootOrdenDelToro() {
  try {
    await loadConfig();
    await loadGuidePatchOptions();
    renderGuidesLandingClasses();
    window.__odtAppReady = true;
    const requestedPage = window.location.hash.replace(/^#/, '').trim();
    const validPages = ['inicio','roster','raid','guias','reclutamiento','media','about'];
    const destination = requestedPage === 'contacto' ? 'reclutamiento' : requestedPage;
    if (destination && validPages.includes(destination)) {
      navigate(destination, requestedPage === 'contacto');
    } else {
      navigate('inicio', false);
    }
  } catch (error) {
    console.error('[ODT] Error durante la inicialización:', error);
  }
}

window.addEventListener('hashchange', () => {
  if (!window.__odtAppReady) return;
  const requestedPage = window.location.hash.replace(/^#/, '').trim();
  const validPages = ['inicio','roster','raid','guias','reclutamiento','media','about'];
  const destination = requestedPage === 'contacto' ? 'reclutamiento' : requestedPage;
  if (!destination || !validPages.includes(destination)) {
    navigate('inicio', false);
    return;
  }
  navigate(destination, requestedPage === 'contacto');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootOrdenDelToro, { once: true });
} else {
  bootOrdenDelToro();
}
