import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calculator,
  Calendar,
  Download,
  Eye,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChfLocale, useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { loadSavedInvoices, upsertInvoice } from '../lib/invoiceStorage';
import { applyInvoiceTotals, normalizeInvoice } from '../lib/invoiceTotals';
import { downloadInvoicePdf } from '../lib/invoicePdf';
import type { InvoiceData, InvoiceItem, InvoiceStatus } from '../types/invoice';
import { INVOICE_CURRENCY_SYMBOLS } from '../types/invoice';
import { DEFAULT_SWISS_VAT_RATE } from '@shared/swissVatRates';
import { BRAND_LOGO_SRC } from '@/const/branding';
import { useTaxRegionConfig } from '../hooks/useTaxRegion';

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0');
  return `INV-${y}${m}${d}-${rand}`;
}

function createInitialInvoice(t: (k: string) => string, taxRate = DEFAULT_SWISS_VAT_RATE): InvoiceData {
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    invoiceNumber: generateInvoiceNumber(),
    date: today,
    dueDate: due,
    status: 'draft',
    companyName: 'Paystack.ch',
    companyAddress: 'Switzerland',
    companyPhone: '',
    companyEmail: '',
    companyWebsite: 'www.paystack.ch',
    clientName: '',
    clientCompany: '',
    clientAddress: '',
    clientPhone: '',
    clientEmail: '',
    items: [],
    subtotal: 0,
    taxRate,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
    currency: 'CHF',
    currencySymbol: 'CHF',
    notes: '',
    terms: t('invDefaultTerms'),
    paymentTerms: 'Net 30',
  };
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    draft: 'ba-status-pill ba-status-pill--pending',
    sent: 'ba-status-pill ba-status-pill--verify',
    paid: 'ba-status-pill ba-status-pill--completed',
    overdue: 'ba-status-pill ba-status-pill--error',
  };
  return <span className={map[status]}>{status.toUpperCase()}</span>;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-bold uppercase text-cdlp-muted mb-2 block tracking-wide">
      {children}
    </label>
  );
}

function resizeLogoAsJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = Math.min(image.naturalWidth, 360);
      const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Unable to prepare logo image.'));
        return;
      }

      // JPEG has no alpha channel, so preserve transparent source logos on white.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read logo image.'));
    };
    image.src = objectUrl;
  });
}

