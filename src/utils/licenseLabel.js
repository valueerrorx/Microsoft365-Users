// Human-readable labels from Graph skuPartNumber (heuristics; extend as your tenant SKUs need).
export function humanLicenseLabel(skuPartNumber) {
  if (!skuPartNumber) return '?'
  const name = String(skuPartNumber)
  const u = name.toUpperCase()

  if (u.includes('A1')) return 'A1'
  if (u.includes('A5')) return 'A5'

  if (u.includes('A3')) {
    if (u.includes('FACULTY') || u.includes('FACULTYUSEQTY')) return 'A3 Lehrer'
    if (u.includes('STUDENT') || u.includes('STUUSE') || u.includes('STUDENTUSEQTY')) return 'A3 Schüler'
    return 'A3'
  }

  if (u.includes('STANDARDWOFFPACK')) {
    if (u.includes('STUDENT')) return 'Office 365 Web-Apps (Schüler)'
    if (u.includes('FACULTY')) return 'Office 365 Web-Apps (Lehrer)'
    return 'Office 365 Web-Apps'
  }

  if (u.includes('EXCHANGESTANDARD')) {
    if (u.includes('STUDENT')) return 'Exchange Online (Schüler)'
    return 'Exchange Online (Standard)'
  }

  if (u.includes('FLOW_FREE')) return 'Power Automate (Free)'
  if (u.includes('POWERAPPS_DEV')) return 'Power Apps (Developer)'
  if (u.includes('WINDOWS_STORE')) return 'Windows Store for Business'

  if (u.includes('TEAMS') && u.includes('PREMIUM')) {
    if (u.includes('DEPARTMENT')) return 'Teams Premium (Abteilungen)'
    return 'Teams Premium'
  }

  if (u.includes('POWER_BI')) return 'Power BI'
  if (u.includes('POWERAPPS') && !u.includes('DEV')) return 'Power Apps'
  if (u.includes('VISIO')) return 'Visio'
  if (u.includes('PROJECT')) return 'Project'
  if (u.includes('DEFENDER') || u.includes('ATP')) return 'Microsoft Defender'
  if (u.includes('INTUNE')) return 'Intune'
  if (u.includes('AZURE') && u.includes('AD')) return 'Entra ID / Azure AD'

  const cleaned = name.replace(/_/g, ' ').trim()
  if (cleaned.length > 32) return `${cleaned.slice(0, 31)}…`
  return cleaned
}
