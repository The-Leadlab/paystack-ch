import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, X, LogOut, Menu, Globe, Edit2, Trash2, LayoutDashboard, Receipt, BarChart3, FileText, ChevronRight, Download } from 'lucide-react';
import { useEmployee } from '../context/EmployeeContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { usePOS } from '../context/POSContext';
import { DocumentProcessor } from './DocumentProcessor';
import { POSManager } from './POSManager';
import type { FinancialData, ProcessedDocument, POSReading } from '../types';

type Tab = 'dashboard' | 'revenue' | 'reports' | 'documents';

export function RestaurantDashboard() {
  const { employees, addEmployee, deleteEmployee } = useEmployee();
  const { income, expenses, addIncome, addExpense, deleteIncome, deleteExpense } = useFinance();
  const { sessions, currentSession, addSession, deleteSession, renameSession, setCurrentSession, isAllSessionsView, setAllSessionsView } = useSession();
  const { documents, addDocument, updateDocumentData } = useDocuments();
  const { signOut, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Filter data by current session or show all
  const filteredIncome = isAllSessionsView ? income : income.filter(i => i.session_id === currentSession?.id);
  const filteredExpenses = isAllSessionsView ? expenses : expenses.filter(e => e.session_id === currentSession?.id);

  const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
  // Total expenses (all categories)
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  // Payroll is NOT deducted separately - it's already in expenses as PAYROLL category
  const totalPayroll = filteredExpenses.filter(e => e.category === 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
  // Balance: Income - All Expenses (which includes payroll)
  const balance = totalIncome - totalExpenses;

  const handleResetAllData = async () => {
    if (!confirm('⚠️ DANGER: This will permanently delete ALL employees, income, and expenses from the entire database. This cannot be undone. Are you absolutely sure?')) {
      return;
    }
    
    if (!confirm('Last chance! This will delete ALL data. Continue?')) {
      return;
    }

    setIsResetting(true);
    try {
      // Use Firestore batch for faster deletion
      const { writeBatch, collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      if (!db || !user?.uid) {
        throw new Error('Database not available');
      }

      const batch = writeBatch(db);
      let deleteCount = 0;

      // Delete all employees
      const employeesSnap = await getDocs(query(collection(db, 'employees'), where('restaurantId', '==', user.uid)));
      employeesSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Delete all income
      const incomeSnap = await getDocs(query(collection(db, 'income'), where('restaurantId', '==', user.uid)));
      incomeSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Delete all expenses
      const expensesSnap = await getDocs(query(collection(db, 'expenses'), where('restaurantId', '==', user.uid)));
      expensesSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Commit batch
      await batch.commit();
      
      alert(`✅ Successfully deleted ${deleteCount} records!`);
      
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Reset error:', error);
      alert('❌ Error resetting data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddSession = async () => {
    await addSession();
  };

  const handleDeleteSession = async (id: string) => {
    if (confirm('Delete this session? All associated data will remain but won\'t be visible in this session.')) {
      await deleteSession(id);
    }
  };

  const handleDeleteAllSessions = async () => {
    if (confirm('⚠️ WARNING: Delete ALL sessions? This will remove all session records but data will remain in the database.')) {
      if (confirm('Are you absolutely sure? This cannot be undone.')) {
        for (const session of sessions) {
          await deleteSession(session.id);
        }
      }
    }
  };

  const handleRenameSession = async (id: string) => {
    if (renameValue.trim()) {
      await renameSession(id, renameValue.trim());
      setRenamingSessionId(null);
      setRenameValue('');
    }
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingSessionId(id);
    setRenameValue(currentName);
  };

  // Handle extracted document data
  const handleDocumentData = async (data: FinancialData, fileName: string, fileHash?: string) => {
    if (!currentSession) {
      alert('Please select a session first');
      return;
    }

    const date = data.date || new Date().toISOString().split('T')[0];
    const amount = data.amountInCHF || data.totalAmount || 0;
    const docType = data.documentType;
    
    if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
      if (data.lineItems) {
        for (const item of data.lineItems) {
          if (item.type === 'INCOME') {
            await addIncome(date, 'SALES', item.amount, item.description || fileName, currentSession.id);
          } else if (item.type === 'EXPENSE') {
            // For expenses, use the item description which may contain supplier info
            const description = item.description || data.issuer || fileName;
            await addExpense(date, 'OTHER', item.amount, description, currentSession.id);
          }
        }
      }
    } else if (docType === 'Pay Slip') {
      // Create PAYROLL expense entry for the GROSS pay (not net pay)
      const grossPay = data.paySlip?.grossPay || data.totalAmount || 0;
      const employeeName = data.paySlip?.employee?.name || 'Unknown Employee';
      
      if (grossPay > 0) {
        await addExpense(
          date, 
          'PAYROLL', 
          grossPay, 
          `Payslip - ${employeeName}`, 
          currentSession.id
        );
      }
      
      console.log('Payslip processed:', employeeName, 'Gross Pay:', grossPay);
    } else if (amount > 0) {
      const category = data.expenseCategory?.toLowerCase().includes('supplier') ? 'SUPPLIERS' : 
                      data.expenseCategory?.toLowerCase().includes('bill') ? 'BILLS' : 'OTHER';
      // Use issuer (supplier name) as description for proper filtering
      const description = data.issuer || data.notes || fileName;
      await addExpense(date, category as any, amount, description, currentSession.id);
    }
    
    // Save document to Firestore with hash
    try {
      await addDocument({
        id: Math.random().toString(36).substr(2, 9),
        fileName,
        status: 'completed',
        data,
        fileHash,
      });
    } catch (error) {
      console.error('Error saving document:', error);
    }
  };

  return (
    <div className="min-h-screen bg-cdlp-dark flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-cdlp-black border-b border-cdlp-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-px bg-cdlp-gold"></div>
            <h1 className="font-serif text-base font-bold gold-text tracking-wide">CAFÉ DE LA PLACE</h1>
            <div className="w-6 h-px bg-cdlp-gold"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            className="p-2 hover:bg-cdlp-border rounded flex items-center gap-1"
          >
            <Globe className="w-4 h-4 text-cdlp-gold" />
            <span className="text-xs font-bold text-cdlp-gold uppercase">{language === 'en' ? 'FR' : 'EN'}</span>
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-cdlp-border rounded"
          >
            <Menu className="w-6 h-6 text-cdlp-gold" />
          </button>
        </div>
      </div>

      {/* Session Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-cdlp-black border-r border-cdlp-border flex flex-col
        transform transition-transform duration-300 ease-in-out custom-scrollbar
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Desktop Header */}
        <div className="hidden md:block p-4 border-b border-cdlp-border">
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 mb-2 text-cdlp-gold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none" className="w-full h-full">
                <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="3" fill="none"/>
                <circle cx="200" cy="200" r="130" stroke="currentColor" strokeWidth="3" fill="none"/>
                <line x1="140" y1="140" x2="260" y2="260" stroke="currentColor" strokeWidth="3"/>
                <line x1="260" y1="140" x2="140" y2="260" stroke="currentColor" strokeWidth="3"/>
                <text x="170" y="190" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">C</text>
                <text x="220" y="190" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">D</text>
                <text x="170" y="240" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">L</text>
                <text x="220" y="240" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="300" fill="currentColor" letterSpacing="8">P</text>
                <path id="topArc" d="M 60,200 A 140,140 0 0,1 340,200" fill="none"/>
                <text fontFamily="Arial, sans-serif" fontSize="28" fontWeight="300" fill="currentColor" letterSpacing="6">
                  <textPath href="#topArc" startOffset="50%" textAnchor="middle">
                    CAFÉ DE LA PLACE
                  </textPath>
                </text>
                <path id="bottomArc" d="M 340,200 A 140,140 0 0,1 60,200" fill="none"/>
                <text fontFamily="Arial, sans-serif" fontSize="24" fontWeight="300" fill="currentColor" letterSpacing="4">
                  <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
                    BISTROT GENÈVE
                  </textPath>
                </text>
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-cdlp-muted">{user?.email}</span>
            <button
              onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
              className="p-1.5 hover:bg-cdlp-border rounded flex items-center gap-1"
            >
              <Globe className="w-3 h-3 text-cdlp-gold" />
              <span className="text-[10px] font-bold text-cdlp-gold">{language === 'en' ? 'FR' : 'EN'}</span>
            </button>
          </div>
          <button
            onClick={handleAddSession}
            className="w-full flex items-center justify-center gap-2 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
          >
            <Plus className="w-4 h-4" /> {t('newSession')}
          </button>
        </div>

        {/* Mobile Header in Sidebar */}
        <div className="md:hidden p-4 border-b border-cdlp-border flex items-center justify-between">
          <span className="font-bold text-cdlp-gold text-sm uppercase">Sessions</span>
          <button onClick={() => setShowSidebar(false)}>
            <X className="w-5 h-5 text-cdlp-muted" />
          </button>
        </div>

        {/* Mobile Add Session Button */}
        <div className="md:hidden p-4 border-b border-cdlp-border">
          <button
            onClick={() => {
              handleAddSession();
              setShowSidebar(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase text-cdlp-muted">
              {t('sessions')} ({sessions.length})
            </h3>
            {sessions.length > 0 && (
              <button
                onClick={handleDeleteAllSessions}
                className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold"
                title="Delete all sessions"
              >
                {t('clearAll')}
              </button>
            )}
          </div>
          
          {/* All Sessions View Button */}
          <button
            onClick={() => {
              setAllSessionsView(true);
              setCurrentSession(null);
              setShowSidebar(false);
            }}
            className={`w-full p-3 mb-2 rounded border transition-colors ${
              isAllSessionsView
                ? 'bg-cdlp-gold/10 border-cdlp-gold text-cdlp-gold'
                : 'bg-cdlp-card border-cdlp-border text-white hover:border-cdlp-gold/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{t('allSessions')}</span>
              {isAllSessionsView && <X className="w-4 h-4" onClick={(e) => { e.stopPropagation(); setAllSessionsView(false); setCurrentSession(sessions[0] || null); }} />}
            </div>
          </button>

          {sessions.length === 0 ? (
            <p className="text-xs text-cdlp-muted/60">No sessions yet</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    currentSession?.id === session.id && !isAllSessionsView
                      ? 'bg-cdlp-gold/10 border-cdlp-gold'
                      : 'bg-cdlp-card border-cdlp-border hover:border-cdlp-gold/50'
                  }`}
                  onClick={() => {
                    setCurrentSession(session);
                    setShowSidebar(false);
                  }}
                >
                  {renamingSessionId === session.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSession(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSession(session.id);
                        if (e.key === 'Escape') { setRenamingSessionId(null); setRenameValue(''); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full bg-cdlp-dark border border-cdlp-gold rounded px-2 py-1 text-xs text-white"
                    />
                  ) : (
                    <div className="flex items-start justify-between">
                      <p className="font-bold text-sm text-white flex-1">{session.name}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(session.id, session.name); }}
                          className="text-cdlp-muted hover:text-cdlp-gold"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                          className="text-cdlp-muted hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-cdlp-border space-y-2">
          <button
            onClick={handleResetAllData}
            disabled={isResetting}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase bg-red-600/10 border border-red-600 text-red-400 rounded hover:bg-red-600/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> {isResetting ? 'Resetting...' : t('resetAllData')}
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase text-cdlp-muted hover:text-cdlp-gold"
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Navigation */}
        <div className="bg-cdlp-black border-b border-cdlp-border px-4 md:px-8 pt-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-t transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-cdlp-dark text-cdlp-gold border-t-2 border-cdlp-gold'
                  : 'text-cdlp-muted hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> {t('dashboard')}
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-t transition-colors ${
                activeTab === 'revenue'
                  ? 'bg-cdlp-dark text-cdlp-gold border-t-2 border-cdlp-gold'
                  : 'text-cdlp-muted hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" /> {t('revenue')}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-t transition-colors ${
                activeTab === 'reports'
                  ? 'bg-cdlp-dark text-cdlp-gold border-t-2 border-cdlp-gold'
                  : 'text-cdlp-muted hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> {t('reports')}
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-t transition-colors ${
                activeTab === 'documents'
                  ? 'bg-cdlp-dark text-cdlp-gold border-t-2 border-cdlp-gold'
                  : 'text-cdlp-muted hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" /> {t('documents')}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {/* Reset View Button for All Sessions */}
          {isAllSessionsView && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => {
                  setAllSessionsView(false);
                  setCurrentSession(sessions[0] || null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold uppercase rounded hover:bg-red-600/20"
              >
                <X className="w-4 h-4" /> {t('resetView')}
              </button>
            </div>
          )}
          
          {activeTab === 'dashboard' && (
            <DashboardTab
              currentSession={currentSession}
              isAllSessionsView={isAllSessionsView}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalPayroll={totalPayroll}
              balance={balance}
              filteredIncome={filteredIncome}
              filteredExpenses={filteredExpenses}
              onAddIncome={() => setShowAddIncome(true)}
              onAddExpense={() => setShowAddExpense(true)}
              onDocumentData={handleDocumentData}
              language={language}
              documents={documents}
              updateDocument={updateDocumentData}
              t={t}
              user={user}
            />
          )}
          {activeTab === 'revenue' && <POSManager />}
          {activeTab === 'reports' && <ReportsPlaceholder />}
          {activeTab === 'documents' && <DocumentsTab />}
        </div>
      </div>

      {/* Modals */}
      {showAddEmployee && <AddEmployeeModal onClose={() => setShowAddEmployee(false)} onAdd={addEmployee} t={t} />}
      {showAddIncome && <AddIncomeModal onClose={() => setShowAddIncome(false)} onAdd={(date, type, amount, desc) => addIncome(date, type, amount, desc, currentSession?.id || '')} t={t} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onAdd={(date, cat, amount, desc) => addExpense(date, cat, amount, desc, currentSession?.id || '')} t={t} />}
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ currentSession, isAllSessionsView, totalIncome, totalExpenses, totalPayroll, balance, filteredIncome, filteredExpenses, onAddIncome, onAddExpense, onDocumentData, language, documents, updateDocument, t, user }: any) {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleResetData = async () => {
    if (!currentSession) {
      alert('No session selected');
      return;
    }
    
    if (!confirm('⚠️ WARNING: This will delete ALL income and expense entries in the current session. This action cannot be undone. Are you sure?')) {
      setShowResetConfirm(false);
      return;
    }
    
    try {
      const { writeBatch, collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      if (!db || !user?.uid) {
        throw new Error('Database not available');
      }

      const batch = writeBatch(db);
      let deleteCount = 0;

      // Delete all income for this session
      const incomeSnap = await getDocs(
        query(
          collection(db, 'income'), 
          where('restaurantId', '==', user.uid),
          where('session_id', '==', currentSession.id)
        )
      );
      incomeSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Delete all expenses for this session
      const expensesSnap = await getDocs(
        query(
          collection(db, 'expenses'), 
          where('restaurantId', '==', user.uid),
          where('session_id', '==', currentSession.id)
        )
      );
      expensesSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Commit batch
      await batch.commit();
      
      alert(`✅ Successfully deleted ${deleteCount} records from session "${currentSession.name}"!`);
      setShowResetConfirm(false);
      
      // Refresh page to update UI
      window.location.reload();
    } catch (error) {
      console.error('Reset error:', error);
      alert('❌ Error resetting session data: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setShowResetConfirm(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">
          {isAllSessionsView ? 'All Sessions' : currentSession?.name || 'Dashboard'}
        </h1>
        {currentSession && !isAllSessionsView && (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold uppercase rounded hover:bg-red-600/20"
          >
            <Trash2 className="w-3 h-3" /> Reset Data
          </button>
        )}
      </div>

      {showResetConfirm && (
        <div className="mb-6 bg-red-600/10 border border-red-600 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-400 mb-1">Reset Session Data?</h3>
              <p className="text-xs text-red-300 mb-3">This will permanently delete all income and expense entries in this session. Documents and employees will not be affected.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetData}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700"
                >
                  Yes, Reset Data
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-cdlp-card border border-cdlp-border text-white text-xs font-bold uppercase rounded hover:bg-cdlp-border/50"
                >
                  Cancel
                </button>
              </div>
            </div>
            <button onClick={() => setShowResetConfirm(false)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('income')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-emerald-500">{totalIncome.toFixed(0)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 md:w-5 h-4 md:h-5 text-red-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('expenses')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-red-500">{totalExpenses.toFixed(0)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 md:w-5 h-4 md:h-5 text-cdlp-gold" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('payroll')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-cdlp-gold">{totalPayroll.toFixed(0)}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 md:w-5 h-4 md:h-5 text-cdlp-gold" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('balance')}</span>
          </div>
          <p className={`text-lg md:text-2xl font-black ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {balance.toFixed(0)}
          </p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>
      </div>

      {/* Document Upload Section */}
      {!currentSession && !isAllSessionsView && (
        <div className="mb-6 bg-cdlp-gold/10 border border-cdlp-gold rounded-lg p-4">
          <p className="text-sm text-cdlp-gold">⚠️ Please create or select a session to upload documents</p>
        </div>
      )}
      {currentSession && (
        <div className="mb-6">
          <DocumentProcessor 
            documents={documents}
            updateDocument={updateDocument}
            onDataExtracted={onDocumentData}
          />
        </div>
      )}

      {/* Income & Expense Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Income Section */}
        <div className="bg-cdlp-black border border-cdlp-border p-4 md:p-6 rounded-lg shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-black text-cdlp-gold uppercase">{t('income')}</h2>
            {currentSession && (
              <button
                onClick={onAddIncome}
                className="flex items-center gap-1 px-2 md:px-3 py-1 bg-emerald-600 text-white text-[10px] md:text-xs font-bold uppercase rounded hover:bg-emerald-700"
              >
                <Plus className="w-3 h-3" /> {t('add')}
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto custom-scrollbar">
            {filteredIncome.length === 0 ? (
              <p className="text-xs text-cdlp-muted/60">No income entries</p>
            ) : (
              filteredIncome.map((item: any) => (
                <div key={item.id} className="p-2 md:p-3 bg-cdlp-card border border-cdlp-border rounded flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs md:text-sm text-white truncate">{item.type}</p>
                    <p className="text-[10px] md:text-xs text-cdlp-muted">{item.date}</p>
                    {item.description && <p className="text-[10px] md:text-xs text-cdlp-muted mt-1 truncate">{item.description}</p>}
                  </div>
                  <p className="font-black text-sm md:text-base text-emerald-500 ml-2">{item.amount.toFixed(0)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expense Section */}
        <div className="bg-cdlp-black border border-cdlp-border p-4 md:p-6 rounded-lg shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-black text-cdlp-gold uppercase">{t('expenses')}</h2>
            {currentSession && (
              <button
                onClick={onAddExpense}
                className="flex items-center gap-1 px-2 md:px-3 py-1 bg-red-600 text-white text-[10px] md:text-xs font-bold uppercase rounded hover:bg-red-700"
              >
                <Plus className="w-3 h-3" /> {t('add')}
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto custom-scrollbar">
            {filteredExpenses.length === 0 ? (
              <p className="text-xs text-cdlp-muted/60">No expense entries</p>
            ) : (
              filteredExpenses.map((item: any) => (
                <div key={item.id} className="p-2 md:p-3 bg-cdlp-card border border-cdlp-border rounded flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs md:text-sm text-white truncate">{item.category}</p>
                    <p className="text-[10px] md:text-xs text-cdlp-muted">{item.date}</p>
                    <p className="text-[10px] md:text-xs text-cdlp-muted mt-1 truncate">{item.description}</p>
                  </div>
                  <p className="font-black text-sm md:text-base text-red-500 ml-2">{item.amount.toFixed(0)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Revenue Tab Component - Full POS/Z-Reading Management
// Reports Tab Component - Full Implementation
function ReportsPlaceholder() {
  const { income, expenses } = useFinance();
  const { currentSession, isAllSessionsView } = useSession();
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [filterActive, setFilterActive] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [supplierFilter, setSupplierFilter] = React.useState<string>('all');

  // Filter data by current session
  const filteredIncome = isAllSessionsView ? income : income.filter(i => i.session_id === currentSession?.id);
  const filteredExpenses = isAllSessionsView ? expenses : expenses.filter(e => e.session_id === currentSession?.id);

  // Apply date filter
  const dateFilteredIncome = dateFrom && dateTo 
    ? filteredIncome.filter(i => i.date >= dateFrom && i.date <= dateTo)
    : filteredIncome;
  
  let dateFilteredExpenses = dateFrom && dateTo
    ? filteredExpenses.filter(e => e.date >= dateFrom && e.date <= dateTo)
    : filteredExpenses;
  
  // Apply category filter
  if (categoryFilter !== 'all') {
    dateFilteredExpenses = dateFilteredExpenses.filter(e => e.category === categoryFilter);
  }
  
  // Apply supplier filter (description contains supplier name)
  if (supplierFilter !== 'all') {
    dateFilteredExpenses = dateFilteredExpenses.filter(e => e.description === supplierFilter);
  }

  // Group by month
  const monthlyData = React.useMemo(() => {
    const months: Record<string, { income: number; expenses: number; balance: number }> = {};
    
    dateFilteredIncome.forEach(item => {
      const month = item.date.substring(0, 7); // YYYY-MM
      if (!months[month]) months[month] = { income: 0, expenses: 0, balance: 0 };
      months[month].income += item.amount;
    });
    
    dateFilteredExpenses.forEach(item => {
      const month = item.date.substring(0, 7);
      if (!months[month]) months[month] = { income: 0, expenses: 0, balance: 0 };
      months[month].expenses += item.amount;
    });
    
    Object.keys(months).forEach(month => {
      months[month].balance = months[month].income - months[month].expenses;
    });
    
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
  }, [dateFilteredIncome, dateFilteredExpenses]);

  // Group expenses by supplier
  const supplierData = React.useMemo(() => {
    const suppliers: Record<string, number> = {};
    
    dateFilteredExpenses
      .filter(e => e.category === 'SUPPLIERS')
      .forEach(item => {
        const supplier = item.description || 'Unknown';
        suppliers[supplier] = (suppliers[supplier] || 0) + item.amount;
      });
    
    return Object.entries(suppliers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 suppliers
  }, [dateFilteredExpenses]);
  
  // Get unique categories and suppliers for filters
  const uniqueCategories = React.useMemo(() => {
    const cats = new Set(filteredExpenses.map(e => e.category));
    return Array.from(cats).sort();
  }, [filteredExpenses]);
  
  const uniqueSuppliers = React.useMemo(() => {
    const suppliers = new Set(
      filteredExpenses
        .filter(e => e.description && e.description.trim() !== '' && !e.description.startsWith('Payslip'))
        .map(e => e.description)
    );
    return Array.from(suppliers).sort();
  }, [filteredExpenses]);

  const setQuickFilter = (type: string) => {
    const today = new Date();
    let from = new Date();
    
    switch(type) {
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        setDateTo(new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]);
        break;
      case 'last3Months':
        from = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        break;
      case 'thisYear':
        from = new Date(today.getFullYear(), 0, 1);
        break;
    }
    
    setDateFrom(from.toISOString().split('T')[0]);
    if (type !== 'lastMonth') {
      setDateTo(today.toISOString().split('T')[0]);
    }
    setFilterActive(true);
  };

  const clearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setFilterActive(false);
    setCategoryFilter('all');
    setSupplierFilter('all');
  };
  
  const handleExport = async (format: 'csv' | 'pdf') => {
    const { exportToCSV, exportToPDF } = await import('../services/reportExportService');
    
    const reportData = {
      income: dateFilteredIncome,
      expenses: dateFilteredExpenses,
      monthlyData,
      supplierData,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sessionName: isAllSessionsView ? 'All Sessions' : currentSession?.name
    };
    
    if (format === 'csv') {
      exportToCSV(reportData);
    } else {
      await exportToPDF(reportData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Date Range Filter</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Category Filter</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">Supplier Filter</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
              disabled={uniqueSuppliers.length === 0}
            >
              <option value="all">All Suppliers</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setQuickFilter('thisMonth')} className="px-3 py-1.5 bg-cdlp-card border border-cdlp-border text-white text-xs font-bold uppercase rounded hover:border-cdlp-gold">
            This Month
          </button>
          <button onClick={() => setQuickFilter('lastMonth')} className="px-3 py-1.5 bg-cdlp-card border border-cdlp-border text-white text-xs font-bold uppercase rounded hover:border-cdlp-gold">
            Last Month
          </button>
          <button onClick={() => setQuickFilter('last3Months')} className="px-3 py-1.5 bg-cdlp-card border border-cdlp-border text-white text-xs font-bold uppercase rounded hover:border-cdlp-gold">
            Last 3 Months
          </button>
          <button onClick={() => setQuickFilter('thisYear')} className="px-3 py-1.5 bg-cdlp-card border border-cdlp-border text-white text-xs font-bold uppercase rounded hover:border-cdlp-gold">
            This Year
          </button>
          <button onClick={clearFilter} className="px-3 py-1.5 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold uppercase rounded hover:bg-red-600/20">
            Clear All
          </button>
        </div>
        {(filterActive || categoryFilter !== 'all' || supplierFilter !== 'all') && (
          <div className="text-xs text-cdlp-gold flex flex-wrap gap-2">
            {filterActive && dateFrom && dateTo && <span>📅 Date: {dateFrom} → {dateTo}</span>}
            {categoryFilter !== 'all' && <span>📂 Category: {categoryFilter}</span>}
            {supplierFilter !== 'all' && <span>🏢 Supplier: {supplierFilter}</span>}
          </div>
        )}
      </div>

      {/* Download Section */}
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-cdlp-gold uppercase mb-1">Export Report</h3>
            <p className="text-xs text-cdlp-muted">Download filtered data in your preferred format</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light transition-colors"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-4 py-2 bg-cdlp-card border border-cdlp-gold text-cdlp-gold text-xs font-bold uppercase rounded hover:bg-cdlp-gold/10 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Analysis */}
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-cdlp-gold" />
          <h2 className="text-sm md:text-base font-black text-cdlp-gold uppercase">Monthly Revenue Analysis</h2>
        </div>
        {monthlyData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-cdlp-muted text-sm">No data available</p>
            <p className="text-cdlp-muted/70 text-xs mt-2">Add income and expenses to see monthly breakdown</p>
          </div>
        ) : (
          <div className="space-y-3">
            {monthlyData.map(([month, data]) => {
              const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
              return (
                <div key={month} className="bg-cdlp-card border border-cdlp-border rounded p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-cdlp-gold uppercase">{monthName}</h3>
                    <span className={`text-lg font-black ${data.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {data.balance.toFixed(2)} CHF
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Income</p>
                      <p className="font-bold text-emerald-500">{data.income.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Expenses</p>
                      <p className="font-bold text-red-500">{data.expenses.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Balance</p>
                      <p className={`font-bold ${data.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {data.balance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supplier Analysis */}
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-cdlp-gold" />
          <h2 className="text-sm md:text-base font-black text-cdlp-gold uppercase">Top Suppliers</h2>
        </div>
        {supplierData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-cdlp-muted text-sm">No supplier expenses recorded</p>
            <p className="text-cdlp-muted/70 text-xs mt-2">Upload supplier invoices to see spending analysis</p>
          </div>
        ) : (
          <div className="space-y-2">
            {supplierData.map(([supplier, amount]) => (
              <div key={supplier} className="flex justify-between items-center p-3 bg-cdlp-card border border-cdlp-border rounded">
                <span className="text-sm font-bold text-white truncate flex-1">{supplier}</span>
                <span className="text-sm font-black text-cdlp-gold ml-4">{amount.toFixed(2)} CHF</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsTab() {
  const { documents } = useDocuments();
  const [filter, setFilter] = useState<'all' | 'suppliers' | 'employees' | 'pos'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  // Group documents by entity (supplier or employee)
  const groupedDocs = useMemo(() => {
    const suppliers: Record<string, ProcessedDocument[]> = {};
    const employees: Record<string, ProcessedDocument[]> = {};
    const posReports: ProcessedDocument[] = [];
    const other: ProcessedDocument[] = [];

    documents.forEach(doc => {
      if (!doc.data) {
        other.push(doc);
        return;
      }

      const docType = doc.data.documentType;
      
      if (docType === 'Pay Slip') {
        const employeeName = doc.data.paySlip?.employee?.name || 'Unknown Employee';
        if (!employees[employeeName]) employees[employeeName] = [];
        employees[employeeName].push(doc);
      } else if (docType === 'Ticket/Receipt' || docType === 'Z2 Multi-Ticket Sheet' || docType === 'Bank Deposit') {
        // POS reports include: Tickets/Receipts, Z2 reports, and Bank Deposits
        posReports.push(doc);
      } else {
        const supplierName = doc.data.issuer || 'Unknown Supplier';
        if (!suppliers[supplierName]) suppliers[supplierName] = [];
        suppliers[supplierName].push(doc);
      }
    });

    return { suppliers, employees, posReports, other };
  }, [documents]);

  const filteredEntities = useMemo(() => {
    if (filter === 'suppliers') return Object.entries(groupedDocs.suppliers);
    if (filter === 'employees') return Object.entries(groupedDocs.employees);
    if (filter === 'pos') return [['POS Reports', groupedDocs.posReports]];
    
    // All documents
    return [
      ...Object.entries(groupedDocs.suppliers),
      ...Object.entries(groupedDocs.employees),
      ...(groupedDocs.posReports.length > 0 ? [['POS Reports', groupedDocs.posReports]] : [])
    ];
  }, [filter, groupedDocs]);

  // Group documents by month within an entity
  const groupByMonth = (docs: ProcessedDocument[]) => {
    const byMonth: Record<string, ProcessedDocument[]> = {};
    docs.forEach(doc => {
      if (!doc.data?.date) return;
      const monthKey = doc.data.date.substring(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(doc);
    });
    return Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  };

  if (selectedEntity) {
    const entityDocs = filter === 'suppliers' 
      ? groupedDocs.suppliers[selectedEntity] 
      : filter === 'employees'
      ? groupedDocs.employees[selectedEntity]
      : groupedDocs.posReports;
    
    const monthlyGroups = groupByMonth(entityDocs || []);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedEntity(null)}
            className="flex items-center gap-2 text-cdlp-gold hover:text-cdlp-gold-light text-sm font-bold uppercase"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back
          </button>
          <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">{selectedEntity}</h1>
        </div>

        {monthlyGroups.map(([month, docs]) => {
          const totalAmount = docs.reduce((sum, d) => sum + (d.data?.totalAmount || 0), 0);
          const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

          return (
            <div key={month} className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card overflow-hidden">
              <div className="bg-cdlp-card border-b border-cdlp-border p-4 flex justify-between items-center">
                <h3 className="text-sm font-bold text-cdlp-gold uppercase">{monthName}</h3>
                <div className="text-right">
                  <p className="text-xs text-cdlp-muted uppercase">Total</p>
                  <p className="text-lg font-black text-white">{totalAmount.toFixed(2)} CHF</p>
                </div>
              </div>
              <div className="divide-y divide-cdlp-border">
                {docs.map(doc => (
                  <div key={doc.id} className="p-4 hover:bg-cdlp-card transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-white text-sm">{doc.fileName}</p>
                        <p className="text-xs text-cdlp-muted mt-1">{doc.data?.date}</p>
                        {doc.data?.notes && (
                          <p className="text-xs text-cdlp-muted mt-1">{doc.data.notes}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-black text-white text-base">{(doc.data?.totalAmount || 0).toFixed(2)}</p>
                        <p className="text-xs text-cdlp-muted">{doc.data?.originalCurrency || 'CHF'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">Document Library</h1>
      </div>

      {/* Filter Options */}
      <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${
              filter === 'all'
                ? 'bg-cdlp-gold text-cdlp-black'
                : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
            }`}
          >
            All Documents
          </button>
          <button
            onClick={() => setFilter('suppliers')}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${
              filter === 'suppliers'
                ? 'bg-cdlp-gold text-cdlp-black'
                : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
            }`}
          >
            Suppliers ({Object.keys(groupedDocs.suppliers).length})
          </button>
          <button
            onClick={() => setFilter('employees')}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${
              filter === 'employees'
                ? 'bg-cdlp-gold text-cdlp-black'
                : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
            }`}
          >
            Employees ({Object.keys(groupedDocs.employees).length})
          </button>
          <button
            onClick={() => setFilter('pos')}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${
              filter === 'pos'
                ? 'bg-cdlp-gold text-cdlp-black'
                : 'bg-cdlp-card border border-cdlp-border text-white hover:border-cdlp-gold'
            }`}
          >
            POS Reports ({groupedDocs.posReports.length})
          </button>
        </div>
      </div>

      {/* Entity Cards */}
      {filteredEntities.length === 0 ? (
        <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-12 text-center">
          <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">No Documents Yet</h3>
          <p className="text-cdlp-muted text-sm mb-4">Upload documents in the Dashboard tab to see them organized here</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
            <div className="bg-cdlp-card border border-cdlp-border rounded p-4">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">Supplier Documents</h4>
              <p className="text-[10px] text-cdlp-muted">Invoices and receipts organized by supplier with monthly grouping</p>
            </div>
            <div className="bg-cdlp-card border border-cdlp-border rounded p-4">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">Employee Documents</h4>
              <p className="text-[10px] text-cdlp-muted">Payslips with Swiss social security contributions breakdown</p>
            </div>
            <div className="bg-cdlp-card border border-cdlp-border rounded p-4">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">POS Reports</h4>
              <p className="text-[10px] text-cdlp-muted">Z-readings with revenue, payment methods, and tips tracking</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map(([entityName, docs]) => {
            const totalAmount = docs.reduce((sum, d) => sum + (d.data?.totalAmount || 0), 0);
            const docCount = docs.length;
            const isEmployee = filter === 'employees' || groupedDocs.employees[entityName];

            return (
              <button
                key={entityName}
                onClick={() => setSelectedEntity(entityName)}
                className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-6 hover:border-cdlp-gold transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-base mb-1 group-hover:text-cdlp-gold transition-colors">
                      {entityName}
                    </h3>
                    <p className="text-xs text-cdlp-muted uppercase">
                      {isEmployee ? 'Employee' : 'Supplier'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-cdlp-muted group-hover:text-cdlp-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">Documents</span>
                    <span className="text-sm font-bold text-white">{docCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">Total Amount</span>
                    <span className="text-lg font-black text-cdlp-gold">{totalAmount.toFixed(2)} CHF</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Modal Components
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
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-cdlp-black border border-cdlp-border rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">Add Employee</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Position</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Monthly Salary</label>
            <input
              type="number"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Social Contributions</label>
            <input
              type="number"
              step="0.01"
              value={contributions}
              onChange={(e) => setContributions(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light">
              Add
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
              Cancel
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
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-cdlp-black border border-cdlp-border rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">Add Income</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'SALES' | 'RESERVATION')}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            >
              <option value="SALES">Sales</option>
              <option value="RESERVATION">Reservation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700">
              Add
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
              Cancel
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
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-cdlp-black border border-cdlp-border rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">Add Expense</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            >
              <option value="BILLS">Bills</option>
              <option value="SUPPLIERS">Suppliers</option>
              <option value="PAYROLL">Payroll</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700">
              Add
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
