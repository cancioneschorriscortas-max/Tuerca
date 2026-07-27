/* ============================================================
   ROBUSTEZ DO PvP (js/03-pvp-sync.js)

   Aquí non hai Firebase nin rede: o que se comproba é a LÓXICA de
   supervivencia, que é onde estaba o oco. O convidado xa vixiaba o
   host; o host non vixiaba a ninguén, así que unha lapela conxelada
   ao outro lado deixaba a partida colgada para sempre.

   Os reloxos maniféstanse a man (Date.now non se pode mover), así
   que se falsea `ultimoPulso` cara atrás para simular silencio.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla } = require('./arnes.js');

/* Monta un host con batalla en marcha e a rede falseada. */
function montarHost(S) {
  const g = novaBatalla(S, { op: 2 });
  const escrituras = [];
  S.aval('(function(p){ window._pvp = p; })')({
    rol: 'host', sala: 'PROBA', procesadas: new Set(), ordenBuf: [],
    finFeito: false, snapPend: null, ordenPend: null,
    net: {
      write: (ruta, v) => { escrituras.push({ ruta, v }); return Promise.resolve(); },
      push: (ruta, v) => { escrituras.push({ ruta, v }); return Promise.resolve(); },
      update: () => Promise.resolve(),
    },
  });
  return { g, escrituras, P: () => S.aval('window._pvp') };
}

proba('o host avisa cando o rival leva uns segundos calado', () => {
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const AVISO = S.aval('PVP_AVISO_MS');

  hostFrame(g);
  afirmar(!P().avisoPulso, 'avisou de entrada, sen darlle tempo ao rival');

  /* Un chisco antes do limiar: aínda non. */
  P().ultimoPulso = Date.now() - (AVISO - 1500);
  hostFrame(g);
  afirmar(!P().avisoPulso, 'avisou antes de tempo');

  /* Pasado o limiar: aviso, e unha soa vez. */
  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, `non avisou tras ${AVISO} ms de silencio`);
});

proba('o host dá a partida por abandonada tras silencio longo', () => {
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const ABANDONO = S.aval('PVP_ABANDONO_MS');

  P().ultimoPulso = Date.now() - (ABANDONO + 1000);
  hostFrame(g);

  afirmar(g.over, 'a batalla segue viva co rival desaparecido');
  afirmar(g.result === 'victory', `esperábase vitoria por retirada, foi ${JSON.stringify(g.result)}`);
  afirmar(P().finFeito, 'non marcou o fin como feito: podería disparar dúas veces');
});

proba('o latexo do rival rearma o aviso', () => {
  /* Sen isto, un corte pasaxeiro deixaba o aviso pegado e o segundo
     corte xa non avisaba. */
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const AVISO = S.aval('PVP_AVISO_MS');

  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, 'non avisou no primeiro corte');

  /* Chega latexo: é o que fai o onValue de `pulso`. */
  P().ultimoPulso = Date.now();
  P().avisoPulso = false;
  hostFrame(g);
  afirmar(!P().avisoPulso, 'quedou o aviso posto co rival de volta');

  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, 'non volveu avisar no segundo corte');
});

proba('o convidado latexa, pero non en cada frame', () => {
  const S = cargarXogo();
  const escrituras = [];
  S.aval('(function(p){ window._pvp = p; })')({
    rol: 'guest', sala: 'PROBA',
    net: { write: (ruta, v) => { escrituras.push(ruta); return Promise.resolve(); } },
  });
  const pulso = S.aval('pvpPulso');
  const PULSO = S.aval('PVP_PULSO_MS');

  for (let i = 0; i < 200; i++) pulso();
  afirmar(escrituras.length === 1,
    `200 frames deberían dar UN latexo, deron ${escrituras.length}: iso é tráfico de balde`);
  afirmar(/\/pulso$/.test(escrituras[0]), `escribiu na ruta equivocada: ${escrituras[0]}`);

  /* Pasado o intervalo, outro. */
  S.aval('window._pvp')._pulsoT = Date.now() - (PULSO + 100);
  pulso();
  afirmar(escrituras.length === 2, 'non volveu latexar pasado o intervalo');
});

proba('o host non latexa (só escoita)', () => {
  const S = cargarXogo();
  const { escrituras } = montarHost(S);
  const pulso = S.aval('pvpPulso');
  for (let i = 0; i < 50; i++) pulso();
  afirmar(escrituras.length === 0, 'o host púxose a latexar: iso é traballo do convidado');
});

proba('os dous lados usan os mesmos limiares', () => {
  /* Estaban a man en 03-pvp-sync.js e en 11-retratos-ui.js con números
     literais distintos de sitio. Se divirxen, un lado corta antes que o
     outro e a partida remata en desacordo. */
  const fs = require('fs');
  const bucle = fs.readFileSync('C:/tuerca/i/js/11-retratos-ui.js', 'utf8');
  afirmar(/PVP_AVISO_MS/.test(bucle) && /PVP_ABANDONO_MS/.test(bucle),
    'o watchdog do convidado volveu aos números literais en vez das constantes');
});

