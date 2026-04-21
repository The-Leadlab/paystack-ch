import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, X, LogOut, Menu, Globe, Edit2, Trash2, LayoutDashboard, Receipt, BarChart3, FileText, ChevronRight, Download, Check, ExternalLink } from 'lucide-react';
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
import { openDocumentInNewTab } from '../lib/openDocumentInNewTab';

type Tab = 'dashboard' | 'revenue' | 'reports' | 'documents';

export function RestaurantDashboard() {
  const { employees, addEmployee, deleteEmployee } = useEmployee();
  const { income, expenses, addIncome, addExpense, updateIncome, updateExpense, deleteIncome, deleteExpense } = useFinance();
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
  const [showMasterReset, setShowMasterReset] = useState(false);
  const [selectedDocumentFromFinance, setSelectedDocumentFromFinance] = useState<ProcessedDocument | null>(null);
  const [showEmployeePanel, setShowEmployeePanel] = useState(false);

  // Filter data by current session or show all
  // For "All Sessions" view, only show data from existing sessions (not orphaned data)
  const existingSessionIds = sessions.map(s => s.id);
  const filteredIncome = isAllSessionsView 
    ? income.filter(i => existingSessionIds.includes(i.session_id))
    : income.filter(i => i.session_id === currentSession?.id);
  const filteredExpenses = isAllSessionsView 
    ? expenses.filter(e => existingSessionIds.includes(e.session_id))
    : expenses.filter(e => e.session_id === currentSession?.id);

  console.log('=== DASHBOARD DATA DEBUG ===');
  console.log('isAllSessionsView:', isAllSessionsView);
  console.log('currentSession:', currentSession);
  console.log('Total income items in context:', income.length);
  console.log('Total expense items in context:', expenses.length);
  console.log('Filtered income items:', filteredIncome.length);
  console.log('Filtered expense items:', filteredExpenses.length);
  if (income.length > 0) {
    console.log('Sample income item:', income[0]);
  }
  if (expenses.length > 0) {
    console.log('Sample expense item:', expenses[0]);
  }

  const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
  // Total expenses (excluding payroll)
  const totalExpenses = filteredExpenses.filter(e => e.category !== 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
  // Payroll is deducted separately
  const totalPayroll = filteredExpenses.filter(e => e.category === 'PAYROLL').reduce((sum, e) => sum + e.amount, 0);
  // VAT calculations
  const vatReceived = filteredIncome.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
  const vatPaid = filteredExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
  const vatBalance = vatReceived - vatPaid;
  // Balance: Income - Expenses - Payroll
  const balance = totalIncome - totalExpenses - totalPayroll;

  console.log('Calculated totals:', { totalIncome, totalExpenses, totalPayroll, balance });
  console.log('=== END DEBUG ===');

  const handleMasterReset = async () => {
    if (!confirm('🗑️ MASTER RESET\n\nThis will permanently delete EVERYTHING:\n• All sessions\n• All income & expenses\n• All POS readings\n• All documents\n• All employees\n\nThis cannot be undone!\n\nAre you absolutely sure?')) {
      return;
    }
    
    if (!confirm('⚠️ FINAL WARNING!\n\nYou are about to delete ALL data from the entire system.\n\nType YES in your mind and click OK to proceed.')) {
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

      // Delete all sessions
      const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('restaurantId', '==', user.uid)));
      sessionsSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

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

      // Delete all POS readings
      const posSnap = await getDocs(query(collection(db, 'pos_readings'), where('restaurantId', '==', user.uid)));
      posSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Delete all documents
      const docsSnap = await getDocs(query(collection(db, 'documents'), where('restaurantId', '==', user.uid)));
      docsSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      // Commit batch
      await batch.commit();
      
      alert(`✅ Master Reset Complete!\n\nDeleted ${deleteCount} records.\n\nThe page will now reload.`);
      
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Master reset error:', error);
      alert('❌ Error during master reset: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleAddSession = async () => {
    await addSession();
  };

  const handleDeleteSession = async (id: string) => {
    if (confirm('Delete this session and all its data (income, expenses, documents, POS readings)?')) {
      await deleteSession(id);
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

  const handleDocumentData = async (data: FinancialData, fileName: string, fileHash?: string, fileRaw?: File) => {
    console.log('🔵 handleDocumentData called:', { fileName, hasData: !!data, currentSession: currentSession?.id });
    
    if (!currentSession) {
      console.error('❌ No session selected');
      alert('Please select a session first');
      throw new Error('No session selected');
    }

    // Check for duplicate document by hash
    if (fileHash) {
      const existingDoc = documents.find(d => d.fileHash === fileHash);
      if (existingDoc) {
        console.log('⚠️ Duplicate document detected:', fileHash);
        alert(`⚠️ This document has already been processed: "${existingDoc.fileName}"\n\nSkipping to avoid duplicate entries.`);
        throw new Error('Duplicate document');
      }
    }

    // Upload file to Firebase Storage (FREE tier: 5GB storage, 1GB/day download)
    let fileUrl: string | undefined;
    if (fileRaw && user?.uid) {
      try {
        console.log('📤 Uploading file to Firebase Storage...');
        const { uploadDocument } = await import('../services/storageService');
        fileUrl = await uploadDocument(fileRaw, user.uid, fileName);
        console.log('✅ File uploaded successfully:', fileUrl);
      } catch (uploadError) {
        console.error('⚠️ File upload failed:', uploadError);
        // Continue without file URL - document metadata will still be saved
      }
    }

    // Save the document with file URL
    let documentId: string;
    try {
      console.log('💾 Saving document to Firestore...');
      const newDoc = await addDocument({
        id: Math.random().toString(36).substr(2, 9),
        fileName,
        status: 'completed',
        data,
        fileHash,
        fileUrl, // Store Firebase Storage URL instead of base64
      });
      documentId = newDoc.id;
      console.log('✅ Document saved with ID:', documentId);
    } catch (error) {
      console.error('❌ Error saving document:', error);
      alert('Failed to save document: ' + (error as Error).message);
      throw error;
    }

    const date = data.date || new Date().toISOString().split('T')[0];
    const amount = data.amountInCHF || data.totalAmount || 0;
    const docType = data.documentType;
    
    console.log('📊 Processing document type:', docType, 'Amount:', amount);
    
    // Check if this is revenue based on category or document type
    const isRevenue = data.expenseCategory?.toUpperCase().includes('REVENUE') || 
                      data.expenseCategory?.toUpperCase().includes('SALES') ||
                      docType === 'Ticket/Receipt' ||
                      docType === 'Z2 Multi-Ticket Sheet';
    
    if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
      console.log('🏦 Processing bank statement with', data.lineItems?.length || 0, 'line items');
      if (data.lineItems) {
        for (const item of data.lineItems) {
          if (item.type === 'INCOME') {
            console.log('➕ Adding income:', item.amount, item.description);
            // Extract VAT if available (typically 7.7% or 8.1% in Switzerland)
            const vatAmount = data.vatAmount || 0;
            await addIncome(date, 'SALES', item.amount, item.description || fileName, currentSession.id, documentId, vatAmount);
          } else if (item.type === 'EXPENSE') {
            console.log('➖ Adding expense:', item.amount, item.description);
            const description = item.description || data.issuer || fileName;
            const vatAmount = data.vatAmount || 0;
            await addExpense(date, 'OTHER', item.amount, description, currentSession.id, undefined, documentId, vatAmount);
          }
        }
      }
    } else if (docType === 'Pay Slip') {
      const netPay = data.paySlip?.netPay || data.totalAmount || 0;
      const grossPay = data.paySlip?.grossPay || 0;
      const employeeName = data.paySlip?.employee?.name || 'Unknown Employee';
      const employeeId = data.paySlip?.employee?.idNumber || '';
      const socialContributions = grossPay - netPay; // Deductions = Gross - Net
      
      console.log('💰 Processing payslip:', employeeName, 'Net Pay:', netPay, 'Social Contributions:', socialContributions);
      
      // Automatically create or update employee record
      try {
        const existingEmployee = employees.find(emp => 
          emp.name.toLowerCase() === employeeName.toLowerCase()
        );
        
        if (existingEmployee) {
          // Update existing employee with latest payslip data
          console.log('📝 Updating existing employee:', employeeName);
          // Note: You'll need to add an updateEmployee function to EmployeeContext
          // For now, we'll just log it
          console.log('Employee already exists, would update with:', {
            net_salary: netPay,
            social_contributions: socialContributions,
            monthly_salary: grossPay
          });
        } else {
          // Create new employee automatically
          console.log('➕ Creating new employee:', employeeName);
          await addEmployee(
            employeeName,
            'Employee', // Default position
            grossPay, // monthly_salary (total cost)
            currentSession?.id
          );
          console.log('✅ Employee created successfully');
        }
      } catch (empError) {
        console.error('⚠️ Error managing employee:', empError);
        // Continue even if employee creation fails
      }
      
      if (netPay > 0) {
        await addExpense(
          date, 
          'PAYROLL', 
          netPay, 
          `Payslip - ${employeeName}`, 
          currentSession.id,
          undefined,
          documentId
        );
      }
    } else if (isRevenue && amount > 0) {
      console.log('💵 Adding revenue:', amount);
      const description = data.issuer || data.notes || fileName;
      const vatAmount = data.vatAmount || 0;
      await addIncome(date, 'SALES', amount, description, currentSession.id, documentId, vatAmount);
    } else if (amount > 0) {
      console.log('💸 Adding expense:', amount);
      const category = data.expenseCategory?.toLowerCase().includes('supplier') ? 'SUPPLIERS' : 
                      data.expenseCategory?.toLowerCase().includes('bill') ? 'BILLS' : 'OTHER';
      const description = data.issuer || data.notes || fileName;
      const vatAmount = data.vatAmount || 0;
      await addExpense(date, category as any, amount, description, currentSession.id, undefined, documentId, vatAmount);
    }
    
    console.log('✅ Document processing complete:', fileName);
  };

  const handleNavigateToDocument = (doc: ProcessedDocument) => {
    setSelectedDocumentFromFinance(doc);
    setActiveTab('documents');
  };

  const handleDocumentUpdated = async (documentId: string, newData: FinancialData) => {
    console.log('🔄 Updating document and related income/expenses:', documentId);
    
    if (!currentSession) {
      console.error('❌ No session selected');
      return;
    }

    try {
      // Delete all existing income/expenses linked to this document
      console.log('🗑️ Deleting old income/expenses for document:', documentId);
      const oldIncome = income.filter(i => i.documentId === documentId);
      const oldExpenses = expenses.filter(e => e.documentId === documentId);
      
      for (const item of oldIncome) {
        await deleteIncome(item.id);
      }
      for (const item of oldExpenses) {
        await deleteExpense(item.id);
      }
      
      console.log(`✅ Deleted ${oldIncome.length} income and ${oldExpenses.length} expense entries`);
      
      // Re-create income/expenses from updated document data
      const date = newData.date || new Date().toISOString().split('T')[0];
      const amount = newData.amountInCHF || newData.totalAmount || 0;
      const docType = newData.documentType;
      
      console.log('📊 Re-processing document type:', docType, 'Amount:', amount);
      
      // Check if this is revenue based on category or document type
      const isRevenue = newData.expenseCategory?.toUpperCase().includes('REVENUE') || 
                        newData.expenseCategory?.toUpperCase().includes('SALES') ||
                        docType === 'Ticket/Receipt' ||
                        docType === 'Z2 Multi-Ticket Sheet';
      
      if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
        console.log('🏦 Re-processing bank statement with', newData.lineItems?.length || 0, 'line items');
        if (newData.lineItems) {
          for (const item of newData.lineItems) {
            if (item.type === 'INCOME') {
              console.log('➕ Re-adding income:', item.amount, item.description);
              await addIncome(date, 'SALES', item.amount, item.description || 'Bank Statement', currentSession.id, documentId);
            } else if (item.type === 'EXPENSE') {
              console.log('➖ Re-adding expense:', item.amount, item.description);
              const description = item.description || newData.issuer || 'Bank Statement';
              await addExpense(date, 'OTHER', item.amount, description, currentSession.id, undefined, documentId);
            }
          }
        }
      } else if (docType === 'Pay Slip') {
        const netPay = newData.paySlip?.netPay || newData.totalAmount || 0;
        const employeeName = newData.paySlip?.employee?.name || 'Unknown Employee';
        
        console.log('💰 Re-processing payslip:', employeeName, 'Net Pay:', netPay);
        
        if (netPay > 0) {
          await addExpense(
            date, 
            'PAYROLL', 
            netPay, 
            `Payslip - ${employeeName}`, 
            currentSession.id,
            undefined,
            documentId
          );
        }
      } else if (isRevenue && amount > 0) {
        console.log('💵 Re-adding revenue:', amount);
        const description = newData.issuer || newData.notes || 'Document';
        await addIncome(date, 'SALES', amount, description, currentSession.id, documentId);
      } else if (amount > 0) {
        console.log('💸 Re-adding expense:', amount);
        const category = newData.expenseCategory?.toLowerCase().includes('supplier') ? 'SUPPLIERS' : 
                        newData.expenseCategory?.toLowerCase().includes('bill') ? 'BILLS' : 'OTHER';
        const description = newData.issuer || newData.notes || 'Document';
        await addExpense(date, category as any, amount, description, currentSession.id, undefined, documentId);
      }
      
      console.log('✅ Document update complete');
      alert('✅ Document updated successfully! Dashboard numbers have been refreshed.');
    } catch (error) {
      console.error('❌ Error updating document:', error);
      alert('Failed to update document: ' + (error as Error).message);
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
          
          {/* Master Reset Button */}
          <button
            onClick={() => setShowMasterReset(true)}
            className="w-full flex items-center justify-center gap-2 py-2 mb-3 bg-red-600/10 border border-red-600 text-red-400 text-xs font-bold uppercase rounded hover:bg-red-600/20"
          >
            <Trash2 className="w-4 h-4" /> Master Reset
          </button>
          
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

        <div className="p-4 border-t border-cdlp-border">
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
          {activeTab === 'dashboard' && (
            <DashboardTab
              currentSession={currentSession}
              isAllSessionsView={isAllSessionsView}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalPayroll={totalPayroll}
              balance={balance}
              vatReceived={vatReceived}
              vatPaid={vatPaid}
              vatBalance={vatBalance}
              filteredIncome={filteredIncome}
              filteredExpenses={filteredExpenses}
              onAddIncome={() => setShowAddIncome(true)}
              onAddExpense={() => setShowAddExpense(true)}
              onDocumentData={handleDocumentData}
              onDocumentUpdated={handleDocumentUpdated}
              language={language}
              documents={documents}
              updateDocument={updateDocumentData}
              deleteIncome={deleteIncome}
              deleteExpense={deleteExpense}
              updateIncome={updateIncome}
              updateExpense={updateExpense}
              addIncome={addIncome}
              addExpense={addExpense}
              onNavigateToDocument={handleNavigateToDocument}
              onShowEmployeePanel={() => setShowEmployeePanel(true)}
              t={t}
              user={user}
            />
          )}
          {activeTab === 'revenue' && <POSManager />}
          {activeTab === 'reports' && <ReportsPlaceholder />}
          {activeTab === 'documents' && <DocumentsTab selectedDocument={selectedDocumentFromFinance} onClearSelection={() => setSelectedDocumentFromFinance(null)} />}
        </div>
      </div>

      {/* Modals */}
      {showAddEmployee && <AddEmployeeModal onClose={() => setShowAddEmployee(false)} onAdd={addEmployee} t={t} />}
      {showAddIncome && <AddIncomeModal onClose={() => setShowAddIncome(false)} onAdd={(date, type, amount, desc) => addIncome(date, type, amount, desc, currentSession?.id || '')} t={t} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onAdd={(date, cat, amount, desc) => addExpense(date, cat, amount, desc, currentSession?.id || '')} t={t} />}
      
      {/* Master Reset Confirmation Modal */}
      {showMasterReset && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-cdlp-black border-2 border-red-600 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-500 uppercase">Master Reset</h3>
                <p className="text-xs text-red-400">Permanent deletion</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-sm text-white font-bold">This will permanently delete EVERYTHING:</p>
              <ul className="space-y-2 text-xs text-cdlp-muted">
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All sessions ({sessions.length})</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All income entries ({income.length})</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All expense entries ({expenses.length})</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All POS readings</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All documents ({documents.length})</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>All employees ({employees.length})</span>
                </li>
              </ul>
              <div className="bg-red-600/10 border border-red-600/30 rounded p-3 mt-4">
                <p className="text-xs text-red-400 font-bold">⚠️ This action cannot be undone!</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMasterReset(false);
                  handleMasterReset();
                }}
                className="flex-1 py-3 bg-red-600 text-white text-sm font-bold uppercase rounded hover:bg-red-700"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setShowMasterReset(false)}
                className="flex-1 py-3 bg-cdlp-card border border-cdlp-border text-white text-sm font-bold uppercase rounded hover:bg-cdlp-border/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Sliding Panel */}
      {showEmployeePanel && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowEmployeePanel(false)}
          />
          
          {/* Sliding Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-cdlp-black border-l border-cdlp-border z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-cdlp-border">
                <div>
                  <h2 className="text-xl font-black text-cdlp-gold uppercase">Employees</h2>
                  <p className="text-xs text-cdlp-muted mt-1">Payroll & State Contributions</p>
                </div>
                <button
                  onClick={() => setShowEmployeePanel(false)}
                  className="p-2 hover:bg-cdlp-border rounded transition-colors"
                >
                  <X className="w-5 h-5 text-cdlp-muted" />
                </button>
              </div>

              {/* Add Employee Button */}
              <button
                onClick={() => {
                  setShowEmployeePanel(false);
                  setShowAddEmployee(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cdlp-gold text-cdlp-black text-sm font-bold uppercase rounded hover:bg-cdlp-gold-light mb-6"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>

              {/* Employees List */}
              {employees.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-cdlp-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-cdlp-muted">No employees yet</p>
                  <p className="text-xs text-cdlp-muted/60 mt-1">Add your first employee to track payroll</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {employees.map((emp) => (
                    <div key={emp.id} className="bg-cdlp-card border border-cdlp-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-black text-white">{emp.name}</h3>
                          {emp.position && (
                            <p className="text-xs text-cdlp-muted mt-1">{emp.position}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Delete employee ${emp.name}?`)) {
                              deleteEmployee(emp.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {emp.net_salary && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cdlp-muted">Net Salary</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {emp.net_salary.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.social_contributions && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cdlp-muted">Social Contributions</span>
                            <span className="text-sm font-bold text-blue-400">
                              {emp.social_contributions.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.state_rest && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cdlp-muted">State Rest</span>
                            <span className="text-sm font-bold text-purple-400">
                              {emp.state_rest.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.monthly_salary && (
                          <div className="flex justify-between items-center pt-2 border-t border-cdlp-border">
                            <span className="text-xs font-bold text-cdlp-gold uppercase">Total Cost</span>
                            <span className="text-sm font-black text-cdlp-gold">
                              {emp.monthly_salary.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {employees.length > 0 && (
                <div className="mt-6 p-4 bg-cdlp-gold/10 border border-cdlp-gold/30 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-cdlp-gold uppercase">Total Payroll</span>
                    <span className="text-lg font-black text-cdlp-gold">
                      {employees.reduce((sum, emp) => sum + (emp.monthly_salary || 0), 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                    </span>
                  </div>
                  <p className="text-xs text-cdlp-muted mt-2">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Income/Expense Section Component with Drag & Drop and Edit
function IncomeExpenseSection({ 
  title, 
  items, 
  type, 
  onAdd, 
  onEdit, 
  onDelete, 
  onDrop,
  onUpdate,
  onItemClick,
  t 
}: { 
  title: string; 
  items: any[]; 
  type: 'income' | 'expense'; 
  onAdd?: () => void; 
  onEdit: (item: any) => void;
  onDelete: (id: string) => Promise<void>;
  onDrop: (item: any) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onItemClick?: (item: any) => void;
  t: (key: string) => string;
}) {
  const [draggedOver, setDraggedOver] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<any>(null);

  const handleDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOver(true);
  };

  const handleDragLeave = () => {
    setDraggedOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      console.log('=== DROP DEBUG ===');
      console.log('Dropped data:', data);
      console.log('Target section type:', type);
      console.log('Data has type field:', data.type);
      console.log('Data has category field:', data.category);
      
      // Simplified detection: 
      // If dropping into income section, only accept items with category (expenses)
      // If dropping into expense section, only accept items with type (income)
      let shouldConvert = false;
      
      if (type === 'income') {
        // Dropping into income - accept if it has category (is an expense)
        shouldConvert = !!data.category;
        console.log('Dropping into INCOME, has category?', shouldConvert);
      } else if (type === 'expense') {
        // Dropping into expense - accept if it has type field (is income)
        shouldConvert = !!data.type && (data.type === 'SALES' || data.type === 'RESERVATION');
        console.log('Dropping into EXPENSE, has income type?', shouldConvert);
      }
      
      console.log('Should convert?', shouldConvert);
      
      if (shouldConvert) {
        console.log('Calling onDrop handler...');
        await onDrop(data);
        console.log('onDrop completed successfully');
      } else {
        console.log('Drop rejected - not from opposite type');
        alert('Cannot drop here - item is already in this section');
      }
    } catch (err) {
      console.error('Drop error:', err);
      alert('Error during drop: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    
    try {
      const updates: any = {
        date: editForm.date,
        amount: editForm.amount,
        description: editForm.description || '',
      };
      
      if (type === 'income') {
        updates.type = editForm.type;
      } else {
        updates.category = editForm.category;
      }
      
      await onUpdate(editForm.id, updates);
      setEditingId(null);
      setEditForm(null);
      alert('✅ Updated successfully!');
    } catch (err) {
      console.error('Save edit error:', err);
      alert('❌ Error saving: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const isIncome = type === 'income';
  const colorClass = isIncome ? 'emerald' : 'red';

  return (
    <div 
      className={`bg-cdlp-black border-2 p-4 md:p-6 rounded-lg shadow-card transition-all ${
        draggedOver 
          ? `border-${colorClass}-500 bg-${colorClass}-500/10` 
          : 'border-cdlp-border'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-black text-cdlp-gold uppercase">{title}</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className={`flex items-center gap-1 px-2 md:px-3 py-1 bg-${colorClass}-600 text-white text-[10px] md:text-xs font-bold uppercase rounded hover:bg-${colorClass}-700`}
          >
            <Plus className="w-3 h-3" /> {t('add')}
          </button>
        )}
      </div>
      
      {draggedOver && (
        <div className={`mb-4 p-3 border-2 border-dashed border-${colorClass}-500 rounded bg-${colorClass}-500/5 text-center`}>
          <p className={`text-xs font-bold text-${colorClass}-500 uppercase`}>
            Drop here to convert to {type}
          </p>
        </div>
      )}
      
      <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <p className="text-xs text-cdlp-muted/60">No {type} entries</p>
        ) : (
          items.map((item: any) => (
            <div 
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className={`p-2 md:p-3 bg-cdlp-card border border-cdlp-border rounded group hover:border-cdlp-gold transition-all cursor-move ${
                editingId === item.id ? 'ring-2 ring-cdlp-gold' : ''
              }`}
            >
              {editingId === item.id ? (
                // Edit Mode
                <div className="space-y-2">
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                  />
                  <input
                    type="text"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description"
                    className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                  />
                  {isIncome ? (
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                    >
                      <option value="SALES">SALES</option>
                      <option value="RESERVATION">RESERVATION</option>
                    </select>
                  ) : (
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                    >
                      <option value="BILLS">BILLS</option>
                      <option value="SUPPLIERS">SUPPLIERS</option>
                      <option value="PAYROLL">PAYROLL</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded hover:bg-emerald-700"
                    >
                      <Check className="w-3 h-3 inline mr-1" /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 px-2 py-1 bg-cdlp-card border border-cdlp-border text-white text-[10px] font-bold uppercase rounded hover:bg-cdlp-border/50"
                    >
                      <X className="w-3 h-3 inline mr-1" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex justify-between items-start">
                  <button
                    onClick={() => onItemClick && item.document_id && onItemClick(item)}
                    className={`flex-1 min-w-0 text-left ${item.document_id ? 'cursor-pointer hover:bg-cdlp-gold/5 -m-1 p-1 rounded transition-colors' : ''}`}
                    disabled={!item.document_id}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs md:text-sm text-white truncate">
                        {isIncome ? item.type : item.category}
                      </p>
                      {item.document_id && (
                        <FileText className="w-3 h-3 text-cdlp-gold flex-shrink-0" title="Linked to document" />
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-cdlp-muted">{item.date}</p>
                    {item.description && (
                      <p className="text-[10px] md:text-xs text-cdlp-muted mt-1 truncate">{item.description}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <p className={`font-black text-sm md:text-base text-${colorClass}-500`}>
                      {item.amount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 hover:bg-cdlp-gold/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3 text-cdlp-gold" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ currentSession, isAllSessionsView, totalIncome, totalExpenses, totalPayroll, balance, vatReceived, vatPaid, vatBalance, filteredIncome, filteredExpenses, onAddIncome, onAddExpense, onDocumentData, onDocumentUpdated, language, documents, updateDocument, deleteIncome, deleteExpense, updateIncome, updateExpense, addIncome, addExpense, t, user, onNavigateToDocument, onShowEmployeePanel }: any) {
  const handleItemClick = (item: any) => {
    if (item.document_id && onNavigateToDocument) {
      const doc = documents.find((d: any) => d.id === item.document_id);
      if (doc) {
        onNavigateToDocument(doc);
      } else {
        alert('Document not found');
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">
          {isAllSessionsView ? 'All Sessions' : currentSession?.name || 'Dashboard'}
        </h1>
        <button
          onClick={onShowEmployeePanel}
          className="flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light transition-colors"
        >
          <Users className="w-4 h-4" /> Employees
        </button>
      </div>

      {/* Financial Summary Cards - 2 rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5 text-emerald-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('income')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-emerald-500">{totalIncome.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 md:w-5 h-4 md:h-5 text-red-500" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('expenses')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-red-500">{totalExpenses.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 md:w-5 h-4 md:h-5 text-cdlp-gold" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('payroll')}</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-cdlp-gold">{totalPayroll.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>

        <div className="bg-cdlp-black border border-cdlp-border p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 md:w-5 h-4 md:h-5 text-cdlp-gold" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">{t('balance')}</span>
          </div>
          <p className={`text-lg md:text-2xl font-black ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {balance.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-cdlp-muted">CHF</p>
        </div>
      </div>

      {/* VAT Summary Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-cdlp-black border border-blue-500/30 p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 md:w-5 h-4 md:h-5 text-blue-400" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">VAT Received</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-blue-400">{vatReceived.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-cdlp-muted">From customers</p>
        </div>

        <div className="bg-cdlp-black border border-orange-500/30 p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 md:w-5 h-4 md:h-5 text-orange-400" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">VAT Paid</span>
          </div>
          <p className="text-lg md:text-2xl font-black text-orange-400">{vatPaid.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-cdlp-muted">On expenses</p>
        </div>

        <div className="bg-cdlp-black border border-purple-500/30 p-3 md:p-4 rounded-lg shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 md:w-5 h-4 md:h-5 text-purple-400" />
            <span className="text-[10px] md:text-xs font-bold uppercase text-cdlp-muted">VAT Balance</span>
          </div>
          <p className={`text-lg md:text-2xl font-black ${vatBalance >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
            {vatBalance.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-cdlp-muted">{vatBalance >= 0 ? 'To pay' : 'Refund'}</p>
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
            onDocumentUpdated={onDocumentUpdated}
          />
        </div>
      )}

      {/* Income & Expense Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Income Section */}
        <IncomeExpenseSection
          title={t('income')}
          items={filteredIncome}
          type="income"
          onAdd={currentSession ? onAddIncome : undefined}
          onEdit={(item) => {/* TODO: Implement edit */}}
          onDelete={async (id) => {
            if (confirm('Delete this income entry?')) {
              await deleteIncome(id);
            }
          }}
          onUpdate={async (id, updates) => {
            await updateIncome(id, updates);
          }}
          onItemClick={handleItemClick}
          onDrop={async (item) => {
            // Convert expense to income
            console.log('=== INCOME DROP START ===');
            console.log('Income onDrop called with:', item);
            console.log('Item session_id:', item.session_id);
            console.log('Item has category?', !!item.category);
            console.log('Item has type?', !!item.type);
            
            if (confirm('Convert this expense to income?')) {
              try {
                console.log('User confirmed conversion');
                console.log('Calling addIncome with params:', {
                  date: item.date,
                  type: 'SALES',
                  amount: item.amount,
                  description: item.description || item.category,
                  sessionId: item.session_id
                });
                
                const newIncome = await addIncome(item.date, 'SALES', item.amount, item.description || item.category, item.session_id);
                console.log('addIncome returned:', newIncome);
                
                if (newIncome) {
                  console.log('Income added successfully, now deleting expense:', item.id);
                  await deleteExpense(item.id);
                  console.log('Expense deleted successfully');
                  alert('✅ Converted to income successfully!');
                } else {
                  console.error('addIncome returned null');
                  alert('❌ Failed to add income - check console for details');
                }
              } catch (err) {
                console.error('Error converting to income:', err);
                alert('❌ Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            } else {
              console.log('User cancelled conversion');
            }
          }}
          t={t}
        />

        {/* Expense Section */}
        <IncomeExpenseSection
          title={t('expenses')}
          items={filteredExpenses}
          type="expense"
          onAdd={currentSession ? onAddExpense : undefined}
          onEdit={(item) => {/* TODO: Implement edit */}}
          onDelete={async (id) => {
            if (confirm('Delete this expense entry?')) {
              await deleteExpense(id);
            }
          }}
          onUpdate={async (id, updates) => {
            await updateExpense(id, updates);
          }}
          onItemClick={handleItemClick}
          onDrop={async (item) => {
            // Convert income to expense
            console.log('=== EXPENSE DROP START ===');
            console.log('Expense onDrop called with:', item);
            console.log('Item session_id:', item.session_id);
            console.log('Item has category?', !!item.category);
            console.log('Item has type?', !!item.type);
            
            if (confirm('Convert this income to expense?')) {
              try {
                console.log('User confirmed conversion');
                console.log('Calling addExpense with params:', {
                  date: item.date,
                  category: 'OTHER',
                  amount: item.amount,
                  description: item.description || item.type,
                  sessionId: item.session_id
                });
                
                const newExpense = await addExpense(item.date, 'OTHER', item.amount, item.description || item.type, item.session_id);
                console.log('addExpense returned:', newExpense);
                
                if (newExpense) {
                  console.log('Expense added successfully, now deleting income:', item.id);
                  await deleteIncome(item.id);
                  console.log('Income deleted successfully');
                  alert('✅ Converted to expense successfully!');
                } else {
                  console.error('addExpense returned null');
                  alert('❌ Failed to add expense - check console for details');
                }
              } catch (err) {
                console.error('Error converting to expense:', err);
                alert('❌ Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
              }
            } else {
              console.log('User cancelled conversion');
            }
          }}
          t={t}
        />
      </div>
    </>
  );
}

// Revenue Tab Component - Full POS/Z-Reading Management
// Reports Tab Component - Full Implementation
function ReportsPlaceholder() {
  const { income, expenses } = useFinance();
  const { currentSession, isAllSessionsView, sessions } = useSession();
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [filterActive, setFilterActive] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [supplierFilter, setSupplierFilter] = React.useState<string>('all');

  // Filter data by current session
  // For "All Sessions" view, only show data from existing sessions (not orphaned data)
  const existingSessionIds = sessions.map(s => s.id);
  const filteredIncome = isAllSessionsView 
    ? income.filter(i => existingSessionIds.includes(i.session_id))
    : income.filter(i => i.session_id === currentSession?.id);
  const filteredExpenses = isAllSessionsView 
    ? expenses.filter(e => existingSessionIds.includes(e.session_id))
    : expenses.filter(e => e.session_id === currentSession?.id);

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
                      {data.balance.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Income</p>
                      <p className="font-bold text-emerald-500">{data.income.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Expenses</p>
                      <p className="font-bold text-red-500">{data.expenses.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">Balance</p>
                      <p className={`font-bold ${data.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {data.balance.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <span className="text-sm font-black text-cdlp-gold ml-4">{amount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ selectedDocument: initialSelectedDocument, onClearSelection }: { selectedDocument?: ProcessedDocument | null; onClearSelection?: () => void }) {
  const { documents, updateDocument } = useDocuments();
  const [filter, setFilter] = useState<'all' | 'suppliers' | 'employees' | 'pos'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(initialSelectedDocument || null);

  // Update selectedDocument when initialSelectedDocument changes
  React.useEffect(() => {
    if (initialSelectedDocument) {
      setSelectedDocument(initialSelectedDocument);
    }
  }, [initialSelectedDocument]);

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

  // If viewing a specific document
  if (selectedDocument) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedDocument(null);
              if (onClearSelection) onClearSelection();
            }}
            className="flex items-center gap-2 text-cdlp-gold hover:text-cdlp-gold-light text-sm font-bold uppercase"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Documents
          </button>
          <h1 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase truncate">{selectedDocument.fileName}</h1>
        </div>

        {/* Document Analysis View - Similar to Ypsom */}
        <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Document Preview Panel */}
            <div className="lg:col-span-4 bg-slate-900 border-r border-cdlp-border">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-xs font-black uppercase text-emerald-400 tracking-widest">Document Preview</h3>
              </div>
              <div className="aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center">
                {(selectedDocument.fileUrl || selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
                  selectedDocument.fileName.toLowerCase().endsWith('.pdf') ? (
                    <iframe 
                      src={selectedDocument.fileUrl || selectedDocument.fileDataUrl || (selectedDocument.fileRaw ? URL.createObjectURL(selectedDocument.fileRaw) : '')} 
                      className="w-full h-full"
                      title="Document Preview"
                    />
                  ) : (
                    <img 
                      src={selectedDocument.fileUrl || selectedDocument.fileDataUrl || (selectedDocument.fileRaw ? URL.createObjectURL(selectedDocument.fileRaw) : '')} 
                      alt="Document Preview" 
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="text-center p-8">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-400 mb-2">Document file not available</p>
                    <p className="text-xs text-slate-500">The original file was not stored with this document</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                {(selectedDocument.fileUrl || selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
                  <button
                    type="button"
                    onClick={() => openDocumentInNewTab(selectedDocument)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Raw Trace
                  </button>
                ) : (
                  <div className="text-center text-xs text-slate-500 italic">
                    Original file not available for viewing
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Panel */}
            <div className="lg:col-span-8 p-6">
              <div className="space-y-6">
                {/* Document Info */}
                <div>
                  <h3 className="text-sm font-black uppercase text-cdlp-gold mb-4">Document Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Issuer Entity</label>
                      <p className="text-sm font-bold text-white">{selectedDocument.data?.issuer || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Date</label>
                      <p className="text-sm font-bold text-white">{selectedDocument.data?.date || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Total Amount</label>
                      <p className="text-lg font-black text-cdlp-gold">{(selectedDocument.data?.totalAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Document Type</label>
                      <p className="text-sm font-bold text-white">{selectedDocument.data?.documentType || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">VAT Amount</label>
                      <p className="text-sm font-bold text-blue-400">{(selectedDocument.data?.vatAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Net Amount</label>
                      <p className="text-sm font-bold text-emerald-400">{(selectedDocument.data?.netAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Category</label>
                      <p className="text-sm font-bold text-white">{selectedDocument.data?.expenseCategory || 'Uncategorized'}</p>
                    </div>
                    {selectedDocument.data?.notes && (
                      <div className="col-span-2">
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Notes</label>
                        <p className="text-sm text-white">{selectedDocument.data.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Interpretation */}
                {selectedDocument.data?.aiInterpretation && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">AI Analysis</h3>
                    <div className="bg-cdlp-card border border-cdlp-border rounded p-4">
                      <p className="text-sm text-cdlp-muted italic">{selectedDocument.data.aiInterpretation}</p>
                    </div>
                  </div>
                )}

                {/* Line Items if available */}
                {selectedDocument.data?.lineItems && selectedDocument.data.lineItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">Line Items</h3>
                    <div className="border border-cdlp-border rounded overflow-hidden">
                      <table className="min-w-full text-xs">
                        <thead className="bg-cdlp-gold text-cdlp-black">
                          <tr className="font-bold uppercase">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-center">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cdlp-border">
                          {selectedDocument.data.lineItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-cdlp-card">
                              <td className="px-3 py-2 text-cdlp-muted">{item.date}</td>
                              <td className="px-3 py-2 text-white font-bold">{item.description}</td>
                              <td className={`px-3 py-2 text-right font-bold ${item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.amount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  item.type === 'INCOME' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                                }`}>
                                  {item.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payslip Details if available */}
                {selectedDocument.data?.paySlip && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">Payslip Details</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Employee</label>
                        <p className="text-sm font-bold text-white">{selectedDocument.data.paySlip.employee?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Employer</label>
                        <p className="text-sm font-bold text-white">{selectedDocument.data.paySlip.employer?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Gross Pay</label>
                        <p className="text-sm font-bold text-emerald-400">{(selectedDocument.data.paySlip.grossPay || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">Net Pay</label>
                        <p className="text-sm font-bold text-cdlp-gold">{(selectedDocument.data.paySlip.netPay || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                      </div>
                    </div>
                    {selectedDocument.data.paySlip.components && selectedDocument.data.paySlip.components.length > 0 && (
                      <div className="border border-cdlp-border rounded overflow-hidden">
                        <table className="min-w-full text-xs">
                          <thead className="bg-cdlp-gold text-cdlp-black">
                            <tr className="font-bold uppercase">
                              <th className="px-3 py-2 text-left">Component</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2 text-center">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cdlp-border">
                            {selectedDocument.data.paySlip.components.map((comp, idx) => (
                              <tr key={idx} className="hover:bg-cdlp-card">
                                <td className="px-3 py-2 text-white font-bold">{comp.description}</td>
                                <td className={`px-3 py-2 text-right font-bold ${comp.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {comp.amount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    comp.type === 'INCOME' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                                  }`}>
                                    {comp.type}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedEntity) {
    const entityDocs = filter === 'suppliers' 
      ? groupedDocs.suppliers[selectedEntity] 
      : filter === 'employees'
      ? groupedDocs.employees[selectedEntity]
      : filter === 'pos'
      ? groupedDocs.posReports
      : // For 'all' filter, find the entity in suppliers or employees
        groupedDocs.suppliers[selectedEntity] || groupedDocs.employees[selectedEntity] || [];
    
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

        {monthlyGroups.length === 0 ? (
          <div className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card p-12 text-center">
            <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">No Documents Found</h3>
            <p className="text-cdlp-muted text-sm">No documents available for this entity</p>
          </div>
        ) : (
          monthlyGroups.map(([month, docs]) => {
          const totalAmount = docs.reduce((sum, d) => sum + (d.data?.totalAmount || 0), 0);
          const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

          return (
            <div key={month} className="bg-cdlp-black border border-cdlp-border rounded-lg shadow-card overflow-hidden">
              <div className="bg-cdlp-card border-b border-cdlp-border p-4 flex justify-between items-center">
                <h3 className="text-sm font-bold text-cdlp-gold uppercase">{monthName}</h3>
                <div className="text-right">
                  <p className="text-xs text-cdlp-muted uppercase">Total</p>
                  <p className="text-lg font-black text-white">{totalAmount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                </div>
              </div>
              <div className="divide-y divide-cdlp-border">
                {docs.map(doc => (
                  <div key={doc.id} className="p-4 hover:bg-cdlp-card transition-colors group">
                    <div className="flex justify-between items-start">
                      <button
                        onClick={() => setSelectedDocument(doc)}
                        className="flex-1 text-left"
                      >
                        <p className="font-bold text-white text-sm group-hover:text-cdlp-gold transition-colors">{doc.fileName}</p>
                        <p className="text-xs text-cdlp-muted mt-1">{doc.data?.date}</p>
                        {doc.data?.notes && (
                          <p className="text-xs text-cdlp-muted mt-1">{doc.data.notes}</p>
                        )}
                      </button>
                      <div className="text-right ml-4 flex items-center gap-3">
                        <div>
                          <p className="font-black text-white text-base">{(doc.data?.totalAmount || 0).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-cdlp-muted">{doc.data?.originalCurrency || 'CHF'}</p>
                        </div>
                        <button
                          onClick={() => setSelectedDocument(doc)}
                          className="p-2 hover:bg-cdlp-gold/10 rounded transition-colors"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4 text-cdlp-muted group-hover:text-cdlp-gold transition-colors" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
        )}
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
                    <span className="text-lg font-black text-cdlp-gold">{totalAmount.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
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
