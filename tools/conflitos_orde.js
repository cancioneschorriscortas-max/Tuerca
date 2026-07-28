#!/usr/bin/env node
/* ============================================================
   ¿QUE PEZAS NON TEÑEN ORDE VÁLIDA?

   Diablo II compón personaxes apilando capas, e garda nun ficheiro COF a
   orde de pintado PARA CADA DIRECCIÓN E CADA FOTOGRAMA. Funcionoulle
   porque as súas pezas se superpoñen —o equipo pousa sobre o corpo— e
   sempre existe unha orde correcta.

   En TUERCA medimos que ordenar capas erra ata un 15%, e a culpa é da
   xeometría: as caixas dos modelos INTERPENÉTRANSE. Pero "interpenetran"
   é vago. O que decide se hai orde válida é máis fino:

     dúas pezas teñen CONFLITO nunha dirección se, nos píxeles onde as
     dúas se ven, ás veces está diante unha e ás veces a outra.

   Se iso pasa, ningunha orde as pinta ben: hai que cambiar a xeometría.
   Se non pasa, existe orde correcta e só hai que atopala — que é
   exactamente o que fai un ficheiro COF.

   Isto lista os conflitos por par de pezas, para saber QUE hai que
   redeseñar en vez de redeseñalo todo.

   Uso: node tools/conflitos_orde.js [CLASE]
   ============================================================ */
const { render, rot } = require('./vox3d.js');
const { montar, ESQUELETO, CLASES } = require('./modelos.js');
const { porGrupos, W, H, ESCALA, PITCH } = require('./proba_capas.js');

const ESTADOS = ['REPOUSO', 'ANDAR', 'DISPARAR'];
const FASES = [0, 0.25, 0.5, 0.75];
const DIRS = 8;
/* Tolerancia: unha diferenza de profundidade por baixo disto é ruído de
   rasterización nunha superficie compartida, non un cruce real. */
const TOL = 0.02;

function conflitos(cls){
  const acc = {};      /* "A|B" -> {px, dirs:Set} */
  for(const est of ESTADOS) for(const fase of FASES){
    const grupos = porGrupos(cls, est, fase, 'peza');
    const nomes = Object.keys(grupos);
    for(let d = 0; d < DIRS; d++){
      const yaw = d*2*Math.PI/DIRS;
      const r = {};
      for(const g of nomes) r[g] = render({ pezas: grupos[g] }, W, H, ESCALA, yaw, PITCH);
      for(let i = 0; i < nomes.length; i++) for(let j = i+1; j < nomes.length; j++){
        const A = r[nomes[i]], B = r[nomes[j]];
        let aDiante = 0, bDiante = 0;
        for(let p = 0; p < W*H; p++){
          if(!A.masc[p] || !B.masc[p]) continue;
          const dz = A.zbuf[p] - B.zbuf[p];
          if(dz < -TOL) aDiante++; else if(dz > TOL) bDiante++;
        }
        /* Conflito = as dúas gañan en algún sitio. O número que importa é
           o do lado MENOR: son os píxeles que quedarían mal coa mellor
           das dúas ordes posibles. */
        if(aDiante && bDiante){
          const clave = nomes[i] + ' | ' + nomes[j];
          const a = acc[clave] = acc[clave] || { px: 0, dirs: new Set(), casos: 0 };
          a.px = Math.max(a.px, Math.min(aDiante, bDiante));
          a.dirs.add(d);
          a.casos++;
        }
      }
    }
  }
  return acc;
}

const clases = process.argv[2] ? [process.argv[2]] : CLASES;
for(const cls of clases){
  const c = conflitos(cls);
  const lista = Object.entries(c).sort((a,b) => b[1].px - a[1].px);
  console.log('\n  ' + cls);
  if(!lista.length){ console.log('    sen conflitos: existe orde correcta en todas as direccións'); continue; }
  console.log('    par de pezas                    peor    direccións afectadas');
  console.log('    ' + '-'.repeat(62));
  for(const [par, a] of lista){
    console.log('    ' + par.padEnd(32) + String(a.px).padStart(5) + ' px' +
      '   ' + [...a.dirs].sort((x,y)=>x-y).join(' '));
  }
}
console.log('\n  "peor" = píxeles que quedarían mal aínda escollendo a mellor orde.\n');
