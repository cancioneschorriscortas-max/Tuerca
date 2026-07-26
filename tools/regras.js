#!/usr/bin/env node
/* ============================================================
   REGRAS ANATÓMICAS DOS ROBOTS DE TUERCA

   Non son opinións: son condicións que TODO modelo ten que
   cumprir. Escritas como código para que se comproben soas —
   un modelo que as incumpra falla, e non hai que ir mirando
   coordenadas a man cada vez.

   Cada regra leva o PORQUÉ. Unha regra sen motivo é unha manía.

   Uso:
     node tools/regras.js            informe de todas as clases
     node tools/regras.js --clase HEAVY
   ============================================================ */
const { ESQUELETO, montar, pose, puntoPosado, ESTADOS, CLASES,
        OBXECTIVO_MAN, ikBrazo, fkBrazo } = require('./modelos.js');
const { sprite } = require('./vox3d.js');

/* ---------- Vocabulario ----------
   Un "punto de agarre" é onde remata o brazo: a man. Un "artiluxio" é
   calquera peza que a unidade leva (arma, soplete). */
const arriba = (p) => p.centro[1] + p.tam[1]/2;
const abaixo = (p) => p.centro[1] - p.tam[1]/2;
const ancho  = (p) => p.tam[0];

function pezas(cls, id){ return ESQUELETO[cls].filter(p => p.id === id); }
function caixaDe(cls, id){
  const ps = pezas(cls, id);
  if(!ps.length) return null;
  return {
    x0: Math.min(...ps.map(p => p.centro[0] - p.tam[0]/2)),
    x1: Math.max(...ps.map(p => p.centro[0] + p.tam[0]/2)),
    y0: Math.min(...ps.map(abaixo)), y1: Math.max(...ps.map(arriba)),
    z0: Math.min(...ps.map(p => p.centro[2] - p.tam[2]/2)),
    z1: Math.max(...ps.map(p => p.centro[2] + p.tam[2]/2)),
  };
}

/* A man: extremo inferior do brazo, no seu eixe. */
/* A peza de torso máis voluminosa: o CORPO. As hombreiras, mochilas e
   demais engadidos van no mesmo grupo pero non definen o ancho. */
function torsoPrincipal(cls){
  return pezas(cls, "torso").reduce((a, b) =>
    (a.tam[0]*a.tam[1]*a.tam[2] >= b.tam[0]*b.tam[1]*b.tam[2] ? a : b));
}

/* A MAN é o extremo do ÚLTIMO segmento do brazo. Desde que hai cóbado ese
   segmento é o antebrazo: medir no brazo alto daría a altura do cóbado. */
function segmentoMan(cls, lado){
  return pezas(cls, 'antebrazo_' + lado).length ? 'antebrazo_' + lado : 'brazo_' + lado;
}
function man(cls, lado){
  const b = pezas(cls, segmentoMan(cls, lado))[0];
  if(!b) return null;
  return { x: b.centro[0], y: abaixo(b), z: b.centro[2] };
}

/* ============================================================
   REGRAS DE ESQUELETO
   ============================================================ */
