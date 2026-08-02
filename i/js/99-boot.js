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
    /* (v0.84) E as chispas da portada, polo mesmo motivo e no mesmo
       sitio: acéndense ao entrar e PÁRANSE ao saír. Unha animación
       debuxando detrás dunha batalla é traballo tirado. */
    if(typeof efxPortada === 'function'){
      try{ efxPortada(naPortada); }
      catch(e){ console.error('[portada fx]', e); }
    }
  };
  new MutationObserver(sincronizar).observe(hg, {attributes: true, attributeFilter: ['style']});
  sincronizar();
})();

/* ============================================================
   O ARRANQUE DO XOGO.

   Vai aquí e non en 12-debrief-hangar.js porque depende de
   interludioArranque(), que se define en 21-interludio.js — un ficheiro
   que carga DESPOIS. Estivo alá e o resultado foi que o guión do
   primeiro día non se executaba nunca: o typeof daba falso e caíase
   nunha reserva silenciosa.

   Secuencia do primeiro día:
     1. interludio de ÓPTIMA — a instalación de probas
     2. bánco de pezas e presuposto
     3. o taller, obrigatorio
     4. o bautizo, dentro do taller ao confirmar

   Calquera outro día, interludioArranque chama directamente a showHangar
   e isto non se nota.
   ============================================================ */
(async function arrancarXogo(){
  /* CARGAR ANTES DE DECIDIR NADA, E ISTO XA MORDEU DÚAS VECES.

     `DATA` nace como freshData() e non se enche ata que showHangar() fai
     `DATA = await loadData()`. Calquera pregunta feita antes diso
     interrógao BALEIRO: interludioPrimeiroDia() mira "cero operacións e
     ninguén no roster" e respondía que si SEMPRE, para todo o mundo e en
     cada arranque.

     E o interludio garda. Así que a apertura saía, marcábase vista e
     escribía o freshData() baleiro enriba da partida do xogador: cada F5
     borraba a campaña. Aliméntase a si mesmo, porque o que queda gravado
     volve cumprir a condición.

     Cárgase aquí, unha vez, antes de preguntar nada. showHangar cargará
     outra vez e non pasa nada; o que non pode volver pasar é decidir sen
     datos. */
  try{ DATA = await loadData(); }
  catch(e){ console.error('[arranque] non se puido cargar a partida', e); }

  const aoHangar = () => Promise.resolve(showHangar()).then(async () => {
    if(typeof primeiroDiaPreparar !== 'function') return;
    if(!primeiroDiaPreparar()) return;
    /* Gárdase de contado: se o xogador pecha a pestana entre o reparto e
       a montaxe, o banco ten que seguir aí ao volver. */
    try{ await saveData(DATA); }catch(e){ console.error('[primeiro día]', e); }
    if(typeof escollaClaseAberta === 'function') escollaClaseAberta();
    else if(typeof showMontaxe === 'function') showMontaxe();
  });
  if(typeof interludioArranque === 'function') interludioArranque(aoHangar);
  else aoHangar();
})();
