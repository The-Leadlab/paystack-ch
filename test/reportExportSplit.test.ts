import { describe, expect, it } from 'vitest';
import { splitVendorAndProductDetail } from '../client/src/cafe/services/reportExportService';

describe('splitVendorAndProductDetail', () => {
  it('uses fallback when description is only a vendor name', () => {
    const { vendor, detail } = splitVendorAndProductDetail(
      'Le Comptoir Tapas',
      'Sales — product / service sale'
    );
    expect(vendor.toLowerCase()).toContain('comptoir');
    expect(detail).toBe('Sales — product / service sale');
    expect(detail.toLowerCase()).not.toBe(vendor.toLowerCase());
  });

  it('splits vendor — product detail format', () => {
    const { vendor, detail } = splitVendorAndProductDetail(
      'Taligro — Olive oil 5L, napkins',
      'purchase'
    );
    expect(vendor.toLowerCase()).toContain('taligro');
    expect(detail).toContain('Olive oil');
  });
});
