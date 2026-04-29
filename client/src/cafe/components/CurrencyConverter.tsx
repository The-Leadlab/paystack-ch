import React, { useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';

export const CurrencyConverter: React.FC = () => {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState('EUR');
  const [result, setResult] = useState<string | null>(null);

  // Approximate rates for demo/estimation purposes
  const rates: Record<string, number> = {
    'EUR': 0.94,
    'USD': 0.88,
    'GBP': 1.12,
    'JPY': 0.006,
    'CAD': 0.65
  };

  const handleConvert = () => {
    const val = parseFloat(amount);
    if (!isNaN(val)) {
      const rate = rates[currency];
      setResult((val * rate).toFixed(2));
    } else {
      setResult(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice h-full flex flex-col">
      <div className="flex items-center mb-6 text-ypsom-deep border-b border-ypsom-alice pb-2">
        <Calculator className="w-4 h-4 mr-2" />
        <h3 className="font-bold text-sm uppercase tracking-wider">Currency Tool</h3>
      </div>
      
      <div className="space-y-4 flex-grow">
        <div>
          <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-1">Amount</label>
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-ypsom-alice rounded-sm focus:outline-none focus:ring-1 focus:ring-ypsom-deep text-ypsom-shadow font-mono text-sm"
            placeholder="0.00"
          />
        </div>
        
        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
          <div>
            <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-1">From</label>
            <select 
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setResult(null); }}
              className="w-full px-2 py-2 border border-ypsom-alice rounded-sm focus:outline-none focus:ring-1 focus:ring-ypsom-deep text-ypsom-shadow text-sm bg-white"
            >
              {Object.keys(rates).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="pb-3 text-ypsom-slate/50">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div>
             <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-1">To</label>
             <div className="w-full px-2 py-2 bg-gray-50 border border-ypsom-alice rounded-sm text-ypsom-slate text-sm font-medium">
               CHF
             </div>
          </div>
        </div>

        <button 
          onClick={handleConvert}
          className="w-full mt-2 bg-ypsom-deep text-white py-2 rounded-sm text-sm font-medium hover:bg-ypsom-shadow transition-colors shadow-sm"
        >
          Calculate
        </button>

        {result && (
          <div className="mt-4 p-4 bg-ypsom-alice/20 border border-ypsom-alice rounded-sm text-center animate-in fade-in slide-in-from-top-2">
             <p className="text-[10px] text-ypsom-slate uppercase tracking-wider mb-1">Estimated Value</p>
             <p className="text-2xl font-bold text-ypsom-deep font-mono">{result} <span className="text-sm font-normal text-ypsom-slate">CHF</span></p>
          </div>
        )}
      </div>
    </div>
  );
};
