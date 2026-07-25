/* ============================================================
   BOOT (multi-ficheiro) — execucións de arranque que dependen
   de símbolos definidos en ficheiros posteriores ao seu fogar.
   ============================================================ */
_pvpEnvolver();

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