const REGRAS_ESQUELETO = [
  {
    id: 'A1', nome: 'a man chega por debaixo do torso',
    por: 'se o brazo remata dentro do torso non se le como membro: fúndese co corpo, e de perfil desaparece',
    revisar(cls){
      const t = caixaDe(cls, 'torso');
      for(const lado of ['e', 'd']){
        const m = man(cls, lado);
        if(!m) return `falta o brazo ${lado}`;
        if(m.y > t.y0 - 0.04) return `a man ${lado} queda en y=${m.y.toFixed(2)}, e o torso remata en ${t.y0.toFixed(2)}`;
      }
    },
  },
  {
    id: 'A2', nome: 'o brazo colga do ombro',
    por: 'o pivote ten que estar no extremo SUPERIOR do brazo; se está no medio, o brazo xira coma unha hélice',
    revisar(cls){
      /* Vale para os dous segmentos: o brazo colga do ombro e o antebrazo
         do cóbado. En ambos, o pivote é o extremo de arriba. */
      for(const lado of ['e', 'd']){
        for(const seg of ['brazo_' + lado, 'antebrazo_' + lado]){
          const b = pezas(cls, seg)[0];
          if(!b) continue;
          if(Math.abs(b.piv[1] - arriba(b)) > 0.12){
            return `o pivote de ${seg} está en y=${b.piv[1].toFixed(2)} e o seu alto en ${arriba(b).toFixed(2)}`;
          }
        }
      }
    },
  },
  {
    id: 'A3', nome: 'a perna nace na cadeira',
    por: 'o pivote da perna ten que coincidir co fondo do torso, ou a perna sae flotando ou metida no corpo',
    revisar(cls){
      const t = caixaDe(cls, 'torso');
      for(const lado of ['e', 'd']){
        const p = pezas(cls, 'perna_' + lado)[0];
        if(Math.abs(p.piv[1] - t.y0) > 0.20){
          return `o pivote da perna ${lado} está en y=${p.piv[1].toFixed(2)} e a cadeira en ${t.y0.toFixed(2)}`;
        }
      }
    },
  },
  {
    id: 'A4', nome: 'os brazos van por fóra do torso',
    por: 'se o brazo está dentro do ancho do torso non se ve nunca de fronte',
    revisar(cls){
      /* Contra o CORPO, non contra o grupo enteiro: as hombreiras do
         HEAVY sobresaen a propósito e inflarían a medida. */
      const corpo = torsoPrincipal(cls);
      for(const lado of ['e', 'd']){
        const b = pezas(cls, 'brazo_' + lado)[0];
        const bordo = Math.abs(b.centro[0]) - ancho(b)/2;
        const medioCorpo = corpo.tam[0]/2 - 0.06;
        if(bordo < medioCorpo - 0.10){
          return `o brazo ${lado} empeza en |x|=${bordo.toFixed(2)} e o corpo chega a ${medioCorpo.toFixed(2)}`;
        }
      }
    },
  },
  {
    id: 'A5', nome: 'a cabeza pousa sobre o torso',
    por: 'un oco entre cabeza e torso vese como unha peza flotando; unha sobreposición grande come o pescozo',
    revisar(cls){
      const t = caixaDe(cls, 'torso'), c = caixaDe(cls, 'cabeza');
      const oco = c.y0 - t.y1;
      if(oco > 0.06) return `hai ${oco.toFixed(2)} de oco entre a cabeza e o torso`;
      if(oco < -0.30) return `a cabeza métese ${(-oco).toFixed(2)} dentro do torso`;
    },
  },
  {
    id: 'A6', nome: 'nada ocupa a entreperna',
    por: 'É O FALLO QUE MÁIS CANTA. Entre as pernas e por debaixo da cintura só pode haber pernas. Calquera outra cousa aí lese como que lle colga do medio.',
    revisar(cls){
      const corpo = torsoPrincipal(cls);
      const pe = pezas(cls, 'perna_e')[0], pd = pezas(cls, 'perna_d')[0];
      /* A entreperna: entre as caras internas das pernas e por debaixo da
         CINTURA, que é o medio do corpo. Medila desde o FONDO do torso
         deixaba pasar cousas á altura da bragueta, que é exactamente o
         fallo que se quería cazar. */
      const dentroX = Math.min(Math.abs(pe.centro[0]), Math.abs(pd.centro[0]));
      for(const p of ESQUELETO[cls]){
        if(p.id === 'perna_e' || p.id === 'perna_d' || p.id === 'torso') continue;
        const baixoCintura = p.centro[1] < corpo.centro[1];
        const naLiñaMedia = Math.abs(p.centro[0]) < dentroX;
        if(baixoCintura && naLiñaMedia){
          return `"${p.id}" está en x=${p.centro[0].toFixed(2)}, y=${p.centro[1].toFixed(2)}: liña media e baixo cintura`;
        }
      }
    },
  },
  {
    id: 'A7', nome: 'todo artiluxio vai nunha man',
    por: 'unha arma que non nace da man flota. O pivote do artiluxio é o puño: aí é onde se agarra e sobre aí xira.',
    revisar(cls){
      const mans = [man(cls, 'e'), man(cls, 'd')];
      for(const p of pezas(cls, 'arma')){
        const piv = p.piv || p.centro;
        const d = Math.min(...mans.map(m => Math.hypot(piv[0]-m.x, piv[1]-m.y)));
        if(d > 0.30) return `o pivote do artiluxio está a ${d.toFixed(2)} da man máis próxima`;
      }
    },
  },
  {
    id: 'A9', nome: 'o artiluxio non se solta da man en ningunha pose',
    por: 'A7 só miraba o repouso, e así pasou desapercibido que a arma NON era filla do brazo: ao balancear, a man afastábase ata 0.25 e o artiluxio quedaba no aire. Un artiluxio é fillo da man e viaxa con ela SEMPRE, en todas as poses e todas as fases.',
    revisar(cls){
      const seg = segmentoMan(cls, 'd');
      const brazo = pezas(cls, seg)[0];
      const paiSeg = (ESQUELETO[cls].find(q => q.id === seg) || {}).pai || null;
      const manRepouso = [brazo.centro[0], abaixo(brazo), brazo.centro[2]];
      for(const p of pezas(cls, 'arma')){
        const agarre = p.piv || p.centro;
        for(const est of ESTADOS){
          for(let i = 0; i < 8; i++){
            const f = i/8;
            const m = puntoPosado(cls, est, f, manRepouso, seg, paiSeg);
            const a = puntoPosado(cls, est, f, agarre, p.id, p.pai, p);
            const d = Math.hypot(m[0]-a[0], m[1]-a[1], m[2]-a[2]);
            if(d > 0.32){
              return `${est} fase ${f.toFixed(2)}: a man e o agarre están a ${d.toFixed(2)}`;
            }
          }
        }
      }
    },
  },
  {
    id: 'A10', nome: 'a man chega onde se lle dixo',
    por: 'a pose base xa non son ángulos escritos a man senón un DESTINO para a man, resolto por cinemática inversa. Esta regra comproba a IK coa cinemática directa: se algún día alguén cambia as lonxitudes dos ósos e o destino queda fóra de alcance, o brazo estírase en silencio e a pose degrádase sen que ninguén se decate. Aquí sáltase.',
    revisar(cls){
      const obx = OBXECTIVO_MAN[cls];
      if(!obx) return;
      for(const lado of ['d', 'e']){
        const alto = pezas(cls, 'brazo_' + lado)[0];
        const ante = pezas(cls, 'antebrazo_' + lado)[0];
        if(!alto || !ante) continue;
        const l1 = alto.tam[1], l2 = ante.tam[1];
        const [ty, tz] = obx[lado];
        if(Math.hypot(ty, tz) > (l1 + l2) * 0.98){
          return `man ${lado}: o destino está a ${Math.hypot(ty,tz).toFixed(2)} e o brazo mide ${(l1+l2).toFixed(2)} — fóra de alcance`;
        }
        const r = ikBrazo(l1, l2, ty, tz);
        const [ay, az] = fkBrazo(l1, l2, r.ombro, r.cobado);
        const err = Math.hypot(ay - ty, az - tz);
        if(err > 0.001) return `man ${lado}: pedíase [${ty}, ${tz}] e queda en [${ay.toFixed(3)}, ${az.toFixed(3)}]`;
        /* As dúas solucións da IK deixan a man no mesmo sitio, así que o
           erro de arriba non distingue entre elas. O que as distingue é o
           CÓBADO: co brazo levantado o robot parece encollerse de ombros.
           Isto pasou de verdade e só se viu ao renderizar. */
        const cy = -l1 * Math.cos(r.ombro);
        if(cy > -l1 * 0.35){
          return `cóbado ${lado} en y=${cy.toFixed(2)}: vai cara arriba, non colga do ombro`;
        }
      }
    },
  },
  {
    id: 'A11', nome: 'o artiluxio queda nivelado en calquera pose',
    por: 'un artiluxio pendurado do antebrazo herda as rotacións do ombro e do cóbado, así que un ángulo de pulso FIXO só vale para a pose coa que se axustou: andando ou disparando, o cano acaba apuntando ao ceo. O pulso calcúlase agora restando o que acumulou a cadea, e isto compróbao en todos os estados e fases.',
    revisar(cls){
      for(const p of pezas(cls, 'arma')){
        if(p.pulso === undefined) return `a peza arma non declara pulso: volveuse a un ángulo fixo`;
        /* Punta do cano fronte ao agarre: se o artiluxio está nivelado,
           os dous quedan á mesma altura. Mídese na xeometría posada, non
           nos ángulos, para que valla aínda que cambie a montaxe. */
        const agarre = p.piv || p.centro;
        const longo = p.tam.indexOf(Math.max(...p.tam));
        const punta = agarre.slice();
        punta[longo] += p.tam[longo];
        for(const est of ESTADOS){
          for(let i = 0; i < 8; i++){
            const f = i/8;
            const a = puntoPosado(cls, est, f, agarre, p.id, p.pai, p);
            const b = puntoPosado(cls, est, f, punta, p.id, p.pai, p);
            const subida = Math.abs(b[1] - a[1]) / p.tam[longo];
            if(subida > 0.35){
              return `${est} fase ${f.toFixed(2)}: o artiluxio inclínase ${(Math.asin(Math.min(1,subida))*180/Math.PI).toFixed(0)}°`;
            }
          }
        }
      }
    },
  },
  {
    id: 'A8', nome: 'nada flota',
    por: 'toda peza ten que tocar outra. Unha caixa solta no aire vese aínda que sexa pequena.',
    revisar(cls){
      const ps = ESQUELETO[cls];
      const toca = (a, b) => {
        for(let k = 0; k < 3; k++){
          const sa = a.tam[k]/2, sb = b.tam[k]/2;
          if(Math.abs(a.centro[k] - b.centro[k]) > sa + sb + 0.08) return false;
        }
        return true;
      };
      const vistos = new Set([0]);
      const pila = [0];
      while(pila.length){
        const i = pila.pop();
        ps.forEach((p, j) => { if(!vistos.has(j) && toca(ps[i], p)){ vistos.add(j); pila.push(j); } });
      }
      if(vistos.size < ps.length){
        const soltas = ps.map((p, i) => vistos.has(i) ? null : p.id).filter(Boolean);
        return `pezas sen contacto co corpo: ${[...new Set(soltas)].join(', ')}`;
      }
    },
  },
];

