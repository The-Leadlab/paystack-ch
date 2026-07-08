import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Users, TrendingUp, TrendingDown, DollarSign, Plus, X, LogOut, Menu, Globe, Edit2, Trash2, LayoutDashboard, Receipt, BarChart3, FileText, ChevronRight, Download, Check, ExternalLink, CreditCard, Lock, Settings, Wallet } from 'lucide-react';
import { BillingPlanPanel } from './BillingPlanPanel';
import { useEmployee } from '../context/EmployeeContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useChfLocale, useFormatChf, useLanguage } from '../context/LanguageContext';
import { formatIssuerForDisplay, formatMonthYearLabel, parseMonthKey } from '../i18n/documentDisplayI18n';
import { useDocuments } from '../context/DocumentContext';
import { usePOS } from '../context/POSContext';
import { DocumentProcessor } from './DocumentProcessor';
import { BusinessKpiCard } from './BusinessKpiCard';
import { BusinessSidebarNav, type BusinessTab } from './BusinessSidebarNav';
import '../businessApp.css';
import { UpgradePromptModal } from './UpgradePromptModal';
import { PlanTestBanner, PlanTestPickerModal } from './PlanTestPickerModal';
import { getSessionDisplayName } from '../lib/formatLocalDateTime';
import { POSManager } from './POSManager';
import type { ProcessedDocument, POSReading } from '../types';
import { openDocumentInNewTab } from '../lib/openDocumentInNewTab';
import { BRAND_LOGO_SRC, BRAND_LOGO_SIZE } from '@/const/branding';
import type { DocumentReference } from 'firebase/firestore';
import {
  buildPayrollExpenseLines,
  isNetPayrollCategory,
  resolvePayrollSettlementMode,
} from '../services/swissPayrollService';
import { SwissAccountCodeBadge, SwissAccountCodeField } from './SwissAccountCodeField';
import { suggestSwissAccountCode } from '@shared/suggestSwissAccountCode';
import { classifyLineItemAccountCode } from '../services/swissAccountClassifierService';
import type { FinancialData } from '../types';

type Tab = BusinessTab;

const FIRESTORE_BATCH_MAX = 450;

const BUSINESS_NAV_ITEMS: { id: Tab; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'revenue', labelKey: 'revenue', icon: Receipt },
  { id: 'reports', labelKey: 'reports', icon: BarChart3 },
  { id: 'documents', labelKey: 'documents', icon: FileText },
  { id: 'billing', labelKey: 'billingTab', icon: Settings },
];

function dedupeSnapshots(...snapshots: { forEach: (fn: (d: { ref: DocumentReference }) => void) => void }[]): DocumentReference[] {
  const seen = new Set<string>();
  const out: DocumentReference[] = [];
  for (const snap of snapshots) {
    snap.forEach((d) => {
      const p = d.ref.path;
      if (seen.has(p)) return;
      seen.add(p);
      out.push(d.ref);
    });
  }
  return out;
}

async function commitDeletesInChunks(
  db: import('firebase/firestore').Firestore,
  refs: DocumentReference[],
  batchSize = FIRESTORE_BATCH_MAX
): Promise<number> {
  const { writeBatch } = await import('firebase/firestore');
  let n = 0;
  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = writeBatch(db);
    const slice = refs.slice(i, i + batchSize);
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    n += slice.length;
  }
  return n;
}

