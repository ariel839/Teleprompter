import { useEffect, useRef } from 'react'

export default function ResultsScreen({ blob, onEdit, onDiscard }) {
  const videoRef = useRef(null)
  const videoUrlRef = useRef(null)
  const hasRecording = !!blob

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    videoUrlRef.current = url
    if (videoRef.current) videoRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  async function handleSave() {
    if (!blob) return
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const fileName = `teleprompter-${Date.now()}.${ext}`

    // Web Share API opens the native share sheet on iOS — user can "Save Video" to Camera Roll
    if (navigator.canShare) {
      const file = new File([blob], fileName, { type: blob.type })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          return
        } catch (e) {
          if (e.name === 'AbortError') return // user cancelled
          // share failed — fall through to regular download
        }
      }
    }

    // Desktop fallback: browser download
    const url = videoUrlRef.current
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }

  return (
    <div className="results-screen">
      <div className="results-header">
        <div className="results-icon">✓</div>
        <h1 className="results-title">Done!</h1>
        <p className="results-subtitle">
          {hasRecording ? 'Your recording is ready.' : 'Script complete — no video recorded.'}
        </p>
      </div>

      <div className={`results-layout${hasRecording ? '' : ' results-layout--no-video'}`}>
        {hasRecording && (
          <div className="results-video-wrap">
            <video ref={videoRef} className="results-video" controls playsInline />
          </div>
        )}

        <div className="results-actions">
          {hasRecording && (
            <>
              <button className="btn-primary btn-large" onClick={handleSave}>
                ↓ Save Video
              </button>
              <button className="btn-secondary" onClick={onDiscard}>
                Discard Recording
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={onEdit}>
            ← Back to Edit
          </button>
        </div>
      </div>
    </div>
  )
}
