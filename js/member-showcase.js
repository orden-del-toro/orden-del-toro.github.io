(function () {
  'use strict';

  // Tiempo de protagonismo de cada integrante. La transición se ajusta en 03-roster.css.
  const DURATION_MS = 6500;

  function armoryLink(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function create(root, {onRetry = () => {}} = {}) {
    const stage=root.querySelector('[data-member-stage]');
    const controls=root.querySelector('[data-member-controls]');
    const stateBox=root.querySelector('[data-member-state]');
    const message=root.querySelector('[data-member-message]');
    const retry=root.querySelector('[data-member-retry]');
    const progress=root.querySelector('[data-member-progress]');
    const counter=root.querySelector('[data-member-counter]');
    const play=root.querySelector('[data-member-play]');
    const announcement=root.querySelector('[data-member-announcement]');
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const events=new AbortController(), options={signal:events.signal};
    let items=[], slides=[], index=0, activeKey='', timer=null, animation=null;
    let elapsed=0, started=0, enabled=false, inView=false, hovered=false, focused=false, gesture=null;
    let manualPaused=motion.matches, destroyed=false, lastWidth=0, status='loading';
    root.dataset.reducedMotion=String(motion.matches);

    function stopTimer() {
      if(timer!==null) {
        elapsed=Math.min(DURATION_MS,elapsed+performance.now()-started);
        clearTimeout(timer);timer=null;
      }
      animation?.cancel();animation=null;
      progress.style.transform=`scaleX(${elapsed/DURATION_MS})`;
    }
    function syncTiming() {
      stopTimer();
      const running=!destroyed&&status==='ready'&&items.length>1&&enabled&&inView&&!document.hidden&&!manualPaused&&!hovered&&!focused&&!gesture;
      root.dataset.playing=String(running);
      play.setAttribute('aria-label',manualPaused?'Reproducir presentación':'Pausar presentación');
      root.querySelector('[data-member-play-icon]').textContent=manualPaused?'▶':'Ⅱ';
      root.querySelector('[data-member-play-label]').textContent=manualPaused?'Reproducir':'Pausar';
      if(!running)return;
      const remaining=Math.max(0,DURATION_MS-elapsed);
      started=performance.now();
      animation=progress.animate([{transform:`scaleX(${elapsed/DURATION_MS})`},{transform:'scaleX(1)'}],{duration:remaining,easing:'linear',fill:'forwards'});
      timer=setTimeout(()=>{stopTimer();elapsed=0;move(1,false);},remaining);
    }
    function fitNames() {
      if(destroyed||stage.hidden)return;
      for(const slide of slides) {
        const name=slide.querySelector('.odt-member-name');
        name.style.fontSize='';name.style.whiteSpace='nowrap';
        const base=parseFloat(getComputedStyle(name).fontSize), available=name.clientWidth;
        const required=name.scrollWidth;
        name.style.whiteSpace='';
        if(required>available&&available>0)name.style.fontSize=`${Math.max(32,base*(available-2)/required)}px`;
      }
    }
    function positionSlides() {
      const total=items.length;
      slides.forEach((slide,i)=>{
        let position='hidden';
        if(i===index)position='active';
        else if(total>2&&i===(index-1+total)%total)position='previous';
        else if(total>1&&i===(index+1)%total)position='next';
        slide.dataset.position=position;
        const active=position==='active';
        slide.inert=!active;slide.setAttribute('aria-hidden',String(!active));
        const link=slide.querySelector('a');if(link)link.tabIndex=active?0:-1;
      });
      activeKey=items[index]?.key||activeKey;
      counter.textContent=total?`${index+1} / ${total}`:'';
    }
    function move(direction,manual=true) {
      if(items.length<2||status!=='ready')return;
      const restore=stage.contains(document.activeElement);
      stopTimer();elapsed=0;
      index=(index+direction+items.length)%items.length;positionSlides();
      if(manual) {
        const member=items[index];
        announcement.textContent=`${member.name}. Clase: ${member.className}. Rango: ${member.rank}.`;
      }
      if(restore)(slides[index].querySelector('a')||play).focus({preventScroll:true});
      syncTiming();
    }
    function element(tag,className,text) {
      const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;
    }
    function makeSlide(member,i) {
      const slide=element('article','odt-member-slide');
      slide.setAttribute('role','group');slide.setAttribute('aria-roledescription','diapositiva');
      slide.setAttribute('aria-label',`Integrante ${i+1} de ${items.length}`);
      slide.append(element('h2','odt-member-name',member.name),element('span','odt-member-underline'));
      const details=element('dl','odt-member-details');
      const classGroup=element('div','odt-member-class');
      classGroup.append(element('dt','odt-member-label','CLASE'),element('dd','odt-member-class-name',member.className));
      const rankGroup=element('div','odt-member-rank');
      rankGroup.append(element('dt','odt-member-label','RANGO'),element('dd','odt-member-rank-name',member.rank));
      details.append(classGroup,rankGroup);slide.append(details);
      if(member.armory) {
        const link=element('a','odt-member-armory','VER ARMERÍA');
        link.href=member.armory;link.target='_blank';link.rel='noopener noreferrer';
        link.setAttribute('aria-label',`Ver armería de ${member.name} (abre otra pestaña)`);slide.append(link);
      } else slide.append(element('p','odt-member-unavailable','Armería no disponible'));
      return slide;
    }
    function update(records,{status:nextStatus='ready'}={}) {
      if(destroyed)return;
      const restore=stage.contains(document.activeElement);
      stopTimer();elapsed=0;status=nextStatus;
      const occurrences=new Map();
      items=status==='ready'?(Array.isArray(records)?records:[]).filter(row=>row&&typeof row==='object').map(row=>{
        const name=String(row.name||'Nombre no indicado');
        const className=String(row.class?.name||'Clase no indicada');
        const base=row.id?`${row.prefix||''}/${row.id}`:row.armoryUrl||`${name}/${className}`;
        const occurrence=occurrences.get(base)||0;occurrences.set(base,occurrence+1);
        return {key:`${base}/${occurrence}`,name,className,rank:String(row.rank||'Rango no indicado'),armory:armoryLink(row.armoryUrl)};
      }):[];
      const found=items.findIndex(member=>member.key===activeKey);
      index=found>=0?found:Math.min(index,Math.max(0,items.length-1));
      slides=items.map(makeSlide);stage.replaceChildren(...slides);
      stage.hidden=!items.length;controls.hidden=items.length<2;stateBox.hidden=items.length>0;
      retry.hidden=status!=='error';
      message.textContent=status==='loading'?'Cargando integrantes…':status==='error'?'No pudimos cargar los integrantes de la hermandad.':'Todavía no hay integrantes para presentar.';
      positionSlides();fitNames();
      if(restore)(slides[index]?.querySelector('a')||root).focus({preventScroll:true});
      syncTiming();
    }
    function setActive(value) {
      enabled=Boolean(value);
      if(!enabled){gesture=null;hovered=false;focused=false;}
      else {focused=root.contains(document.activeElement);hovered=window.matchMedia('(hover: hover)').matches&&root.matches(':hover');fitNames();}
      syncTiming();
    }
    root.querySelector('[data-member-previous]').addEventListener('click',()=>move(-1),options);
    root.querySelector('[data-member-next]').addEventListener('click',()=>move(1),options);
    play.addEventListener('click',()=>{manualPaused=!manualPaused;syncTiming();},options);
    retry.addEventListener('click',onRetry,options);
    root.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;syncTiming();}},options);
    root.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hovered=false;syncTiming();}},options);
    root.addEventListener('focusin',()=>{focused=true;syncTiming();},options);
    root.addEventListener('focusout',()=>{queueMicrotask(()=>{if(!destroyed){focused=root.contains(document.activeElement);syncTiming();}});},options);
    root.addEventListener('keydown',event=>{
      if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();move(event.key==='ArrowLeft'?-1:1);
    },options);
    stage.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY};syncTiming();
    },options);
    function endGesture(event) {
      if(!gesture||event.pointerId!==gesture.id)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;
      if(event.type!=='pointercancel'&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.35)move(dx<0?1:-1);
      syncTiming();
    }
    window.addEventListener('pointerup',endGesture,options);
    window.addEventListener('pointercancel',endGesture,options);
    document.addEventListener('visibilitychange',syncTiming,options);
    motion.addEventListener('change',()=>{root.dataset.reducedMotion=String(motion.matches);if(motion.matches)manualPaused=true;syncTiming();},options);
    const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=.15;syncTiming();},{threshold:[0,.15]});
    observer.observe(root);
    const resize=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;fitNames();}});
    resize.observe(root);
    document.fonts?.ready.then(fitNames);
    document.fonts?.addEventListener('loadingdone',fitNames,options);
    return {update,setActive,destroy(){destroyed=true;stopTimer();observer.disconnect();resize.disconnect();events.abort();}};
  }
  window.ODTMemberShowcase={create,DURATION_MS};
})();
