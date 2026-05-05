import { useState, useRef, useCallback } from 'react'
import mammoth from 'mammoth'

export default function ImportScreen({ script, onScriptChange, onContinue }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPaste, setShowPaste] = useState(!script)
  const fileInputRef = useRef(null)

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0

  async function handleFile(file) {
    setError('')
    setLoading(true)
    try {
      if (file.name.endsWith('.txt')) {
        const text = await file.text()
        onScriptChange(text)
        setShowPaste(false)
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        onScriptChange(result.value.trim())
        setShowPaste(false)
      } else {
        setError('Please upload a .txt or .docx file')
      }
    } catch (e) {
      setError('Failed to read file. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const handleFileInput = async (e) => {
    const file = e.target.files[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="import-screen">
      <div className="import-header">
        <div className="import-logo">📽</div>
        <h1>Teleprompter</h1>
        <p className="import-subtitle">Record yourself naturally</p>
      </div>

      <div className="import-body">
        {/* Drop zone */}
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Upload file"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          {loading ? (
            <div className="drop-zone-inner">
              <div className="spinner" />
              <span>Reading file…</span>
            </div>
          ) : (
            <div className="drop-zone-inner">
              <div className="drop-icon">📄</div>
              <strong>Drop a file here</strong>
              <span>or tap to browse</span>
              <span className="drop-hint">.txt or .docx</span>
            </div>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}

        {/* Paste option */}
        <div className="paste-section">
          <button
            className="paste-toggle"
            onClick={() => setShowPaste(v => !v)}
          >
            {showPaste ? 'Hide text editor' : '✏️ Paste or type script'}
          </button>

          {showPaste && (
            <textarea
              className="paste-area"
              placeholder="Paste or type your script here…"
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              rows={8}
              autoFocus={!script}
            />
          )}
        </div>

        {/* Word count + clear */}
        {script && (
          <div className="script-meta">
            <span className="word-count">{wordCount} words · ~{Math.ceil(wordCount / 130)} min read</span>
            <button
              className="clear-btn"
              onClick={() => {
                onScriptChange('')
                setShowPaste(true)
                localStorage.removeItem('tp-script')
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="import-footer">
        <button
          className="btn-primary btn-large"
          onClick={onContinue}
          disabled={!script.trim()}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
