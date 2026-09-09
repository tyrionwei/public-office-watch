import { Component, createRef, type ReactNode } from 'react';

// This recovery screen must stay in the entry bundle, outside the router and data providers.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private headingRef = createRef<HTMLHeadingElement>();

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.headingRef.current?.focus();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const english = document.documentElement.lang.startsWith('en');
    return <main className="mx-auto max-w-xl space-y-4 px-6 py-16 text-slate-200">
      <h1 ref={this.headingRef} tabIndex={-1} className="font-display text-2xl text-white">
        {english ? 'This page could not be loaded' : '頁面暫時無法載入'}
      </h1>
      <p role="alert">{english ? 'Please reload the page to try again.' : '請重新載入頁面再試一次。'}</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" className="border border-accent px-4 py-3 text-accent" onClick={() => window.location.reload()}>
          {english ? 'Reload page' : '重新載入頁面'}
        </button>
        <a href="/" className="border border-line px-4 py-3">{english ? 'Go to home page' : '返回首頁'}</a>
      </div>
    </main>;
  }
}
