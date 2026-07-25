/* ============================================================
   Micro-framework de probas. Cero dependencias, coma o resto do
   proxecto: `node test/run.js` e listo.
   ============================================================ */
const probas = [];

function proba(nome, fn) { probas.push({ nome, fn }); }

/* Proba que documenta un bug coñecido AÍNDA SEN ARRANXAR. Non tingue a
   suite de vermello, pero tampouco deixa esquecer o problema: se algún
   día pasa, a suite FALLA para obrigar a quitarlle o "pendente". */
function probaPendente(nome, motivo, fn) {
  probas.push({ nome, fn, pendente: motivo });
}

function afirmar(cond, msg) {
  if (!cond) throw new Error(msg || 'afirmación falsa');
}

function igual(real, esperado, msg) {
  if (real !== esperado) {
    throw new Error(`${msg || 'valores distintos'}\n      real:     ${JSON.stringify(real)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

async function executarTodas() {
  let ok = 0, pendentes = 0;
  const fallos = [];
  for (const { nome, fn, pendente } of probas) {
    const t0 = Date.now();
    let erro = null;
    try { await fn(); } catch (e) { erro = e; }
    const ms = Date.now() - t0;

    if (pendente) {
      if (erro) {
        pendentes++;
        console.log(`  \x1b[33m•\x1b[0m ${nome} \x1b[90m(pendente: ${pendente})\x1b[0m`);
      } else {
        fallos.push({ nome });
        console.log(`  \x1b[31m✗\x1b[0m ${nome}`);
        console.log(`      xa PASA: arranxouse o bug. Quítalle o "pendente" para que quede protexido.`);
      }
      continue;
    }
    if (erro) {
      fallos.push({ nome, e: erro });
      console.log(`  \x1b[31m✗\x1b[0m ${nome}`);
      console.log(`      ${String(erro.message).split('\n').join('\n      ')}`);
    } else {
      ok++;
      console.log(`  \x1b[32m✓\x1b[0m ${nome} \x1b[90m(${ms} ms)\x1b[0m`);
    }
  }
  console.log(`\n  ${ok}/${probas.length - pendentes} probas pasadas` + (pendentes ? `, ${pendentes} pendente(s) por bug coñecido` : ''));
  if (fallos.length) {
    console.log(`  \x1b[31m${fallos.length} fallo(s)\x1b[0m`);
    return 1;
  }
  console.log('  \x1b[32mtodo correcto\x1b[0m');
  return 0;
}

module.exports = { proba, probaPendente, afirmar, igual, executarTodas };
