const LIMITE_MS = 24 * 60 * 60 * 1000; // 24 horas

export function podeEditarRegistro(item) {
  const criado = item?.createdAt || item?.reg;
  if (!criado) return false;
  return Date.now() - Number(criado) <= LIMITE_MS;
}

export function tempoRestanteEdicao(item) {
  const criado = item?.createdAt || item?.reg;
  if (!criado) return 0;
  return Math.max(0, Number(criado) + LIMITE_MS - Date.now());
}

export { LIMITE_MS };