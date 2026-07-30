import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [systemData, setSystemData] = useState({});
  const [redFlags, setRedFlags] = useState([]);
  const [overallScore, setOverallScore] = useState(100);
  const [syncStatus, setSyncStatus] = useState('Waiting for deep WMI scan...');

  // Interactive Test States
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [isFullscreenPixelTest, setIsFullscreenPixelTest] = useState(false);
  const [pixelColorIdx, setPixelColorIdx] = useState(0);
  const pixelColors = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF'];

  // PowerShell 1-Click Payload targeting Vite API endpoint
  const psCommand = `$d=@{}; Get-CimInstance Win32_OperatingSystem,Win32_ComputerSystem,Win32_Bios,Win32_BaseBoard,Win32_Processor | %{$_.psobject.properties | %{ if($_.Value){$d[$_.Name]=$_.Value.ToString()} }}; Invoke-RestMethod -Uri "http://localhost:5173/api/sync" -Method Post -Body ($d|ConvertTo-Json) -ContentType "application/json"`;

  // 1. INSTANT BROWSER AUTO-DETECT (On Load)
  useEffect(() => {
    const detectWebSpecs = async () => {
      const autoData = {};

      if (navigator.hardwareConcurrency) {
        autoData['Processor Cores'] = `${navigator.hardwareConcurrency} Logical Cores`;
      }
      if (navigator.deviceMemory) {
        autoData['RAM Estimate'] = `~${navigator.deviceMemory} GB`;
      }
      autoData['OS Platform'] = navigator.userAgentData?.platform || navigator.platform;

      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            autoData['Graphics Card (GPU)'] = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch (e) {
        console.warn('WebGL blocked');
      }

      autoData['Display Resolution'] = `${window.screen.width} x ${window.screen.height}`;

      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          autoData['Battery Level'] = `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging' : 'Discharging'})`;
        } catch (e) {
          console.warn('Battery API blocked');
        }
      }

      setSystemData((prev) => ({ ...autoData, ...prev }));
    };

    detectWebSpecs();
  }, []);

  // 2. LISTEN FOR POWERSHELL AUTO-SYNC DATA
