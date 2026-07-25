/* ============================================================
   BOOT (multi-ficheiro) — execucións de arranque que dependen
   de símbolos definidos en ficheiros posteriores ao seu fogar.
   ============================================================ */
_pvpEnvolver();

/* (v0.72) A axuda e o panel de estado viven en 16-estado.js, que carga
   DESPOIS de 00b-i18n.js. O aplicarIdioma() de arranque execútase antes
   de que esas funcións existan, así que alí non pintan nada: hai que
   chamalas unha vez aquí, xa con todo cargado. */
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
    document.body.classList.toggle('no-hangar', hg.style.display !== 'none');
  };
  new MutationObserver(sincronizar).observe(hg, {attributes: true, attributeFilter: ['style']});
  sincronizar();
})();
