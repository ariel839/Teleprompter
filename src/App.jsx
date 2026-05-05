import { useState, useEffect } from 'react'
import ImportScreen from './screens/ImportScreen'
import EditScreen from './screens/EditScreen'
import PrompterScreen from './screens/PrompterScreen'
import ResultsScreen from './screens/ResultsScreen'
import './App.css'

const SCREENS = { IMPORT: 'import', EDIT: 'edit', PROMPTER: 'prompter', RESULTS: 'results' }

const DEFAULT_SETTINGS = {
  fontSize: 36,
  alignment: 'center',
  speed: 5,           // 1–10
  mode: 'manual',     // 'manual' | 'voice'
  fontFamily: 'sans', // 'sans' | 'serif' | 'mono' | 'lexend'
  camera: true,       // show front camera as background when going live
  textBg: true,       // semi-transparent band behind text for readability
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.IMPORT)
  const [script, setScript] = useState('')
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tp-settings')
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch { return DEFAULT_SETTINGS }
  })
  const [tryMode, setTryMode] = useState(false)
  const [recordingBlob, setRecordingBlob] = useState(null)

  // Load saved script on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('tp-script')
    if (saved) setScript(saved)
  }, [])

  // Save script for this session only (clears on new tab / browser restart)
  useEffect(() => {
    if (script) sessionStorage.setItem('tp-script', script)
    else sessionStorage.removeItem('tp-script')
  }, [script])

  // Save settings
  useEffect(() => {
    localStorage.setItem('tp-settings', JSON.stringify(settings))
  }, [settings])

  function handleTry() {
    setSettings(prev => ({ ...prev, camera: true }))
    setTryMode(true)
    setScreen(SCREENS.PROMPTER)
  }

  function handlePrompterExit() {
    setTryMode(false)
    setScreen(SCREENS.EDIT)
  }

  function handlePrompterFinish(blob) {
    setTryMode(false)
    setRecordingBlob(blob)
    setScreen(SCREENS.RESULTS)
  }

  return (
    <div className={`app app--${screen}`}>
      {screen === SCREENS.IMPORT && (
        <ImportScreen
          script={script}
          onScriptChange={setScript}
          onContinue={() => setScreen(SCREENS.EDIT)}
        />
      )}
      {screen === SCREENS.EDIT && (
        <EditScreen
          script={script}
          onScriptChange={setScript}
          settings={settings}
          onSettingsChange={setSettings}
          onBack={() => setScreen(SCREENS.IMPORT)}
          onGoLive={() => setScreen(SCREENS.PROMPTER)}
          onTry={handleTry}
        />
      )}
      {screen === SCREENS.PROMPTER && (
        <PrompterScreen
          script={script}
          settings={settings}
          autoStart={tryMode}
          onExit={handlePrompterExit}
          onFinish={handlePrompterFinish}
          onSpeedChange={(newSpeed) => setSettings(prev => ({ ...prev, speed: newSpeed }))}
        />
      )}
      {screen === SCREENS.RESULTS && (
        <ResultsScreen
          blob={recordingBlob}
          onEdit={() => setScreen(SCREENS.EDIT)}
          onDiscard={() => { setRecordingBlob(null); setScreen(SCREENS.EDIT) }}
        />
      )}
    </div>
  )
}