/* ============================================================
   REGRAS DE MOVEMENTO
   ============================================================ */
const REGRAS_POSE = [
  {
    id: 'M1', nome: 'as pernas van en oposición',
    por: 'se van xuntas non é andar, é saltar',
    revisar(cls){
      for(const f of [0.1, 0.3, 0.6, 0.9]){
        const p = pose(cls, 'ANDAR', f);
        if(Math.sign(p.perna_e) === Math.sign(p.perna_d) && Math.abs(p.perna_e) > 0.02){
          return `na fase ${f} as dúas pernas van cara ao mesmo lado`;
        }
      }
    },
  },
  {
    id: 'M2', nome: 'o brazo vai contra a perna do mesmo lado',
    por: 'marcha contralateral: brazo dereito con perna esquerda. Se van á par, o robot anda coma un boneco.',
    revisar(cls){
      for(const f of [0.1, 0.3, 0.6, 0.9]){
        const p = pose(cls, 'ANDAR', f);
        if(Math.abs(p.perna_d) < 0.02) continue;
        if(Math.sign(p.brazo_d) === Math.sign(p.perna_d)){
          return `na fase ${f} o brazo dereito acompaña a perna dereita`;
        }
      }
    },
  },
  {
    id: 'M3', nome: 'o brazo balancea menos ca a perna',
    por: 'ao revés parece que rema. Na marcha real o brazo describe un arco moito menor có da perna, e invertelo lese como esaxeración de debuxo animado — que non é o rexistro deste xogo',
    revisar(cls){
      const p = pose(cls, 'ANDAR', 0.25);
      if(Math.abs(p.brazo_d) > Math.abs(p.perna_d)){
        return `brazo ${Math.abs(p.brazo_d).toFixed(2)} fronte a perna ${Math.abs(p.perna_d).toFixed(2)}`;
      }
    },
  },
  {
    id: 'M4', nome: 'ningunha articulación se pasa',
    por: 'máis dun cuarto de volta nunha articulación deste tamaño rompe a lectura: parece que se lle soltou a peza',
    revisar(cls){
      const LIMITE = { perna_e: 0.9, perna_d: 0.9, brazo_e: 1.2, brazo_d: 1.2,
                       torso: 0.6, cabeza: 0.5, arma: 0.8 };
      for(const est of ESTADOS){
        for(let i = 0; i < 8; i++){
          const p = pose(cls, est, i/8);
          for(const [art, ang] of Object.entries(p)){
            const lim = LIMITE[art] ?? 1.0;
            if(Math.abs(ang) > lim){
              return `${est}: "${art}" chega a ${ang.toFixed(2)} rad (límite ${lim})`;
            }
          }
        }
      }
    },
  },
  {
    id: 'M5', nome: 'o repouso é repouso',
    por: 'se a pose de parado move algo, a unidade quieta parece que vibra',
    revisar(cls){
      const p = pose(cls, 'REPOUSO', 0);
      const movidas = Object.entries(p).filter(([, v]) => Math.abs(v) > 0.001);
      if(movidas.length) return `REPOUSO move ${movidas.map(([k]) => k).join(', ')}`;
    },
  },
];

