import React from 'react';

export function FirebaseMissing() {
  return (
    <div className="min-h-screen bg-ypsom-alice flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-ypsom-alice rounded-lg shadow-audit p-8 text-center">
        <h1 className="font-black text-ypsom-deep uppercase tracking-tight text-lg mb-2">
          Configuration Firebase manquante
        </h1>
        <p className="text-sm text-ypsom-slate mb-6 leading-relaxed">
          L&apos;application a besoin des variables{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">VITE_FIREBASE_*</code> et{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code>.
        </p>
        <div className="text-left text-xs text-ypsom-slate space-y-3 mb-6 border-t border-ypsom-alice pt-4">
          <p className="font-bold text-ypsom-deep uppercase tracking-widest">Sur Netlify</p>
          <p>
            Site settings → Environment variables → ajoutez les clés listées dans{' '}
            <code className="bg-gray-100 px-1 rounded">.env.example</code>, puis redéployez.
          </p>
          <p className="font-bold text-ypsom-deep uppercase tracking-widest mt-4">En local</p>
          <p>
            Copiez <code className="bg-gray-100 px-1 rounded">.env.example</code> vers{' '}
            <code className="bg-gray-100 px-1 rounded">.env.local</code> et remplissez les valeurs.
          </p>
        </div>
        <a
          href="https://console.firebase.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-2.5 bg-ypsom-deep text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-ypsom-shadow transition-colors"
        >
          Ouvrir la console Firebase
        </a>
      </div>
    </div>
  );
}