export function InvoiceMakerPanel() {
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { taxConfig, loading: taxRegionLoading } = useTaxRegionConfig();
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(() => createInitialInvoice(t));
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [savedInvoices, setSavedInvoices] = useState<InvoiceData[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const invoiceRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedInvoices(loadSavedInvoices(user?.uid).map(normalizeInvoice));
  }, [user?.uid]);

  useEffect(() => {
    if (taxRegionLoading) return;
    setInvoiceData((current) =>
      current.items.length === 0 ? { ...current, taxRate: taxConfig.defaultRate } : current
    );
  }, [taxConfig.defaultRate, taxRegionLoading]);

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    documents.forEach((doc) => {
      const issuer = doc.data?.issuer?.trim();
      if (issuer) names.add(issuer);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const displayInvoice = useMemo(() => applyInvoiceTotals(invoiceData), [invoiceData]);

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxRate: invoiceData.taxRate,
      total: 0,
    };
    setInvoiceData((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const normalized = applyInvoiceTotals({ ...prev, items: [updated] }).items[0];
        return normalized ?? updated;
      }),
    }));
  };

  const applyVatToAllItems = () => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, taxRate: prev.taxRate })),
    }));
  };

  const removeItem = (id: string) => {
    setInvoiceData((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  };

  const populateFromSupplier = (name: string) => {
    const doc = documents.find((d) => d.data?.issuer?.trim() === name);
    setInvoiceData((prev) => ({
      ...prev,
      clientName: name,
      clientCompany: name,
      clientEmail: doc?.data?.issuer ? prev.clientEmail : prev.clientEmail,
    }));
  };

  const saveInvoice = (): boolean => {
    if (!invoiceData.clientName || !invoiceData.companyName) {
      alert(t('invValidationRequired'));
      return false;
    }
    if (invoiceData.items.length === 0) {
      alert(t('invValidationItems'));
      return false;
    }
    const next = upsertInvoice(user?.uid, applyInvoiceTotals(invoiceData));
    setSavedInvoices(next);
    alert(t('invSavedSuccess'));
    return true;
  };

  const invoicePdfLabels = useMemo(
    () => ({
      previewTitle: t('invPreviewTitle'),
      invoiceNumber: t('invNumber'),
      from: t('invFrom'),
      to: t('invTo'),
      date: t('invDate'),
      dueDate: t('invDueDate'),
      paymentTerms: t('invPaymentTerms'),
      colDescription: t('invColDescription'),
      colQty: t('invColQty'),
      colUnit: t('invColUnit'),
      colDiscount: t('invColDiscount'),
      colVat: t('invColVat'),
      colTotal: t('invColTotalHt'),
      subtotal: t('invSubtotalHt'),
      discount: t('invDiscount'),
      tax: t('invTax'),
      vatBreakdown: t('invVatBreakdown'),
      total: t('invTotalTtc'),
      notes: t('invNotes'),
      terms: t('invTerms'),
      status: t('invStatus'),
    }),
    [t]
  );

  const generatePdf = async () => {
    if (invoiceData.items.length === 0) {
      alert(t('invValidationItems'));
      return;
    }
    try {
      await downloadInvoicePdf(displayInvoice, invoicePdfLabels, chfLocale, invoiceData.companyLogoDataUrl);
    } catch {
      alert(t('invPdfFailed'));
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      event.target.value = '';
      return;
    }

    try {
      const companyLogoDataUrl = await resizeLogoAsJpeg(file);
      setInvoiceData((current) => ({ ...current, companyLogoDataUrl }));
    } catch {
      alert(t('invPdfFailed'));
    } finally {
      event.target.value = '';
    }
  };

  const clearCompanyLogo = () => {
    setInvoiceData((current) => ({ ...current, companyLogoDataUrl: undefined }));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const sendInvoice = () => {
    if (!invoiceData.clientEmail) {
      alert(t('invEmailRequired'));
      return;
    }
    const subject = encodeURIComponent(`${t('invEmailSubject')} ${invoiceData.invoiceNumber}`);
    const body = encodeURIComponent(
      `${t('invEmailBodyIntro')}\n\n${displayInvoice.invoiceNumber}\n${t('invTotalTtc')}: ${displayInvoice.currencySymbol} ${displayInvoice.total.toFixed(2)}\n${t('invDueDate')}: ${displayInvoice.dueDate}`
    );
    window.open(`mailto:${invoiceData.clientEmail}?subject=${subject}&body=${body}`, '_blank');
    const sent = applyInvoiceTotals({ ...invoiceData, status: 'sent' });
    setInvoiceData(sent);
    upsertInvoice(user?.uid, sent);
    setSavedInvoices(loadSavedInvoices(user?.uid));

    void (async () => {
      const { backupInvoiceToGoogleDrive } = await import('../lib/invoiceDriveBackup');
      await backupInvoiceToGoogleDrive(sent, invoicePdfLabels, chfLocale, user?.uid);
    })();
  };

  const fmtMoney = (n: number) =>
    n.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const InvoicePreview = () => (
    <div
      id="invoice-preview"
      ref={invoiceRef}
      className="bg-white text-gray-900 p-8 shadow-lg max-w-4xl mx-auto rounded-lg print:shadow-none"
    >
      <div className="flex justify-between items-start mb-8 gap-4">
        <div className="flex items-center gap-6">
          <img
            src={invoiceData.companyLogoDataUrl || BRAND_LOGO_SRC}
            alt={invoiceData.companyName || 'Company logo'}
            className="h-12 w-auto max-w-44 object-contain"
          />
          <div className="border-l border-gray-200 pl-6">
            <h1 className="text-3xl font-bold mb-2">{t('invPreviewTitle')}</h1>
            <div className="bg-gray-100 px-3 py-2 rounded border">
              <p className="text-sm text-gray-500 mb-1">{t('invNumber')}</p>
              <p className="text-lg font-bold">{invoiceData.invoiceNumber}</p>
            </div>
          </div>
        </div>
        <InvoiceStatusBadge status={invoiceData.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold mb-3">{t('invFrom')}</h3>
          <div className="text-gray-600 text-sm space-y-1">
            <p className="font-medium text-gray-900">{invoiceData.companyName}</p>
            <p className="whitespace-pre-line">{invoiceData.companyAddress}</p>
            {invoiceData.companyPhone ? <p>{invoiceData.companyPhone}</p> : null}
            {invoiceData.companyEmail ? <p>{invoiceData.companyEmail}</p> : null}
            {invoiceData.companyWebsite ? <p>{invoiceData.companyWebsite}</p> : null}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-3">{t('invTo')}</h3>
          <div className="text-gray-600 text-sm space-y-1">
            <p className="font-medium text-gray-900">{invoiceData.clientName}</p>
            {invoiceData.clientCompany ? <p>{invoiceData.clientCompany}</p> : null}
            <p className="whitespace-pre-line">{invoiceData.clientAddress}</p>
            {invoiceData.clientPhone ? <p>{invoiceData.clientPhone}</p> : null}
            {invoiceData.clientEmail ? <p>{invoiceData.clientEmail}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-sm">
        <div>
          <p className="font-medium text-gray-500">{t('invDate')}</p>
          <p>{new Date(invoiceData.date).toLocaleDateString(chfLocale)}</p>
        </div>
        <div>
          <p className="font-medium text-gray-500">{t('invDueDate')}</p>
          <p>{new Date(invoiceData.dueDate).toLocaleDateString(chfLocale)}</p>
        </div>
        <div>
          <p className="font-medium text-gray-500">{t('invPaymentTerms')}</p>
          <p>{invoiceData.paymentTerms}</p>
        </div>
      </div>

      <table className="w-full border-collapse mb-8 text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 font-semibold">{t('invColDescription')}</th>
            <th className="text-center py-3 font-semibold">{t('invColQty')}</th>
            <th className="text-right py-3 font-semibold">{t('invColUnit')}</th>
            <th className="text-right py-3 font-semibold">{t('invColDiscount')}</th>
            <th className="text-right py-3 font-semibold">{t('invColVat')}</th>
            <th className="text-right py-3 font-semibold">{t('invColTotalHt')}</th>
          </tr>
        </thead>
        <tbody>
          {displayInvoice.items.map((item) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-3">{item.description}</td>
              <td className="py-3 text-center">{item.quantity}</td>
              <td className="py-3 text-right">
                {displayInvoice.currencySymbol} {fmtMoney(item.unitPrice)}
              </td>
              <td className="py-3 text-right">
                {item.discountAmount > 0
                  ? `-${displayInvoice.currencySymbol} ${fmtMoney(item.discountAmount)}`
                  : '—'}
              </td>
              <td className="py-3 text-right">{item.taxRate}%</td>
              <td className="py-3 text-right font-medium">
                {displayInvoice.currencySymbol} {fmtMoney(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-8">
        <div className="w-72 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('invSubtotalHt')}</span>
            <span>
              {displayInvoice.currencySymbol} {fmtMoney(displayInvoice.subtotal)}
            </span>
          </div>
          {(displayInvoice.vatBreakdown ?? []).map((line) => (
            <div key={line.ratePercent} className="flex justify-between">
              <span className="text-gray-600">
                {t('invTax')} ({line.ratePercent}%)
              </span>
              <span>
                {displayInvoice.currencySymbol} {fmtMoney(line.vatAmount)}
              </span>
            </div>
          ))}
          {displayInvoice.discountAmount > 0 ? (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invInvoiceDiscount')}</span>
              <span>
                -{displayInvoice.currencySymbol} {fmtMoney(displayInvoice.discountAmount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t-2 border-gray-200 pt-3 text-lg font-bold">
            <span>{t('invTotalTtc')}</span>
            <span>
              {displayInvoice.currencySymbol} {fmtMoney(displayInvoice.total)}
            </span>
          </div>
        </div>
      </div>

      {(invoiceData.notes || invoiceData.terms) && (
        <div className="border-t border-gray-200 pt-6 text-sm space-y-4">
          {invoiceData.notes ? (
            <div>
              <h4 className="font-semibold mb-2">{t('invNotes')}</h4>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.notes}</p>
            </div>
          ) : null}
          {invoiceData.terms ? (
            <div>
              <h4 className="font-semibold mb-2">{t('invTerms')}</h4>
              <p className="text-gray-600 whitespace-pre-line text-justify">{invoiceData.terms}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (isPreviewMode) {
    return (
      <div className="space-y-4">
        <div className="ba-panel flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setIsPreviewMode(false)} className="ba-filter-chip flex items-center gap-2">
            <X className="w-4 h-4" /> {t('invBackEdit')}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generatePdf} className="ba-filter-chip flex items-center gap-2">
              <Download className="w-4 h-4" /> {t('invDownloadPdf')}
            </button>
            <button type="button" onClick={sendInvoice} className="ba-btn-approve flex items-center gap-2 !h-9">
              <Send className="w-4 h-4" /> {t('invSend')}
            </button>
          </div>
        </div>
        <InvoicePreview />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="ba-page-header flex-col items-start !mb-4 gap-3 sm:flex-row sm:items-center">
        <div>
          <h1>{t('invoiceMakerTab')}</h1>
          <p className="text-xs text-cdlp-muted mt-1 font-normal normal-case tracking-normal">{t('invSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInvoiceData(createInitialInvoice(t))}
            className="ba-filter-chip flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('invNew')}
          </button>
          <button type="button" onClick={() => saveInvoice()} className="ba-filter-chip flex items-center gap-2">
            <Save className="w-4 h-4" /> {t('invSaveDraft')}
          </button>
          <button type="button" onClick={() => setIsPreviewMode(true)} className="ba-btn-start flex items-center gap-2">
            <Eye className="w-4 h-4" /> {t('invPreview')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="ba-panel space-y-4">
            <div className="ba-section-head">
              <Building2 className="w-5 h-5" />
              <span>{t('invCompanyInfo')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>{t('invCompanyName')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.companyName} onChange={(e) => setInvoiceData((p) => ({ ...p, companyName: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invCompanyEmail')}</FieldLabel>
                <input type="email" className="ba-verify-field" value={invoiceData.companyEmail} onChange={(e) => setInvoiceData((p) => ({ ...p, companyEmail: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invCompanyPhone')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.companyPhone} onChange={(e) => setInvoiceData((p) => ({ ...p, companyPhone: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invCompanyWebsite')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.companyWebsite} onChange={(e) => setInvoiceData((p) => ({ ...p, companyWebsite: e.target.value }))} />
              </div>
            </div>
            <div>
              <FieldLabel>{t('invCompanyAddress')}</FieldLabel>
              <textarea className="ba-verify-field !h-auto min-h-[5rem] py-2 resize-y" rows={3} value={invoiceData.companyAddress} onChange={(e) => setInvoiceData((p) => ({ ...p, companyAddress: e.target.value }))} />
            </div>
            <div>
              <FieldLabel htmlFor="inv-company-logo">{t('invCompanyLogo')}</FieldLabel>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={logoInputRef}
                  id="inv-company-logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="block max-w-full text-sm text-cdlp-muted file:mr-3 file:rounded-md file:border-0 file:bg-cdlp-gold file:px-3 file:py-2 file:text-sm file:font-bold file:text-cdlp-ink hover:file:opacity-90"
                  onChange={handleLogoChange}
                />
                {invoiceData.companyLogoDataUrl ? (
                  <>
                    <img
                      src={invoiceData.companyLogoDataUrl}
                      alt={t('invCompanyLogo')}
                      className="h-10 max-w-28 rounded border border-cdlp-border object-contain bg-white p-1"
                    />
                    <button type="button" onClick={clearCompanyLogo} className="ba-filter-chip flex items-center gap-1.5">
                      <X className="h-4 w-4" /> {t('invRemoveLogo')}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-cdlp-muted">{t('invUploadLogo')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="ba-panel space-y-4">
            <div className="ba-section-head">
              <Calendar className="w-5 h-5" />
              <span>{t('invDetails')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <FieldLabel htmlFor="inv-number">{t('invNumber')}</FieldLabel>
                <div className="flex gap-2">
                  <input
                    id="inv-number"
                    className="ba-verify-field flex-1"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) => setInvoiceData((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="ba-filter-chip shrink-0 px-3"
                    onClick={() => setInvoiceData((p) => ({ ...p, invoiceNumber: generateInvoiceNumber() }))}
                    title={t('invRegenerateNumber')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="inv-date">{t('invDate')}</FieldLabel>
                <input
                  id="inv-date"
                  type="date"
                  className="ba-verify-field"
                  value={invoiceData.date}
                  onChange={(e) => setInvoiceData((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="inv-due">{t('invDueDate')}</FieldLabel>
                <input
                  id="inv-due"
                  type="date"
                  className="ba-verify-field"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="inv-status">{t('invStatus')}</FieldLabel>
                <select
                  id="inv-status"
                  className="ba-verify-field uppercase"
                  value={invoiceData.status}
                  onChange={(e) => setInvoiceData((p) => ({ ...p, status: e.target.value as InvoiceStatus }))}
                >
                  <option value="draft">{t('invStatusDraft')}</option>
                  <option value="sent">{t('invStatusSent')}</option>
                  <option value="paid">{t('invStatusPaid')}</option>
                  <option value="overdue">{t('invStatusOverdue')}</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="inv-terms-pay">{t('invPaymentTerms')}</FieldLabel>
                <select
                  id="inv-terms-pay"
                  className="ba-verify-field"
                  value={invoiceData.paymentTerms}
                  onChange={(e) => setInvoiceData((p) => ({ ...p, paymentTerms: e.target.value }))}
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">{t('invDueOnReceipt')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="ba-panel space-y-4">
            <div className="ba-section-head">
              <User className="w-5 h-5" />
              <span>{t('invClientInfo')}</span>
            </div>
            {supplierOptions.length > 0 ? (
              <div>
                <FieldLabel htmlFor="inv-supplier">{t('invQuickSelectSupplier')}</FieldLabel>
                <select
                  id="inv-supplier"
                  className="ba-verify-field"
                  value={selectedSupplier}
                  onChange={(e) => {
                    setSelectedSupplier(e.target.value);
                    if (e.target.value) populateFromSupplier(e.target.value);
                  }}
                >
                  <option value="">{t('invSelectSupplier')}</option>
                  {supplierOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>{t('invClientName')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.clientName} onChange={(e) => setInvoiceData((p) => ({ ...p, clientName: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invClientCompany')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.clientCompany} onChange={(e) => setInvoiceData((p) => ({ ...p, clientCompany: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invClientEmail')}</FieldLabel>
                <input type="email" className="ba-verify-field" value={invoiceData.clientEmail} onChange={(e) => setInvoiceData((p) => ({ ...p, clientEmail: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('invClientPhone')}</FieldLabel>
                <input className="ba-verify-field" value={invoiceData.clientPhone} onChange={(e) => setInvoiceData((p) => ({ ...p, clientPhone: e.target.value }))} />
              </div>
            </div>
            <div>
              <FieldLabel>{t('invClientAddress')}</FieldLabel>
              <textarea className="ba-verify-field !h-auto min-h-[5rem] py-2 resize-y" rows={3} value={invoiceData.clientAddress} onChange={(e) => setInvoiceData((p) => ({ ...p, clientAddress: e.target.value }))} />
            </div>
          </div>

          <div className="ba-panel space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="ba-section-head !mb-0">
                <FileText className="w-5 h-5" />
                <span>{t('invItems')}</span>
              </div>
              <button type="button" onClick={addItem} className="ba-filter-chip flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('invAddItem')}
              </button>
            </div>
            <div className="space-y-3">
              {invoiceData.items.map((item) => {
                const displayItem = displayInvoice.items.find((i) => i.id === item.id) ?? item;
                return (
                <div key={item.id} className="ba-subpanel grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-4">
                    <FieldLabel>{t('invColDescription')}</FieldLabel>
                    <input className="ba-verify-field" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder={t('invItemDescPlaceholder')} />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <FieldLabel>{t('invColQty')}</FieldLabel>
                    <input type="number" min={1} className="ba-verify-field" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <FieldLabel>{t('invColUnit')}</FieldLabel>
                    <input type="number" min={0} step={0.01} className="ba-verify-field" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <FieldLabel>{t('invLineDiscount')}</FieldLabel>
                    <input type="number" min={0} step={0.01} className="ba-verify-field" value={item.discountAmount ?? 0} onChange={(e) => updateItem(item.id, 'discountAmount', Number(e.target.value))} />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <FieldLabel>{t('invColVat')}</FieldLabel>
                    <select
                      className="ba-verify-field"
                      value={item.taxRate ?? invoiceData.taxRate}
                      onChange={(e) => updateItem(item.id, 'taxRate', Number(e.target.value))}
                    >
                      {taxConfig.rates.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <FieldLabel>{t('invColTotalHt')}</FieldLabel>
                    <div className="ba-verify-field flex items-center justify-end font-bold tabular-nums text-xs">
                      {invoiceData.currencySymbol} {fmtMoney(displayItem.total)}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeItem(item.id)} className="p-2 text-cdlp-muted hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
              })}
              {invoiceData.items.length === 0 ? (
                <p className="text-center text-sm text-cdlp-muted py-6">{t('invNoItems')}</p>
              ) : null}
            </div>
          </div>

          <div className="ba-panel space-y-4">
            <div className="ba-section-head">
              <span>{t('invAdditional')}</span>
            </div>
            <div>
              <FieldLabel>{t('invNotes')}</FieldLabel>
              <textarea className="ba-verify-field !h-auto min-h-[5rem] py-2 resize-y" rows={3} value={invoiceData.notes} onChange={(e) => setInvoiceData((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>{t('invTerms')}</FieldLabel>
              <textarea className="ba-verify-field !h-auto min-h-[5rem] py-2 resize-y" rows={3} value={invoiceData.terms} onChange={(e) => setInvoiceData((p) => ({ ...p, terms: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="ba-panel space-y-4">
            <div className="ba-section-head">
              <Calculator className="w-5 h-5" />
              <span>{t('invFinancialSummary')}</span>
            </div>
            <div>
              <FieldLabel>{t('invCurrency')}</FieldLabel>
              <select
                className="ba-verify-field"
                value={invoiceData.currency}
                onChange={(e) =>
                  setInvoiceData((p) => ({
                    ...p,
                    currency: e.target.value,
                    currencySymbol: INVOICE_CURRENCY_SYMBOLS[e.target.value] ?? e.target.value,
                  }))
                }
              >
                {Object.keys(INVOICE_CURRENCY_SYMBOLS).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cdlp-muted">{t('invSubtotalHt')}</span>
                <span className="ba-field-value tabular-nums">
                  {invoiceData.currencySymbol} {fmtMoney(displayInvoice.subtotal)}
                </span>
              </div>
              <div>
                <FieldLabel>{t('invDefaultVat')}</FieldLabel>
                <div className="flex gap-2">
                  <select
                    className="ba-verify-field flex-1"
                    value={invoiceData.taxRate}
                    onChange={(e) => setInvoiceData((p) => ({ ...p, taxRate: Number(e.target.value) }))}
                  >
                    {taxConfig.rates.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ba-filter-chip shrink-0 px-3 text-xs"
                    onClick={applyVatToAllItems}
                    disabled={invoiceData.items.length === 0}
                    title={t('invApplyVatToAll')}
                  >
                    {t('invApplyVatToAll')}
                  </button>
                </div>
              </div>
              {(displayInvoice.vatBreakdown ?? []).length > 1
                ? (displayInvoice.vatBreakdown ?? []).map((line) => (
                    <div key={line.ratePercent} className="flex justify-between">
                      <span className="text-cdlp-muted">
                        {t('invTax')} ({line.ratePercent}%)
                      </span>
                      <span className="ba-field-value tabular-nums">
                        {invoiceData.currencySymbol} {fmtMoney(line.vatAmount)}
                      </span>
                    </div>
                  ))
                : null}
              <div className="flex justify-between font-medium">
                <span className="text-cdlp-muted">{t('invTax')}</span>
                <span className="ba-field-value tabular-nums">
                  {invoiceData.currencySymbol} {fmtMoney(displayInvoice.taxAmount)}
                </span>
              </div>
              <div>
                <FieldLabel>{t('invInvoiceDiscount')}</FieldLabel>
                <input type="number" min={0} step={0.01} className="ba-verify-field" value={invoiceData.discountAmount} onChange={(e) => setInvoiceData((p) => ({ ...p, discountAmount: Number(e.target.value) }))} />
              </div>
              <div className="border-t border-cdlp-border pt-3 flex justify-between text-lg font-black">
                <span>{t('invTotalTtc')}</span>
                <span className="text-cdlp-gold tabular-nums">
                  {invoiceData.currencySymbol} {fmtMoney(displayInvoice.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="ba-panel space-y-3">
            <div className="ba-section-head !mb-2">
              <span>{t('invQuickActions')}</span>
            </div>
            <button type="button" onClick={() => setIsPreviewMode(true)} className="ba-btn-start w-full flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" /> {t('invPreview')}
            </button>
            <button type="button" onClick={() => saveInvoice()} className="ba-filter-chip w-full flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {t('invSaveDraft')}
            </button>
            <button type="button" onClick={generatePdf} className="ba-filter-chip w-full flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> {t('invDownloadPdf')}
            </button>
            <button type="button" onClick={sendInvoice} disabled={!invoiceData.clientEmail} className="ba-btn-approve w-full flex items-center justify-center gap-2 !h-10 disabled:opacity-40">
              <Send className="w-4 h-4" /> {t('invSend')}
            </button>
          </div>

          <div className="ba-panel space-y-3 text-sm">
            <div className="ba-section-head !mb-2">
              <span>{t('invStatusPanel')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cdlp-muted">{t('invStatus')}</span>
              <InvoiceStatusBadge status={invoiceData.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-cdlp-muted">{t('invItems')}</span>
              <span className="ba-field-value">{invoiceData.items.length}</span>
            </div>
          </div>
        </div>
      </div>

      {savedInvoices.length > 0 ? (
        <div className="ba-panel ba-panel--flat overflow-hidden">
          <div className="p-4 border-b border-cdlp-border">
            <div className="ba-section-head !mb-0">
              <span>{t('invSavedList')}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="ba-doc-table min-w-[720px] w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">{t('invNumber')}</th>
                  <th className="text-left">{t('invClientName')}</th>
                  <th className="text-left">{t('invClientCompany')}</th>
                  <th className="text-right">{t('invTotalTtc')}</th>
                  <th className="text-left">{t('invStatus')}</th>
                  <th className="text-left">{t('invDate')}</th>
                  <th className="text-right">{t('dpColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cdlp-border">
                {savedInvoices.map((invoice) => (
                  <tr key={invoice.invoiceNumber}>
                    <td className="px-4 py-3 font-bold">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">{invoice.clientName || '—'}</td>
                    <td className="px-4 py-3">{invoice.clientCompany || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {invoice.currencySymbol} {fmtMoney(invoice.total)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 ba-table-muted">{new Date(invoice.date).toLocaleDateString(chfLocale)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="ba-filter-chip !py-1" onClick={() => setInvoiceData(normalizeInvoice(invoice))}>
                          {t('invEdit')}
                        </button>
                        <button
                          type="button"
                          className="ba-filter-chip !py-1"
                          onClick={() => {
                            setInvoiceData(normalizeInvoice(invoice));
                            setIsPreviewMode(true);
                          }}
                        >
                          {t('invView')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
