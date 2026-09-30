export const RUOLI = {
  COORDINATORE: 'coordinatore',
  SEGNALATORE: 'segnalatore',
  MANUTENTORE: 'manutentore',
  SEGNALATORE_MANUTENTORE: 'segnalatore_manutentore',
  FRONT_OFFICE: 'front_office',
  AMMINISTRATORE: 'amministratore',
}

export const STATI_TICKET = {
  NUOVO: 'nuovo',
  ASSEGNATO: 'assegnato',
  IN_LAVORAZIONE: 'in_lavorazione',
  RISOLTO: 'risolto',
  CHIUSO: 'chiuso',
}

export const PRIORITA = {
  URGENTE: 'urgente',
  ALTA: 'alta',
  MEDIA: 'media',
  BASSA: 'bassa',
}

export const TIPI_INTERVENTO_COMMERCIALE = {
  amministrazione:        'Amministrazione',
  condizioni_commerciali: 'Condizioni commerciali',
  nuova_pratica:          'Nuova pratica',
  dilazione_pagamento:    'Pagamenti',
  richiesta_disdetta:     'Richiesta disdetta',
  sopralluogo:            'Sopralluogo',
  subentro:               'Subentro',
  nota_credito:           'Nota Credito',
  altro:                  'Altro',
}

export const TIPI_INTERVENTO_TECNICO = {
  apertura_contatore_morosita:    'Apertura contatore post-morosità',
  guasto_contatore:               'Guasto contatore',
  guasto_mezzo:                   'Guasto mezzo',
  installazione_nuovo_contatore:  'Installazione nuovo contatore',
  installazione_serbatoio:        'Installazione serbatoio',
  manutenzione_serbatoio:         'Manutenzione serbatoio',
  rimozione_contatore_morosita:   'Rimozione contatore per morosità',
  rimozione_serbatoio:            'Rimozione serbatoio',
  sopralluogo:                    'Sopralluogo',
  sostituzione_serbatoio:         'Sostituzione serbatoio',
  telecontrollo:                  'Telecontrollo',
  altro:                          'Altro',
}

export const TIPI_INTERVENTO = {
  ...TIPI_INTERVENTO_COMMERCIALE,
  ...TIPI_INTERVENTO_TECNICO,
}

// Manteniamo TIPI_PROBLEMA come alias per compatibilità
export const TIPI_PROBLEMA = TIPI_INTERVENTO

export const CATEGORIE = {
  commerciale: 'Commerciale',
  tecnico:     'Tecnico',
}

export const PROVINCE = {
  'Arezzo':        'Arezzo (AR)',
  'Firenze':       'Firenze (FI)',
  'Grosseto':      'Grosseto (GR)',
  'Livorno':       'Livorno (LI)',
  'Lucca':         'Lucca (LU)',
  'Massa-Carrara': 'Massa-Carrara (MS)',
  'Pisa':          'Pisa (PI)',
  'Pistoia':       'Pistoia (PT)',
  'Prato':         'Prato (PO)',
  'Siena':         'Siena (SI)',
}

export const STATI_LABEL = {
  nuovo:         'Nuovo',
  assegnato:     'Assegnato',
  in_lavorazione:'In Lavorazione',
  risolto:       'Risolto',
  chiuso:        'Chiuso',
}

export const PRIORITA_LABEL = {
  urgente: 'Urgente',
  alta:    'Alta',
  media:   'Media',
  bassa:   'Bassa',
}

export const STATO_COLORS = {
  nuovo:         'bg-blue-100 text-blue-800',
  assegnato:     'bg-yellow-100 text-yellow-800',
  in_lavorazione:'bg-orange-100 text-orange-800',
  risolto:       'bg-green-100 text-green-800',
  chiuso:        'bg-gray-100 text-gray-600',
}

export const PRIORITA_COLORS = {
  urgente: 'bg-red-100 text-red-800',
  alta:    'bg-orange-100 text-orange-800',
  media:   'bg-yellow-100 text-yellow-800',
  bassa:   'bg-green-100 text-green-800',
}

export function formatOra(iso) {
  return iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''
}

export function formatData(iso) {
  return iso ? new Date(iso).toLocaleDateString('it-IT') : ''
}

export const MAX_FOTO = 3
export const MAX_FOTO_MB = 20
export const FORMATI_ACCETTATI = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
]
export const FORMATI_FOTO_ACCETTATI = FORMATI_ACCETTATI