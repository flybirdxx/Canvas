import React, { useState } from 'react';
import { X, Key, Link as LinkIcon, Settings, CheckCircle2, Image as ImageIcon, Video as VideoIcon, Type as TextIcon, UploadCloud } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { listProviders } from '@/services/gateway';
import type { Capability } from '@/services/gateway';

/** imgbb 图床是一个特殊 "虚拟 Provider"，单独占一个侧栏 tab。 */
const IMG_HOST_TAB = '__imgHost';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { providers, updateProvider, imgHost, updateImgHost } = useSettingsStore();
  const registeredProviders = listProviders().filter(p => p.auth !== 'none');
  const [activeTab, setActiveTab] = useState(registeredProviders[0]?.id ?? 't8star');
  const [savedStatus, setSavedStatus] = useState(false);

  const handleSave = () => {
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2000);
  };

  const activeProvider = registeredProviders.find(p => p.id === activeTab) ?? registeredProviders[0];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center anim-fade-in"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="anim-pop flex flex-col overflow-hidden"
        style={{
          width: '100%',
          maxWidth: 720,
          borderRadius: 'var(--r-xl)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', background: 'var(--bg-2)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '14px 20px', background: 'var(--bg-2)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--ink-0)' }}>
            <Settings className="w-4.5 h-4.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
            <h2 className="serif" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ width: 28, height: 28, borderRadius: '50%' }}
          >
            <X className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>

        {/* Body */}
        <div className="flex" style={{ height: 420 }}>
          {/* Sidebar */}
          <div
            className="paper-scroll flex flex-col overflow-y-auto"
            style={{ width: 192, padding: 12, gap: 2, background: 'var(--bg-2)' }}
          >
            <div className="meta" style={{ padding: '6px 10px', fontSize: 9.5 }}>
              API Providers
            </div>
            {registeredProviders.map((p) => {
              const cfg = providers[p.id];
              const configured = !!cfg?.apiKey;
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab(p.id)}
                  className="text-left flex items-center justify-between gap-2 transition-colors"
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 13,
                    fontWeight: 500,
                    background: isActive ? 'var(--bg-0)' : 'transparent',
                    color: isActive ? 'var(--ink-0)' : 'var(--ink-1)',
                    boxShadow: 'none',
                    border: isActive ? '1px solid var(--line-1)' : '1px solid transparent',
                  }}
                >
                  <span className="truncate">{p.name}</span>
                  {configured && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--success)',
                        flexShrink: 0,
                      }}
                      title="已配置密钥"
                    />
                  )}
                </button>
              );
            })}

            <div className="meta" style={{ padding: '14px 10px 6px', fontSize: 9.5 }}>
              Image Host
            </div>
            {(() => {
              const isActive = activeTab === IMG_HOST_TAB;
              const configured = imgHost.enabled && !!imgHost.apiKey;
              return (
                <button
                  onClick={() => setActiveTab(IMG_HOST_TAB)}
                  className="text-left flex items-center justify-between gap-2 transition-colors"
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 13,
                    fontWeight: 500,
                    background: isActive ? 'var(--bg-0)' : 'transparent',
                    color: isActive ? 'var(--ink-0)' : 'var(--ink-1)',
                    boxShadow: 'none',
                    border: isActive ? '1px solid var(--line-1)' : '1px solid transparent',
                  }}
                >
                  <span className="truncate">imgbb</span>
                  {configured && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--success)',
                        flexShrink: 0,
                      }}
                      title="图床已启用"
                    />
                  )}
                </button>
              );
            })()}
          </div>

          {/* Content */}
          <div className="flex-1 paper-scroll overflow-y-auto" style={{ padding: 24 }}>
            {activeTab === IMG_HOST_TAB ? (
              <div className="flex flex-col" style={{ gap: 22 }}>
                <div>
                  <h3
                    className="serif"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-0)', marginBottom: 4 }}
                  >
                    imgbb 图床
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    启用后，所有 Provider 返回的图像会自动上传到 imgbb 换成稳定外链，
                    避免 b64 撑爆本地存储、以及代理 URL 过期导致节点裂图。
                  </p>
                  <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                    <span
                      className="inline-flex items-center gap-1"
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        fontSize: 11,
                        fontWeight: 500,
                        background: 'color-mix(in oklch, var(--port-image) 14%, var(--bg-1))',
                        color: 'var(--port-image)',
                        border: '1px solid color-mix(in oklch, var(--port-image) 30%, transparent)',
                      }}
                    >
                      <UploadCloud className="w-3 h-3" strokeWidth={1.8} />
                      外链托管
                    </span>
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 16 }}>
                  <label
                    className="flex items-center justify-between"
                    style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-1)' }}
                  >
                    <span>启用图床上传</span>
                    <input
                      type="checkbox"
                      checked={imgHost.enabled}
                      onChange={(e) => updateImgHost({ enabled: e.target.checked })}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </label>

                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <label
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}
                    >
                      <Key className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                      imgbb API Key
                    </label>
                    <input
                      type="password"
                      value={imgHost.apiKey}
                      onChange={(e) => updateImgHost({ apiKey: e.target.value })}
                      className="input-paper mono"
                      style={{ fontSize: 12.5 }}
                      placeholder="imgbb 个人密钥"
                    />
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      获取密钥：
                      <a
                        href="https://api.imgbb.com/"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                      >
                        api.imgbb.com
                      </a>
                      。关闭开关或留空时，Provider 原始输出（data URL / 原链接）会直接写入节点。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 22 }}>
                <div>
                  <h3
                    className="serif"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-0)', marginBottom: 4 }}
                  >
                    {activeProvider?.name ?? activeTab} Configuration
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    {activeProvider?.authHint ?? 'Configure API key and endpoint for this provider.'}
                  </p>
                  {activeProvider && (
                    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                      {activeProvider.capabilities.map((cap) => (
                        <CapabilityBadge
                          key={cap}
                          cap={cap}
                          count={activeProvider.models.filter(m => m.capability === cap).length}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col" style={{ gap: 16 }}>
                  {/* Base URL */}
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <label
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}
                    >
                      <LinkIcon className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={providers[activeTab]?.baseUrl || ''}
                      onChange={(e) => updateProvider(activeTab, { baseUrl: e.target.value })}
                      className="input-paper mono"
                      style={{ fontSize: 12.5 }}
                      placeholder="https://api..."
                    />
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <label
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-1)' }}
                    >
                      <Key className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--ink-2)' }} />
                      API Key
                    </label>
                    <input
                      type="password"
                      value={providers[activeTab]?.apiKey || ''}
                      onChange={(e) => updateProvider(activeTab, { apiKey: e.target.value })}
                      className="input-paper mono"
                      style={{ fontSize: 12.5 }}
                      placeholder="sk-..."
                    />
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      Your key is stored locally in your browser.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="hairline-t flex items-center justify-between"
          style={{ padding: '14px 20px', background: 'var(--bg-2)' }}
        >
          <div
            className="flex items-center gap-1.5 transition-opacity"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--success)',
              opacity: savedStatus ? 1 : 0,
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            Saved locally
          </div>
          <button onClick={handleSave} className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

const CAP_META: Record<Capability, { label: string; fg: string; bg: string; Icon: React.ComponentType<any> }> = {
  image: { label: '图像', fg: 'var(--port-image)', bg: 'color-mix(in oklch, var(--port-image) 14%, var(--bg-1))', Icon: ImageIcon },
  video: { label: '视频', fg: 'var(--port-video)', bg: 'color-mix(in oklch, var(--port-video) 14%, var(--bg-1))', Icon: VideoIcon },
  text:  { label: '文本', fg: 'var(--port-text)',  bg: 'color-mix(in oklch, var(--port-text)  14%, var(--bg-1))',  Icon: TextIcon },
};

function CapabilityBadge({ key, cap, count }: { cap: Capability; count: number; key?: React.Key }) {
  const meta = CAP_META[cap];
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        background: meta.bg,
        color: meta.fg,
        border: '1px solid color-mix(in oklch, currentColor 30%, transparent)',
      }}
    >
      <Icon className="w-3 h-3" strokeWidth={1.8} />
      {meta.label}
      <span style={{ opacity: 0.7 }}>· {count}</span>
    </span>
  );
}