/* ============================================================
   REGRAS DE LECTURA (sobre o sprite xa renderizado)
   ============================================================ */
const REGRAS_RENDER = [
  {
    id: 'L1', nome: 'o artiluxio vese nas oito direccións',
    por: 'a arma é o que distingue unha clase doutra dun golpe de vista. Se desaparece nalgunha dirección, esa dirección non se le.',
    revisar(cls){
      if(!pezas(cls, 'arma').length) return null;
      /* Mídese por DIFERENZA: o mesmo render con artiluxio e sen el. O
         que cambia é o que o artiluxio aporta á imaxe, veña da cor que
         veña e tápese a si mesmo canto queira. Contar píxeles dunha cor
         daba falsos negativos en canto unha peza levaba dúas. */
      const fallos = [];
      const { render } = require('./vox3d.js');
      const SS = 4, alt = 26, W = alt*SS*2, esc = alt*SS*0.42;
      for(let d = 0; d < 8; d++){
        const yaw = d*2*Math.PI/8;
        const con = render(montar(cls, 'ANDAR', 0), W, W, esc, yaw);
        const sen = render(montar(cls, 'ANDAR', 0, null, ['arma']), W, W, esc, yaw);
        let n = 0;
        for(let i = 0; i < W*W; i++){
          if(con.masc[i] !== sen.masc[i]){ n++; continue; }
          if(!con.masc[i]) continue;
          if(Math.abs(con.col[i*3] - sen.col[i*3]) > 6) n++;
        }
        /* En píxeles do render a escala SS; ao reducir, /SS² */
        const finais = n / (SS*SS);
        if(finais < 6) fallos.push(`${d}(~${finais.toFixed(0)}px)`);
      }
      /* Non se esixe nas OITO. Unha ferramenta pequena suxeita diante do
         corpo tápase polas costas, e iso é correcto: o que non pode pasar
         é que unha arma non se vexa case nunca. O de distinguir a clase
         desde atrás resólveo L4, que é a regra que de verdade importaba. */
      if(fallos.length > 3) return `apenas aporta en ${fallos.length} direccións: ${fallos.join(' ')}`;
    },
  },
  {
    id: 'L5', nome: 'as direccións van na orde que espera o xogo',
    por: 'O xogo escolle o sprite cun índice calculado do vector de movemento. Ese índice deducírase da matriz de rotación, e estaba MAL: as tropas avanzaban co fusil apuntando cara atrás. Só se viu porque alguén mirou o mapa. A orde é 0 de fronte, 2 á dereita, 4 de costas, 6 á esquerda. Ademais destapou que Blender xiraba ao revés que vox3d: o mesmo índice daba direccións opostas segundo o renderizador. Queda fixado aquí para os dous.',
    revisar(cls){
      const sp = (d) => sprite(montar(cls, 'REPOUSO', 0), 30, d*2*Math.PI/8);
      /* O visor: brillante e cian, non o ten ningunha outra peza. Visible
         de fronte e nada en absoluto de costas. */
      const visor = (s) => {
        let n = 0;
        for(let i = 0; i < s.ancho*s.alto; i++){
          const r = s.px[i*4], g = s.px[i*4+1], b = s.px[i*4+2];
          if(s.px[i*4+3] > 110 && g > 140 && b > 140 && r < g - 35) n++;
        }
        return n;
      };
      const fronte = visor(sp(0)), costas = visor(sp(4));
      if(fronte <= costas) return `o índice 0 debería ser de fronte: visor ${fronte} px, e de costas (4) ${costas}`;
      if(costas > fronte*0.25) return `o índice 4 debería ser de costas, pero vense ${costas} px de visor`;
      /* E o artiluxio ten que caer ao lado que toca. */
      const lado = (s) => {
        let ax = 0, an = 0, bx = 0, bn = 0;
        for(let y = 0; y < s.alto; y++) for(let x = 0; x < s.ancho; x++){
          const i = (y*s.ancho + x)*4;
          if(s.px[i+3] < 110) continue;
          bx += x; bn++;
          if(s.px[i] > 150 && s.px[i+1] > 120 && s.px[i+2] < 110){ ax += x; an++; }   /* ámbar */
          else if(s.px[i] < 90 && s.px[i+1] < 95 && s.px[i+2] < 105 && s.px[i] > 20){ ax += x; an++; }
        }
        return an && bn ? (ax/an) - (bx/bn) : 0;
      };
      const dta = lado(sp(2)), esq = lado(sp(6));
      if(!(dta > 0)) return `no índice 2 (dereita) o artiluxio debería quedar á dereita do corpo, e queda en ${dta.toFixed(1)}`;
      if(!(esq < 0)) return `no índice 6 (esquerda) o artiluxio debería quedar á esquerda do corpo, e queda en ${esq.toFixed(1)}`;
    },
  },
  {
    id: 'L4', nome: 'a clase distínguese das demais nas oito direccións',
    por: 'É A REGRA QUE IMPORTA, e da que L1 era só un síntoma. Nun RTS decídese a quen se dispara nun golpe de vista: se dúas clases se ven igual desde algunha dirección, esa dirección está rota. Non ten por que ser a arma quen as distinga — ao enxeñeiro recoñéceselle por detrás pola mochila.',
    revisar(cls){
      const { render } = require('./vox3d.js');
      const SS = 4, alt = 26, W = alt*SS*2, esc = alt*SS*0.42;
      const outras = CLASES.filter(c => c !== cls);
      const fallos = [];
      for(let d = 0; d < 8; d++){
        const yaw = d*2*Math.PI/8;
        const meu = render(montar(cls, 'ANDAR', 0), W, W, esc, yaw);
        for(const o of outras){
          const seu = render(montar(o, 'ANDAR', 0), W, W, esc, yaw);
          let dif = 0;
          for(let i = 0; i < W*W; i++){
            if(meu.masc[i] !== seu.masc[i]){ dif++; continue; }
            if(!meu.masc[i]) continue;
            if(Math.abs(meu.col[i*3] - seu.col[i*3]) + Math.abs(meu.col[i*3+2] - seu.col[i*3+2]) > 24) dif++;
          }
          const finais = dif / (SS*SS);
          if(finais < 30) fallos.push(`dir ${d} vs ${o} (~${finais.toFixed(0)}px)`);
        }
      }
      if(fallos.length) return fallos.join(', ');
    },
  },
  {
    id: 'L2', nome: 'a silueta non se corta',
    por: 'se o modelo toca o bordo do lenzo, o contorno queda aberto e vese un corte recto',
    revisar(cls){
      for(let d = 0; d < 8; d++){
        const SS = 4, alt = 26, W = alt*SS*2;
        const { masc } = require('./vox3d.js').render(
          montar(cls, 'ANDAR', 0.25), W, W, alt*SS*0.42, d*2*Math.PI/8);
        for(let x = 0; x < W; x++){
          if(masc[x] || masc[(W-1)*W + x]) return `dirección ${d}: toca o bordo horizontal`;
        }
        for(let y = 0; y < W; y++){
          if(masc[y*W] || masc[y*W + W-1]) return `dirección ${d}: toca o bordo vertical`;
        }
      }
    },
  },
  {
    id: 'L6', nome: 'a cor de bando vese desde calquera dirección',
    por: 'A cor de equipo non é decoración: é a información que di a quen se pode disparar. Un modelo pode pasar todas as demais regras e aínda así vestirse de placas metálicas ata que xa non se sabe de que bando é. Ao facer o HEAVY con placa peitoral e hombreiras metálicas pareceume que pasara iso; a medida dixo que non (48%, na media das outras), pero a impresión estaba fundada e o risco é real, así que queda medido en vez de a ollo.',
    revisar(cls){
      let eq = 0, tot = 0;
      for(let d = 0; d < 8; d++){
        const s = sprite(montar(cls, 'ANDAR', 0.25), 26, d*2*Math.PI/8, 4);
        for(let i = 0; i < s.ancho*s.alto; i++){
          if(!s.px[i*4+3]) continue;
          tot++;
          /* O azul do equipo, sombreado ou non. O metal ([150,156,166])
             non pasa este filtro: ten as tres canles moi xuntas. */
          if(s.px[i*4+2] > s.px[i*4] + 25 && s.px[i*4+2] > 60) eq++;
        }
      }
      const p = eq*100/Math.max(1, tot);
      if(p < 35) return `só o ${p.toFixed(0)}% do sprite leva a cor do bando (mínimo 35%)`;
    },
  },
  {
    id: 'L3', nome: 'de perfil non desaparece',
    por: 'se a área de perfil é moito menor cá frontal, ao xirar o robot semella encoller',
    revisar(cls){
      const area = (yaw) => {
        const s = sprite(montar(cls, 'ANDAR', 0.25), 26, yaw, 4);
        let n = 0;
        for(let i = 0; i < s.ancho*s.alto; i++) if(s.px[i*4+3]) n++;
        return n;
      };
      const razon = area(0) / area(Math.PI/2);
      if(razon > 1.45) return `área frontal/perfil = ${razon.toFixed(2)} (obxectivo <= 1.45)`;
    },
  },
];

