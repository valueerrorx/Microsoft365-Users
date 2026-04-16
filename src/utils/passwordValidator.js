// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Mag. Thomas Michael Weissel <valueerror@gmail.com>

/**
 * Microsoft 365 Password Complexity Requirements:
 * - Min. 8 Zeichen
 * - Mind. 3 von 4 Kategorien: Großbuchstaben, Kleinbuchstaben, Ziffern, Sonderzeichen
 */
export function validatePassword(password) {
  const p = password || ''
  const checks = {
    minLength:  p.length >= 8,
    hasUpper:   /[A-Z]/.test(p),
    hasLower:   /[a-z]/.test(p),
    hasDigit:   /[0-9]/.test(p),
    hasSpecial: /[^A-Za-z0-9]/.test(p)
  }
  const categories = [checks.hasUpper, checks.hasLower, checks.hasDigit, checks.hasSpecial].filter(Boolean).length
  const valid = checks.minLength && categories >= 3
  const strength = !p.length ? 0 : !checks.minLength ? 1 : categories === 1 ? 1 : categories === 2 ? 2 : categories === 3 ? 3 : 4

  return { ...checks, categories, valid, strength }
}

export const strengthLabels = ['', 'Zu schwach', 'Schwach', 'Mittel', 'Stark']
export const strengthColors = ['', '#f85149', '#d29922', '#58a6ff', '#3fb950']
