import React, { useEffect, useState } from 'react';

interface TransitionScreenProps {
  label: string;
  onDone: () => void;
}

const TransitionScreen: React.FC<TransitionScreenProps> = ({ label, onDone }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const t1 = setTimeout(() => setVisible(true), 20);
    // Switch view while overlay is still fully opaque, then unmount overlay
    const t2 = setTimeout(() => {
      onDone();         // switches activeView → explorer (overlay still covers screen)
    }, 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{
        background: '#0a0e1a',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <img src="/logo.png" alt="logo" className="w-20 h-20 opacity-80" />
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-3 tracking-wide uppercase">Searching</p>
        <p className="text-white text-2xl font-semibold">{label}</p>
      </div>
      <div
        className="w-8 h-8 rounded-full border-2 border-slate-700"
        style={{ borderTopColor: '#5eead4', animation: 'spin 0.8s linear infinite' }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default TransitionScreen;
