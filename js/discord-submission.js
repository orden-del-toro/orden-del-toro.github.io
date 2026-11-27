(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ODTDiscordSubmission = api;
})(globalThis, function () {
  'use strict';
  const serverInvite = 'https://discord.gg/WdQYscBH7x';
  const defaultProfile = 'https://discord.com/users/376215095560372224';
  function destination(value) {
    for(const candidate of [value,defaultProfile])try {
        const url = new URL(candidate);
        if (url.protocol === 'https:' && ['discord.com','www.discord.com'].includes(url.hostname)
          && /^\/users\/\d{15,22}\/?$/.test(url.pathname)) return { url:'https://discord.com'+url.pathname, profile:true };
      } catch { /* Continúa con el perfil de la hermandad verificado. */ }
    return { url:serverInvite, profile:false };
  }
  function template(data) {
    const field = value => String(value ?? '').replace(/\r\n?/g,'\n').trim() || 'No indicado';
    return [
      'SOLICITUD DE RECLUTAMIENTO · ORDEN DEL TORO', '',
      'Personaje: '+field(data.personaje || data.nombre),
      'Clase: '+field(data.clase),
      'Especialización: '+field(data.espec),
      'iLvl: '+field(data.ilvl),
      'Discord: '+field(data.discord),
      'Armory / Perfil: '+field(data.armory), '',
      'EXPERIENCIA E INFORMACIÓN ADICIONAL',
      field(data.mensaje)
    ].join('\n');
  }
  function splitMessages(text, limit = 1900) {
    if (!Number.isInteger(limit) || limit < 2) throw new Error('Límite de mensaje no válido.');
    const parts = []; let start = 0;
    while (start < text.length) {
      let end = Math.min(start + limit, text.length);
      if (end < text.length) {
        const newline = text.lastIndexOf('\n', end - 1);
        if (newline > start + limit / 2) end = newline + 1;
        else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      }
      parts.push(text.slice(start,end)); start = end;
    }
    return parts.length ? parts : [''];
  }
  function show(data, options = {}) {
    document.getElementById('discordSubmissionDialog')?.remove();
    const target = destination(options.profileUrl);
    const modal = document.createElement('dialog'); modal.id = 'discordSubmissionDialog'; modal.className = 'odt-discord-dialog';
    modal.setAttribute('aria-labelledby','discordSubmissionTitle');
    const heading = document.createElement('div'); heading.className = 'odt-discord-dialog-heading';
    const title = document.createElement('h2'); title.id = 'discordSubmissionTitle'; title.textContent = 'Tu solicitud para Discord';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'odt-discord-close'; close.textContent = '×'; close.setAttribute('aria-label','Cerrar plantilla');
    close.addEventListener('click',()=>modal.close()); heading.append(title,close); modal.append(heading);
    const instructions = document.createElement('p'); instructions.className = 'odt-discord-instructions';
    instructions.textContent = target.profile
      ? '1. Copiá la plantilla. 2. Abrí el perfil de Rupp (darkylabola) y tocá «Mensaje». 3. Pegala y enviala desde tu Discord.'
      : 'Copiá la plantilla y abrí Discord. En el servidor de la hermandad, buscá a Rupp y enviale la solicitud por mensaje privado.';
    modal.append(instructions);
    const parts = splitMessages(template(data));
    if (parts.length > 1) {
      const note = document.createElement('p'); note.className = 'odt-discord-length-note';
      note.textContent = 'Tu solicitud es larga. Copiá y enviá estos '+parts.length+' mensajes en orden; se conserva todo el texto.'; modal.append(note);
    }
    const status = document.createElement('p'); status.className = 'odt-discord-status'; status.id = 'discordSubmissionStatus'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    parts.forEach((part,index)=>{
      const section = document.createElement('section'); section.className = 'odt-discord-message';
      const label = document.createElement('label'); label.htmlFor = 'discordSubmissionText'+index;
      label.textContent = parts.length > 1 ? `Mensaje ${index+1} de ${parts.length}` : 'Plantilla con tus datos';
      const area = document.createElement('textarea'); area.id = label.htmlFor; area.readOnly = true; area.value = part; area.rows = Math.min(12,Math.max(5,part.split('\n').length)); area.spellcheck = false;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'panel-cta odt-discord-copy'; copy.textContent = parts.length > 1 ? `Copiar mensaje ${index+1}` : 'Copiar plantilla';
      copy.addEventListener('click',async()=>{
        let copied = false;
        try { if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(part);copied=true;} } catch { /* Continúa con la selección manual. */ }
        if(!copied){
          area.focus();area.select();area.setSelectionRange(0,area.value.length);
          try{copied=document.execCommand('copy');}catch{copied=false;}
        }
        status.textContent = copied
          ? (parts.length > 1 ? `Mensaje ${index+1} copiado. ` : 'Plantilla copiada. ')+'Pegalo en Discord y enviá el mensaje.'
          : 'No se pudo copiar automáticamente. Seleccioná la plantilla y usá «Copiar»; después pegala en Discord.';
      });
      section.append(label,area,copy); modal.append(section);
    });
    modal.append(status);
    const actions = document.createElement('div'); actions.className = 'odt-discord-dialog-actions';
    const open = document.createElement('a'); open.id = 'discordSubmissionOpen'; open.className = 'panel-cta'; open.href = target.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
    open.textContent = target.profile ? 'Abrir perfil de Rupp en Discord' : 'Abrir Discord de la hermandad'; actions.append(open); modal.append(actions);
    const note = document.createElement('p'); note.className = 'odt-discord-delivery-note';
    note.textContent = 'La solicitud se envía cuando la pegás y confirmás en Discord. El formulario conserva tus datos y no se guarda en Admin.'; modal.append(note);
    if(target.profile){
      const join = document.createElement('a'); join.className = 'odt-discord-join'; join.href = serverInvite; join.target = '_blank'; join.rel = 'noopener noreferrer'; join.textContent = 'Unirme al Discord de la hermandad'; modal.append(join);
    }
    modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
    modal.addEventListener('close',()=>modal.remove(),{once:true});
    document.body.append(modal); modal.showModal();
  }
  return { template, splitMessages, destination, show };
});
