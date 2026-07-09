// Generates a CHIRP-compatible generic CSV — the standard way to bulk-program
// Baofeng (and most other CHIRP-supported) radios. Import via
// File > Import in CHIRP, then upload to the radio.
const CHIRP_HEADERS = [
  'Location', 'Name', 'Frequency', 'Duplex', 'Offset', 'Tone', 'rToneFreq', 'cToneFreq',
  'DtcsCode', 'DtcsPolarity', 'RxDtcsCode', 'CrossMode', 'Mode', 'TStep', 'Skip', 'Power',
  'Comment', 'URCALL', 'RPT1CALL', 'RPT2CALL', 'DVCODE',
]

function csvField(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function chirpRow(r) {
  const duplex = r.offset > 0 ? '+' : r.offset < 0 ? '-' : ''
  const offsetAbs = Math.abs(r.offset).toFixed(6)
  const hasRxTone = Boolean(r.tone_out)
  const hasTxTone = Boolean(r.tone_in)
  const tone = hasRxTone ? 'TSQL' : hasTxTone ? 'Tone' : ''
  const rToneFreq = hasTxTone ? r.tone_in : hasRxTone ? r.tone_out : '88.5'
  const cToneFreq = hasRxTone ? r.tone_out : '88.5'
  // Baofeng/CHIRP memory name is truncated to 7 chars on upload — US
  // callsigns (max 6 chars) fit with room to spare.
  const name = (r.callsign || `CH${r.channel}`).slice(0, 7)
  const comment = [r.city, r.state].filter(Boolean).join(', ') + (r.club ? ` - ${r.club}` : '')

  return [
    r.channel,
    name,
    r.freq.toFixed(6),
    duplex,
    offsetAbs,
    tone,
    rToneFreq,
    cToneFreq,
    '023',
    'NN',
    '023',
    'Tone->Tone',
    'FM',
    '5.00',
    '',
    '',
    comment,
    '', '', '', '',
  ]
}

export function generateChirpCsv(repeaters) {
  const sorted = [...repeaters].sort((a, b) => a.channel - b.channel)
  const lines = [CHIRP_HEADERS.join(',')]
  for (const r of sorted) {
    lines.push(chirpRow(r).map(csvField).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
