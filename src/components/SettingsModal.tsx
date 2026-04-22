import React, { useState } from 'react';
import { X, Key, Link as LinkIcon, Settings, CheckCircle2 } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { providers, updateProvider } = useSettingsStore();
  const [activeTab, setActiveTab] = useState('t8star');
  const [savedStatus, setSavedStatus] = useState(false);

  const handleSave = () => {
    setSavedStatus(true);
    setTimeout(() => {
      setSavedStatus(false);
    }, 2000);
  };

  const tabs = [
    { id: 't8star', label: 't8star AI' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl shadow-[0_32px_80px_rgb(0,0,0,0.15)] border border-gray-200/80 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 text-gray-800">
            <Settings className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200/60 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex h-[400px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-100 bg-gray-50/30 p-3 flex flex-col gap-1">
            <div className="text-xs font-semibold text-gray-400 px-3 py-2 uppercase tracking-wider">
              API Providers
            </div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex flex-col gap-6">
              
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">
                  {tabs.find(t => t.id === activeTab)?.label} Configuration
                </h3>
                <p className="text-sm text-gray-500">
                  Configure API keys and endpoints for this provider.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Base URL */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-gray-400" /> Base URL
                  </label>
                  <input 
                    type="text" 
                    value={providers[activeTab]?.baseUrl || ''}
                    onChange={(e) => updateProvider(activeTab, { baseUrl: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    placeholder="https://api..."
                  />
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-gray-400" /> API Key
                  </label>
                  <input 
                    type="password" 
                    value={providers[activeTab]?.apiKey || ''}
                    onChange={(e) => updateProvider(activeTab, { apiKey: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-mono"
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Your key is stored locally in your browser.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 opacity-0 transition-opacity" style={{ opacity: savedStatus ? 1 : 0 }}>
            <CheckCircle2 className="w-4 h-4" /> Saved locally
          </div>
          <button 
            onClick={handleSave}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
