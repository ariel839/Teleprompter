// Detect text direction from content (RTL languages: Hebrew, Arabic, etc.)
export function detectTextDirection(text) {
  const rtlPattern = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
  const ltrPattern = /[a-zA-Z\u00C0-\u024F]/
  const rtlCount = (text.match(new RegExp(rtlPattern.source, 'g')) || []).length
  const ltrCount = (text.match(new RegExp(ltrPattern.source, 'g')) || []).length
  return rtlCount > ltrCount ? 'rtl' : 'ltr'
}

// Parse script text into array of words
export function parseWords(text) {
  return text.trim().split(/\s+/).filter(Boolean)
}

// Normalize a word for fuzzy matching (lowercase, strip punctuation)
export function normalizeWord(word) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Find the best matching word index in scriptWords for the recently spoken words.
// Uses a sliding window approach. Returns the index of the last matched word, or -1.
export function findWordInScript(spokenWords, scriptWords, fromIndex = 0) {
  if (!spokenWords.length || !scriptWords.length) return -1

  const windowSize = Math.min(5, spokenWords.length)
  const recentSpoken = spokenWords.slice(-windowSize).map(normalizeWord)

  const searchFrom = Math.max(0, fromIndex - 3)
  const searchTo = Math.min(scriptWords.length - windowSize, fromIndex + 60)

  let bestScore = 0.45 // minimum threshold
  let bestIndex = -1

  for (let i = searchFrom; i <= searchTo; i++) {
    let matches = 0
    for (let j = 0; j < windowSize; j++) {
      const sw = normalizeWord(scriptWords[i + j] || '')
      if (sw && recentSpoken[j] === sw) matches++
    }
    const score = matches / windowSize
    if (score > bestScore) {
      bestScore = score
      bestIndex = i + windowSize - 1
    }
  }

  return bestIndex
}