useEffect(() => {
  if (import.meta.hot) {
    import.meta.hot.on('ps-data-sync', (data) => {
      setSystemData((prev) => {
        const updated = { ...prev, ...data };
        evaluateSystem(updated);
        return updated;
      });
      setSyncStatus('✅ Deep WMI Hardware Stats successfully synced!');
      setActiveTab('summary'); // 👈 Automatically switches to the Detected Hardware tab upon sync!
    });
  }
}, []);

  // 3. HARDWARE INTEGRITY EVALUATION
  const evaluateSystem = (data) => {
    const flags = [];
    let score = 100;

    // Secure Boot Evaluation
    if (data['SecureBootCapable'] === 'False' || data['SecureBootEnabled'] === 'False') {
      flags.push({
        severity: 'warning',
        title: 'Secure Boot Disabled/Unsupported',
        desc: 'Security layers disabled or unsupported for modern OS features.'
      });
      score -= 10;
    }

    // Motherboard Alignment Check
    const model = (data['Model'] || data['System Model'] || '').toLowerCase();
    const product = (data['Product'] || data['BaseBoard Product'] || '').toLowerCase();
    if (product && model && !model.includes(product.substring(0, 3)) && !product.includes(model.substring(0, 3))) {
      flags.push({
        severity: 'danger',
        title: 'Possible Replaced Motherboard',
        desc: `BaseBoard (${product}) does not align with factory model (${model}).`
      });
      score -= 25;
    }

    setRedFlags(flags);
    setOverallScore(Math.max(0, score));
  };

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab === 'keyboard') {
        e.preventDefault();
        setPressedKeys((prev) => new Set(prev).add(e.code));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const copyPowerShellCmd = () => {
    navigator.clipboard.writeText(psCommand);
    setSyncStatus('📋 Copied! Open Terminal (PowerShell) on target laptop and press Enter.');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6">
      {/* Fullscreen Pixel Test Overlay */}
      {isFullscreenPixelTest && (
        <div
          onClick={() => {
            if (pixelColorIdx < pixelColors.length - 1) setPixelColorIdx((p) => p + 1);
            else { setIsFullscreenPixelTest(false); setPixelColorIdx(0); }
          }}
          style={{ backgroundColor: pixelColors[pixelColorIdx] }}
          className="fixed inset-0 z-50 flex items-end justify-center pb-8 cursor-pointer"
        >
          <span className="bg-slate-900/80 text-white px-4 py-2 rounded-full text-xs border border-slate-700">
            Click to cycle colors ({pixelColorIdx + 1}/{pixelColors.length}). Click to exit.
          </span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sky-400">⚡ 2nd-Hand Laptop Diagnostic Engine</h1>
            <p className="text-sm text-slate-400 mt-1">Instant Web API detection + 1-click deep WMI auto-sync.</p>
          </div>
          <div className={`px-4 py-2 rounded-xl border flex flex-col items-end ${
            overallScore >= 80 ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400' :
            overallScore >= 60 ? 'bg-amber-950/50 border-amber-500/50 text-amber-400' :
            'bg-rose-950/50 border-rose-500/50 text-rose-400'
          }`}>
            <span className="text-xs uppercase tracking-wider font-medium">Health Score</span>
            <span className="text-2xl font-black">{overallScore} / 100</span>
          </div>
        </header>

        {/* 1-Click Auto-Sync Section */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 backdrop-blur-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-200">🚀 1-Click Deep Hardware Auto-Sync</h3>
              <p className="text-xs text-slate-400">Copies a single PowerShell command to auto-populate Motherboard, Serial #, and BIOS data.</p>
            </div>
            <button
              onClick={copyPowerShellCmd}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-sky-500/20 whitespace-nowrap"
            >
              📋 Copy Auto-Sync Command
            </button>
          </div>
          <p className="text-xs text-amber-400/90 font-mono italic">{syncStatus}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {[
            { id: 'summary', label: `📋 Detected Hardware (${Object.keys(systemData).length})` },
            { id: 'risks', label: `🚨 Integrity Flags (${redFlags.length})` },
            { id: 'keyboard', label: '⌨️ Keyboard Test' },
            { id: 'screen', label: '🖥️ Dead Pixel Test' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Specs Grid */}
        {activeTab === 'summary' && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(systemData).map(([key, val]) => (
                <div key={key} className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">{key}</span>
                  <span className="text-xs text-slate-200 break-words font-medium">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Integrity Risks */}
        {activeTab === 'risks' && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-3">
            {redFlags.length === 0 ? (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm">
                <strong>✓ Clear Health Assessment:</strong> No motherboard mismatches or critical security violations detected.
              </div>
            ) : (
              redFlags.map((flag, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-rose-950/20 border-l-4 border-rose-500 text-rose-200 border border-rose-500/40">
                  <strong className="text-sm block font-semibold">{flag.title}</strong>
                  <p className="text-xs mt-1 text-slate-300">{flag.desc}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: Keyboard Test */}
        {activeTab === 'keyboard' && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">Press physical keys on the keyboard to test registration.</p>
              <button onClick={() => setPressedKeys(new Set())} className="px-3 py-1 bg-slate-700 text-xs rounded text-slate-200">Reset</button>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-4">
              {[['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'],
                ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL'],
                ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM']].map((row, rIdx) => (
                <div key={rIdx} className="flex gap-1.5">
                  {row.map((k) => (
                    <div key={k} className={`w-10 h-10 rounded flex items-center justify-center font-bold text-xs transition border ${
                      pressedKeys.has(k) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}>{k.replace('Key', '')}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Dead Pixel Test */}
        {activeTab === 'screen' && (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-6 space-y-4">
            <p className="text-sm text-slate-300">Launch fullscreen solid flasher to inspect panel for dead pixels or backlight bleed.</p>
            <button
              onClick={() => { setPixelColorIdx(0); setIsFullscreenPixelTest(true); }}
              className="px-5 py-2.5 bg-sky-500 text-slate-950 font-semibold text-sm rounded-lg transition"
            >
              🖥️ Launch Dead Pixel Flasher
            </button>
          </div>
        )}
      </div>
    </div>
  );
}