/* ============================================================
   O LOBBY: de AGARDANDO a BATALLA sen pisarse

   Reproduce un fallo real reportado polo dono: «quédase pillado na sala
   ás veces, e cando lle dás a iniciar cada un vai á súa partida».

   O host promovía a sala a 'listo' sempre que o estado NON fose 'listo'.
   'batalla' tampouco é 'listo', así que en canto o host arrancaba e
   marcaba a sala como batalla, esta mesma regra volvía escribir 'listo'
   por riba. O convidado —que só arranca ao ver 'batalla'— podía non
   chegar a vela nunca: quedaba na sala mentres o host xogaba só.

   Que fose INTERMITENTE era a pista: dependía de se o convidado
   alcanzaba a ver o estado bo antes de que se pisase.
   ============================================================ */
function redeFalsa(){
  const store = {}, subs = [];
  const get = (r) => r.split('/').filter(Boolean).reduce((o,k)=> o==null?undefined:o[k], store);
  const set = (r,v) => { const ks=r.split('/').filter(Boolean); let o=store;
    for(let i=0;i<ks.length-1;i++) o=(o[ks[i]]=o[ks[i]]||{});
    if(v===null) delete o[ks[ks.length-1]]; else o[ks[ks.length-1]]=v; };
  const avisar = (r) => { for(const s of subs.slice())
    if(r===s.ruta || r.startsWith(s.ruta+'/') || s.ruta.startsWith(r+'/')) s.cb(get(s.ruta)); };
  return { _store: store, _estados: [],
    write:(r,v)=>{set(r,v);avisar(r);return Promise.resolve();},
    /* Firebase admite claves con barra nun update: son rutas relativas e
       aplícanse atomicamente. O código real úsao para abrir a revancha e
       poñer os `listo` a cero na MESMA escritura, e sen iso a proba non
       reproduce a realidade. */
    update(r,v){ if(v && v.estado) this._estados.push(v.estado);
      const chan = {}, fondo = [];
      for(const [k,val] of Object.entries(v)){
        if(k.includes('/')) fondo.push([r + '/' + k, val]); else chan[k] = val;
      }
      const a=get(r)||{}; set(r,{...a,...chan});
      for(const [ruta,val] of fondo) set(ruta, val);
      avisar(r); return Promise.resolve(); },
    remove:(r)=>{set(r,null);avisar(r);return Promise.resolve();},
    push:(r,v)=>{const a=get(r)||{};a['k'+Object.keys(a).length]=v;set(r,a);avisar(r);return Promise.resolve();},
    once:async(r)=>get(r),
    onValue:(r,cb)=>{const s={ruta:r,cb};subs.push(s);cb(get(r));return ()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1);};},
    onDisconnectRemove:()=>{} };
}

/* Monta host + convidado sobre a mesma rede e devólveos xa dentro da sala. */
async function montarSala(S){
  const mkLobby = S.aval('mkLobby');
  const net = redeFalsa();
  const nada = { estado(){}, salaPechada(){} };
  const host = mkLobby(net, nada), guest = mkLobby(net, nada);
  const sala = await host.crear('HOST');
  await guest.unirse('GUEST', sala);
  return { net, host, guest, sala, ver: () => net._store.salas[sala] };
}

proba('cos dous listos, a sala promove a LISTO', async () => {
  for(const orde of [['host','guest'], ['guest','host']]){
    const S = cargarXogo();
    const s = await montarSala(S);
    for(const quen of orde) await s[quen].listo();
    afirmar(s.ver().estado === 'listo',
      `listos en orde ${orde.join('->')}: a sala quedou en "${s.ver().estado}"`);
  }
});

proba('o lobby NON pisa o estado batalla', async () => {
  const S = cargarXogo();
  const s = await montarSala(S);
  await s.host.listo();
  await s.guest.listo();
  afirmar(s.ver().estado === 'listo', 'non chegou a listo');
  /* O host arranca: escribe batalla, coma en pvpArrancar. */
  await s.net.update(`salas/${s.sala}`, {estado: 'batalla', mapa: {seed: 0}});
  afirmar(s.ver().estado === 'batalla',
    `o lobby volveu escribir "${s.ver().estado}" por riba de batalla — o convidado nunca arrancaría`);
  afirmar(!s.net._estados.slice(s.net._estados.indexOf('batalla') + 1).includes('listo'),
    'escribiuse listo DESPOIS de batalla: a carreira segue aí');
});

proba('na revancha volve promover desde entrebatallas', async () => {
  const S = cargarXogo();
  const s = await montarSala(S);
  await s.host.listo();
  await s.guest.listo();
  await s.net.update(`salas/${s.sala}`, {estado: 'batalla', mapa: {seed: 0}});
  /* Fin da batalla: o host abre a revancha e pon os listos a cero NA MESMA
     escritura, igual que fai 12-debrief-hangar.js. Se fosen tres escrituras
     seguidas, entre a primeira e a segunda a sala tería os dous listos en
     estado promovible e volvería arrancar soa. */
  await s.net.update(`salas/${s.sala}`, {estado: 'entrebatallas', n: 2,
    'host/listo': false, 'guest/listo': false});
  afirmar(s.ver().estado === 'entrebatallas', 'a revancha non se abriu');
  await s.host.listo();
  await s.guest.listo();
  afirmar(s.ver().estado === 'listo',
    `a segunda batalla non promove: a sala quedou en "${s.ver().estado}"`);
});