export function RestaurantDashboard() {
  const { employees, addEmployee, deleteEmployee } = useEmployee();
  const {
    income,
    expenses,
    addIncome,
    addExpense,
    updateIncome,
    updateExpense,
    deleteIncome,
    deleteExpense,
    deleteFinancesByDocumentId,
  } = useFinance();
  const { sessions, currentSession, addSession, deleteSession, renameSession, setCurrentSession, isAllSessionsView, setAllSessionsView } = useSession();
  const { documents, addDocument, updateDocumentData, deleteDocument: deleteDocumentFromContext } = useDocuments();
  const { signOut, user } = useAuth();
  const { enforcementEnabled, entitlements, incrementDocumentUsage, documentsUsedThisMonth, loading: subscriptionLoading, isPlanTestUser, billing } = useSubscription();
  const { language, setLanguage, t } = useLanguage();
  const chfLocale = useChfLocale();
  const errMsg = (error: unknown) => (error instanceof Error ? error.message : t('errorUnknown'));

  const openBillingTab = () => {
    setActiveTab('billing');
    setShowSidebar(false);
  };
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const showRevenueTab = !enforcementEnabled || entitlements.allCoreModules;
  const showAllSessionsView = !enforcementEnabled || entitlements.allCoreModules;
  const canAddSession =
    !enforcementEnabled || entitlements.maxSessions == null || sessions.length < entitlements.maxSessions;
  const canAddEmployee =
    !enforcementEnabled ||
    entitlements.maxEmployeeSlots == null ||
    employees.length < entitlements.maxEmployeeSlots;
  const sessionLimitMessage =
    enforcementEnabled && entitlements.maxSessions != null
      ? t('planLimitSessions').replace('{n}', String(entitlements.maxSessions))
      : '';
  const employeeLimitMessage =
    enforcementEnabled && entitlements.maxEmployeeSlots != null
      ? t('planLimitEmployees').replace('{n}', String(entitlements.maxEmployeeSlots))
      : '';

  useEffect(() => {
    if (!showRevenueTab && activeTab === 'revenue') {
      setActiveTab('dashboard');
    }
  }, [showRevenueTab, activeTab]);

  useEffect(() => {
    if (!showAllSessionsView && isAllSessionsView) {
      setAllSessionsView(false);
      setCurrentSession(sessions[0] || null);
    }
  }, [showAllSessionsView, isAllSessionsView, sessions, setAllSessionsView, setCurrentSession]);

  // Show the upgrade prompt once per dashboard load if the account already sits at its monthly cap.
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const upgradePromptShownRef = useRef(false);
  useEffect(() => {
    if (subscriptionLoading || upgradePromptShownRef.current) return;
    const cap = entitlements.maxDocumentsPerMonth;
    if (enforcementEnabled && cap != null && documentsUsedThisMonth >= cap) {
      setShowUpgradePrompt(true);
    }
    upgradePromptShownRef.current = true;
  }, [subscriptionLoading, enforcementEnabled, entitlements.maxDocumentsPerMonth, documentsUsedThisMonth]);

  const [planTestPickerOpen, setPlanTestPickerOpen] = useState(false);
  useEffect(() => {
    if (!isPlanTestUser || subscriptionLoading) return;
    if (!billing?.planId) setPlanTestPickerOpen(true);
  }, [isPlanTestUser, subscriptionLoading, billing?.planId]);

  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMasterReset, setShowMasterReset] = useState(false);
  const [selectedDocumentFromFinance, setSelectedDocumentFromFinance] = useState<ProcessedDocument | null>(null);
  const [showEmployeePanel, setShowEmployeePanel] = useState(false);
  const storageUploadEnabledRef = useRef(true);

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const removed = await deleteFinancesByDocumentId(documentId);
      await deleteDocumentFromContext(documentId);
      console.log(
        `ðŸ—‘ï¸ Document ${documentId} deleted with ${removed.income} income and ${removed.expenses} expense row(s)`
      );
    } catch (err) {
      console.error('Failed to delete document and linked finances:', err);
      alert(t('alertDocumentDeleteFailed'));
      throw err;
    }
  };

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
  // Expenses include PAYROLL_TAXES (state) but not net salary (shown on Payroll card)
  const totalExpenses = filteredExpenses
    .filter((e) => !isNetPayrollCategory(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
  // Payroll card = net payment to employee(s) only
  const totalPayroll = filteredExpenses
    .filter((e) => isNetPayrollCategory(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
  // VAT calculations
  const vatReceived = filteredIncome.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
  const vatPaid = filteredExpenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
  const vatBalance = vatReceived - vatPaid;
  // Balance: Income - Expenses - Payroll
  const balance = totalIncome - totalExpenses - totalPayroll;

  console.log('Calculated totals:', { totalIncome, totalExpenses, totalPayroll, balance });
  console.log('=== END DEBUG ===');

  const handleMasterReset = async () => {
    if (!confirm(t('alertMasterResetConfirm'))) {
      return;
    }
    
    if (!confirm(t('alertMasterResetFinal'))) {
      return;
    }

    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      if (!db || !user?.uid) {
        throw new Error('Database not available');
      }

      const uid = user.uid;
      const c = collection;
      const w = where;

      const sessionsRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'sessions'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'sessions'), w('restaurant_id', '==', uid)))
      );
      const employeesRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'employees'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'employees'), w('restaurant_id', '==', uid)))
      );
      const incomeRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'income'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'income'), w('restaurant_id', '==', uid)))
      );
      const expenseRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'expenses'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'expenses'), w('restaurant_id', '==', uid)))
      );
      const posRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'pos_readings'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'pos_readings'), w('restaurant_id', '==', uid)))
      );
      const docsRefs = dedupeSnapshots(
        await getDocs(query(c(db, 'documents'), w('restaurantId', '==', uid))),
        await getDocs(query(c(db, 'documents'), w('restaurant_id', '==', uid)))
      );

      const allRefs = [
        ...sessionsRefs,
        ...employeesRefs,
        ...incomeRefs,
        ...expenseRefs,
        ...posRefs,
        ...docsRefs,
      ];

      const deleteCount = await commitDeletesInChunks(db, allRefs);
      
      alert(t('alertMasterResetComplete').replace('{count}', String(deleteCount)));
      
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Master reset error:', error);
      alert(t('alertMasterResetError').replace('{msg}', errMsg(error)));
    }
  };

  const handleAddSession = async () => {
    if (!canAddSession) {
      alert(sessionLimitMessage);
      return;
    }
    await addSession();
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm(t('alertDeleteSessionConfirm'))) return;
    const result = await deleteSession(id);
    if (!result.ok) {
      alert(t('alertDeleteSessionError').replace('{msg}', result.message || t('errorUnknown')));
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

  const handleQueueDocument = async (fileName: string, fileHash?: string, fileRaw?: File): Promise<string> => {
    if (!currentSession) {
      console.error('âŒ No session selected');
      alert(t('alertSelectSessionFirst'));
      throw new Error('No session selected');
    }

    // Check for duplicate document by hash
    if (fileHash) {
      const existingDoc = documents.find(d => d.fileHash === fileHash);
      if (existingDoc) {
        console.log('âš ï¸ Duplicate document detected:', fileHash);
        alert(t('alertDuplicateDocument').replace('{name}', existingDoc.fileName));
        throw new Error('Duplicate document');
      }
    }

    try {
      console.log('ðŸ’¾ Queue-saving document to Firestore...');
      const newDoc = await addDocument({
        id: Math.random().toString(36).substr(2, 9),
        fileName,
        status: 'pending',
        ...(fileHash ? { fileHash } : {}),
      });
      const createdId = newDoc.id;
      console.log('âœ… Document queue-saved with ID:', createdId);

      // Always keep a local backup for resilient reprocessing even if remote storage is unstable/disabled.
      if (fileRaw) {
        void (async () => {
          try {
            const { cacheDocumentFile } = await import('../services/storageService');
            await cacheDocumentFile(createdId, fileRaw);
          } catch (cacheErr) {
            console.warn('âš ï¸ Local cache backup failed:', cacheErr);
          }
        })();
      }

      // Upload to Firebase Storage before AI processing (no Vercel body-size cap on Storage).
      if (fileRaw && user?.uid && storageUploadEnabledRef.current) {
        try {
          console.log('📤 Uploading file to Firebase Storage...');
          const { uploadDocument } = await import('../services/storageService');
          const { downloadURL, storagePath } = await uploadDocument(fileRaw, user.uid, fileName);
          await updateDocumentData(createdId, { fileUrl: downloadURL, storagePath });
          console.log('✅ File stored for processing:', createdId);
        } catch (uploadError: any) {
          console.error('⚠️ Storage upload failed:', uploadError);
          if (uploadError?.code === 'storage/unauthorized') {
            storageUploadEnabledRef.current = false;
            console.warn('Storage upload disabled for this session due to storage/unauthorized.');
          }
        }
      }

      return createdId;
    } catch (error) {
      console.error('âŒ Error queue-saving document:', error);
      alert(t('alertQueueSaveFailed').replace('{msg}', errMsg(error)));
      throw error;
    }
  };

  const resolveDocumentAccountCode = (
    data: FinancialData,
    opts: { kind: 'income' | 'expense'; category?: string; description?: string; isIncome?: boolean }
  ): string | undefined => {
    const ai = data.swissAccountClassification;
    if (ai?.account_code && !ai.splits?.length) {
      return ai.account_code;
    }
    if (opts.description) {
      return classifyLineItemAccountCode({
        vendor: data.issuer,
        description: opts.description,
        isIncome: opts.isIncome ?? opts.kind === 'income',
      });
    }
    return suggestSwissAccountCode({
      kind: opts.kind,
      category: opts.category,
      incomeType: opts.kind === 'income' ? 'SALES' : undefined,
      description: `${data.issuer || ''} ${data.notes || ''}`,
    });
  };

  const handleDocumentData = async (data: FinancialData, fileName: string, fileHash?: string, fileRaw?: File, persistedDocumentId?: string) => {
    console.log('ðŸ”µ handleDocumentData called:', { fileName, hasData: !!data, currentSession: currentSession?.id, persistedDocumentId });

    if (!currentSession) {
      console.error('âŒ No session selected');
      alert(t('alertSelectSessionFirst'));
      throw new Error('No session selected');
    }

    // Capture before the update below — tells us whether this is a genuinely new completion
    // (count it toward the monthly plan cap) or a re-processing of an already-completed
    // document (don't double-count it).
    const wasAlreadyCompleted =
      !!persistedDocumentId && documents.find((d) => d.id === persistedDocumentId)?.status === 'completed';

    let documentId: string;
    try {
      if (persistedDocumentId) {
        await updateDocumentData(persistedDocumentId, {
          status: 'completed',
          data,
          ...(fileHash ? { fileHash } : {}),
        });
        documentId = persistedDocumentId;
        console.log('âœ… Document updated to completed with ID:', documentId);
      } else {
        console.log('ðŸ’¾ Saving document to Firestore (legacy path)...');
        const newDoc = await addDocument({
          id: Math.random().toString(36).substr(2, 9),
          fileName,
          status: 'completed',
          data,
          ...(fileHash ? { fileHash } : {}),
        });
        documentId = newDoc.id;
        console.log('âœ… Document saved with ID:', documentId);
      }
    } catch (error) {
      console.error('âŒ Error saving document:', error);
      alert(t('alertSaveDocumentFailed').replace('{msg}', errMsg(error)));
      throw error;
    }

    if (!wasAlreadyCompleted) {
      try {
        await incrementDocumentUsage();
      } catch (usageError) {
        console.error('Failed to record monthly document usage:', usageError);
      }
    }

    const date = data.date || new Date().toISOString().split('T')[0];
    const amount = data.amountInCHF || data.totalAmount || 0;
    const docType = data.documentType;
    
    console.log('ðŸ“Š Processing document type:', docType, 'Amount:', amount);
    
    // Check if this is revenue based on category or document type
    const isRevenue = data.expenseCategory?.toUpperCase().includes('REVENUE') || 
                      data.expenseCategory?.toUpperCase().includes('SALES') ||
                      docType === 'Ticket/Receipt' ||
                      docType === 'Z2 Multi-Ticket Sheet';
    
    if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
      console.log('ðŸ¦ Processing bank statement with', data.lineItems?.length || 0, 'line items');
      if (data.lineItems) {
        for (const item of data.lineItems) {
          if (item.type === 'INCOME') {
            console.log('âž• Adding income:', item.amount, item.description);
            // Extract VAT if available (typically 7.7% or 8.1% in Switzerland)
            const vatAmount = data.vatAmount || 0;
            const incCode = resolveDocumentAccountCode(data, {
              kind: 'income',
              description: item.description || fileName,
              isIncome: true,
            });
            await addIncome(date, 'SALES', item.amount, item.description || fileName, currentSession.id, documentId, vatAmount, incCode);
          } else if (item.type === 'EXPENSE') {
            console.log('âž– Adding expense:', item.amount, item.description);
            const description = item.description || data.issuer || fileName;
            const vatAmount = data.vatAmount || 0;
            const expCode = resolveDocumentAccountCode(data, {
              kind: 'expense',
              category: 'OTHER',
              description,
            });
            await addExpense(date, 'OTHER', item.amount, description, currentSession.id, undefined, documentId, vatAmount, expCode);
          }
        }
      }
    } else if (docType === 'Pay Slip') {
      const employeeName = data.paySlip?.employee?.name || 'Unknown Employee';
      const settlement = resolvePayrollSettlementMode(data);
      const payrollLines = buildPayrollExpenseLines(data, employeeName, settlement);
      const netForEmployee =
        payrollLines.find((l) => l.category === 'PAYROLL')?.amount ??
        payrollLines[0]?.amount ??
        0;

      console.log('ðŸ’° Processing payslip:', employeeName, settlement, payrollLines);

      try {
        const existingEmployee = employees.find(
          (emp) => emp.name.toLowerCase() === employeeName.toLowerCase()
        );
        if (!existingEmployee && netForEmployee > 0) {
          await addEmployee(employeeName, 'Employee', netForEmployee, currentSession?.id);
        }
      } catch (empError) {
        console.error('âš ï¸ Error managing employee:', empError);
      }

      for (const line of payrollLines) {
        const payrollCode = suggestSwissAccountCode({
          kind: 'expense',
          category: line.category,
          description: line.description,
        });
        await addExpense(
          date,
          line.category,
          line.amount,
          line.description,
          currentSession.id,
          undefined,
          documentId,
          undefined,
          payrollCode
        );
      }
    } else if (isRevenue && amount > 0) {
      console.log('ðŸ’µ Adding revenue:', amount);
      const description = data.issuer || data.notes || fileName;
      const vatAmount = data.vatAmount || 0;
      const incCode = resolveDocumentAccountCode(data, { kind: 'income', description });
      await addIncome(date, 'SALES', amount, description, currentSession.id, documentId, vatAmount, incCode);
    } else if (amount > 0) {
      console.log('ðŸ’¸ Adding expense:', amount);
      const category = data.expenseCategory?.toLowerCase().includes('supplier') ? 'SUPPLIERS' : 
                      data.expenseCategory?.toLowerCase().includes('bill') ? 'BILLS' :
                      data.expenseCategory?.toLowerCase().includes('salary') || data.expenseCategory?.toLowerCase().includes('payroll') ? 'PAYROLL' :
                      'OTHER';
      const description = data.issuer || data.notes || fileName;
      const vatAmount = data.vatAmount || 0;
      const splits = data.swissAccountClassification?.splits;
      if (splits?.length) {
        for (const split of splits) {
          const splitAmount = split.amount ?? amount / splits.length;
          await addExpense(
            date,
            category as any,
            splitAmount,
            split.description || description,
            currentSession.id,
            undefined,
            documentId,
            vatAmount / splits.length,
            split.account_code
          );
        }
      } else {
        const expCode = resolveDocumentAccountCode(data, { kind: 'expense', category, description });
        await addExpense(date, category as any, amount, description, currentSession.id, undefined, documentId, vatAmount, expCode);
      }
    }
    
    console.log('âœ… Document processing complete:', fileName);
  };

  const handleNavigateToDocument = (doc: ProcessedDocument) => {
    setSelectedDocumentFromFinance(doc);
    setActiveTab('documents');
  };

  const handleDocumentUpdated = async (documentId: string, newData: FinancialData) => {
    console.log('ðŸ”„ Updating document and related income/expenses:', documentId);
    
    if (!currentSession) {
      console.error('âŒ No session selected');
      return;
    }

    try {
      // Delete all existing income/expenses linked to this document
      console.log('ðŸ—‘ï¸ Deleting old income/expenses for document:', documentId);
      const removed = await deleteFinancesByDocumentId(documentId);
      console.log(`âœ… Deleted ${removed.income} income and ${removed.expenses} expense entries`);
      
      // Re-create income/expenses from updated document data
      const date = newData.date || new Date().toISOString().split('T')[0];
      const amount = newData.amountInCHF || newData.totalAmount || 0;
      const docType = newData.documentType;
      
      console.log('ðŸ“Š Re-processing document type:', docType, 'Amount:', amount);
      
      // Check if this is revenue based on category or document type
      const isRevenue = newData.expenseCategory?.toUpperCase().includes('REVENUE') || 
                        newData.expenseCategory?.toUpperCase().includes('SALES') ||
                        docType === 'Ticket/Receipt' ||
                        docType === 'Z2 Multi-Ticket Sheet';
      
      if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
        console.log('ðŸ¦ Re-processing bank statement with', newData.lineItems?.length || 0, 'line items');
        if (newData.lineItems) {
          for (const item of newData.lineItems) {
            if (item.type === 'INCOME') {
              console.log('âž• Re-adding income:', item.amount, item.description);
              await addIncome(date, 'SALES', item.amount, item.description || 'Bank Statement', currentSession.id, documentId);
            } else if (item.type === 'EXPENSE') {
              console.log('âž– Re-adding expense:', item.amount, item.description);
              const description = item.description || newData.issuer || 'Bank Statement';
              await addExpense(date, 'OTHER', item.amount, description, currentSession.id, undefined, documentId);
            }
          }
        }
    } else if (docType === 'Pay Slip') {
        const employeeName = newData.paySlip?.employee?.name || 'Unknown Employee';
        const settlement = resolvePayrollSettlementMode(newData);
        const payrollLines = buildPayrollExpenseLines(newData, employeeName, settlement);
        console.log('ðŸ’° Re-processing payslip:', employeeName, settlement, payrollLines);
        for (const line of payrollLines) {
          await addExpense(
            date,
            line.category,
            line.amount,
            line.description,
            currentSession.id,
            undefined,
            documentId
          );
        }
      } else if (isRevenue && amount > 0) {
        console.log('ðŸ’µ Re-adding revenue:', amount);
        const description = newData.issuer || newData.notes || 'Document';
        await addIncome(date, 'SALES', amount, description, currentSession.id, documentId);
      } else if (amount > 0) {
        console.log('ðŸ’¸ Re-adding expense:', amount);
        const category = newData.expenseCategory?.toLowerCase().includes('supplier') ? 'SUPPLIERS' : 
                        newData.expenseCategory?.toLowerCase().includes('bill') ? 'BILLS' :
                        newData.expenseCategory?.toLowerCase().includes('salary') || newData.expenseCategory?.toLowerCase().includes('payroll') ? 'PAYROLL' :
                        'OTHER';
        const description = newData.issuer || newData.notes || 'Document';
        await addExpense(date, category as any, amount, description, currentSession.id, undefined, documentId);
      }
      
      console.log('âœ… Document update complete');
      alert(t('alertDocumentUpdated'));
    } catch (error) {
      console.error('âŒ Error updating document:', error);
      alert(t('alertUpdateDocumentFailed').replace('{msg}', errMsg(error)));
    }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setShowSidebar(false);
  };

  const sidebarNavItems = BUSINESS_NAV_ITEMS.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: t(item.labelKey),
  }));

  return (
    <div className="ba-v3 min-h-[100dvh] min-h-screen bg-cdlp-dark flex flex-col md:flex-row touch-manipulation overscroll-y-contain">
      {showUpgradePrompt && entitlements.maxDocumentsPerMonth != null && (
        <UpgradePromptModal
          documentCap={entitlements.maxDocumentsPerMonth}
          onClose={() => setShowUpgradePrompt(false)}
          onOpenBilling={openBillingTab}
        />
      )}
      {isPlanTestUser ? (
        <>
          {billing?.planId ? <PlanTestBanner onSwitch={() => setPlanTestPickerOpen(true)} /> : null}
          <PlanTestPickerModal
            open={planTestPickerOpen}
            required={!billing?.planId}
            onClose={() => setPlanTestPickerOpen(false)}
          />
        </>
      ) : null}
      {/* Mobile Header */}
      <div className="md:hidden bg-cdlp-black border-b border-cdlp-border px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img
            src={BRAND_LOGO_SRC}
            alt="Paystack.ch"
            width={BRAND_LOGO_SIZE}
            height={BRAND_LOGO_SIZE}
            className="h-11 w-auto max-w-[200px] object-contain shrink-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            className="min-h-11 min-w-11 shrink-0 flex items-center justify-center hover:bg-cdlp-border rounded-lg active:opacity-80"
          >
            <Globe className="w-4 h-4 text-cdlp-gold" />
            <span className="text-xs font-bold text-cdlp-gold uppercase">{language === 'en' ? 'FR' : 'EN'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="min-h-11 min-w-11 shrink-0 flex items-center justify-center hover:bg-cdlp-border rounded-lg active:opacity-80"
            aria-expanded={showSidebar}
            aria-label={t('menuAria')}
          >
            <Menu className="w-6 h-6 text-cdlp-gold" />
          </button>
        </div>
      </div>

      {/* Session Sidebar */}
      <div
        className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-cdlp-black border-r border-cdlp-border flex flex-col
        h-[100dvh] max-h-[100dvh] transform transition-transform duration-300 ease-in-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Desktop Header + nav */}
        <div className="hidden md:flex md:flex-col shrink-0 p-4 border-b border-cdlp-border">
          <div className="flex flex-col items-start mb-4">
            <img
              src={BRAND_LOGO_SRC}
              alt="Paystack.ch"
              width={BRAND_LOGO_SIZE}
              height={BRAND_LOGO_SIZE}
              className="h-10 w-auto max-w-[180px] object-contain shrink-0"
            />
          </div>

          <BusinessSidebarNav
            activeTab={activeTab}
            onTabChange={switchTab}
            showRevenueTab={showRevenueTab}
            items={sidebarNavItems}
          />

          <div className="flex items-center justify-between gap-2 mb-3 pt-2 border-t border-cdlp-border">
            <span className="text-[11px] text-cdlp-muted truncate">{user?.email}</span>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
              className="shrink-0 px-2 py-1 rounded border border-cdlp-border text-[10px] font-bold text-cdlp-muted uppercase flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              {language === 'en' ? 'ENG' : 'FR'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowMasterReset(true)}
            className="ba-master-reset w-full flex items-center justify-center gap-2 py-2 mb-2 text-xs font-bold uppercase rounded"
          >
            <Trash2 className="w-4 h-4" /> {t('dashMasterReset')}
          </button>

          <button
            type="button"
            onClick={handleAddSession}
            disabled={!canAddSession}
            title={!canAddSession ? sessionLimitMessage : undefined}
            className="ba-new-session w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canAddSession ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {t('newSession')}
          </button>
          {enforcementEnabled && entitlements.maxSessions != null ? (
            <p className="mt-2 text-[10px] text-cdlp-muted font-bold uppercase tracking-tight">
              {sessions.length}/{entitlements.maxSessions} {t('sessions')}
            </p>
          ) : null}
        </div>

        {/* Mobile nav + session controls */}
        <div className="md:hidden shrink-0 px-4 pb-3 border-b border-cdlp-border space-y-3">
          <BusinessSidebarNav
            activeTab={activeTab}
            onTabChange={switchTab}
            showRevenueTab={showRevenueTab}
            items={sidebarNavItems}
          />
          <button
            type="button"
            onClick={() => setShowMasterReset(true)}
            className="ba-master-reset w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded"
          >
            <Trash2 className="w-4 h-4" /> {t('dashMasterReset')}
          </button>
        </div>

        {/* Mobile Header in Sidebar */}
        <div className="md:hidden shrink-0 p-4 border-b border-cdlp-border flex items-center justify-between">
          <span className="font-bold text-cdlp-gold text-sm uppercase">{t('sessions')}</span>
          <button onClick={() => setShowSidebar(false)}>
            <X className="w-5 h-5 text-cdlp-muted" />
          </button>
        </div>

        {/* Mobile Add Session Button */}
        <div className="md:hidden shrink-0 p-4 border-b border-cdlp-border">
          <button
            onClick={() => {
              handleAddSession();
              setShowSidebar(false);
            }}
            disabled={!canAddSession}
            title={!canAddSession ? sessionLimitMessage : undefined}
            className="w-full flex items-center justify-center gap-2 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canAddSession ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {t('newSession')}
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase text-cdlp-muted">{t('dashRecentSessions')}</h3>
          </div>
          
          {/* All Sessions View Button */}
          {showAllSessionsView ? (
            <button
              onClick={() => {
                setAllSessionsView(true);
                setCurrentSession(null);
                setShowSidebar(false);
              }}
              className={`w-full p-3 mb-2 rounded border transition-colors ${
                isAllSessionsView
                  ? 'bg-cdlp-gold/10 border-cdlp-gold text-cdlp-gold'
                  : 'bg-cdlp-card border-cdlp-border hover:border-cdlp-gold/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{t('allSessions')}</span>
                {isAllSessionsView && <X className="w-4 h-4" onClick={(e) => { e.stopPropagation(); setAllSessionsView(false); setCurrentSession(sessions[0] || null); }} />}
              </div>
            </button>
          ) : null}

          {sessions.length === 0 ? (
            <p className="text-xs text-cdlp-muted/60">{t('noSessionsYet')}</p>
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
                      <p className="font-bold text-sm flex-1">{getSessionDisplayName(session)}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(session.id, session.name); }}
                          className="text-cdlp-muted hover:text-cdlp-gold"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
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

        {/* Pinned bottom: billing + logout (sessions scroll above) */}
        <div className="shrink-0 p-4 border-t border-cdlp-border bg-cdlp-black space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href="/app/personal/overview"
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded border border-cdlp-gold/40 text-cdlp-gold hover:bg-cdlp-gold/10 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            Personal finances
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase text-cdlp-muted border border-cdlp-border rounded hover:text-cdlp-gold hover:border-cdlp-gold/40"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
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
      <main
        id="main-dashboard-content"
        className="flex-1 flex flex-col overflow-hidden"
        aria-label={t('financialDashboard')}
      >
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 custom-scrollbar pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-8 [-webkit-overflow-scrolling:touch]">
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
              onDocumentQueued={handleQueueDocument}
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
              onDeleteDocument={handleDeleteDocument}
              onNavigateToDocument={handleNavigateToDocument}
              onShowEmployeePanel={() => setShowEmployeePanel(true)}
              t={t}
              user={user}
            />
          )}
          {activeTab === 'revenue' && showRevenueTab ? <POSManager /> : null}
          {activeTab === 'reports' && <ReportsPlaceholder />}
          {activeTab === 'documents' && <DocumentsTab selectedDocument={selectedDocumentFromFinance} onClearSelection={() => setSelectedDocumentFromFinance(null)} />}
          {activeTab === 'billing' ? <BillingPlanPanel /> : null}
        </div>
      </main>

      {/* Mobile: fixed bottom tab bar (app-style) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[45] border-t border-cdlp-border bg-cdlp-black/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
        aria-label={t('navMainAria')}
      >
        <div className="flex max-w-lg mx-auto items-stretch justify-between gap-1 px-1">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 min-h-[52px] active:opacity-90 ${
              activeTab === 'dashboard' ? 'text-cdlp-gold bg-cdlp-gold/10' : 'text-cdlp-muted'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight px-0.5">{t('dashboard')}</span>
          </button>
          {showRevenueTab ? (
            <button
              type="button"
              onClick={() => setActiveTab('revenue')}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 min-h-[52px] active:opacity-90 ${
                activeTab === 'revenue' ? 'text-cdlp-gold bg-cdlp-gold/10' : 'text-cdlp-muted'
              }`}
            >
              <Receipt className="w-5 h-5 shrink-0" aria-hidden />
              <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight px-0.5">{t('revenue')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 min-h-[52px] active:opacity-90 ${
              activeTab === 'reports' ? 'text-cdlp-gold bg-cdlp-gold/10' : 'text-cdlp-muted'
            }`}
          >
            <BarChart3 className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight px-0.5">{t('reports')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 min-h-[52px] active:opacity-90 ${
              activeTab === 'documents' ? 'text-cdlp-gold bg-cdlp-gold/10' : 'text-cdlp-muted'
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight px-0.5">{t('documents')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2 min-h-[52px] active:opacity-90 ${
              activeTab === 'billing' ? 'text-cdlp-gold bg-cdlp-gold/10' : 'text-cdlp-muted'
            }`}
          >
            <CreditCard className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight px-0.5">{t('billingTab')}</span>
          </button>
        </div>
      </nav>

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
                <h3 className="text-lg font-black text-red-500 uppercase">{t('dashMasterReset')}</h3>
                <p className="text-xs text-red-400">{t('dashPermanentDeletion')}</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-sm text-white font-bold">{t('dashDeleteEverything')}</p>
              <ul className="space-y-2 text-xs text-cdlp-muted">
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllSessionsCount').replace('{n}', String(sessions.length))}</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllIncomeCount').replace('{n}', String(income.length))}</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllExpensesCount').replace('{n}', String(expenses.length))}</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllPosReadings')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllDocumentsCount').replace('{n}', String(documents.length))}</span>
                </li>
                <li className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span>{t('dashAllEmployeesCount').replace('{n}', String(employees.length))}</span>
                </li>
              </ul>
              <div className="bg-red-600/10 border border-red-600/30 rounded p-3 mt-4">
                <p className="text-xs text-red-400 font-bold">{t('resetCannotUndo')}</p>
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
                {t('dashYesDeleteEverything')}
              </button>
              <button
                onClick={() => setShowMasterReset(false)}
                className="flex-1 py-3 bg-cdlp-card border border-cdlp-border text-white text-sm font-bold uppercase rounded hover:bg-cdlp-border/50"
              >
                {t('cancel')}
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
                  <h2 className="text-xl font-black text-cdlp-gold uppercase">{t('employees')}</h2>
                  <p className="text-xs text-cdlp-muted mt-1">{t('dashEmployeesSubtitle')}</p>
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
                  if (!canAddEmployee) return;
                  setShowEmployeePanel(false);
                  setShowAddEmployee(true);
                }}
                disabled={!canAddEmployee}
                title={!canAddEmployee ? employeeLimitMessage : undefined}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cdlp-gold text-cdlp-black text-sm font-bold uppercase rounded hover:bg-cdlp-gold-light mb-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {canAddEmployee ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Add Employee
              </button>
              {enforcementEnabled && entitlements.maxEmployeeSlots != null ? (
                <p className={`mb-6 text-[10px] font-bold uppercase tracking-tight ${canAddEmployee ? 'text-cdlp-muted' : 'text-red-400'}`}>
                  {t('dashEmployeeSlots').replace('{n}', String(employees.length)).replace('{max}', String(entitlements.maxEmployeeSlots))}
                  {!canAddEmployee ? ` Â· ${employeeLimitMessage}` : ''}
                </p>
              ) : (
                <div className="mb-6" />
              )}

              {/* Employees List */}
              {employees.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-cdlp-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-cdlp-muted">{t('dashNoEmployeesYet')}</p>
                  <p className="text-xs text-cdlp-muted/60 mt-1">{t('dashAddFirstEmployee')}</p>
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
                            if (confirm(t('alertDeleteEmployeeConfirm').replace('{name}', emp.name))) {
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
                            <span className="text-xs text-cdlp-muted">{t('dashNetSalary')}</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {emp.net_salary.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.social_contributions && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cdlp-muted">{t('dashSocialCharges')}</span>
                            <span className="text-sm font-bold text-blue-400">
                              {emp.social_contributions.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.state_rest && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-cdlp-muted">{t('dashStateRest')}</span>
                            <span className="text-sm font-bold text-purple-400">
                              {emp.state_rest.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                            </span>
                          </div>
                        )}
                        {emp.monthly_salary && (
                          <div className="flex justify-between items-center pt-2 border-t border-cdlp-border">
                            <span className="text-xs font-bold text-cdlp-gold uppercase">{t('dashTotalCost')}</span>
                            <span className="text-sm font-black text-cdlp-gold">
                              {emp.monthly_salary.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
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
                    <span className="text-sm font-bold text-cdlp-gold uppercase">{t('dashTotalPayroll')}</span>
                    <span className="text-lg font-black text-cdlp-gold">
                      {employees.reduce((sum, emp) => sum + (emp.monthly_salary || 0), 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                    </span>
                  </div>
                  <p className="text-xs text-cdlp-muted mt-2">{t('dashEmployeeCount').replace('{n}', String(employees.length))}</p>
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
  const formatChf = useFormatChf();
  const { language } = useLanguage();
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
        alert(t('alertDropRejected'));
      }
    } catch (err) {
      console.error('Drop error:', err);
      alert(t('alertDropError').replace('{msg}', err instanceof Error ? err.message : t('errorUnknown')));
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
        updates.account_code = editForm.account_code || undefined;
      } else {
        updates.category = editForm.category;
        updates.account_code = editForm.account_code || undefined;
      }
      
      await onUpdate(editForm.id, updates);
      setEditingId(null);
      setEditForm(null);
      alert(t('alertUpdatedSuccess'));
    } catch (err) {
      console.error('Save edit error:', err);
      alert(t('alertSaveError').replace('{msg}', err instanceof Error ? err.message : t('errorUnknown')));
    }
  };

  const isIncome = type === 'income';
  const colorClass = isIncome ? 'emerald' : 'red';

  return (
    <div 
      className={`ba-panel border-2 transition-all ${
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
            {t('dropConvertTo').replace('{type}', type === 'income' ? t('income') : t('expenses'))}
          </p>
        </div>
      )}
      
      <div className="space-y-2 max-h-64 md:max-h-96 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <p className="text-xs text-cdlp-muted/60">{type === 'income' ? t('noIncomeEntries') : t('noExpenseEntries')}</p>
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
                    placeholder={t('dashDescription')}
                    className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                  />
                  {isIncome ? (
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                    >
                      <option value="SALES">{t('SALES')}</option>
                      <option value="RESERVATION">{t('RESERVATION')}</option>
                    </select>
                  ) : (
                    <select
                      value={editForm.category}
                      onChange={(e) => {
                        const category = e.target.value;
                        setEditForm({
                          ...editForm,
                          category,
                          account_code:
                            editForm.account_code ||
                            suggestSwissAccountCode({
                              kind: 'expense',
                              category,
                              description: editForm.description || '',
                            }),
                        });
                      }}
                      className="w-full px-2 py-1 bg-cdlp-dark border border-cdlp-border rounded text-xs text-white"
                    >
                      <option value="BILLS">{t('BILLS')}</option>
                      <option value="SUPPLIERS">{t('SUPPLIERS')}</option>
                      <option value="PAYROLL">{t('PAYROLL')}</option>
                      <option value="PAYROLL_TAXES">{t('PAYROLL_TAXES')}</option>
                      <option value="OTHER">{t('OTHER')}</option>
                    </select>
                  )}
                  <label className="block text-[9px] uppercase font-bold text-cdlp-muted tracking-wider">
                    {t('swissAccountCode')}
                  </label>
                  <SwissAccountCodeField
                    value={editForm.account_code || ''}
                    onChange={(account_code) => setEditForm({ ...editForm, account_code })}
                    lang={language}
                    kind={isIncome ? 'income' : 'expense'}
                    category={editForm.category}
                    incomeType={editForm.type}
                    description={editForm.description || ''}
                    placeholder={t('swissAccountCodePlaceholder')}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded hover:bg-emerald-700"
                    >
                      <Check className="w-3 h-3 inline mr-1" /> {t('dashSave')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 px-2 py-1 bg-cdlp-card border border-cdlp-border text-white text-[10px] font-bold uppercase rounded hover:bg-cdlp-border/50"
                    >
                      <X className="w-3 h-3 inline mr-1" /> {t('cancel')}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-xs md:text-sm truncate">
                        {isIncome ? item.type : item.category}
                      </p>
                      <SwissAccountCodeBadge konto={item.account_code} lang={language} />
                      {item.document_id && (
                        <FileText className="w-3 h-3 text-cdlp-gold flex-shrink-0" title={t('linkedToDocument')} />
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-cdlp-muted">{item.date}</p>
                    {item.description && (
                      <p className="text-[10px] md:text-xs text-cdlp-muted mt-1 truncate">{item.description}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <p className={`font-black text-sm md:text-base text-${colorClass}-500`}>
                      {formatChf(item.amount)}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 hover:bg-cdlp-gold/20 rounded transition-colors"
                        title={t('dashActionEdit')}
                      >
                        <Edit2 className="w-3 h-3 text-cdlp-gold" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title={t('dashActionDelete')}
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
function formatLiveClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function useLiveClock(): string {
  const [clock, setClock] = useState(() => formatLiveClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatLiveClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

function DashboardTab({ currentSession, isAllSessionsView, totalIncome, totalExpenses, totalPayroll, balance, vatReceived, vatPaid, vatBalance, filteredIncome, filteredExpenses, onAddIncome, onAddExpense, onDocumentQueued, onDocumentData, onDocumentUpdated, language, documents, updateDocument, deleteIncome, deleteExpense, updateIncome, updateExpense, addIncome, addExpense, onDeleteDocument, t, user, onNavigateToDocument, onShowEmployeePanel }: any) {
  const chfLocale = useChfLocale();
  const liveClock = useLiveClock();
  const vatOnSalesRate = totalIncome > 0 ? (vatReceived / totalIncome) * 100 : 0;
  const expenseBaseForVat = totalExpenses + totalPayroll;
  const vatOnPurchasesRate = expenseBaseForVat > 0 ? (vatPaid / expenseBaseForVat) * 100 : 0;
  const sessionTimestamp = isAllSessionsView
    ? t('allSessions')
    : currentSession
      ? getSessionDisplayName(currentSession)
      : '';

  const handleItemClick = (item: any) => {
    if (item.document_id && onNavigateToDocument) {
      const doc = documents.find((d: any) => d.id === item.document_id);
      if (doc) {
        onNavigateToDocument(doc);
      } else {
        alert(t('alertDocumentNotFound'));
      }
    }
  };

  return (
    <>
      <div className="ba-page-header">
        <div className="min-w-0">
          <h1>{t('dashboard')}</h1>
          {sessionTimestamp ? (
            <p className="text-xs text-cdlp-muted tabular-nums mt-1 font-normal normal-case tracking-normal">{sessionTimestamp}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="text-[11px] md:text-xs text-cdlp-muted tabular-nums font-mono">{liveClock}</p>
          <button
            onClick={onShowEmployeePanel}
            className="ba-filter-chip flex items-center gap-2 !h-auto py-2"
          >
            <Users className="w-4 h-4" /> {t('employees')}
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      {(() => {
        const flowBase = Math.max(totalIncome, totalExpenses + totalPayroll, Math.abs(balance), 1);
        const fmt = (n: number) =>
          n.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              <BusinessKpiCard
                label={t('income')}
                value={fmt(totalIncome)}
                icon={TrendingUp}
                tone="green"
                progressPct={(totalIncome / flowBase) * 100}
              />
              <BusinessKpiCard
                label={t('expenses')}
                value={fmt(totalExpenses)}
                icon={TrendingDown}
                tone="red"
                progressPct={(totalExpenses / flowBase) * 100}
              />
              <BusinessKpiCard
                label={t('payroll')}
                value={fmt(totalPayroll)}
                icon={Users}
                tone="gold"
                progressPct={(totalPayroll / flowBase) * 100}
              />
              <BusinessKpiCard
                label={t('balance')}
                value={fmt(balance)}
                icon={DollarSign}
                tone={balance >= 0 ? 'green' : 'red'}
                progressPct={(Math.abs(balance) / flowBase) * 100}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
              <BusinessKpiCard
                label={t('vatReceivedLabel')}
                value={fmt(vatReceived)}
                hint={t('vatFromCustomersHint').replace('{rate}', vatOnSalesRate.toFixed(2))}
                icon={Receipt}
                tone="blue"
                progressPct={vatOnSalesRate > 0 ? Math.min(vatOnSalesRate * 10, 100) : 8}
              />
              <BusinessKpiCard
                label={t('vatPaidLabel')}
                value={fmt(vatPaid)}
                hint={t('vatOnPurchasesHint').replace('{rate}', vatOnPurchasesRate.toFixed(2))}
                icon={Receipt}
                tone="gold"
                progressPct={vatOnPurchasesRate > 0 ? Math.min(vatOnPurchasesRate * 10, 100) : 8}
              />
              <BusinessKpiCard
                label={t('vatBalanceLabel')}
                value={fmt(vatBalance)}
                hint={vatBalance >= 0 ? t('vatBalanceToPay') : t('vatBalanceRefund')}
                icon={Receipt}
                tone={vatBalance >= 0 ? 'purple' : 'red'}
                progressPct={Math.min((Math.abs(vatBalance) / Math.max(vatReceived, 1)) * 100, 100)}
              />
            </div>
          </>
        );
      })()}

      {/* Document Upload Section */}
      {!currentSession && !isAllSessionsView && (
        <div className="mb-6 bg-cdlp-gold/10 border border-cdlp-gold rounded-lg p-4">
          <p className="text-sm text-cdlp-gold">{t('alertSelectSessionForUpload')}</p>
        </div>
      )}
      {currentSession && (
        <div className="mb-6">
          <DocumentProcessor 
            documents={documents}
            updateDocument={updateDocument}
            onDeleteDocument={onDeleteDocument}
            onDocumentQueued={onDocumentQueued}
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
            if (confirm(t('alertDeleteIncomeConfirm'))) {
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
            
            if (confirm(t('alertConvertExpenseToIncomeConfirm'))) {
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
                  alert(t('alertConvertedToIncomeSuccess'));
                } else {
                  console.error('addIncome returned null');
                  alert(t('alertAddIncomeFailed'));
                }
              } catch (err) {
                console.error('Error converting to income:', err);
                alert(t('alertGenericError').replace('{msg}', err instanceof Error ? err.message : t('errorUnknown')));
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
            if (confirm(t('alertDeleteExpenseConfirm'))) {
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
            
            if (confirm(t('alertConvertIncomeToExpenseConfirm'))) {
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
                  alert(t('alertConvertedToExpenseSuccess'));
                } else {
                  console.error('addExpense returned null');
                  alert(t('alertAddExpenseFailed'));
                }
              } catch (err) {
                console.error('Error converting to expense:', err);
                alert(t('alertGenericError').replace('{msg}', err instanceof Error ? err.message : t('errorUnknown')));
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
  const { enforcementEnabled, entitlements } = useSubscription();
  const { t, language } = useLanguage();
  const chfLocale = useChfLocale();
  const advancedReports = !enforcementEnabled || entitlements.advancedAnalyticsAndReports;

  const categoryLabel = (cat: string) => {
    const known = ['BILLS', 'SUPPLIERS', 'PAYROLL', 'PAYROLL_TAXES', 'OTHER'] as const;
    if ((known as readonly string[]).includes(cat)) return t(cat);
    return cat;
  };
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [filterActive, setFilterActive] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [supplierFilter, setSupplierFilter] = React.useState<string>('all');
  const [vatPeriodMode, setVatPeriodMode] = React.useState<'month' | 'semester' | 'year' | 'allYears'>('month');

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
      const month = parseMonthKey(item.date);
      if (!month) return;
      if (!months[month]) months[month] = { income: 0, expenses: 0, balance: 0 };
      months[month].income += item.amount;
    });
    
    dateFilteredExpenses.forEach(item => {
      const month = parseMonthKey(item.date);
      if (!month) return;
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
        const supplier = item.description || t('repUnknown');
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
  
  const reportPayload = () => ({
    income: dateFilteredIncome,
    expenses: dateFilteredExpenses,
    monthlyData,
    supplierData,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sessionName: isAllSessionsView ? t('allSessions') : (currentSession ? getSessionDisplayName(currentSession) : undefined),
    locale: language,
    labelCategory: categoryLabel,
    labelIncomeType: (type: string) =>
      type === 'SALES' || type === 'RESERVATION' ? t(type) : type,
  });

  const handleExport = async (format: 'csv' | 'pdf') => {
    const { exportToCSV, exportToPDF } = await import('../services/reportExportService');
    const reportData = reportPayload();
    
    if (format === 'csv') {
      exportToCSV(reportData);
    } else {
      await exportToPDF(reportData);
    }
  };

  const handleVatExport = async (format: 'csv' | 'pdf') => {
    const { exportSwissVatCSV, exportSwissVatPDF } = await import('../services/reportExportService');
    const reportData = reportPayload();

    if (format === 'csv') {
      exportSwissVatCSV(reportData, vatPeriodMode);
    } else {
      await exportSwissVatPDF(reportData, vatPeriodMode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="ba-page-header">
        <h1>{t('reports')}</h1>
      </div>
      {/* Filters */}
      <div className="ba-panel">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('repDateRangeFilter')}</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="ba-verify-field flex-1 !w-auto"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ba-verify-field flex-1 !w-auto"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('repCategoryFilter')}</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="ba-verify-field"
            >
              <option value="all">{t('repAllCategories')}</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{categoryLabel(cat)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('repSupplierFilter')}</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="ba-verify-field"
              disabled={uniqueSuppliers.length === 0}
            >
              <option value="all">{t('repAllSuppliers')}</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => setQuickFilter('thisMonth')} className="ba-filter-chip">
            {t('repThisMonth')}
          </button>
          <button type="button" onClick={() => setQuickFilter('lastMonth')} className="ba-filter-chip">
            {t('repLastMonth')}
          </button>
          <button type="button" onClick={() => setQuickFilter('last3Months')} className="ba-filter-chip">
            {t('repLast3Months')}
          </button>
          <button type="button" onClick={() => setQuickFilter('thisYear')} className="ba-filter-chip">
            {t('repThisYear')}
          </button>
          <button type="button" onClick={clearFilter} className="ba-filter-chip ba-filter-chip--danger">
            {t('repClearAll')}
          </button>
        </div>
        {(filterActive || categoryFilter !== 'all' || supplierFilter !== 'all') && (
          <div className="text-xs text-cdlp-gold flex flex-wrap gap-2">
            {filterActive && dateFrom && dateTo && (
              <span>{t('repFilterDate').replace('{from}', dateFrom).replace('{to}', dateTo)}</span>
            )}
            {categoryFilter !== 'all' && (
              <span>{t('repFilterCategory').replace('{cat}', categoryLabel(categoryFilter))}</span>
            )}
            {supplierFilter !== 'all' && (
              <span>{t('repFilterSupplier').replace('{name}', supplierFilter)}</span>
            )}
          </div>
        )}
      </div>

      {/* Download Section */}
      <div className="ba-panel">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-3 w-full lg:w-auto">
            <div>
              <h3 className="text-sm font-bold text-cdlp-gold uppercase mb-1">{t('repExportReport')}</h3>
              <p className="text-xs text-cdlp-muted">{t('repExportReportDesc')}</p>
            </div>
            {advancedReports ? (
              <div>
                <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-1">{t('repSwissVatStatement')}</h4>
                <p className="text-[11px] text-cdlp-muted">{t('repSwissVatDesc')}</p>
              </div>
            ) : null}
          </div>
          <div className="w-full lg:w-auto space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light transition-colors"
              >
                <Download className="w-4 h-4" /> {t('repDownloadCsv')}
              </button>
              <button
                type="button"
                disabled={!advancedReports}
                title={!advancedReports ? t('reportsAdvancedLocked') : undefined}
                onClick={() => advancedReports && handleExport('pdf')}
                className="flex items-center gap-2 px-4 py-2 bg-cdlp-card border border-cdlp-gold text-cdlp-gold text-xs font-bold uppercase rounded hover:bg-cdlp-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> {t('repDownloadPdf')}
              </button>
            </div>
            {advancedReports ? (
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={vatPeriodMode}
                  onChange={(e) => setVatPeriodMode(e.target.value as 'month' | 'semester' | 'year' | 'allYears')}
                  className="ba-verify-field !w-auto uppercase"
                >
                  <option value="month">{t('repTvaByMonth')}</option>
                  <option value="semester">{t('repTvaBy6Months')}</option>
                  <option value="year">{t('repTvaByYear')}</option>
                  <option value="allYears">{t('repTvaEveryYear')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleVatExport('csv')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> {t('repTvaCsv')}
                </button>
                <button
                  type="button"
                  onClick={() => handleVatExport('pdf')}
                  className="flex items-center gap-2 px-4 py-2 bg-cdlp-card border border-blue-500 text-blue-400 text-xs font-bold uppercase rounded hover:bg-blue-500/10 transition-colors"
                >
                  <Download className="w-4 h-4" /> {t('repTvaPdf')}
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-cdlp-muted font-bold uppercase tracking-tight">{t('reportsAdvancedLocked')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Analysis */}
      <div className="ba-panel">
        <div className="ba-section-head">
          <BarChart3 className="w-5 h-5" />
          <h2>{t('repMonthlyAnalysis')}</h2>
        </div>
        {monthlyData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-cdlp-muted text-sm">{t('repNoData')}</p>
            <p className="text-cdlp-muted/70 text-xs mt-2">{t('repNoDataHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {monthlyData.map(([month, data]) => {
              const monthName = formatMonthYearLabel(month, chfLocale, t('repInvalidMonth'));
              return (
                <div key={month} className="ba-stat-row">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-cdlp-gold uppercase">{monthName}</h3>
                    <span className={`text-lg font-black ${data.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {data.balance.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">{t('repIncome')}</p>
                      <p className="font-bold text-emerald-500">{data.income.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">{t('repExpenses')}</p>
                      <p className="font-bold text-red-500">{data.expenses.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-cdlp-muted uppercase mb-1">{t('repBalance')}</p>
                      <p className={`font-bold ${data.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {data.balance.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      <div className="ba-panel">
        <div className="ba-section-head">
          <Users className="w-5 h-5" />
          <h2>{t('repTopSuppliers')}</h2>
        </div>
        {supplierData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-cdlp-muted text-sm">{t('repNoSuppliers')}</p>
            <p className="text-cdlp-muted/70 text-xs mt-2">{t('repNoSuppliersHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {supplierData.map(([supplier, amount]) => (
              <div key={supplier} className="ba-stat-row flex justify-between items-center !py-3">
                <span className="text-sm font-bold ba-field-value truncate flex-1">{supplier}</span>
                <span className="text-sm font-black text-cdlp-gold ml-4">{amount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ selectedDocument: initialSelectedDocument, onClearSelection }: { selectedDocument?: ProcessedDocument | null; onClearSelection?: () => void }) {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const posReportsLabel = t('docPosReports');
  const { documents, updateDocument } = useDocuments();
  const [filter, setFilter] = useState<'all' | 'suppliers' | 'employees' | 'pos'>('all');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(initialSelectedDocument || null);
  const [invoiceBreakdownTab, setInvoiceBreakdownTab] = useState(0);

  // Update selectedDocument when initialSelectedDocument changes
  React.useEffect(() => {
    if (initialSelectedDocument) {
      setSelectedDocument(initialSelectedDocument);
    }
  }, [initialSelectedDocument]);

  React.useEffect(() => {
    setInvoiceBreakdownTab(0);
  }, [selectedDocument?.id, selectedDocument?.data?.subDocuments?.length ?? 0]);

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
        const employeeName = doc.data.paySlip?.employee?.name || t('docUnknownEmployee');
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
    if (filter === 'pos') return [[posReportsLabel, groupedDocs.posReports]];
    
    // All documents
    return [
      ...Object.entries(groupedDocs.suppliers),
      ...Object.entries(groupedDocs.employees),
      ...(groupedDocs.posReports.length > 0 ? [[posReportsLabel, groupedDocs.posReports]] : [])
    ];
  }, [filter, groupedDocs, posReportsLabel]);

  // Group documents by month within an entity
  const groupByMonth = (docs: ProcessedDocument[]) => {
    const byMonth: Record<string, ProcessedDocument[]> = {};
    docs.forEach(doc => {
      const monthKey = parseMonthKey(doc.data?.date);
      if (!monthKey) return;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(doc);
    });
    return Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  };

  // If viewing a specific document
  if (selectedDocument) {
    return (
      <div className="space-y-6">
        <div className="ba-page-header flex-col items-start !mb-4">
          <button
            type="button"
            onClick={() => {
              setSelectedDocument(null);
              if (onClearSelection) onClearSelection();
            }}
            className="flex items-center gap-2 text-cdlp-gold hover:text-cdlp-gold-light text-sm font-bold uppercase mb-2"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> {t('docBackToDocuments')}
          </button>
          <h1 className="truncate max-w-full">{selectedDocument.fileName}</h1>
        </div>

        <div className="ba-verify-shell">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
            <div className="lg:col-span-4 ba-verify-preview flex flex-col">
              <div className="p-4 border-b border-cdlp-border">
                <h3 className="text-xs font-black uppercase text-emerald-400 tracking-widest">{t('docPreview')}</h3>
              </div>
              <div className="flex-1 min-h-[280px] overflow-hidden flex items-center justify-center">
                {(selectedDocument.fileUrl || selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
                  selectedDocument.fileName.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={selectedDocument.fileUrl || selectedDocument.fileDataUrl || (selectedDocument.fileRaw ? URL.createObjectURL(selectedDocument.fileRaw) : '')}
                      className="w-full h-full min-h-[280px]"
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
                    <FileText className="w-16 h-16 text-cdlp-muted mx-auto mb-4 opacity-40" />
                    <p className="text-sm text-cdlp-muted mb-2">{t('docFileNotAvailable')}</p>
                    <p className="text-xs text-cdlp-muted opacity-70">{t('docFileNotStored')}</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-cdlp-border">
                {(selectedDocument.fileUrl || selectedDocument.fileDataUrl || selectedDocument.fileRaw) ? (
                  <button
                    type="button"
                    onClick={() => openDocumentInNewTab(selectedDocument)}
                    className="ba-btn-approve w-full h-10 flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> {t('docOpenRawTrace')}
                  </button>
                ) : (
                  <div className="text-center text-xs text-cdlp-muted italic">{t('docOriginalUnavailable')}</div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 ba-verify-form p-4 md:p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Document Info */}
                <div>
                  <h3 className="text-sm font-black uppercase text-cdlp-gold mb-4">{t('docInformation')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docIssuerEntity')}</label>
                      <p className="ba-field-value">{selectedDocument.data?.issuer || t('na')}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docDate')}</label>
                      <p className="ba-field-value">{selectedDocument.data?.date || t('na')}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docTotalAmount')}</label>
                      <p className="text-lg font-black text-cdlp-gold">{(selectedDocument.data?.totalAmount || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docDocumentType')}</label>
                      <p className="ba-field-value">{selectedDocument.data?.documentType || t('repUnknown')}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docVatAmount')}</label>
                      <p className="text-sm font-bold text-blue-400">{(selectedDocument.data?.vatAmount || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docNetAmount')}</label>
                      <p className="text-sm font-bold text-emerald-400">{(selectedDocument.data?.netAmount || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedDocument.data?.originalCurrency || 'CHF'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docCategory')}</label>
                      <p className="ba-field-value">{selectedDocument.data?.expenseCategory || t('docUncategorized')}</p>
                    </div>
                    {selectedDocument.data?.notes && (
                      <div className="col-span-2">
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docNotes')}</label>
                        <p className="ba-field-value font-normal">{selectedDocument.data.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Interpretation */}
                {selectedDocument.data?.aiInterpretation && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('docAiAnalysis')}</h3>
                    <div className="ba-subpanel">
                      <p className="text-sm text-cdlp-muted italic">{selectedDocument.data.aiInterpretation}</p>
                    </div>
                  </div>
                )}

                {/* Multi-invoice breakdown (one item per detected invoice block across pages) */}
                {selectedDocument.data?.subDocuments && selectedDocument.data.subDocuments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">
                      {t('docInvoiceBreakdown').replace('{n}', String(selectedDocument.data.subDocuments.length))}
                    </h3>
                    <p className="text-[10px] text-cdlp-muted mb-3">{t('docInvoiceBreakdownHint')}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedDocument.data.subDocuments.map((subDoc: any, idx: number) => {
                        const active = idx === invoiceBreakdownTab;
                        return (
                          <button
                            key={`doc-inv-tab-${idx}`}
                            type="button"
                            onClick={() => setInvoiceBreakdownTab(idx)}
                            className={`ba-filter-chip max-w-[200px] truncate ${active ? 'ba-filter-chip--active' : ''}`}
                          >
                            <span className="font-bold block truncate">{subDoc.issuer || t('docInvoiceN').replace('{n}', String(idx + 1))}</span>
                            <span className="font-mono text-[10px] text-cdlp-gold">
                              {(Number(subDoc.totalAmount || 0)).toLocaleString(chfLocale, { minimumFractionDigits: 2 })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const subs = selectedDocument.data!.subDocuments!;
                      const idx = Math.min(invoiceBreakdownTab, Math.max(0, subs.length - 1));
                      const subDoc = subs[idx];
                      return (
                        <div className="ba-subpanel grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docDate')}</p>
                            <p className="font-bold text-foreground">{subDoc.date || t('na')}</p>
                          </div>
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docCurrency')}</p>
                            <p className="font-bold text-foreground">{subDoc.originalCurrency || selectedDocument.data?.originalCurrency || 'CHF'}</p>
                          </div>
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docGrossTotal')}</p>
                            <p className="font-black text-cdlp-gold">
                              {(Number(subDoc.totalAmount || 0)).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docNetAmount')}</p>
                            <p className="font-bold text-foreground">
                              {(Number(subDoc.netAmount || 0)).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docVatAmount')}</p>
                            <p className="font-bold text-foreground">
                              {(Number(subDoc.vatAmount || 0)).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-cdlp-muted uppercase">{t('docVatRate')}</p>
                            <p className="font-bold text-foreground">{Number(subDoc.vatRate || 0)}%</p>
                          </div>
                          {subDoc.pageRange && (
                            <div className="col-span-2">
                              <p className="text-cdlp-muted uppercase">{t('docPages')}</p>
                              <p className="font-bold text-foreground">{subDoc.pageRange}</p>
                            </div>
                          )}
                          <div className="col-span-2">
                            <p className="text-cdlp-muted uppercase">{t('docCategory')}</p>
                            <p className="font-bold text-foreground">{subDoc.expenseCategory || 'OTHER'}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Line Items if available */}
                {selectedDocument.data?.lineItems && selectedDocument.data.lineItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('docLineItems')}</h3>
                    <div className="border border-cdlp-border rounded overflow-hidden">
                      <table className="ba-data-table min-w-full text-xs">
                        <thead>
                          <tr>
                            <th>{t('docDate')}</th>
                            <th>{t('docDescription')}</th>
                            <th className="text-right">{t('docAmount')}</th>
                            <th className="text-center">{t('docType')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cdlp-border">
                          {selectedDocument.data.lineItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-cdlp-muted">{item.date}</td>
                              <td className="px-3 py-2 ba-field-value">{item.description}</td>
                              <td className={`px-3 py-2 text-right font-bold ${item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.amount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  item.type === 'INCOME' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                                }`}>
                                  {item.type === 'INCOME' ? t('dpFlowIncome') : t('dpFlowExpense')}
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
                    <h3 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('docPayslipDetails')}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docEmployee')}</label>
                        <p className="ba-field-value">{selectedDocument.data.paySlip.employee?.name || t('na')}</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docEmployer')}</label>
                        <p className="ba-field-value">{selectedDocument.data.paySlip.employer?.name || t('na')}</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docGrossPay')}</label>
                        <p className="text-sm font-bold text-emerald-400">{(selectedDocument.data.paySlip.grossPay || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-cdlp-muted block mb-1">{t('docNetPay')}</label>
                        <p className="text-sm font-bold text-cdlp-gold">{(selectedDocument.data.paySlip.netPay || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                      </div>
                    </div>
                    {selectedDocument.data.paySlip.components && selectedDocument.data.paySlip.components.length > 0 && (
                      <div className="border border-cdlp-border rounded overflow-hidden">
                        <table className="ba-data-table min-w-full text-xs">
                          <thead>
                            <tr>
                              <th>{t('docComponent')}</th>
                              <th className="text-right">{t('docAmount')}</th>
                              <th className="text-center">{t('docType')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cdlp-border">
                            {selectedDocument.data.paySlip.components.map((comp, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 ba-field-value">{comp.description}</td>
                                <td className={`px-3 py-2 text-right font-bold ${comp.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {comp.amount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    comp.type === 'INCOME' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                                  }`}>
                                    {comp.type === 'INCOME' ? t('dpFlowIncome') : t('dpFlowExpense')}
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
            <ChevronRight className="w-4 h-4 rotate-180" /> {t('docBack')}
          </button>
          <h2 className="text-xl md:text-2xl font-black text-cdlp-gold uppercase">{formatIssuerForDisplay(selectedEntity, t)}</h2>
        </div>

        {monthlyGroups.length === 0 ? (
          <div className="ba-panel p-12 text-center">
            <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">{t('docNoDocuments')}</h3>
            <p className="text-cdlp-muted text-sm">{t('docNoDocumentsEntity')}</p>
          </div>
        ) : (
          monthlyGroups.map(([month, docs]) => {
          const totalAmount = docs.reduce((sum, d) => sum + (d.data?.totalAmount || 0), 0);
          const monthName = formatMonthYearLabel(month, chfLocale, t('repInvalidMonth'));

          return (
            <div key={month} className="ba-panel ba-panel--flat overflow-hidden">
              <div className="ba-subpanel !rounded-none border-x-0 border-t-0 flex justify-between items-center">
                <h3 className="text-sm font-bold text-cdlp-gold uppercase">{monthName}</h3>
                <div className="text-right">
                  <p className="text-xs text-cdlp-muted uppercase">{t('docTotalChf')}</p>
                  <p className="text-lg font-black ba-field-value">{totalAmount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</p>
                </div>
              </div>
              <div className="divide-y divide-cdlp-border">
                {docs.map(doc => (
                  <div key={doc.id} className="p-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors group">
                    <div className="flex justify-between items-start">
                      <button
                        type="button"
                        onClick={() => setSelectedDocument(doc)}
                        className="flex-1 text-left"
                      >
                        <p className="font-bold ba-field-value text-sm group-hover:text-cdlp-gold transition-colors">{doc.fileName}</p>
                        <p className="text-xs text-cdlp-muted mt-1">{doc.data?.date}</p>
                        {doc.data?.notes && (
                          <p className="text-xs text-cdlp-muted mt-1">{doc.data.notes}</p>
                        )}
                      </button>
                      <div className="text-right ml-4 flex items-center gap-3">
                        <div>
                          <p className="font-black ba-field-value text-base">{(doc.data?.totalAmount || 0).toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-cdlp-muted">{doc.data?.originalCurrency || 'CHF'}</p>
                        </div>
                        <button
                          onClick={() => setSelectedDocument(doc)}
                          className="p-2 hover:bg-cdlp-gold/10 rounded transition-colors"
                          title={t('docViewDetails')}
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
      <div className="ba-page-header">
        <h1>{t('documentsLibraryTitle')}</h1>
      </div>

      {/* Filter Options */}
      <div className="ba-panel">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter('all')} className={`ba-filter-chip ${filter === 'all' ? 'ba-filter-chip--active' : ''}`}>
            {t('docAllDocuments')}
          </button>
          <button type="button" onClick={() => setFilter('suppliers')} className={`ba-filter-chip ${filter === 'suppliers' ? 'ba-filter-chip--active' : ''}`}>
            {t('docSuppliersCount').replace('{n}', String(Object.keys(groupedDocs.suppliers).length))}
          </button>
          <button type="button" onClick={() => setFilter('employees')} className={`ba-filter-chip ${filter === 'employees' ? 'ba-filter-chip--active' : ''}`}>
            {t('docEmployeesCount').replace('{n}', String(Object.keys(groupedDocs.employees).length))}
          </button>
          <button type="button" onClick={() => setFilter('pos')} className={`ba-filter-chip ${filter === 'pos' ? 'ba-filter-chip--active' : ''}`}>
            {t('docPosCount').replace('{n}', String(groupedDocs.posReports.length))}
          </button>
        </div>
      </div>

      {/* Entity Cards */}
      {filteredEntities.length === 0 ? (
        <div className="ba-panel p-12 text-center">
          <FileText className="w-16 h-16 text-cdlp-gold/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-cdlp-gold uppercase mb-2">{t('docNoDocumentsYet')}</h3>
          <p className="text-cdlp-muted text-sm mb-4">{t('docNoDocumentsYetHint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
            <div className="ba-subpanel">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">{t('docSupplierDocsTitle')}</h4>
              <p className="text-[10px] text-cdlp-muted">{t('docSupplierDocsDesc')}</p>
            </div>
            <div className="ba-subpanel">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">{t('docEmployeeDocsTitle')}</h4>
              <p className="text-[10px] text-cdlp-muted">{t('docEmployeeDocsDesc')}</p>
            </div>
            <div className="ba-subpanel">
              <h4 className="text-xs font-bold text-cdlp-gold uppercase mb-2">{t('docPosReports')}</h4>
              <p className="text-[10px] text-cdlp-muted">{t('docPosDocsDesc')}</p>
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
                type="button"
                key={entityName}
                onClick={() => setSelectedEntity(entityName)}
                className="ba-entity-card group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-base mb-1">
                      {formatIssuerForDisplay(entityName, t)}
                    </h3>
                    <p className="text-xs text-cdlp-muted uppercase">
                      {isEmployee ? t('docEntityEmployee') : t('docEntitySupplier')}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-cdlp-muted group-hover:text-cdlp-gold transition-colors" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">{t('documents')}</span>
                    <span className="text-sm font-bold ba-field-value">{docCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-cdlp-muted uppercase">{t('docTotalAmount')}</span>
                    <span className="text-lg font-black text-cdlp-gold">{totalAmount.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF</span>
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
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">{t('addEmployeeTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('position')}</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('monthlySalary')}</label>
            <input
              type="number"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('socialContributions')}</label>
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
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">{t('addIncomeTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('type')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'SALES' | 'RESERVATION')}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            >
              <option value="SALES">{t('SALES')}</option>
              <option value="RESERVATION">{t('RESERVATION')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('amount')}</label>
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
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 py-2.5 md:py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700">
              {t('addIncome')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
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
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-cdlp-black border border-cdlp-border rounded-t-lg md:rounded-lg p-4 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base md:text-lg font-black text-cdlp-gold uppercase mb-4">{t('addExpenseTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
            >
              <option value="BILLS">{t('BILLS')}</option>
              <option value="SUPPLIERS">{t('SUPPLIERS')}</option>
              <option value="PAYROLL">{t('PAYROLL')}</option>
              <option value="OTHER">{t('OTHER')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('amount')}</label>
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
            <label className="block text-xs font-bold uppercase text-cdlp-muted mb-1">{t('description')}</label>
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
              {t('addExpense')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 md:py-2 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
