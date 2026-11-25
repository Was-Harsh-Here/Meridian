import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __MERIDIAN_BOOTED__?: boolean;
    __meridianResetCache?: () => void;
  }
}

class MeridianErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'Unexpected runtime error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050811] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-sky-500/40 bg-[#080E1E] p-6 space-y-4 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
              [ MERIDIAN RECOVERY ]
            </div>
            <h1 className="text-lg font-bold text-white">
              Display Interrupted
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {this.state.message}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (window.__meridianResetCache) {
                    window.__meridianResetCache();
                  } else {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
              >
                Reset Cache &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  if ('serviceWorker' in navigator && window.isSecureContext) {
    registerSW({
      immediate: true,
      onRegisterError(err) {
        console.warn('Service Worker registration skipped:', err);
      },
    });
  }
} catch {
  // Never block rendering in restricted iOS WebViews or private browsing
}

window.__MERIDIAN_BOOTED__ = true;

createRoot(document.getElementById('root')!).render(
  <MeridianErrorBoundary>
    <App />
  </MeridianErrorBoundary>
);
