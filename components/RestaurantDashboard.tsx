import React, { useState } from 'react';
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, X, LogOut, Menu, Globe } from 'lucide-react';
import { useEmployee } from '../context/EmployeeContext';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function RestaurantDashboard() {
  const { employees, addEmployee, deleteEmployee } = useEmployee();
  const { income, expenses, addIncome, addExpense } = useFinance();
  const { signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayroll = employees.reduce((sum, e) => sum + (e.monthly_salary || 0) + (e.social_contributions || 0), 0);
  const balance = totalIncome - totalExpenses - totalPayroll;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ypsom-deep rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">YP</span>
          </div>
          <span className="font-black text-ypsom-deep text-xs">{t('appName')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
          >
            <Globe className="w-4 h-4 text-ypsom-deep" />
            <span className="text-xs font-bold text-ypsom-deep uppercase">{language === 'en' ? 'FR' : 'EN'}</span>
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <Menu className="w-6 h-6 text-ypsom-deep" />
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop always visible, Mobile overlay */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Desktop Header */}
        <div className="hidden md:block p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-ypsom-deep rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">YP</span>
              </div>
              <span className="font-black text-ypsom-deep text-sm">{t('appName')}</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
              className="p-1.5 hover:bg-gray-100 rounded flex items-center gap-1"
              title={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
            >
              <Globe className="w-4 h-4 text-ypsom-deep" />
              <span className="text-xs font-bold text-ypsom-deep">{language === 'en' ? 'FR' : 'EN'}</span>
            </button>
          </div>
          <button
            onClick={() => setShowAddEmployee(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-ypsom-deep text-white text-xs font-bold uppercase rounded hover:bg-ypsom-deep/90"
          >
            <Plus className="w-4 h-4" /> {t('addEmployee')}
          </button>
        </div>

        {/* Mobile Header in Sidebar */}
        <div className="md:hidden p-4 border-b border-gray-200 flex items-center justify-between">
          <span className="font-black text-ypsom-deep text-sm uppercase">{t('employees')}</span>
          <button onClick={() => setShowSidebar(false)}>
            <X className="w-5 h-5 text-ypsom-slate" />
          </button>
        </div>

        {/* Mobile Add Employee Button */}
        <div className="md:hidden p-4 border-b border-gray-200">
          <button
            onClick={() => {
              setShowAddEmployee(true);
              setShowSidebar(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-ypsom-deep text-white text-xs font-bold uppercase rounded hover:bg-ypsom-deep/90"
          >
            <Plus className="w-4 h-4" /> {t('addEmployee')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-bold uppercase text-ypsom-slate mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> {t('employees')} ({employees.length})
          </h3>
          {employees.length === 0 ? (
            <p className="text-xs text-ypsom-slate/60">{t('noEmployees')}</p>
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
                    <p>{t('salary')}: {emp.monthly_salary?.toFixed(2) || 0} CHF</p>
                    <p>{t('contributions')}: {emp.social_contributions?.toFixed(2) || 0} CHF</p>
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
            <LogOut className="w-4 h-4" /> {t('logout')}
          </button>
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <h1 className="text-xl md:text-2xl font-black text-ypsom-deep uppercase mb-4 md:mb-6">
          {t('financialDashboard')}
        </h1>

        {/* Financial Summary - Responsive Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 md:w-5 h-4 md:h-5 text-green-600" />
              <span className="text-[10px] md:text-xs font-bold uppercase text-ypsom-slate">{t('income')}</span>
            </div>
            <p className="text-lg md:text-2xl font-black text-green-600">{totalIncome.toFixed(0)}</p>
            <p className="text-xs text-ypsom-slate">CHF</p>
          </div>

          <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 md:w-5 h-4 md:h-5 text-red-600" />
              <span className="text-[10px] md:text-xs font-bold uppercase text-ypsom-slate">{t('expenses')}</span>
            </div>
            <p className="text-lg md:text-2xl font-black text-red-600">{totalExpenses.toFixed(0)}</p>
            <p className="text-xs text-ypsom-slate">CHF</p>
          </div>

          <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 md:w-5 h-4 md:h-5 text-orange-600" />
              <span className="text-[10px] md:text-xs font-bold uppercase text-ypsom-slate">{t('payroll')}</span>
            </div>
            <p className="text-lg md:text-2xl font-black text-orange-600">{totalPayroll.toFixed(0)}</p>
            <p className="text-xs text-ypsom-slate">CHF</p>
          </div>

          <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 md:w-5 h-4 md:h-5 text-ypsom-deep" />
              <span className="text-[10px] md:text-xs font-bold uppercase text-ypsom-slate">{t('balance')}</span>
            </div>
            <p className={`text-lg md:text-2xl font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance.toFixed(0)}
            </p>
            <p className="text-xs text-ypsom-slate">CHF</p>
          </div>
        </div>

        {/* Income & Expense Sections - Stack on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Income Section */}
          <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base md:text-lg font-black text-ypsom-deep uppercase">{t('incomeTitle')}</h2>
              <button
                onClick={() => setShowAddIncome(true)}
                className="flex items-center gap-1 px-2 md:px-3 py-1 bg-green-600 text-white text-[10px] md:text-xs font-bold uppercase rounded hover:bg-green-700"
              >
                <Plus className="w-3 h-3" /> {t('addIncome')}
              </button>
            </div>
            <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto">
              {income.length === 0 ? (
                <p className="text-xs text-ypsom-slate/60">{t('noIncome')}</p>
              ) : (
                income.map((item) => (
                  <div key={item.id} className="p-2 md:p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs md:text-sm text-ypsom-deep truncate">{t(item.type)}</p>
                      <p className="text-[10px] md:text-xs text-ypsom-slate">{item.date}</p>
                      {item.description && <p className="text-[10px] md:text-xs text-ypsom-slate mt-1 truncate">{item.description}</p>}
                    </div>
                    <p className="font-black text-sm md:text-base text-green-600 ml-2">{item.amount.toFixed(0)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expense Section */}
          <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base md:text-lg font-black text-ypsom-deep uppercase">{t('expensesTitle')}</h2>
              <button
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-1 px-2 md:px-3 py-1 bg-red-600 text-white text-[10px] md:text-xs font-bold uppercase rounded hover:bg-red-700"
              >
                <Plus className="w-3 h-3" /> {t('addExpense')}
              </button>
            </div>
            <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto">
              {expenses.length === 0 ? (
                <p className="text-xs text-ypsom-slate/60">{t('noExpenses')}</p>
              ) : (
                expenses.map((item) => (
                  <div key={item.id} className="p-2 md:p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs md:text-sm text-ypsom-deep truncate">{t(item.category)}</p>
                      <p className="text-[10px] md:text-xs text-ypsom-slate">{item.date}</p>
                      <p className="text-[10px] md:text-xs text-ypsom-slate mt-1 truncate">{item.description}</p>
                    </div>
                    <p className="font-black text-sm md:text-base text-red-600 ml-2">{item.amount.toFixed(0)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddEmployee && <AddEmployeeModal onClose={() => setShowAddEmployee(false)} onAdd={addEmployee} t={t} />}
      {showAddIncome && <AddIncomeModal onClose={() => setShowAddIncome(false)} onAdd={addIncome} t={t} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onAdd={addExpense} t={t} />}
    </div>
  );
}

function AddEmployeeModal({ onClose, onAdd, t }: { onClose: () => void; onAdd: (name: string, position?: string, salary?: number, contributions?: number) => Promise<any>; t: (key: string) => string }) {
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
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-ypsom-deep uppercase mb-4">{t('addEmployeeTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('position')}</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('monthlySalary')}</label>
            <input
              type="number"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('socialContributions')}</label>
            <input
              type="number"
              step="0.01"
              value={contributions}
              onChange={(e) => setContributions(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-ypsom-deep text-white text-xs font-bold uppercase rounded hover:bg-ypsom-deep/90">
              {t('add')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddIncomeModal({ onClose, onAdd, t }: { onClose: () => void; onAdd: (date: string, type: 'SALES' | 'RESERVATION', amount: number, description?: string) => Promise<any>; t: (key: string) => string }) {
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
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-ypsom-deep uppercase mb-4">{t('addIncomeTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('type')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'SALES' | 'RESERVATION')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="SALES">{t('sales')}</option>
              <option value="RESERVATION">{t('reservation')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('amount')}</label>
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
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700">
              {t('add')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddExpenseModal({ onClose, onAdd, t }: { onClose: () => void; onAdd: (date: string, category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER', amount: number, description: string) => Promise<any>; t: (key: string) => string }) {
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
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-ypsom-deep uppercase mb-4">{t('addExpenseTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="BILLS">{t('bills')}</option>
              <option value="SUPPLIERS">{t('suppliers')}</option>
              <option value="PAYROLL">{t('payrollCategory')}</option>
              <option value="OTHER">{t('other')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('amount')}</label>
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
            <label className="block text-xs font-bold uppercase text-ypsom-slate mb-1">{t('description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700">
              {t('add')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-gray-300 text-xs font-bold uppercase rounded hover:bg-gray-50">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
