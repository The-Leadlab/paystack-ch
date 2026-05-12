import React, { useState } from 'react';
import { Building2, Plus, ChevronRight, User } from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { useLanguage } from '../context/LanguageContext';
import type { Client } from '../types';

export function ClientOnboarding() {
  const { t } = useLanguage();
  const { clients, currentClient, setCurrentClient, addClient, loading, error } = useClient();
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      const result = await addClient(name);
      if (!result) {
        setLocalError(error || t('onboardErrorAddClient'));
      } else {
        setNewName('');
        setCurrentClient(result);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    setCurrentClient(client);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="animate-pulse font-black text-ypsom-deep uppercase tracking-widest text-sm">{t('onboardLoading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-ypsom-deep rounded-sm flex items-center justify-center">
            <span className="text-white font-bold text-lg font-serif italic">YP</span>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl text-ypsom-deep tracking-wider leading-none">
              CAFE <span className="font-light">DE LA PLACE</span>
            </span>
            <span className="text-[0.6rem] tracking-[0.25em] text-ypsom-slate uppercase font-bold">{t('onboardSubtitle')}</span>
          </div>
        </div>

        <div className="bg-white border border-ypsom-alice rounded-lg shadow-audit p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-ypsom-deep" />
            <h1 className="font-black text-ypsom-deep uppercase tracking-tight">{t('onboardHeading')}</h1>
          </div>

          {(error || localError) && (
            <p className="text-xs text-red-600 font-medium mb-4">
              {localError || error}
            </p>
          )}

          <form onSubmit={handleAddClient} className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ypsom-slate mb-1.5">{t('onboardNewClientLabel')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ypsom-slate/60" />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('onboardPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 border border-ypsom-alice rounded-sm text-sm text-ypsom-deep placeholder:text-ypsom-slate/50 focus:outline-none focus:ring-2 focus:ring-ypsom-deep/20 focus:border-ypsom-deep"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-ypsom-deep text-white font-black text-[10px] uppercase tracking-widest rounded-sm hover:bg-ypsom-deep/90 disabled:opacity-60 transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('onboardAdd')}
              </button>
            </div>
          </form>

          {clients.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ypsom-slate mb-3">{t('onboardSelectExisting')}</p>
              <ul className="space-y-1">
                {clients.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-sm border text-left transition-colors ${
                        currentClient?.id === client.id
                          ? 'border-ypsom-deep bg-ypsom-deep/5 text-ypsom-deep'
                          : 'border-ypsom-alice hover:border-ypsom-deep/30 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold text-sm text-ypsom-deep">{client.name}</span>
                      <ChevronRight className="w-4 h-4 text-ypsom-slate" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
