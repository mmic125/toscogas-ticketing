export const RUOLI = {
  COORDINATORE: 'coordinatore',
  SEGNALATORE: 'segnalatore',
  MANUTENTORE: 'manutentore',
  SEGNALATORE_MANUTENTORE: 'segnalatore_manutentore',
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
  sopralluogo:            'Sopralluogo',
  nuova_pratica:          'Nuova pratica',
  condizioni_commerciali: 'Condizioni commerciali',
  richiesta_disdetta:     'Richiesta disdetta',
  subentro:               'Subentro',
  dilazione_pagamento:    'Richiesta dilazione pagamento',
}

export const TIPI_INTERVENTO_TECNICO = {
  sopralluogo:                    'Sopralluogo',
  guasto_contatore:               'Guasto contatore',
  manutenzione_serbatoio:         'Manutenzione serbatoio',
  telecontrollo:                  'Telecontrollo',
  rimozione_contatore_morosita:   'Rimozione contatore per morosità',
  installazione_nuovo_contatore:  'Installazione nuovo contatore',
  installazione_serbatoio:        'Installazione serbatoio',
  sostituzione_serbatoio:         'Sostituzione serbatoio',
  rimozione_serbatoio:            'Rimozione serbatoio',
  guasto_mezzo:                   'Guasto mezzo',
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