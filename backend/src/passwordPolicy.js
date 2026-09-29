const db = require('./db')

// Stessa blacklist già usata storicamente lato frontend (CambioPassword.jsx)
const COMMON_PASSWORDS = [
  'Password1!', 'Password1', 'Password123', 'Qwerty123!', 'Admin1234!',
  'Benvenuto1!', 'Toscogas1!', 'Toscogas12', 'Temporanea1!', 'Abc12345!',
  'Passw0rd!', 'Welcome1!', 'Letmein1!', 'Changeme1!', 'Summer2026!',
]
const AMBIGUOUS_CHARS_RE = /[lI1O0]/

const DEFAULT_POLICY = {
  min_length: 12,
  require_uppercase: true, min_uppercase: 1,
  require_special: false, min_special: 1,
  require_digit: true, min_digit: 1,
  avoid_ambiguous_common: true,
  validity_days: null,
}

async function getPasswordPolicy() {
  const { rows } = await db.query('SELECT * FROM password_policy WHERE id = 1')
  return rows[0] || DEFAULT_POLICY
}

// Ritorna un array di messaggi di errore (vuoto se la password rispetta la policy)
function validatePassword(pwd, policy) {
  const errori = []
  if (pwd.length < policy.min_length) errori.push(`Almeno ${policy.min_length} caratteri`)

  if (policy.require_uppercase) {
    const n = (pwd.match(/[A-Z]/g) || []).length
    if (n < policy.min_uppercase) errori.push(`Almeno ${policy.min_uppercase} lettera/e maiuscola/e`)
  }
  if (policy.require_digit) {
    const n = (pwd.match(/[0-9]/g) || []).length
    if (n < policy.min_digit) errori.push(`Almeno ${policy.min_digit} numero/i`)
  }
  if (policy.require_special) {
    const n = (pwd.match(/[^A-Za-z0-9]/g) || []).length
    if (n < policy.min_special) errori.push(`Almeno ${policy.min_special} carattere/i speciale/i`)
  }
  if (policy.avoid_ambiguous_common) {
    if (COMMON_PASSWORDS.includes(pwd)) errori.push('Password troppo comune, scegline una diversa')
    if (AMBIGUOUS_CHARS_RE.test(pwd)) errori.push('Evita caratteri ambigui (l, I, 1, O, 0)')
  }
  return errori
}

module.exports = { getPasswordPolicy, validatePassword, COMMON_PASSWORDS, DEFAULT_POLICY }
