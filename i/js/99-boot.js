/* ============================================================
   BOOT (multi-ficheiro) — execucións de arranque que dependen
   de símbolos definidos en ficheiros posteriores ao seu fogar.
   ============================================================ */
_pvpEnvolver();

/* (v0.72) A axuda e o panel de estado viven en 16-estado.js, que carga
   DESPOIS de 00b-i18n.js. O aplicarIdioma() de arranque execútase antes
   de que esas funcións existan, así que alí non pintan nada: hai que
   chamalas unha vez aquí, xa con todo cargado. */
/* (v0.74) As políticas de autoplay teñen o contexto de audio suspendido
   ata que hai un xesto do usuario, así que ao cargar a portada a cama non
   pode arrancar. Á primeira pulsación, acéndese. */
document.addEventListener('pointerdown', function _primeiroXesto(){
  document.removeEventListener('pointerdown', _primeiroXesto);
  try{
    if(typeof initAudio === 'function') initAudio();
    if(typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended'){
      audioCtx.resume().catch(() => {});
    }
    const hg2 = document.getElementById('hangar');
    if(typeof ambienteIniciar === 'function'){
      ambienteIniciar(hg2 && hg2.style.display !== 'none' ? 'hangar' : 'batalla');
    }
  }catch(e){ console.error('[ambiente xesto]', e); }
}, {once: false});

try{ if(typeof axudaRender === 'function') axudaRender(); }
catch(e){ console.error('[boot axuda]', e); }
try{ if(typeof estadoRender === 'function') estadoRender(); }
catch(e){ console.error('[boot estado]', e); }

/* (v0.69) A lámina do hangar só se ve na portada: en batalla estorbaría e
   custaría pintado. O hangar amosa e agocha con style.display desde media
   ducia de sitios, así que en vez de tocalos todos obsérvase o elemento. */
(function(){
  const hg = document.getElementById('hangar');
  if(!hg) return;
  const sincronizar = () => {
    const naPortada = hg.style.display !== 'none';
    document.body.classList.toggle('no-hangar', naPortada);
    /* (v0.74) A cama de son cambia de escena co ecrán: nave pechada no
       hangar, campo aberto en batalla. Mesmo observador, que xa sabe
       cando muda. */
    if(typeof ambienteIniciar === 'function'){
      try{ ambienteIniciar(naPortada ? 'hangar' : 'batalla'); }
      catch(e){ console.error('[ambiente escena]', e); }
    }
  };
  new MutationObserver(sincronizar).observe(hg, {attributes: true, attributeFilter: ['style']});
  sincronizar();
})();
