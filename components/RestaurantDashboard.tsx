import React, { useState } from 'react';
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, X, LogOut } from 'lucide-react';
import { useEmployee } from '../context/EmployeeContext';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';

export function RestaurantDashboard() {
  const { employees, addEmployee, deleteEmployee } = useEmployee();
  const { income, expenses, addIncome, addExpense } = useFinance();
  const { signOut } = useAuth();
  
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayroll = employees.reduce((sum, e) => sum + (e.monthly_salary || 0) + (e.social_contributions || 0), 0);
  const balance = totalIncome - totalExpenses - totalPayroll;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Employee List */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-ypsom-deep rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">YP</span>
            </div>
            <span className="font-black text-ypsom-deep text-sm">CAFE DE LA PLACE</span>
          </div>
          <button
            onClick={() => setShowAddEmployee(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-ypsom-deep text-white text-xs font-bold uppercase rounded hover:bg-ypsom-deep/90"
          >
            <Plus className="w-4 h-4" /> Employé
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-bold uppercase text-ypsom-slate mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Employés ({employees.length})
          </h3>
          {employees.length === 0 ? (
            <p className="text-xs text-ypsom-slate/60">Aucun employé</p>
          ) : (
            <div className="space-y-2">
              {employees.map((emp) => (
                <div key={emp.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-bold text-sm text-ypsom-deep">{emp.name}</p>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {emp.position && <p className="text-xs text-ypsom-slate">{emp.position}</p>}
                  <div className="mt-2 text-xs space-y-1">
                    <p>Salaire: {emp.monthly_salary?.toFixed(2) || 0} CHF</p>
                    <p>Cotisations: {emp.social_contributions?.toFixed(2) || 0} CHF</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase text-ypsom-slate hover:text-ypsom-deep"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-black text-ypsom-deep uppercase mb-6">Tableau de bord financier</h1>

        {/* Financial Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-xs font-bold uppercase text-ypsom-slate">Revenus</span>
            </div>
            <p className="text-2xl font-black text-green-600">{totalIncome.toFixed(2)} CHF</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-xs font-bold uppercase text-ypsom-slate">Dépenses</span>
            </div>
            <p className="text-2xl font-black text-red-600">{totalExpenses.toFixed(2)} CHF</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-orange-600" />
              <span className="text-xs font-bold uppercase text-ypsom-slate">Salaires</span>
            </div>
            <p className="text-2xl font-black text-orange-600">{totalPayroll.toFixed(2)} CHF</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-ypsom-deep" />
              <span className="text-xs font-bold uppercase text-ypsom-slate">Solde</span>
            </div>
            <p className={`text-2xl font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance.toFixed(2)} CHF
            </p>
          </div>
        </div>

        {/* Income & Expense Sections */}
        <div className="grid grid-cols-2 gap-6">
          {/* Income Section */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-ypsom-deep uppercase">Revenus</h2>
              <button
                onClick={() => setShowAddIncome(true)}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700"
              >
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {income.length === 0 ? (
                <p className="text-xs text-ypsom-slate/60">Aucun revenu enregistré</p>
              ) : (
                income.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-ypsom-deep">{item.type}</p>
                      <p className="text-xs text-ypsom-slate">{item.date}</p>
                      {item.description && <p className="text-xs text-ypsom-slate mt-1">{item.description}</p>}
                    </div>
                    <p className="font-black text-green-600">{item.amount.toFixed(2)} CHF</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expense Section */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-ypsom-deep uppercase">Dépenses</h2>
              <button
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700"
              >
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenses.length === 0 ? (
                <p className="text-xs text-ypsom-slate/60">Aucune dépense enregistrée</p>
              ) : (
                expenses.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-ypsom-deep">{item.category}</p>
                      <p className="text-xs text-ypsom-slate">{item.date}</p>
                      <p className="text-xs text-ypsom-slate mt-1">{item.description}</p>
                    </div>
                    <p className="font-black text-red-600">{item.amount.toFixed(2)} CHF</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddEmployee && <AddEmployeeModal onClose={() => setShowAddEmployee(false)} onAdd={addEmployee} />}
      {showAddIncome && <AddIncomeModal onClose={() => setShowAddIncome(false)} onAdd={addIncome} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onAdd={addExpense} />}
    </div>
  );
}

function AddEmployeeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, position?: string, salary?: number, contributions?: number) => Promise<any> }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [contributions, setContributions] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(name, position, parseFloat(salary) || 0, parseFloat(contributions) || 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-black text-ypsom-deep uppercase mb-4">Ajouter un employé</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Poste</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Salaire mensuel (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Cotisations sociales (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={contributions}
              onChange={(e) => setContributions(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-ypsom-deep text-white text-xs font-bold uppercase rounded hover:bg-ypsom-deep/90">
              Ajouter
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddIncomeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (date: string, type: 'SALES' | 'RESERVATION', amount: number, description?: string) => Promise<any> }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'SALES' | 'RESERVATION'>('SALES');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(date, type, parseFloat(amount), description);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-black text-ypsom-deep uppercase mb-4">Ajouter un revenu</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'SALES' | 'RESERVATION')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="SALES">Ventes</option>
              <option value="RESERVATION">Réservations</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Montant (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700">
              Ajouter
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddExpenseModal({ onClose, onAdd }: { onClose: () => void; onAdd: (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string) => Promise<any> }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER'>('BILLS');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd(date, category, parseFloat(amount), description);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-black text-ypsom-deep uppercase mb-4">Ajouter une dépense</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="BILLS">Factures (électricité, loyer...)</option>
              <option value="SUPPLIERS">Fournisseurs</option>
              <option value="PAYROLL">Salaires</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Montant (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700">
              Ajouter
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
