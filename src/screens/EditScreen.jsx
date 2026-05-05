import { detectTextDirection } from '../utils/textUtils'

const FONTS = [
  { id: 'sans', label: 'Sans', style: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: 'serif', label: 'Serif', style: 'Georgia, serif' },
  { id: 'mono', label: 'Mono', style: "'Courier New', monospace" },
  { id: 'lexend', label: 'Lexend', style: "'Lexend', sans-serif" },
]

export default function EditScreen({ script, onScriptChange, settings, onSettingsChange, onBack, onGoLive, onTry }) {
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
  const textDir = detectTextDirection(script)

  function update(key, value) {
    onSettingsChange(prev => ({ ...prev, [key]: value }))
  }

  const currentFont = FONTS.find(f => f.id === settings.fontFamily) || FONTS[0]
  const scrollText = script.slice(0, 400).trim() || 'Your script will appear here…'
  // Same px/s formula as PrompterScreen: speed * fontSize * 0.24
  // Cycle duration = ~300px of text / px-per-second, clamped to [2s, 30s]
  const pxPerSec = settings.speed * settings.fontSize * 0.24
  const scrollDuration = Math.min(30, Math.max(2, Math.round(300 / pxPerSec)))

  return (
    <div className="edit-screen">
      {/* Nav */}
      <div className="edit-nav">
        <button className="nav-btn" onClick={onBack}>← Back</button>
        <span className="edit-title">Edit</span>
        <button
          className="nav-btn nav-btn-accent"
          onClick={onGoLive}
          disabled={!script.trim()}
        >
          Go Live →
        </button>
      </div>

      <div className="edit-body">
        {/* Left column: Script + Preview */}
        <div className="edit-col edit-col-left">
          <section className="edit-section">
            <div className="section-header">
              <h2>Script</h2>
              <span className="word-count">
                {textDir === 'rtl' && <span className="dir-badge">RTL</span>}
                {wordCount} words
              </span>
            </div>
            <textarea
              className="edit-textarea"
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              placeholder="Your script…"
              rows={5}
              dir={textDir}
              style={{ textAlign: textDir === 'rtl' ? 'right' : 'left' }}
            />
          </section>

          <section className="edit-section">
            <div className="section-header">
              <h2>Preview</h2>
              <button
                className="try-btn"
                onClick={onTry}
                disabled={!script.trim()}
              >
                ▶ Try
              </button>
            </div>
            <div
              className="preview-block"
              dir={textDir}
              style={{
                fontSize: `${settings.fontSize}px`,
                textAlign: settings.alignment,
                fontFamily: currentFont.style,
                lineHeight: 1.65,
              }}
            >
              <div
                className="preview-scroll-text"
                style={{ animationDuration: `${scrollDuration}s` }}
              >
                <span>{scrollText}</span>
                <span aria-hidden="true">{scrollText}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Settings + Go Live */}
        <div className="edit-col edit-col-right">
          <section className="edit-section">
            <h2>Display</h2>

            <div className="setting-row">
              <label>Font size <span className="setting-value">{settings.fontSize}px</span></label>
              <input
                type="range" min={16} max={72} step={2}
                value={settings.fontSize}
                onChange={(e) => update('fontSize', +e.target.value)}
                className="setting-slider"
              />
              <div className="slider-labels"><span>Aa</span><span style={{ fontSize: '20px' }}>Aa</span></div>
            </div>

            <div className="setting-row">
              <label>Alignment</label>
              <div className="btn-group">
                {['left', 'center', 'right'].map(a => (
                  <button
                    key={a}
                    className={`btn-option ${settings.alignment === a ? 'active' : ''}`}
                    onClick={() => update('alignment', a)}
                  >
                    {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <label>Font</label>
              <div className="btn-group">
                {FONTS.map(f => (
                  <button
                    key={f.id}
                    className={`btn-option ${settings.fontFamily === f.id ? 'active' : ''}`}
                    onClick={() => update('fontFamily', f.id)}
                    style={{ fontFamily: f.style }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="edit-section">
            <h2>Recording</h2>

            <div className="setting-row">
              <label>Camera</label>
              <div className="btn-group">
                <button
                  className={`btn-option ${settings.camera ? 'active' : ''}`}
                  onClick={() => update('camera', true)}
                >
                  📷 On
                </button>
                <button
                  className={`btn-option ${!settings.camera ? 'active' : ''}`}
                  onClick={() => update('camera', false)}
                >
                  Off
                </button>
              </div>
              {settings.camera && (
                <p className="mode-hint">
                  Front camera shows behind your script. Use iPhone Screen Recording (Control Center) to capture the video.
                </p>
              )}
            </div>

            {settings.camera && (
              <div className="setting-row">
                <label>Text background</label>
                <div className="btn-group">
                  <button
                    className={`btn-option ${settings.textBg ? 'active' : ''}`}
                    onClick={() => update('textBg', true)}
                  >
                    Dark band
                  </button>
                  <button
                    className={`btn-option ${!settings.textBg ? 'active' : ''}`}
                    onClick={() => update('textBg', false)}
                  >
                    None
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="edit-section">
            <h2>Scrolling</h2>

            <div className="setting-row">
              <label>Speed <span className="setting-value">{settings.speed}/10</span></label>
              <input
                type="range" min={1} max={10} step={1}
                value={settings.speed}
                onChange={(e) => update('speed', +e.target.value)}
                className="setting-slider"
              />
              <div className="slider-labels"><span>Slow</span><span>Fast</span></div>
            </div>

            <div className="setting-row">
              <label>Mode</label>
              <div className="btn-group">
                <button
                  className={`btn-option ${settings.mode === 'manual' ? 'active' : ''}`}
                  onClick={() => update('mode', 'manual')}
                >
                  🎚️ Manual
                </button>
                <button
                  className={`btn-option btn-option-voice ${settings.mode === 'voice' ? 'active' : ''}`}
                  onClick={() => update('mode', 'voice')}
                >
                  🎤 Voice
                </button>
              </div>
              {settings.mode === 'voice' && (
                <p className="mode-hint">
                  Listens to your voice and auto-adjusts scroll. Requires mic + HTTPS. Best on Chrome/Edge.
                </p>
              )}
            </div>
          </section>

        </div>
      </div>

      <div className="edit-footer">
        <button
          className="btn-primary btn-large"
          onClick={onGoLive}
          disabled={!script.trim()}
        >
          🎬 Go Live
        </button>
      </div>
    </div>
  )
}
