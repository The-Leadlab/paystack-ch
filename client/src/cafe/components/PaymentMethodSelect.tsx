import React from "react";
import {
  MANUAL_PAYMENT_METHODS,
  normalizeStoredPaymentMethod,
  type StoredPaymentMethod,
} from "@shared/paymentMethod";

const METHOD_KEYS: Record<StoredPaymentMethod, string> = {
  unspecified: "rhPaymentUnspecified",
  cash: "posCash",
  card: "posCard",
  twint: "rhPaymentTwint",
  bank_transfer: "rhPaymentBankTransfer",
  other: "posOther",
};

type PaymentMethodSelectProps = {
  value?: string | null;
  onChange: (next: StoredPaymentMethod) => void;
  t: (key: string) => string;
  className?: string;
  title?: string;
  id?: string;
};

export function PaymentMethodSelect({
  value,
  onChange,
  t,
  className,
  title,
  id,
}: PaymentMethodSelectProps) {
  const current = normalizeStoredPaymentMethod(value);
  return (
    <select
      id={id}
      value={current}
      title={title || t("rhPaymentMethod")}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value as StoredPaymentMethod);
      }}
      className={className || "ba-table-select"}
    >
      <option value="unspecified">{t(METHOD_KEYS.unspecified)}</option>
      {MANUAL_PAYMENT_METHODS.map((method) => (
        <option key={method} value={method}>
          {t(METHOD_KEYS[method])}
        </option>
      ))}
    </select>
  );
}
