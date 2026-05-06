import { useEffect, useRef, useState, useCallback } from 'react'
import { parseWords, detectTextDirection } from '../utils/textUtils'
import { useVoicePacing } from '../hooks/useVoicePacing'

const FONT_MAP = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: 'Georgia, serif',
  mono: "'Courier New', monospace",
  lexend: "'Lexend', sans-serif",
}

export default function PrompterScreen({ script, settings, autoStart = false, onExit, onFinish, onSpeedChange }) {
  const { fontSize, alignment, speed, mode, fontFamily, camera: cameraEnabled, textBg } = settings

  // ── State ──
  const [isPlaying, setIsPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentWordIdx, setCurrentWordIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [finished, setFinished] = useState(false)
  const [effectiveMode, setEffectiveMode] = useState(mode)
  const [safariWarning, setSafariWarning] = useState(false)
  const [displaySpeed, setDisplaySpeed] = useState(speed)
  // Camera
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [showRecHint, setShowRecHint] = useState(false)

  // ── Refs ──
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const wordEls = useRef([])
  const wordOffsets = useRef([])
  const scrollYRef = useRef(0)
  const targetScrollYRef = useRef(0)
  const isPlayingRef = useRef(false)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const hideTimerRef = useRef(null)
  const maxScrollRef = useRef(0)
  const voiceMatchRef = useRef(0)
  const liveSpeedRef = useRef(speed)

  const words = parseWords(script)
  const textDir = detectTextDirection(script)
  const fontStyle = FONT_MAP[fontFamily] || FONT_MAP.sans
  // pixels per second = speed * fontSize * 0.24 — speed 5 ≈ 130 WPM
  const pixelsPerUnit = fontSize * 0.24

  // ── Camera ──
  const startRecording = useCallback(() => {
    if (!streamRef.current || typeof MediaRecorder === 'undefined') return
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : ''
    const recorder = new MediaRecorder(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 4_000_000,
    })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorderRef.current = recorder
    recorder.start(5000) // flush a chunk every 5 s to avoid unbounded memory growth
  }, [])

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
  }, [])

  const stopCamera = useCallback(() => {
    stopMediaRecorder()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [stopMediaRecorder])

  const startCamera = useCallback(async () => {
    setCameraError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraOn(true)
      setShowRecHint(true)
      setTimeout(() => setShowRecHint(false), 4000)

      // Reset chunks — recording starts when user presses play
      chunksRef.current = []
    } catch {
      setCameraError(true)
      setCameraOn(false)
    }
  }, [])

  // Auto-start camera on mount if setting is enabled
  useEffect(() => {
    if (cameraEnabled) startCamera()
    return () => stopCamera()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start playing when launched from "Try" button
  useEffect(() => {
    if (!autoStart) return
    const t = setTimeout(() => {
      setIsPlaying(true)
      isPlayingRef.current = true
    }, 600) // allow camera init + word offsets to cache
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = useCallback(async (e) => {
    e.stopPropagation()
    if (cameraOn) stopCamera()
    else await startCamera()
  }, [cameraOn, startCamera, stopCamera])

  // ── Voice pacing ──
  const isVoiceMode = effectiveMode === 'voice'

  const getReadingLineY = useCallback(() =>
    (window.visualViewport?.height ?? window.innerHeight) * 0.3
  , [])

  const handleVoiceWordMatch = useCallback((wordIndex) => {
    voiceMatchRef.current = wordIndex
    setCurrentWordIdx(wordIndex)
    const wordY = wordOffsets.current[wordIndex]
    if (wordY !== undefined) {
      targetScrollYRef.current = Math.max(0, wordY - getReadingLineY())
    }
    if (!isPlayingRef.current) {
      isPlayingRef.current = true
      setIsPlaying(true)
    }
  }, [getReadingLineY])

  const { status: voiceStatus, isSupported, reset: resetVoice } = useVoicePacing({
    enabled: isVoiceMode && isPlaying,
    scriptWords: words,
    onWordMatch: handleVoiceWordMatch,
  })

  useEffect(() => {
    if (mode === 'voice' && !isSupported) {
      setEffectiveMode('manual')
      setSafariWarning(true)
    } else {
      setEffectiveMode(mode)
    }
  }, [mode, isSupported])

  // ── Cache word positions ──
  const cacheOffsets = useCallback(() => {
    const offsets = wordEls.current.map(el => el ? el.offsetTop : 0)
    wordOffsets.current = offsets
    if (innerRef.current && outerRef.current) {
      maxScrollRef.current = Math.max(0,
        innerRef.current.offsetHeight - outerRef.current.offsetHeight
      )
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(cacheOffsets, 150)
    return () => clearTimeout(t)
  }, [script, fontSize, fontFamily, cacheOffsets])

  useEffect(() => {
    const vv = window.visualViewport
    if (vv) { vv.addEventListener('resize', cacheOffsets); return () => vv.removeEventListener('resize', cacheOffsets) }
    window.addEventListener('resize', cacheOffsets)
    return () => window.removeEventListener('resize', cacheOffsets)
  }, [cacheOffsets])

  // ── RAF scroll loop ──
  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    lastTimeRef.current = null
  }, [])

  const startRaf = useCallback(() => {
    if (rafRef.current) return
    lastTimeRef.current = null
    const tick = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      if (isPlayingRef.current) {
        const maxScroll = maxScrollRef.current
        const speedPx = liveSpeedRef.current * pixelsPerUnit

        if (!isVoiceMode) {
          scrollYRef.current += speedPx * dt
        } else {
          const diff = targetScrollYRef.current - scrollYRef.current
          scrollYRef.current += diff * Math.min(1, dt * 2.5)
        }

        if (maxScroll > 0) {
          scrollYRef.current = Math.max(0, Math.min(maxScroll, scrollYRef.current))
        }

        if (innerRef.current) {
          innerRef.current.style.transform = `translateY(${-scrollYRef.current}px)`
        }

        const prog = maxScroll > 0 ? scrollYRef.current / maxScroll : 0
        setProgress(prog)

        if (!isVoiceMode) {
          const currentY = scrollYRef.current + getReadingLineY()
          const offsets = wordOffsets.current
          let closest = 0
          for (let i = 0; i < offsets.length; i++) {
            if (offsets[i] <= currentY) closest = i
            else break
          }
          setCurrentWordIdx(closest)
        }

        if (maxScroll > 0 && scrollYRef.current >= maxScroll) {
          isPlayingRef.current = false
          setIsPlaying(false)
          setFinished(true)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [isVoiceMode, getReadingLineY, pixelsPerUnit])

  useEffect(() => {
    isPlayingRef.current = isPlaying
    if (isPlaying) startRaf()
    else stopRaf()
    return stopRaf
  }, [isPlaying, startRaf, stopRaf])

  // ── Controls auto-hide ──
  const showControlsTemp = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500)
  }, [])

  useEffect(() => { showControlsTemp(); return () => clearTimeout(hideTimerRef.current) }, [])

  // Prevent iOS bounce
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const prevent = (e) => e.preventDefault()
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [])

  // ── Speed +/- ──
  const adjustSpeed = useCallback((delta) => {
    const next = Math.max(1, Math.min(10, liveSpeedRef.current + delta))
    liveSpeedRef.current = next
    setDisplaySpeed(next)
    onSpeedChange?.(next)
    showControlsTemp()
  }, [showControlsTemp, onSpeedChange])

  // ── Handlers ──
  const handleTap = (e) => {
    if (e.target.closest('button')) return
    if (!showControls) { showControlsTemp(); return }
    togglePlay()
    showControlsTemp()
  }

  const togglePlay = () => {
    if (finished) return
    const next = !isPlaying
    setIsPlaying(next)
    isPlayingRef.current = next
    if (next) {
      startRaf()
      if (cameraOn) {
        const rec = mediaRecorderRef.current
        if (!rec || rec.state === 'inactive') {
          // First play — create the one recorder for this session
          startRecording()
        } else if (rec.state === 'paused') {
          // Subsequent plays — resume the same recorder (keeps audio session alive on iOS)
          try { rec.resume() } catch {}
        }
      }
    } else {
      // Pause — suspend recording without ending the audio session
      try {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.pause()
      } catch {}
    }
    // Keep camera preview alive on iOS
    if (videoRef.current && cameraOn) videoRef.current.play().catch(() => {})
  }


  const handleRewind = (e) => {
    e.stopPropagation()
    const amount = isVoiceMode ? fontSize * 4 : liveSpeedRef.current * pixelsPerUnit * 5
    scrollYRef.current = Math.max(0, scrollYRef.current - amount)
    targetScrollYRef.current = scrollYRef.current
    if (innerRef.current) innerRef.current.style.transform = `translateY(${-scrollYRef.current}px)`
    setFinished(false)
    voiceMatchRef.current = Math.max(0, currentWordIdx - 20)
    showControlsTemp()
  }

  const handleExit = (e) => {
    e.stopPropagation()
    setIsPlaying(false)
    stopRaf()
    stopMediaRecorder()
    chunksRef.current = []
    onExit()
  }

  const collectRecordingAndFinish = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const type = chunksRef.current[0]?.type || 'video/webm'
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type })
          : null
        onFinish(blob)
      }
      recorder.stop()
      mediaRecorderRef.current = null
    } else {
      onFinish(null)
    }
  }, [onFinish])

  const handleToggleMode = (e) => {
    e.stopPropagation()
    const next = effectiveMode === 'manual' ? 'voice' : 'manual'
    if (next === 'voice' && !isSupported) { setSafariWarning(true); return }
    setSafariWarning(false)
    setEffectiveMode(next)
    showControlsTemp()
  }

  const handleRestart = () => {
    scrollYRef.current = 0
    targetScrollYRef.current = 0
    if (innerRef.current) innerRef.current.style.transform = 'translateY(0)'
    setProgress(0); setFinished(false); setCurrentWordIdx(0)
    voiceMatchRef.current = 0; resetVoice()
    // discard the previous take so the next recording is clean
    stopMediaRecorder()
    chunksRef.current = []
  }

  return (
    <div
      ref={outerRef}
      className={`prompter-outer ${cameraOn ? 'camera-mode' : ''}`}
      onClick={handleTap}
    >
      {/* Camera background — always mounted so we can assign srcObject */}
      <video
        ref={videoRef}
        className={`camera-bg ${cameraOn ? 'active' : ''}`}
        autoPlay
        muted
        playsInline
      />

      {/* Dark overlay for text readability when camera is on */}
      {cameraOn && <div className="camera-dim" />}

      {/* Progress bar */}
      <div className="prompter-progress">
        <div className="prompter-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Screen recording hint */}
      {showRecHint && (
        <div className="rec-hint">
          📱 Swipe down → tap ● Screen Record to capture
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="safari-warning">📷 Camera access denied</div>
      )}

      {/* Voice warnings */}
      {safariWarning && <div className="safari-warning">🎤 Voice unavailable — manual scroll</div>}
      {isVoiceMode && voiceStatus === 'error' && <div className="safari-warning">🎤 Mic denied — manual scroll</div>}

      {/* Reading line */}
      <div className="reading-line" />

      {/* Fades */}
      <div className="prompter-fade-top" />
      <div className="prompter-fade-bottom" />

      {/* Scrolling text */}
      <div
        ref={innerRef}
        className={`prompter-inner ${cameraOn && textBg ? 'with-text-bg' : ''}`}
        dir={textDir}
        style={{
          fontSize: `${fontSize}px`,
          textAlign: alignment,
          fontFamily: fontStyle,
          lineHeight: 1.65,
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            ref={el => { wordEls.current[i] = el }}
            className={`prompter-word ${i === currentWordIdx && isVoiceMode ? 'word-current' : ''}`}
          >
            {word}{' '}
          </span>
        ))}
      </div>

      {/* Top nav — always visible */}
      <div className="prompter-top-nav">
        <button className="ctrl-btn ctrl-exit" onClick={handleExit} aria-label="Exit">✕</button>
      </div>

      {/* Controls overlay */}
      <div className="prompter-controls visible">
        <div className="controls-row">
          <button className="ctrl-btn" onClick={handleRewind} aria-label="Rewind">⏮</button>
          <button
            className={`ctrl-record-btn ${isPlaying ? 'recording' : ''}`}
            onClick={(e) => { e.stopPropagation(); togglePlay(); showControlsTemp() }}
            disabled={finished}
          >
            {finished ? '✓' : isPlaying ? <span className="record-pause" /> : <span className="record-dot" />}
          </button>
          <button
            className={`ctrl-btn ${cameraOn ? 'camera-active' : ''}`}
            onClick={toggleCamera}
            aria-label="Toggle camera"
          >
            📷
          </button>
          <button
            className={`ctrl-btn ctrl-mode ${isVoiceMode ? 'voice-active' : ''}`}
            onClick={handleToggleMode}
            aria-label="Toggle mode"
          >
            {isVoiceMode ? '🎤' : '🎚️'}
          </button>
        </div>

        {/* Speed +/- row — always visible */}
        <div className="speed-row">
          <button className="speed-adj-btn" onClick={(e) => { e.stopPropagation(); adjustSpeed(-1) }}>−</button>
          <span className="speed-label">Speed {displaySpeed}/10</span>
          <button className="speed-adj-btn" onClick={(e) => { e.stopPropagation(); adjustSpeed(+1) }}>+</button>
        </div>

        {isVoiceMode && voiceStatus === 'listening' && (
          <div className="voice-indicator"><span className="voice-dot" /> Voice active</div>
        )}
      </div>

      {/* Finished overlay */}
      {finished && (
        <div className="finished-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="finished-card">
            <div className="finished-icon">✓</div>
            <h2>Done!</h2>
            <p>You've reached the end of your script.</p>
            <button className="btn-primary btn-large" onClick={collectRecordingAndFinish}>See Results</button>
            <button className="btn-secondary" onClick={handleRestart}>Start Over</button>
            <button className="btn-secondary" onClick={onExit}>Back to Edit</button>
          </div>
        </div>
      )}
    </div>
  )
}