/* ============================================================
   Informe
   ============================================================ */
function revisar(clases){
  const todo = [];
  for(const cls of clases){
    for(const [grupo, regras] of [['esqueleto', REGRAS_ESQUELETO], ['movemento', REGRAS_POSE], ['lectura', REGRAS_RENDER]]){
      for(const r of regras){
        let fallo = null;
        try{ fallo = r.revisar(cls) || null; }
        catch(e){ fallo = 'a regra petou: ' + e.message; }
        todo.push({ cls, grupo, ...r, fallo });
      }
    }
  }
  return todo;
}

module.exports = { REGRAS_ESQUELETO, REGRAS_POSE, REGRAS_RENDER, revisar, caixaDe, man, torsoPrincipal };

if(require.main === module){
  const i = process.argv.indexOf('--clase');
  const clases = i >= 0 ? [process.argv[i+1]] : CLASES;
  const res = revisar(clases);
  let mal = 0;
  console.log('\nTUERCA — regras anatómicas\n');
  for(const cls of clases){
    console.log(`  ${cls}`);
    for(const r of res.filter(x => x.cls === cls)){
      if(r.fallo){ mal++; console.log(`    \x1b[31m✗ ${r.id}\x1b[0m ${r.nome}\n         ${r.fallo}`); }
      else console.log(`    \x1b[32m✓ ${r.id}\x1b[0m ${r.nome}`);
    }
    console.log('');
  }
  console.log(mal ? `  \x1b[31m${mal} regra(s) incumprida(s)\x1b[0m\n` : '  \x1b[32mtodas as regras cumpridas\x1b[0m\n');
  process.exit(mal ? 1 : 0);
}
