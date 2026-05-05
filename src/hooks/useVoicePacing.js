import { useEffect, useRef, useState, useCallback } from 'react'
import { findWordInScript } from '../utils/textUtils'

// Hook for voice-paced scrolling via Web Speech API
// enabled: bool - whether voice mode is active
// scriptWords: string[] - the parsed word list
// onWordMatch: (wordIndex: number) => void - called when a word is matched
export function useVoicePacing({ enabled, scriptWords, onWordMatch }) {
  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'error' | 'unsupported'
  const recognitionRef = useRef(null)
  const lastMatchIndexRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const reset = useCallback(() => {
    lastMatchIndexRef.current = 0
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
      return
    }

    if (!isSupported) {
      setStatus('unsupported')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => setStatus('listening')

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setStatus('error')
      }
    }

    recognition.onend = () => {
      // Auto-restart if still enabled
      if (enabledRef.current) {
        try { recognition.start() } catch {}
      } else {
        setStatus('idle')
      }
    }

    recognition.onresult = (event) => {
      // Build transcript from all results (including interim)
      let fullText = ''
      for (let i = 0; i < event.results.length; i++) {
        fullText += event.results[i][0].transcript + ' '
      }

      const spokenWords = fullText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)

      // Use only the last 8 spoken words for matching
      const recent = spokenWords.slice(-8)

      const matchIndex = findWordInScript(recent, scriptWords, lastMatchIndexRef.current)
      if (matchIndex !== -1 && matchIndex >= lastMatchIndexRef.current) {
        lastMatchIndexRef.current = matchIndex
        onWordMatch(matchIndex)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e) {
      setStatus('error')
    }

    return () => {
      recognition.onend = null
      try { recognition.stop() } catch {}
      recognitionRef.current = null
    }
  }, [enabled, isSupported, scriptWords])

  return { status, isSupported, reset }
}
