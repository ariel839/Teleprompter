import { useEffect, useRef, useState } from 'react'

export default function ResultsScreen({ blob, onEdit, onDiscard }) {
  const videoRef = useRef(null)
  const videoUrlRef = useRef(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const hasRecording = !!blob

  // Create object URL from blob on mount, revoke on unmount
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    videoUrlRef.current = url
    if (videoRef.current) {
      videoRef.current.src = url
    }
    return () => URL.revokeObjectURL(url)
  }, [blob])

  function handleSave() {
    if (!blob || !videoUrlRef.current) return
    const a = document.createElement('a')
    a.href = videoUrlRef.current
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    a.download = `teleprompter-${Date.now()}.${ext}`
    a.click()
  }

  function handleDraft() {
    // Store a flag in localStorage; the blob URL lives in memory for this session
    localStorage.setItem('tp-has-draft', '1')
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2500)
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

      {/* On desktop this becomes a two-column grid (video left, actions right) */}
      <div className={`results-layout${hasRecording ? '' : ' results-layout--no-video'}`}>
        {hasRecording && (
          <div className="results-video-wrap">
            <video
              ref={videoRef}
              className="results-video"
              controls
              playsInline
            />
          </div>
        )}

        <div className="results-actions">
          {hasRecording && (
            <>
              <button className="btn-primary btn-large" onClick={handleSave}>
                ↓ Save Video
              </button>
              <button
                className={`btn-secondary results-draft-btn ${draftSaved ? 'draft-saved' : ''}`}
                onClick={handleDraft}
              >
                {draftSaved ? '✓ Draft Saved' : '📋 Save as Draft'}
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
