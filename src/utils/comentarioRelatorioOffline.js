/**
 * Comentário narrativo do relatório (offline).
 * Só informa — sem recomendações ou conselhos.
 * Textos mais longos para preencher melhor a página.
 */

function n(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function fmt(formatoMoeda, v) {
  const x = n(v);
  try {
    return `R$ ${formatoMoeda.format(x)}`;
  } catch {
    return `R$ ${x.toFixed(2).replace(".", ",")}`;
  }
}

function pct(parte, total) {
  if (!(total > 0)) return null;
  return Math.round((parte / total) * 1000) / 10;
}

function topTipos(obj, limite = 5) {
  return Object.entries(obj || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite);
}

function listarTipos(formatoMoeda, pares) {
  return pares.map(([tipo, v]) => `${tipo} (${fmt(formatoMoeda, v)})`).join(", ");
}

/**
 * @returns {string} parágrafos separados por \n\n
 */
export function montarComentarioRelatorio({
  labelPeriodo,
  resumo = {},
  projecao = {},
  formatoMoeda,
}) {
  const periodo = String(labelPeriodo || "o período analisado").trim();
  const ant = n(resumo.saldoAnterior);
  const rec = n(resumo.entradas);
  const des = n(resumo.saidas);
  const atual = n(resumo.saldoAtual);
  const diz = n(resumo.dizimos);
  const qtd = Number(resumo.quantidade) || 0;
  const resultado = n(rec - des);
  const deltaSaldo = n(atual - ant);

  const aRec = n(projecao.aReceber);
  const aPag = n(projecao.aPagar);
  const proj = n(projecao.saldoProjetado);

  const f = (v) => fmt(formatoMoeda, v);
  const paragrafos = [];



  // ——— 2. Visão geral / resultado ———
  if (qtd === 0 && rec === 0 && des === 0) {
    paragrafos.push(
      `No intervalo em questão não houve lançamentos realizados de entrada ou de saída. O saldo anterior de ${f(ant)} permanece como referência da posição de caixa, de modo que o saldo atual também se situa em ${f(atual)}.`
    );
  } else {
    let p = `A tesouraria iniciou o período com saldo anterior de ${f(ant)}. `;

    if (rec > 0 && des > 0) {
      p += `Durante ${periodo}, as receitas realizadas alcançaram ${f(rec)} e as despesas realizadas totalizaram ${f(des)}. `;
    } else if (rec > 0) {
      p += `Durante ${periodo}, foram registradas apenas receitas realizadas, no montante de ${f(rec)}, sem despesas realizadas no mesmo intervalo. `;
    } else if (des > 0) {
      p += `Durante ${periodo}, foram registradas apenas despesas realizadas, no montante de ${f(des)}, sem receitas realizadas no mesmo intervalo. `;
    }

    if (resultado > 0) {
      p += `Com isso, o resultado operacional do período foi positivo em ${f(resultado)}. `;
    } else if (resultado < 0) {
      p += `Com isso, o resultado operacional do período foi negativo em ${f(Math.abs(resultado))}. `;
    } else {
      p += `Receitas e despesas realizadas se equivaleram, de forma que o resultado operacional do período ficou nulo. `;
    }

    if (deltaSaldo > 0) {
      p += `A posição de caixa avançou ${f(deltaSaldo)} em relação ao saldo anterior, encerrando o período com saldo atual de ${f(atual)}.`;
    } else if (deltaSaldo < 0) {
      p += `A posição de caixa recuou ${f(Math.abs(deltaSaldo))} em relação ao saldo anterior, encerrando o período com saldo atual de ${f(atual)}.`;
    } else {
      p += `A posição de caixa encerrou o período no mesmo patamar do saldo anterior, em ${f(atual)}.`;
    }

    if (qtd > 0) {
      p += ` Esse resultado reúne ${qtd} lançamento${qtd === 1 ? "" : "s"} realizado${qtd === 1 ? "" : "s"} no período.`;
    }

    paragrafos.push(p);
  }

  // ——— 3. Receitas e dízimos ———
  if (rec > 0) {
    let p = `Do lado das entradas, as receitas realizadas somaram ${f(rec)}. `;

    if (diz > 0) {
      const pDiz = pct(diz, rec);
      p += `Desse total, os dízimos corresponderam a ${f(diz)}`;
      if (pDiz != null) {
        p += `, equivalentes a ${pDiz}% das receitas do período`;
      }
      p += ". ";
      const outras = n(rec - diz);
      if (outras > 0) {
        p += `As demais receitas, excluídos os dízimos, somaram ${f(outras)}. `;
      }
    } else {
      p += `Não houve dízimos realizados registrados neste intervalo. `;
    }


    paragrafos.push(p);
  }

  // ——— 4. Despesas ———
  if (des > 0) {
    let p = `Do lado das saídas, as despesas realizadas alcançaram ${f(des)}. `;


    if (rec > 0) {
      const pDes = pct(des, rec);
      if (pDes != null) {
        p += `Em relação às receitas do mesmo intervalo, as despesas corresponderam a ${pDes}% do montante arrecadado.`;
      }
    }

    paragrafos.push(p.trim());
  }

  // ——— 5. Leitura conjunta (quando há os dois lados) ———
  if (rec > 0 && des > 0) {
    if (rec > des) {
      paragrafos.push(
        `Comparando as duas frentes, as receitas realizadas superaram as despesas em ${f(rec - des)} no período de ${periodo}, o que se reflete na variação positiva do saldo de caixa entre o início e o fim do intervalo.`
      );
    } else if (des > rec) {
      paragrafos.push(
        `Comparando as duas frentes, as despesas realizadas superaram as receitas em ${f(des - rec)} no período de ${periodo}, o que se reflete na variação do saldo de caixa entre o início e o fim do intervalo.`
      );
    }
  }

  // ——— 6. Projeção e compromissos em aberto ———
  if (aRec > 0 || aPag > 0) {
    let p = `Além dos valores já realizados, o levantamento considera compromissos e direitos ainda em aberto. `;

    if (aRec > 0 && aPag > 0) {
      p += `Há ${f(aRec)} classificados como a receber e ${f(aPag)} como a pagar. `;
      if (aRec > aPag) {
        p += `O montante a receber supera o a pagar em ${f(aRec - aPag)}. `;
      } else if (aPag > aRec) {
        p += `O montante a pagar supera o a receber em ${f(aPag - aRec)}. `;
      } else {
        p += `Os valores a receber e a pagar estão empatados neste levantamento. `;
      }
    } else if (aRec > 0) {
      p += `Há ${f(aRec)} a receber e não constam valores a pagar em aberto. `;
    } else {
      p += `Há ${f(aPag)} a pagar e não constam valores a receber em aberto. `;
    }

    p += `Tomando o saldo atual de ${f(atual)} como base, a projeção de caixa, já incorporando esses itens futuros, situa-se em ${f(proj)}.`;
    paragrafos.push(p);
  } else if (qtd > 0 || rec > 0 || des > 0) {
    paragrafos.push(
      `Neste levantamento não há valores em aberto a receber ou a pagar. Dessa forma, a projeção de caixa permanece alinhada ao saldo atual de ${f(atual)}, sem ajustes adicionais por direitos ou compromissos futuros.`
    );
  }

  // ——— 7. Encerramento descritivo ———
  paragrafos.push(
    `Os quadros, gráficos e a relação de movimentações que seguem detalham a mesma base numérica descrita acima, permitindo conferir a composição das receitas e despesas e a evolução recente das coletas e dos demais fluxos da tesouraria.`
  );

  return paragrafos.join("\n\n");
}