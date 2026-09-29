// Coda di bozze ticket salvate in localStorage quando si è offline.
// Solo campi testuali: gli allegati richiedono un upload e non sono supportati offline.

const STORAGE_KEY = 'bozze_ticket'

function leggiBozze() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function scriviBozze(bozze) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bozze))
}

export function salvaBozza(dati) {
  const bozze = leggiBozze()
  const bozza = { id: crypto.randomUUID(), creata_il: new Date().toISOString(), dati }
  bozze.push(bozza)
  scriviBozze(bozze)
  return bozza
}

export function elencaBozze() {
  return leggiBozze()
}

export function rimuoviBozza(id) {
  scriviBozze(leggiBozze().filter(b => b.id !== id))
}

// Tenta l'invio di ogni bozza in coda tramite inviaFn(dati); rimuove
// dalla coda solo quelle inviate con successo.
export async function sincronizzaBozze(inviaFn) {
  const bozze = leggiBozze()
  if (bozze.length === 0) return { inviate: 0, fallite: 0 }

  let inviate = 0
  let fallite = 0
  for (const bozza of bozze) {
    try {
      await inviaFn(bozza.dati)
      rimuoviBozza(bozza.id)
      inviate++
    } catch {
      fallite++
    }
  }
  return { inviate, fallite }
}
