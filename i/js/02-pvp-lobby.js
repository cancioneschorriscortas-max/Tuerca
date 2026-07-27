/* ============================================================
   (v0.30 R2) DUELO ONLINE — LOBBY (Firebase Realtime Database)
   Sala con clave, nome, facciones (host=AZUL, convidado=VERMELLO),
   presenza (onDisconnect) e chat. A batalla sincronizada chega na R3.
   ============================================================ */
/* FIREBASE_CFG e FIREBASE_URLS viven en js/config.js (fóra do repo: ver config.example.js) */
let _fb = null;
function _loadScript(u){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = u; s.onload = res;
    s.onerror = () => rej(new Error('Non se puido cargar ' + u));
    document.head.appendChild(s);
  });
}
async function ensureFirebase(statusCb){
  if(_fb) return _fb;
  statusCb && statusCb('Cargando SDK de Firebase…');
  await _loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  await _loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js');
  try{ await _loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js'); }catch(e){}
  for(let i = 0; i < FIREBASE_URLS.length; i++){
    const url = FIREBASE_URLS[i];
    try{
      statusCb && statusCb('Conectando (' + (i+1) + '/' + FIREBASE_URLS.length + ')…');
      const app = firebase.initializeApp({...FIREBASE_CFG, databaseURL: url}, 'tuerca' + i);
      const db = app.database();
      const conectado = await new Promise(res => {
        const to = setTimeout(() => res(false), 6000);
        db.ref('.info/connected').on('value', s => {
          if(s.val() === true){ clearTimeout(to); res(true); }
        });
      });
      if(conectado){
        /* (v0.33) auth anónima se está activada na consola; se non, seguimos coas regras abertas */
        try{ if(app.auth) await app.auth().signInAnonymously(); }catch(e){ console.warn('[auth]', e.code || e.message); }
        _fb = {app, db, url}; return _fb;
      }
      db.goOffline(); app.delete();
    }catch(e){ console.warn('[lobby]', e); }
  }
  throw new Error('SEN_CONEXION');
}
/* Transporte abstracto sobre a RTDB — a mesma interface serve para tests e para o 2P local */
function fbNet(db){
  return {
    write:  (p, v) => db.ref(p).set(v),
    update: (p, v) => db.ref(p).update(v),
    push:   (p, v) => db.ref(p).push(v),
    remove: (p)    => db.ref(p).remove(),
    once:   (p)    => db.ref(p).once('value').then(s => s.val()),
    onValue:(p, cb) => { const r = db.ref(p); const h = s => cb(s.val()); r.on('value', h); return () => r.off('value', h); },
    onDisconnectRemove: (p) => db.ref(p).onDisconnect().remove(),
  };
}
/* Máquina de estados do lobby — INDEPENDENTE do transporte (testable en Node) */
const SALA_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function mkLobby(net, ui){
  const L = { sala:null, rol:null, nome:null, unsub:[], pechada:false };
  L.crear = async (nome) => {
    L.nome = nome; L.rol = 'host';
    L.sala = Array.from({length:5}, () => SALA_ABC[Math.floor(Math.random()*SALA_ABC.length)]).join('');
    await net.write(`salas/${L.sala}`, { estado:'agardando', creada: Date.now(), host: {nome, listo:false, v: TUERCA_V} });
    net.onDisconnectRemove && net.onDisconnectRemove(`salas/${L.sala}`);   /* se cae o host, cae a sala */
    L._escoitar();
    return L.sala;
  };
  L.unirse = async (nome, sala) => {
    sala = String(sala || '').trim().toUpperCase();
    const datos = await net.once(`salas/${sala}`);
    if(!datos) throw new Error('SALA_INEXISTENTE');
    if(datos.guest) throw new Error('SALA_CHEA');
    L.nome = nome; L.rol = 'guest'; L.sala = sala;
    await net.update(`salas/${sala}/guest`, {nome, listo:false, v: TUERCA_V});
    net.onDisconnectRemove && net.onDisconnectRemove(`salas/${sala}/guest`);
    L._escoitar();
  };
  L._escoitar = () => {
    L.unsub.push(net.onValue(`salas/${L.sala}`, datos => {
      if(L.pechada) return;
      if(!datos){ ui.salaPechada && ui.salaPechada(); return; }
      ui.estado && ui.estado(datos, L.rol);
      /* O host promove a sala a LISTO cando os dous confirmaron.
         A condición di desde ONDE se pode promover, non desde onde non.
         Antes era `estado !== 'listo'`, e iso incluía 'batalla': en canto
         o host arrancaba e poñía a sala en batalla, esta mesma liña
         volvía escribir 'listo' por riba. O convidado, que só arranca ao
         ver 'batalla', quedaba na sala para sempre — e o host xogando só.
         Que fose intermitente era a proba: dependía de se o convidado
         alcanzaba a ver o 'batalla' antes de que se pisase. */
      const PROMOVIBLES = ['agardando', 'entrebatallas'];
      if(L.rol === 'host' && datos.host && datos.guest
         && datos.host.listo && datos.guest.listo
         && PROMOVIBLES.includes(datos.estado)){
        net.update(`salas/${L.sala}`, {estado: 'listo'});
      }
    }));
  };
  L.listo = () => net.update(`salas/${L.sala}/${L.rol}`, {listo: true});
  L.chat  = (txt) => net.push(`salas/${L.sala}/chat`, {de: L.nome, txt: String(txt).slice(0, 80), ts: Date.now()});
  L.sair  = async () => {
    L.pechada = true;
    L.unsub.forEach(f => f && f());
    L.unsub = [];
    if(L.sala){
      if(L.rol === 'host') await net.remove(`salas/${L.sala}`);
      else if(L.rol === 'guest') await net.remove(`salas/${L.sala}/guest`);
    }
  };
  return L;
}
let _lobby = null;

