import React, { useState, useEffect } from "react";
import HackerCard from "./HackerCard";

export interface ScannerSettings {
  autoSave: boolean;
  debugMode: boolean;
  timeout: string;
  maxRetries: string;
  proxyBypass: boolean;
  proxyRotation: boolean;
  cloudflareBypass: boolean;
  userAgent: boolean;
  hitSoundFile: string | null;
  hitSoundName: string | null;
  hitSoundEnabled: boolean;
  hideConfigOnScan: boolean;
  corsAnywhereEnabled: boolean;
  corsAnywhereUrl: string;
}

interface SettingsTabProps {
  settings: ScannerSettings;
  onSettingsChange: (settings: ScannerSettings) => void;
}

const SettingsTab = ({ settings, onSettingsChange }: SettingsTabProps) => {
  const [localSettings, setLocalSettings] = useState<ScannerSettings>(settings);

  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleSoundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLocalSettings(prev => ({ ...prev, hitSoundFile: reader.result as string, hitSoundName: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSoundFile = () => setLocalSettings(prev => ({ ...prev, hitSoundFile: null, hitSoundName: null }));

  const testSound = () => {
    if (localSettings.hitSoundFile) {
      const audio = new Audio(localSettings.hitSoundFile);
      audio.play();
    }
  };

  const handleSaveSettings = () => {
    onSettingsChange(localSettings);
    localStorage.setItem('iptv_scanner_settings', JSON.stringify(localSettings));
  };

  const updateSetting = <K extends keyof ScannerSettings>(key: K, value: ScannerSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
      <HackerCard title="HIT SOUND NOTIFICATION" icon="🔊">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">ENABLE HIT SOUND</label>
            <button onClick={() => updateSetting('hitSoundEnabled', !localSettings.hitSoundEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.hitSoundEnabled ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.hitSoundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">AUTO-SAVE RESULTS</label>
            <button onClick={() => updateSetting('autoSave', !localSettings.autoSave)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.autoSave ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.autoSave ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-primary">HIT SOUND FILE (MP3/WAV):</label>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={handleSoundFileChange} className="hidden" id="sound-file-input" />
              <input placeholder="اختر ملف صوت للتنبيه" value={localSettings.hitSoundName || ""} readOnly className="flex-1 text-xs sm:text-sm h-9 sm:h-10 px-3 bg-[hsl(var(--input))] border-2 border-primary/30 rounded-lg text-foreground outline-none" />
              <div className="flex gap-2">
                <label htmlFor="sound-file-input" className="cursor-pointer">
                  <span className="inline-flex items-center gap-1 px-3 py-2 bg-primary/20 border border-primary/50 text-primary rounded-lg text-xs font-bold hover:bg-primary/30 transition-all cursor-pointer">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                    BROWSE
                  </span>
                </label>
                {localSettings.hitSoundFile && (
                  <>
                    <button onClick={testSound} className="px-3 py-2 bg-primary/20 border border-primary/50 text-primary rounded-lg text-xs font-bold hover:bg-primary/30 transition-all">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                    </button>
                    <button onClick={removeSoundFile} className="px-3 py-2 bg-destructive/20 border border-destructive/50 text-destructive rounded-lg text-xs font-bold hover:bg-destructive/30 transition-all">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </HackerCard>

      <HackerCard title="PROXY SETTINGS" icon="🌐">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">PROXY BYPASS</label>
            <button onClick={() => updateSetting('proxyBypass', !localSettings.proxyBypass)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.proxyBypass ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.proxyBypass ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">PROXY ROTATION</label>
            <button onClick={() => updateSetting('proxyRotation', !localSettings.proxyRotation)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.proxyRotation ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.proxyRotation ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </HackerCard>

      <HackerCard title="BYPASS SETTINGS" icon="🛡️">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">CLOUDFLARE BYPASS</label>
            <button onClick={() => updateSetting('cloudflareBypass', !localSettings.cloudflareBypass)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.cloudflareBypass ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.cloudflareBypass ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">RANDOM USER AGENT</label>
            <button onClick={() => updateSetting('userAgent', !localSettings.userAgent)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.userAgent ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.userAgent ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">DEBUG MODE</label>
            <button onClick={() => updateSetting('debugMode', !localSettings.debugMode)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.debugMode ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.debugMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="font-bold text-foreground text-xs sm:text-sm">HIDE CONFIG ON SCAN</label>
            <button onClick={() => updateSetting('hideConfigOnScan', !localSettings.hideConfigOnScan)}
              className={`w-10 h-5 rounded-full transition-colors ${localSettings.hideConfigOnScan ? 'bg-primary' : 'bg-slate-700'} relative`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${localSettings.hideConfigOnScan ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </HackerCard>

      <HackerCard title="PERFORMANCE SETTINGS" icon="⚡">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-primary">TIMEOUT (MS):</label>
            <input type="number" value={localSettings.timeout} onChange={(e) => updateSetting('timeout', e.target.value)}
              className="w-full px-3 py-2 bg-[hsl(var(--input))] border-2 border-primary/30 rounded-lg text-foreground outline-none focus:border-primary text-xs sm:text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-primary">MAX RETRIES:</label>
            <select value={localSettings.maxRetries} onChange={(e) => updateSetting('maxRetries', e.target.value)}
              className="w-full px-3 py-2 bg-[hsl(var(--input))] border-2 border-primary/30 rounded-lg text-foreground outline-none focus:border-primary text-xs sm:text-sm">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
        </div>
      </HackerCard>

      <div className="flex justify-center">
        <button onClick={handleSaveSettings} className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-mono tracking-wider hover:bg-primary/90 transition-all flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
          SAVE SETTINGS
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
