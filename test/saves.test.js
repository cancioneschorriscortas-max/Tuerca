/* ============================================================
   PERSISTENCIA (js/01-nucleo-datos.js)

   A primeira proba deste ficheiro é a que tiña que existir desde
   o principio: que gardar GARDE. O código usaba `window.storage`,
   que non existe en ningún navegador, e o catch baleiro tragaba o
   erro en cada chamada. A campaña vivía en memoria e morría ao
   recargar — sen que nada o dixese.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo } = require('./arnes.js');

const partida = (extra = {}) => Object.assign({
  units: [{ id: 'R-01', name: 'PROBA', cls: 'GRUNT', ops: 3 }],
  fallen: [], opCount: 7, nextId: 2, recurringEnemies: [],
}, extra);

proba('gardar escribe de verdade no almacenamento', () => {
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  const CLAVE = S.aval('SAVE_CLAVE');

  afirmar(LS.getItem(CLAVE) == null, 'a ranura non estaba baleira ao empezar');
  return S.aval('saveData')(partida()).then((ok) => {
    afirmar(ok === true, 'saveData dixo que non puido gardar');
    const txt = LS.getItem(CLAVE);
    afirmar(txt, 'NON se escribiu nada: a partida perderíase ao recargar');
    const d = JSON.parse(txt);
    afirmar(d.opCount === 7, `gardouse mal: opCount = ${d.opCount}`);
    afirmar(d.units.length === 1, 'gardouse mal: perdéronse unidades');
  });
});

proba('cargar le do almacenamento, non da memoria', () => {
  const S = cargarXogo();
  /* Escríbese A MAN na ranura para que memStore siga baleiro: así se
     comproba a lectura de verdade e non o eco da sesión. */
  S.aval('localStorage').setItem(S.aval('SAVE_CLAVE'), JSON.stringify(partida({ opCount: 21 })));
  return S.aval('loadData')().then((d) => {
    afirmar(d.opCount === 21, `non leu do almacenamento (opCount = ${d.opCount})`);
    afirmar((d.units || []).length === 1, 'non recuperou as unidades');
  });
});

proba('unha ranura corrupta non leva a campaña por diante', () => {
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  LS.setItem(S.aval('SAVE_COPIA'), JSON.stringify(partida({ opCount: 12 })));
  LS.setItem(S.aval('SAVE_CLAVE'), '{isto non é json válido');
  return S.aval('loadData')().then((d) => {
    afirmar(d.opCount === 12, `debía recuperar a copia, devolveu opCount = ${d.opCount}`);
  });
});

proba('un JSON válido que non é unha partida rexéitase', () => {
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  LS.setItem(S.aval('SAVE_COPIA'), JSON.stringify(partida({ opCount: 5 })));
  /* JSON perfecto, pero doutra cousa. Sen validación entraría e petaría
     moito máis adiante, lonxe da causa. */
  LS.setItem(S.aval('SAVE_CLAVE'), JSON.stringify({ hola: 'mundo' }));
  return S.aval('loadData')().then((d) => {
    afirmar(d.opCount === 5, `colou un gardado que non era unha partida (opCount = ${d.opCount})`);
  });
});

proba('a copia faise antes de pisar o gardado anterior', () => {
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  const gardar = S.aval('saveData');
  return gardar(partida({ opCount: 1 }))
    .then(() => gardar(partida({ opCount: 2 })))
    .then(() => {
      const copia = JSON.parse(LS.getItem(S.aval('SAVE_COPIA')));
      const actual = JSON.parse(LS.getItem(S.aval('SAVE_CLAVE')));
      afirmar(actual.opCount === 2, 'a ranura principal non ten o último gardado');
      afirmar(copia.opCount === 1, `a copia debía ter o anterior, ten ${copia.opCount}`);
    });
});

proba('borrar todo leva tamén a copia', () => {
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  const gardar = S.aval('saveData');
  return gardar(partida({ opCount: 1 }))
    .then(() => gardar(partida({ opCount: 2 })))
    .then(() => S.aval('wipeData')())
    .then(() => {
      afirmar(LS.getItem(S.aval('SAVE_CLAVE')) == null, 'quedou a ranura principal');
      afirmar(LS.getItem(S.aval('SAVE_COPIA')) == null,
        'quedou a copia: a partida "borrada" volvería soa na seguinte carga');
    });
});

proba('se non se pode gardar, dise', () => {
  /* Cota chea, modo privado, permisos. Calar é o que permitiu que o bug
     de window.storage durase tanto. */
  const S = cargarXogo();
  const LS = S.aval('localStorage');
  const orixinal = LS.setItem;
  LS.setItem = () => { const e = new Error('cheo'); e.name = 'QuotaExceededError'; throw e; };
  return S.aval('saveData')(partida()).then((ok) => {
    LS.setItem = orixinal;
    afirmar(ok === false, 'saveData dixo que gardara cando non puido');
  });
});

proba('non queda ningún uso de window.storage', () => {
  const fs = require('fs');
  const dir = 'C:/tuerca/i/js/';
  const restos = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).filter((f) => {
    const t = fs.readFileSync(dir + f, 'utf8');
    /* Só chamadas reais; os comentarios que o explican poden quedar. */
    return /window\.storage\s*\./.test(t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, ''));
  });
  afirmar(!restos.length, `aínda usan window.storage (non existe): ${restos.join(', ')}`);
});
