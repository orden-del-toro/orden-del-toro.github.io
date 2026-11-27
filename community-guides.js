const db=ODTDocuments.create();
const CLASSES=[['Guerrero','Protección','Tanque'],['Guerrero','Armas','DPS'],['Guerrero','Furia','DPS'],['Paladín','Sagrado','Sanador'],['Paladín','Protección','Tanque'],['Paladín','Reprensión','DPS'],['Cazador','Bestias','DPS'],['Cazador','Puntería','DPS'],['Cazador','Supervivencia','DPS'],['Pícaro','Asesinato','DPS'],['Pícaro','Forajido','DPS'],['Pícaro','Sutileza','DPS'],['Sacerdote','Disciplina','Sanador'],['Sacerdote','Sagrado','Sanador'],['Sacerdote','Sombra','DPS'],['Caballero de la Muerte','Sangre','Tanque'],['Caballero de la Muerte','Escarcha','DPS'],['Caballero de la Muerte','Profano','DPS'],['Chamán','Elemental','DPS'],['Chamán','Mejora','DPS'],['Chamán','Restauración','Sanador'],['Mago','Arcano','DPS'],['Mago','Fuego','DPS'],['Mago','Escarcha','DPS'],['Brujo','Aflicción','DPS'],['Brujo','Demonología','DPS'],['Brujo','Destrucción','DPS'],['Monje','Maestro Cervecero','Tanque'],['Monje','Tejedor de Niebla','Sanador'],['Monje','Viajero del Viento','DPS'],['Druida','Equilibrio','DPS'],['Druida','Feral','DPS'],['Druida','Guardián','Tanque'],['Druida','Restauración','Sanador'],['Cazador de Demonios','Venganza','Tanque'],['Cazador de Demonios','Devastación','DPS'],['Cazador de Demonios','Aldrachi','DPS'],['Evocador','Devastación','DPS'],['Evocador','Preservación','Sanador'],['Evocador','Aumento','DPS']];
const GEAR_SLOTS=['Casco','Cuello','Hombros','Capa','Pecho','Brazaletes','Arma 1','Arma 2','Manos','Cintura','Piernas','Botas','Anillo 1','Anillo 2','Abalorio 1','Abalorio 2'];
let gearRows=[];
const CONSUMABLE_TYPES=['Frasco','Poción','Comida','Aceite','Runa'];
let consumableRows=[];
let allowedPatches=[];
let manualExtras=[];

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('open');setTimeout(()=>$('toast').classList.remove('open'),2600)}
function initSelects(){const cls=$('guideClass');cls.innerHTML='<option value="">Seleccionar clase</option>'+[...new Set(CLASSES.map(x=>x[0]))].map(x=>`<option>${esc(x)}</option>`).join('');cls.onchange=()=>{const specs=CLASSES.filter(x=>x[0]===cls.value);$('guideSpec').innerHTML='<option value="">Seleccionar especialización</option>'+specs.map(x=>`<option data-role="${esc(x[2])}">${esc(x[1])}</option>`).join('');renderPreview()};}
function extractWowheadId(value){const s=String(value||'').trim();if(!s)return '';const m=s.match(/(?:wowhead\.com\/)(?:[a-z]{2}\/)?(?:item=|item\/)(\d+)/i)||s.match(/[?&]item=(\d+)/i)||s.match(/^https?:\/\/[^\s]+[?&]spell=(\d+)/i)||s.match(/^\d+$/);return m?m[1]:'';}
function normalizeWowheadUrl(value,type='item'){const id=extractWowheadId(value);return id?`https://www.wowhead.com/${type}=${id}`:''}
function isObjectPlaceholderName(v){return /^(Objeto Wowhead|Cargando objeto)/i.test(String(v||''));}
function isGenericExtraName(v){return /^(Gema(?: 2)?|Encantamiento)\s*#\d+$/i.test(String(v||''));}
function normalizeWowheadIconUrl(icon){const raw=String(icon||'').trim();if(!raw)return '';if(/^https?:\/\//i.test(raw))return raw;const clean=raw.split('?')[0].split('#')[0];if(/^\d+$/.test(clean))return `https://wow.zamimg.com/images/wow/icons/large/${clean}.jpg`;if(/\.(?:jpg|jpeg|png|webp)$/i.test(clean))return `https://wow.zamimg.com/images/wow/icons/large/${clean}`;return `https://wow.zamimg.com/images/wow/icons/large/${clean}.jpg`;}
function extractStatsFromTooltipHtml(html){const text=String(html||'').replace(/<br\s*\/?>/gi,' ').replace(/<\/(?:div|p|li|tr|td|th)>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();const found=[];const tests=[[/Critical Strike|Golpe cr[ií]tico|Cr[ií]tico/i,'Crítico'],[/Haste|Celeridad|Prisa/i,'Celeridad'],[/Mastery|Maestr[ií]a/i,'Maestría'],[/Versatility|Versatilidad/i,'Versatilidad']];tests.forEach(([rx,label])=>{if(rx.test(text))found.push(label)});return {statsString:found.join(' / '),stats:{strength:0,haste:0,crit:0,mastery:0,versatility:0}};}
async function fetchWowheadTooltipDirect(itemId,kind='item') {
      const endpoints = [
        `https://nether.wowhead.com/tooltip/${kind}/${encodeURIComponent(itemId)}?dataEnv=1&locale=0`,
        `https://nether.wowhead.com/tooltip/${kind}/${encodeURIComponent(itemId)}?dataEnv=1`
      ];
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { headers: { 'Accept': 'application/json,text/plain,*/*' } });
          if (!response.ok) continue;
          const raw = await response.text();
          let data = null;
          try { data = JSON.parse(raw); } catch (_) {}
          if (!data) continue;
          const name = String(data.name || data.itemName || data.title || '').trim();
          let icon = data.icon || data.iconUrl || data.icon_url || '';
          let tooltipHtml = data.tooltip || data.tooltipHtml || data.tooltip_html || data.html || '';
          if (typeof data.tooltip === 'object' && data.tooltip) {
            tooltipHtml = data.tooltip.html || data.tooltip.content || '';
          }
          const statsParsed = extractStatsFromTooltipHtml(tooltipHtml);
          const statsString = String(data.statsString || data.stats || '').trim() || statsParsed.statsString;
          if (name || icon || statsString) {
            return {
              name,
              iconUrl: normalizeWowheadIconUrl(icon),
              statsString,
              tooltipText: String(tooltipHtml||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim(),
              stats: data.stats && typeof data.stats === 'object' ? {
                strength:Number(data.stats.strength||0),haste:Number(data.stats.haste||0),crit:Number(data.stats.crit||0),mastery:Number(data.stats.mastery||0),versatility:Number(data.stats.versatility||0)
              } : statsParsed.stats
            };
          }
        } catch (_) {}
      }
      return null;
    }

    async function fetchWowheadData(itemId,kind='item') {
      const direct = await fetchWowheadTooltipDirect(itemId,kind);
      if (direct && (direct.name || direct.iconUrl || direct.statsString)) return direct;
      const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://cors-anywhere.herokuapp.com/'
      ];
      for (const proxy of proxies) {
        try {
          const wowheadUrl = `https://www.wowhead.com/${kind}=${itemId}&xml`;
          const response = await fetch(proxy + encodeURIComponent(wowheadUrl));
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const xmlText = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const name = xmlDoc.querySelector('name')?.textContent?.trim() || '';
          const icon = xmlDoc.querySelector('icon')?.textContent?.trim() || '';
          const iconUrl = normalizeWowheadIconUrl(icon);
          const jsonElem = xmlDoc.querySelector('json');
          let stats = { strength: 0, haste: 0, crit: 0, mastery: 0, versatility: 0 };
          let statsString = '';
          if (jsonElem) {
            try {
              const jsonData = JSON.parse(jsonElem.textContent);
              const secondaryStats = [];
              if (jsonData.crit) secondaryStats.push('Crítico');
              if (jsonData.haste) secondaryStats.push('Prisa');
              if (jsonData.mastery) secondaryStats.push('Maestría');
              if (jsonData.versatility) secondaryStats.push('Versatilidad');
              if (secondaryStats.length > 0) {
                statsString = secondaryStats.join(' / ');
              } else {
                const primaryStats = [];
                if (jsonData.stamina) primaryStats.push('Stamina');
                if (jsonData.intellect) primaryStats.push('Intelecto');
                if (jsonData.strength) primaryStats.push('Fuerza');
                if (jsonData.agility) primaryStats.push('Agilidad');
                if (primaryStats.length > 0) statsString = primaryStats.join(' / ');
              }
              if (jsonData.strength) stats.strength = jsonData.strength;
              if (jsonData.haste) stats.haste = jsonData.haste;
              if (jsonData.crit) stats.crit = jsonData.crit;
              if (jsonData.mastery) stats.mastery = jsonData.mastery;
              if (jsonData.versatility) stats.versatility = jsonData.versatility;
            } catch (e) {}
          }
          return { name, iconUrl, statsString, stats, tooltipText:'' };
        } catch (e) {
          continue;
        }
      }
      return null;
    }
const wowheadResolveTokens={};const wowheadResolveTimers={};
function normalizeGearMods(g){
  if(!Array.isArray(g.mods)){
    g.mods=[];
    if(g.gemId)g.mods.push({type:'gem',id:g.gemId,url:g.gemUrl||'',name:g.gemName||'',icon:g.gemIcon||''});
    if(g.gem2Id)g.mods.push({type:'gem',id:g.gem2Id,url:g.gem2Url||'',name:g.gem2Name||'',icon:g.gem2Icon||''});
    if(g.enchantId)g.mods.push({type:'enchant',id:g.enchantId,url:g.enchantUrl||'',name:g.enchantName||'',icon:g.enchantIcon||''});
  }
  g.mods=g.mods.filter(Boolean).map(x=>({type:x.type==='enchant'?'enchant':['other','extra','crafting'].includes(x.type)?'other':'gem',id:String(x.id||x.wowheadId||''),url:x.url||x.wowheadUrl||'',name:x.name||'',icon:x.icon||''}));
  return g.mods;
}
function classifyCommunityModifier(mod,data){
  const raw=`${data?.tooltipText||''} ${data?.name||mod.name||''} ${mod.url||''}`.toLowerCase();
  if(/(?:spell=|\/spell\/)/i.test(mod.url||''))return 'enchant';
  if(/optional\s+crafting\s+reagent|optional\s+reagent|crafting\s+reagent|profession\s+reagent|missive|embellishment|\bcrafting\b|\bcrafted\b|\b(?:armor|armour)\s+(?:kit|patch)\b|\bpatch(?:es)?\b/i.test(raw))return 'other';
  return mod.type==='enchant'?'enchant':'gem';
}
function scheduleWowheadResolve(i,key){const tokenKey=i+'::'+key;if(wowheadResolveTimers[tokenKey])clearTimeout(wowheadResolveTimers[tokenKey]);wowheadResolveTimers[tokenKey]=setTimeout(()=>resolveWowheadData(i,key),260)}
async function resolveWowheadData(i,key){
  const row=gearRows[i];if(!row)return false;
  if(key==='item'){
    const id=extractWowheadId(row.url||row.wowheadUrl);if(!id)return false;
    try{const data=await fetchWowheadData(id);const current=gearRows[i];if(!current||extractWowheadId(current.url||current.wowheadUrl)!==id)return false;if(data){current.name=data.name||current.name;current.icon=data.iconUrl||current.icon||'';current.stats=data.statsString||current.stats||'';current.wowheadId=id;current.wowheadUrl=normalizeWowheadUrl(current.url||current.wowheadUrl,'item');renderGearRows();renderPreview();return true}}catch(e){console.warn('[ODT] No se pudo resolver datos de Wowhead',e)}return false;
  }
  const mods=normalizeGearMods(row),mod=mods[Number(key)];if(!mod?.id)return false;
  const tokenKey=i+'::mod::'+key,token=(wowheadResolveTokens[tokenKey]||0)+1;wowheadResolveTokens[tokenKey]=token;const requestedId=mod.id;
  try{const data=await fetchWowheadData(requestedId,mod.type==='enchant'?'spell':'item');if(token!==wowheadResolveTokens[tokenKey])return false;const current=normalizeGearMods(gearRows[i]||{}),target=current[Number(key)];if(!target||target.id!==requestedId)return false;if(data){target.name=data.name||target.name;target.icon=data.iconUrl||target.icon||'';target.type=classifyCommunityModifier(target,data);renderGearRows();renderManualAndDetectedExtras();renderPreview();return true}}catch(e){console.warn('[ODT] No se pudo resolver datos del modificador',e)}return false;
}
async function resolveAllCommunityWowheadData(){const jobs=[];gearRows.forEach((row,i)=>{if(row.url||row.wowheadUrl)jobs.push(resolveWowheadData(i,'item'));normalizeGearMods(row).forEach((mod,j)=>{if(mod.id)jobs.push(resolveWowheadData(i,j))})});if(jobs.length)await Promise.allSettled(jobs)}
function makeWhLink(id,type='item',label=''){if(!id)return label?`<span>${esc(label)}</span>`:'';const data=`${type}=${id}`;return `<a class="odt-wh-link" href="https://www.wowhead.com/${type}=${id}" target="_blank" rel="noopener" data-wowhead="${data}" data-wh-icon-size="small" data-wh-iconize-link="true" data-wh-rename-link="true">${esc(label||id)}</a>`;}
function makeWhIconLink(id,type='item',label='',size='small'){if(!id)return '';const data=`${type}=${id}`;return `<a class="odt-icon-link" href="https://www.wowhead.com/${type}=${id}" target="_blank" rel="noopener" data-wowhead="${data}" data-wh-icon-size="${size}" data-wh-iconize-link="true" data-wh-rename-link="true" aria-label="${esc(label||type)}">${esc(label||id)}</a>`;}
function makeWhIconButton(id,type='item',label='',size='small',click=''){if(!id)return '';const data=`${type}=${id}`;return `<a class="mini-socket filled odt-icon-link" href="https://www.wowhead.com/${type}=${id}" target="_blank" rel="noopener" data-wowhead="${data}" data-wh-icon-size="${size}" data-wh-iconize-link="true" data-wh-rename-link="false" aria-label="${esc(label||type)}" onclick="event.preventDefault();event.stopPropagation();${click}">${esc(label||id)}</a>`;}
function refreshWowhead(){setTimeout(()=>{try{if(window.WH&&WH.Tooltips&&typeof WH.Tooltips.refreshLinks==='function')WH.Tooltips.refreshLinks();else if(typeof $WowheadPower!=='undefined'&&$WowheadPower.refreshLinks)$WowheadPower.refreshLinks();setTimeout(()=>{try{if(window.WH&&WH.Tooltips&&typeof WH.Tooltips.refreshLinks==='function')WH.Tooltips.refreshLinks()}catch(e){}},250)}catch(e){}},80)}
function setItemFromUrl(i,value){const row=gearRows[i];if(!row)return;row.url=value;const id=extractWowheadId(value);row.wowheadId=id;row.wowheadUrl=id?normalizeWowheadUrl(value,'item'):'';if(!id){row.name='';row.icon='';row.stats='';renderGearRows();renderPreview();refreshWowhead();return;}if(!row.name||isObjectPlaceholderName(row.name))row.name='Cargando objeto…';renderGearRows();renderPreview();refreshWowhead();scheduleWowheadResolve(i,'item')}
function setGearModFromUrl(i,j,value){const row=gearRows[i];if(!row)return;const mod=normalizeGearMods(row)[j];if(!mod)return;const raw=String(value||'').trim(),spell=/[?&]spell=|\/spell(?:=|\/)/i.test(raw),id=extractWowheadId(raw);mod.url=id?normalizeWowheadUrl(raw,spell?'spell':'item'):raw;mod.id=id;mod.name=id?(mod.name||''):'';mod.icon='';if(spell)mod.type='enchant';else if(id&&mod.type==='enchant')mod.type='gem';renderGearRows();renderManualAndDetectedExtras();renderPreview();refreshWowhead();if(id)scheduleWowheadResolve(i,j)}
function setGearModType(i,j,type){const mod=normalizeGearMods(gearRows[i]||{})[j];if(!mod)return;mod.type=['gem','enchant','other'].includes(type)?type:'gem';if(mod.id)mod.url=normalizeWowheadUrl(mod.url,mod.type==='enchant'?'spell':'item');renderGearRows();renderManualAndDetectedExtras();renderPreview()}
function setConsumableFromUrl(i,value){const row=consumableRows[i];row.url=value;const id=extractWowheadId(value);row.wowheadId=id;row.wowheadUrl=id?normalizeWowheadUrl(value,'item'):'';if(id&&!row.name)row.name='Consumible Wowhead #'+id;renderConsumables();renderPreview();refreshWowhead()}
async function loadAllowedPatches(){
  const found=new Map();
  // Fuente oficial para las guías comunitarias: parches administrados manualmente en el archivo local.
  try{
    const snap=await db.collection('guidePatches').where('active','==',true).get();
    snap.docs.forEach(doc=>{
      const d=doc.data()||{};
      const name=String(d.name||'').trim();
      if(name) found.set(doc.id,{name,order:Number.isFinite(Number(d.order))?Number(d.order):999999});
    });
  }catch(e){
    console.warn('No se pudieron cargar los parches administrados desde el archivo local.',e);
  }
  allowedPatches=[...found.values()].sort((a,b)=>(a.order-b.order)||a.name.localeCompare(b.name,undefined,{numeric:true})).map(x=>x.name);
  const select=$('guidePatch');
  if(select){
    select.innerHTML=allowedPatches.length
      ? '<option value="">Seleccionar parche</option>'+allowedPatches.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')
      : '<option value="">No hay parches disponibles</option>';
    select.disabled=!allowedPatches.length;
    select.onchange=renderPreview;
  }
}
function uploadTalentImage(input){const file=input.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return toast('La captura debe ser una imagen.');const reader=new FileReader();reader.onload=()=>{ $('talentImagePreview').innerHTML=`<img src="${esc(reader.result)}" alt="Captura de talentos">`; $('talentImageData').value=reader.result; renderPreview(); };reader.readAsDataURL(file)}
function renderGearRows(){const box=$('gearList');box.innerHTML=gearRows.map((g,i)=>{const mods=normalizeGearMods(g);const icons=mods.filter(x=>x.id).map(x=>makeWhIconButton(x.id,x.type==='enchant'?'spell':'item',x.name||labelForExtraType(x.type),'small')).join('');const rows=mods.map((x,j)=>`<div class="inline-input-row"><select aria-label="Tipo de modificador" onchange="setGearModType(${i},${j},this.value)"><option value="gem" ${x.type==='gem'?'selected':''}>Gema</option><option value="enchant" ${x.type==='enchant'?'selected':''}>Encantamiento</option><option value="other" ${x.type==='other'?'selected':''}>Extra de crafteo</option></select><input value="${esc(x.url)}" placeholder="URL de Wowhead" oninput="setGearModFromUrl(${i},${j},this.value)"><button class="remove-btn" type="button" aria-label="Quitar modificador" onclick="removeGearMod(${i},${j})">×</button></div>`).join('');return `<div class="builder-gear-row"><div class="builder-slot-name">${esc(g.slot)}</div><button class="gear-icon-btn ${g.wowheadId?'filled':''}" type="button" onclick="focusGearUrl(${i})">${g.wowheadId?makeWhIconLink(g.wowheadId,'item',g.name||'Objeto','large'): '+'}</button><div class="gear-row-main"><div class="gear-url-line"><input value="${esc(g.url||'')}" placeholder="Pegá la URL de Wowhead del objeto" oninput="setItemFromUrl(${i},this.value)"><button class="tiny-btn" type="button" onclick="openGearPicker(${i})">URL</button></div><div class="gear-mods">${icons||'<span class="builder-armor-status">Sin modificadores</span>'}</div><div id="inline-${i}" class="inline-inputs open">${rows}</div><div class="gear-mod-add"><button class="tiny-btn" type="button" onclick="addGearMod(${i},'gem')">+ Gema</button><button class="tiny-btn" type="button" onclick="addGearMod(${i},'enchant')">+ Encantamiento</button><button class="tiny-btn" type="button" onclick="addGearMod(${i},'other')">+ Extra</button></div></div><button class="remove-btn" onclick="removeGear(${i})">×</button></div>`}).join('')||'<div class="empty">No hay piezas agregadas.</div>';refreshWowhead()}
function renderConsumables(){const box=$('consumablesList');if(!box)return;box.innerHTML=consumableRows.map((c,i)=>`<div class="consumable-builder-row"><div class="consumable-type">${esc(c.type)}</div><div class="consumable-url-line"><input value="${esc(c.url||'')}" placeholder="Pegá la URL de Wowhead del consumible" oninput="setConsumableFromUrl(${i},this.value)">${c.wowheadId?`<span class="consumable-preview-icon">${makeWhIconLink(c.wowheadId,'item',c.name||'Consumible')}</span>`:''}</div><button class="remove-btn" type="button" onclick="clearConsumable(${i})">×</button></div>`).join('');refreshWowhead()}
window.clearConsumable=i=>{const c=consumableRows[i];if(!c)return;c.url='';c.name='';c.wowheadId='';c.wowheadUrl='';renderConsumables();renderPreview()};
window.removeGear=i=>{gearRows.splice(i,1);renderGearRows();renderPreview()};
window.addGear=()=>{const used=new Set(gearRows.map(x=>x.slot));const slot=GEAR_SLOTS.find(x=>!used.has(x));if(!slot)return toast('Ya agregaste todas las ranuras.');gearRows.push({slot,url:'',wowheadId:'',wowheadUrl:'',gemUrl:'',gemId:'',gemUrl2:'',gem2Id:'',enchantUrl:'',enchantId:''});renderGearRows();renderPreview()};
window.focusGearUrl=i=>{document.querySelector(`#gearList .builder-gear-row:nth-child(${i+1}) input`)?.focus()};
window.openGearPicker=i=>{const el=document.querySelector(`#gearList .builder-gear-row:nth-child(${i+1}) input`);if(el){el.focus();el.select()}};
window.addGearMod=(i,type)=>{const row=gearRows[i];if(!row)return;normalizeGearMods(row).push({type:['gem','enchant','other'].includes(type)?type:'gem',id:'',url:'',name:'',icon:''});renderGearRows();renderManualAndDetectedExtras();renderPreview();document.querySelector(`#inline-${i} .inline-input-row:last-child input`)?.focus()};
window.removeGearMod=(i,j)=>{const row=gearRows[i];if(!row)return;normalizeGearMods(row).splice(j,1);renderGearRows();renderManualAndDetectedExtras();renderPreview()};
function renderManualAndDetectedExtras(){
  const lists={gem:$('gemsExtrasList'),enchant:$('enchantExtrasList'),other:$('otherExtrasList')};
  Object.values(lists).forEach(box=>{if(box)box.innerHTML=''});
  const seen={gem:new Set(),enchant:new Set(),other:new Set()};
  const appendIcon=(type,item)=>{
    const box=lists[type]||lists.other;if(!box||!item.id)return;
    const key=String(item.id);if(seen[type].has(key))return;seen[type].add(key);
    const wrap=document.createElement('span');wrap.className='extra-icon-chip';
    wrap.innerHTML=makeWhIconLink(item.id,type==='enchant'?'spell':'item',item.name||labelForExtraType(type));box.appendChild(wrap);
  };
  gearRows.forEach(g=>normalizeGearMods(g).forEach(x=>appendIcon(x.type,x)));
  manualExtras.forEach((x,i)=>{
    const box=lists[x.type]||lists.other;if(!box)return;
    const row=document.createElement('div');row.className='manual-extra-row';
    row.innerHTML=`<input class="manual-extra-url" value="${esc(x.url||'')}" placeholder="Pegá la URL de Wowhead" oninput="updateManualExtra(${i},this.value)"><span class="extra-manual-icon">${x.id?makeWhIconLink(x.id,x.type==='enchant'?'spell':'item',x.name||labelForExtraType(x.type)):''}</span><button class="remove-btn" type="button" onclick="removeManualExtra(${i})">×</button>`;box.appendChild(row);
  });
  refreshWowhead();
}
function labelForExtraType(type){return type==='gem'?'Gema':type==='enchant'?'Encantamiento':'Extra'}
window.addManualExtra=function(type){manualExtras.push({type,url:'',id:'',name:''});renderManualAndDetectedExtras();setTimeout(()=>document.querySelectorAll('.manual-extra-row input').item(document.querySelectorAll('.manual-extra-row input').length-1)?.focus(),0)};
window.updateManualExtra=function(i,value){const x=manualExtras[i];if(!x)return;x.url=value;x.id=extractWowheadId(value);x.name=labelForExtraType(x.type)+' #'+(x.id||'');renderManualAndDetectedExtras();renderPreview()};
window.removeManualExtra=function(i){manualExtras.splice(i,1);renderManualAndDetectedExtras();renderPreview()};
function getForm(){
  const spec=$('guideSpec').value,cls=$('guideClass').value,patch=$('guidePatch')?.value||'';
  return {
    title:$('guideTitle').value.trim(),authorName:$('guideAuthorName')?.value.trim().slice(0,60)||'',description:$('guideDescription').value.trim(),class:cls,specialization:spec,patch,
    role:CLASSES.find(x=>x[0]===cls&&x[1]===spec)?.[2]||'',
    content:{stats:[1,2,3,4].map(i=>$('statPriority'+i)?.value||'').filter(Boolean).join(' > '),statsPriority:[1,2,3,4].map(i=>$('statPriority'+i)?.value||'').filter(Boolean),talents:$('guideTalents').value.trim(),talentImage:$('talentImageData').value||'',rotation:$('guideRotation').value.trim(),tips:$('guideTips').value.trim()},
    gear:gearRows.map(x=>{
      const mods=normalizeGearMods(x).filter(m=>m.id).map(m=>({type:m.type,name:m.name||labelForExtraType(m.type)+' #'+m.id,icon:m.icon||'',url:m.url||'',wowheadUrl:m.url||'',wowheadId:m.id,id:m.id}));
      const gems=mods.filter(m=>m.type==='gem'),enchants=mods.filter(m=>m.type==='enchant'),enchant=enchants[0]||null;
      return {slot:x.slot,name:x.name||'',icon:x.icon||'',url:x.url||'',wowheadUrl:x.wowheadUrl||'',wowheadId:x.wowheadId||'',stats:x.stats||'',popularity:x.popularity??null,parses:x.parses??null,mods,gems,gemsNames:gems.map(g=>g.name).filter(Boolean).join(', '),gemsIcons:gems.map(g=>g.icon).filter(Boolean).join(', '),enchant:enchant?.name||'',enchantIcon:enchant?.icon||'',enchantWowheadUrl:enchant?.wowheadUrl||'',enchantWowheadId:enchant?.wowheadId||'',extras:mods};
    }),
    extras:manualExtras.filter(x=>x.id).map(x=>({type:x.type,name:x.name||labelForExtraType(x.type),icon:x.icon||'',url:x.url||'',wowheadUrl:normalizeWowheadUrl(x.url||'',x.type==='enchant'?'spell':'item'),wowheadId:x.id})),
    consumables:consumableRows.map(x=>({type:x.type,name:x.name||'',icon:x.icon||'',url:x.url||'',wowheadUrl:x.wowheadUrl||'',wowheadId:x.wowheadId||''})).filter(x=>x.wowheadId)
  };
}
function savedGearMods(item){
  if(Array.isArray(item?.mods)&&item.mods.length)return item.mods;
  if(Array.isArray(item?.extras)&&item.extras.length)return item.extras;
  const mods=[];
  (Array.isArray(item?.gems)?item.gems:[]).forEach(x=>mods.push({type:'gem',...x}));
  if(item?.enchantWowheadId||item?.enchantWowheadUrl||item?.enchant)mods.push({type:'enchant',name:item.enchant,icon:item.enchantIcon,wowheadUrl:item.enchantWowheadUrl,wowheadId:item.enchantWowheadId});
  return mods;
}
function gearModsMarkup(item,size='small'){
  return savedGearMods(item).map(m=>{const id=m.wowheadId||m.id||extractWowheadId(m.wowheadUrl||m.url||'');if(!id)return '';const type=m.type==='enchant'?'spell':'item';return makeWhIconLink(id,type,m.name||labelForExtraType(m.type||'gem'),size)}).join('');
}
function renderPreview(){
  const d=getForm(),priority=d.content.statsPriority.filter(Boolean).join(' > ');
  const gear=d.gear.map(x=>{const item=x.wowheadId?makeWhLink(x.wowheadId,'item',x.name||'Objeto #'+x.wowheadId):esc(x.name||x.slot);return `<div class="preview-gear-item"><div class="preview-item-top">${item}</div><div class="preview-item-mods">${gearModsMarkup(x)}</div><span>${esc(x.slot)}</span></div>`}).join('');
  const consumables=d.consumables.map(x=>`<div class="preview-consumable-item">${makeWhIconLink(x.wowheadId,'item',x.name||x.type,'small')}<span>${esc(x.type)}</span></div>`).join('');
  const manualExtraPreview=(d.extras||[]).map(x=>`<span class="extra-icon-chip">${makeWhIconLink(x.wowheadId,x.type==='enchant'?'spell':'item',x.name||'Extra','small')}</span>`).join('');
  $('preview').innerHTML=`<div class="preview-status">PENDIENTE DE REVISIÓN</div><div class="preview-card"><h3>${esc(d.title||'Nueva guía')}</h3><div class="preview-meta">${esc(d.class||'Clase')} · ${esc(d.specialization||'Especialización')} · ${esc(d.role||'Rol')}${d.patch?`<span class="preview-patch">PARCHE ${esc(d.patch)}</span>`:''}</div><div class="preview-meta">Créditos: ${esc(d.authorName||'Invitado')}</div><p class="preview-desc">${esc(d.description||'La descripción de la guía aparecerá aquí.')}</p><div class="section-kicker">Estadísticas</div><p class="preview-desc">${esc(priority||'Sin prioridad definida.')}</p><div class="section-kicker">Equipo</div><div class="preview-gear">${gear||'<div class="preview-gear-item">Todavía no hay piezas.</div>'}</div>${consumables?`<div class="section-kicker" style="margin-top:10px">Consumibles</div><div class="preview-consumables">${consumables}</div>`:''}${manualExtraPreview?`<div class="section-kicker" style="margin-top:10px">Extras</div><div class="preview-extra-icons">${manualExtraPreview}</div>`:''}${d.content.talentImage||d.content.talents?`<div class="section-kicker" style="margin-top:10px">Talentos</div>${d.content.talentImage?`<div class="preview-talent-image"><img src="${esc(d.content.talentImage)}" alt="Talentos"></div>`:''}${d.content.talents?`<p class="preview-desc">${esc(d.content.talents)}</p>`:''}`:''}${d.content.rotation?`<div class="section-kicker" style="margin-top:10px">Rotación y habilidades</div><p class="preview-desc">${esc(d.content.rotation)}</p>`:''}${d.content.tips?`<div class="section-kicker" style="margin-top:10px">Consejos</div><p class="preview-desc">${esc(d.content.tips)}</p>`:''}</div>`;refreshWowhead()
}
function bindForm(){['guideTitle','guideAuthorName','guideDescription','guideTalents','guideRotation','guideTips','guideClass','guideSpec','guidePatch','statPriority1','statPriority2','statPriority3','statPriority4'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderPreview);el.addEventListener('change',renderPreview)}});$('guideClass').addEventListener('change',renderPreview)}
function guestId(){
  try {let id=localStorage.getItem('odt-visitor-id');if(!id){id=crypto.randomUUID();localStorage.setItem('odt-visitor-id',id);}return id;}
  catch{return crypto.randomUUID();}
}
async function saveGuide(submit){await resolveAllCommunityWowheadData();const data=getForm();if(!data.title||!data.class||!data.specialization)return toast('Completá nombre, clase y especialización.');if(!data.patch||!allowedPatches.includes(data.patch))return toast('Seleccioná un parche válido creado desde Admin.');const now=new Date().toISOString();const defaultAuthorName='Invitado';const payload={...data,authorId:guestId(),authorName:(data.authorName||defaultAuthorName).slice(0,60),status:submit?'pending':'draft',featured:false,votes:0,ratingTotal:0,ratingCount:0,createdAt:now,updatedAt:now};try{await db.collection('communityGuides').add(payload);toast(submit?'Guía enviada para revisión.':'Borrador guardado.');setTimeout(()=>location.href='community-guides.html',900)}catch(e){console.error(e);toast(e.message||'No se pudo guardar la guía.')}}
window.saveDraft=()=>saveGuide(false);window.submitGuide=()=>saveGuide(true);
async function loadGuides(){const box=$('guideGrid');if(!box)return;box.innerHTML='<div class="empty">Cargando guías...</div>';try{const snap=await db.collection('communityGuides').where('status','==','published').limit(60).get();const docs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(Number(b.featured)-Number(a.featured))||(Number(b.votes||0)-Number(a.votes||0)));renderGuides(docs);const requestedGuide=new URLSearchParams(location.search).get('guia');if(requestedGuide&&docs.some(g=>g.id===requestedGuide))setTimeout(()=>window.openGuide(requestedGuide),0)}catch(e){console.error(e);box.innerHTML='<div class="empty">No se pudieron cargar las guías.</div>'}}
let allGuides=[];
function renderGuides(docs){allGuides=docs;applyFilters()}
function applyFilters(){const q=($('search')?.value||'').toLowerCase().trim(),cls=$('filterClass')?.value||'',spec=$('filterSpec')?.value||'',patch=$('filterPatch')?.value||'';const filtered=allGuides.filter(g=>(!q||[g.title,g.description,g.authorName,g.class,g.specialization,g.patch].join(' ').toLowerCase().includes(q))&&(!cls||g.class===cls)&&(!spec||g.specialization===spec)&&(!patch||g.patch===patch));if(!$('guideGrid'))return;$('guideGrid').innerHTML=filtered.length?filtered.map(g=>`<article class="guide-card"><div class="guide-card-head"><div class="guide-card-title">${esc(g.title||'Guía sin título')}</div><div class="guide-card-author">POR ${esc(g.authorName||'USUARIO')}</div></div><div class="guide-card-body"><div class="guide-card-desc">${esc(g.description||'Sin descripción.')}</div><div class="guide-tags"><span class="tag gold">${esc(g.class||'')}</span><span class="tag">${esc(g.specialization||'')}</span>${g.featured?'<span class="tag gold">DESTACADA</span>':''}</div></div><div class="guide-card-footer"><div class="rating">★ ${g.ratingCount?((g.ratingTotal/g.ratingCount).toFixed(1)):'Sin votos'}<span>${Number(g.votes||0)} votos</span></div><button class="gold-btn" onclick="openGuide('${g.id}')">VER GUÍA</button></div></article>`).join(''):'<div class="empty">No hay guías que coincidan con los filtros.</div>'}
function fillFilters(){if(!$('filterClass'))return;const cls=[...new Set(CLASSES.map(x=>x[0]))];$('filterClass').innerHTML='<option value="">Todas las clases</option>'+cls.map(x=>`<option>${esc(x)}</option>`).join('');$('filterSpec').innerHTML='<option value="">Todas las especializaciones</option>'+[...new Set(CLASSES.map(x=>x[1]))].map(x=>`<option>${esc(x)}</option>`).join('');loadPublicPatches();['search','filterClass','filterSpec','filterPatch'].forEach(id=>$(id)?.addEventListener('input',applyFilters))}
async function loadPublicPatches(){
  const found=new Set();
  const staticHosting=Boolean(document.querySelector('meta[name="odt-hosting"][content="github-pages"]'));
  const sources=staticHosting?['guides.json']:['guides.json','/api/guides','/api/config'];
  for(const source of sources){
    try{
      const response=await fetch(new URL(source,document.baseURI),{cache:'no-store'});
      if(!response.ok)continue;
      const data=await response.json(),guides=source==='/api/config'?data?.guides:data;
      if(guides&&typeof guides==='object')Object.values(guides).forEach(guide=>{const patch=String(guide?.patch||'').trim();if(patch)found.add(patch);});
    }catch(error){}
    if(found.size)break;
  }
  const select=$('filterPatch');
  if(select)select.innerHTML='<option value="">Todos los parches</option>'+[...found].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=>`<option>${esc(value)}</option>`).join('');
}
window.openGuide=async id=>{
  const g=allGuides.find(x=>x.id===id);if(!g)return;const content=g.content||{};
  const priority=(Array.isArray(content.statsPriority)?content.statsPriority.filter(Boolean).join(' > '):String(content.statsPriority||''))||content.stats||'';
  const consumables=(g.consumables||[]).filter(x=>x.wowheadId||x.wowheadUrl).map(x=>`<div class="preview-consumable-item">${makeWhIconLink(x.wowheadId||extractWowheadId(x.wowheadUrl),'item',x.name||x.type||'Consumible','small')}<span>${esc(x.type||'Consumible')}</span></div>`).join('');
  const extraIcons=(g.extras||[]).map(x=>{const itemId=x.wowheadId||x.id||extractWowheadId(x.wowheadUrl||x.url||'');return itemId?`<span class="extra-icon-chip">${makeWhIconLink(itemId,x.type==='enchant'?'spell':'item',x.name||'Extra','small')}</span>`:''}).join('');
  $('modal').classList.add('open');
  $('modalContent').innerHTML=`<button class="ghost-btn close-modal" onclick="closeGuide()">✕ CERRAR</button><div class="eyebrow">GUÍA DE LA COMUNIDAD</div><h2 class="section-title" style="font-size:27px;margin-top:8px">${esc(g.title)}</h2><div class="preview-meta">${esc(g.class)} · ${esc(g.specialization)} · Por ${esc(g.authorName)}${g.patch?` · PARCHE ${esc(g.patch)}`:''}</div><p class="preview-desc">${esc(g.description||'')}</p><div class="guide-tags"><span class="tag gold">${esc(g.class)}</span><span class="tag">${esc(g.specialization)}</span></div>${priority?`<div class="section"><h3 class="section-title">Estadísticas</h3><p class="preview-desc">${esc(priority)}</p></div>`:''}<div class="section"><h3 class="section-title">Equipo</h3><div class="detail-gear">${(g.gear||[]).map(x=>`<div class="preview-gear-item"><div class="preview-item-top">${x.wowheadId?makeWhLink(x.wowheadId,'item',x.name||'Objeto'):esc(x.name||x.slot)}</div><div class="preview-item-mods">${gearModsMarkup(x)}</div><span>${esc(x.slot||'')}</span></div>`).join('')||'<div class="preview-gear-item">Sin equipo.</div>'}</div></div>${consumables?`<div class="section"><h3 class="section-title">Consumibles</h3><div class="preview-consumables">${consumables}</div></div>`:''}${extraIcons?`<div class="section"><h3 class="section-title">Otros extras</h3><div class="preview-extra-icons">${extraIcons}</div></div>`:''}<div class="section"><h3 class="section-title">Talentos</h3>${content.talentImage?`<img class="guide-talent-image" src="${esc(content.talentImage)}" alt="Talentos">`:''}<p class="preview-desc">${esc(content.talents||'No especificado.')}</p></div><div class="section"><h3 class="section-title">Rotación y prioridades</h3><p class="preview-desc">${esc(content.rotation||'No especificado.')}</p></div><div class="section"><h3 class="section-title">Consejos</h3><p class="preview-desc">${esc(content.tips||'No especificado.')}</p></div><div class="editor-actions"><button class="gold-btn" onclick="voteGuide('${g.id}')">★ VOTAR 5/5</button></div>`;refreshWowhead()
};window.closeGuide=()=>{$('modal').classList.remove('open')};
async function voteGuide(id){try{await ODTDocuments.vote(id,guestId());toast('Voto registrado.');await loadGuides()}catch(e){toast(e.message||'No se pudo registrar el voto.')}}
window.voteGuide=voteGuide;
function initCommunityPage(){if(document.getElementById('gearList')){initSelects();bindForm();gearRows=GEAR_SLOTS.map(slot=>({slot,url:'',wowheadId:'',wowheadUrl:'',gemUrl:'',gemId:'',gemIcon:'',gemName:'',gem2Url:'',gem2Id:'',gem2Icon:'',gem2Name:'',enchantUrl:'',enchantId:'',enchantIcon:'',enchantName:'',stats:'',icon:'',name:''}));consumableRows=CONSUMABLE_TYPES.map(type=>({type,url:'',name:'',icon:'',wowheadId:'',wowheadUrl:''}));renderGearRows();renderConsumables();renderManualAndDetectedExtras();renderPreview();loadAllowedPatches()}else{fillFilters();loadGuides()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCommunityPage);else initCommunityPage()
