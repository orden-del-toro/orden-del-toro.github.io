
(function(){
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  async function loadPublishedCommunityGuides(){
    var box=document.getElementById('publishedCommunityGuides');
    if(!box || !window.ODTDocuments) return;
    try{
      var snapshot=await ODTDocuments.create().collection('communityGuides')
        .where('status','==','published').limit(6).get();
      var guides=snapshot.docs.map(function(doc){return Object.assign({id:doc.id},doc.data());});
      guides.sort(function(a,b){
        return Number(Boolean(b.featured))-Number(Boolean(a.featured)) || Number(b.votes||0)-Number(a.votes||0);
      });
      if(!guides.length){
        box.innerHTML='<p class="odt-community-guides-status">Todavía no hay guías publicadas. Volvé pronto para ver los aportes de la hermandad.</p>';
        return;
      }
      box.innerHTML=guides.map(function(guide){
        return '<article class="odt-community-guide-card">' +
          '<div class="odt-community-guide-card-top"><span>'+escapeHtml(guide.class||'CLASE')+'</span>'+
          (guide.featured?'<span class="odt-community-guide-featured">DESTACADA</span>':'')+'</div>'+
          '<h3>'+escapeHtml(guide.title||'Guía sin título')+'</h3>'+
          '<div class="odt-community-guide-meta">'+escapeHtml(guide.specialization||'')+
          (guide.patch?' · PARCHE '+escapeHtml(guide.patch):'')+'</div>'+
          '<p>'+escapeHtml(guide.description||'Guía compartida por la comunidad.')+'</p>'+
          '<div class="odt-community-guide-card-bottom"><span>POR '+escapeHtml(guide.authorName||'USUARIO')+'</span>'+
          '<a href="community-guides.html?guia='+encodeURIComponent(guide.id)+'">VER GUÍA <span aria-hidden="true">›</span></a></div></article>';
      }).join('');
    }catch(error){
      console.warn('[ODT] No se pudieron cargar las guías comunitarias.',error);
      box.innerHTML='<p class="odt-community-guides-status">No se pudieron cargar las guías ahora. Puedes verlas en la sección de la comunidad.</p>';
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadPublishedCommunityGuides,{once:true}); else loadPublishedCommunityGuides();
})();
