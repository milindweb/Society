/* configStore.test.ts — Tests for config state store */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configStore, subscribeConfig, getConfigSnapshot, useConfigStore } from '@/state/configStore';
import type { SocietyConfig, ConfigEnums } from '@/types/domain';

const mockConfig: SocietyConfig = {
  societyName: 'Test Society',
  address: '123 Main St',
  registrationNumber: 'REG-001',
  contactEmail: 'test@test.com',
  contactMobile: '9876543210',
  timezone: 'Asia/Kolkata',
  currencyCode: 'USD',
  currencySymbol: '$',
  dateDisplayFormat: 'DD/MM/YYYY',
  financialYearStartMonth: 4,
  financialYearStartDay: 1,
  searchMinChars: 2,
  pageSizeDefault: 25,
  isConfigured: true,
};

const mockEnums: ConfigEnums = {
  statuses: {
    complaint: [
      { value: 'OPEN', label: 'Open' },
      { value: 'CLOSED', label: 'Closed' },
    ],
    payment: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'PAID', label: 'Paid' },
    ],
  },
  chargeTypes: [
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'PARKING', label: 'Parking' },
  ],
  paymentModes: [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
  ],
  categories: {},
  types: {},
  numbering: [],
  roles: [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'MEMBER', label: 'Member' },
  ],
};

describe('configStore', () => {
  beforeEach(() => {
    configStore.clear();
  });

  describe('setConfig', () => {
    it('sets config and marks as loaded', () => {
      configStore.setConfig(mockConfig);
      expect(configStore.config).toEqual(mockConfig);
      expect(configStore.loaded).toBe(true);
    });
  });

  describe('setEnums', () => {
    it('sets enums', () => {
      configStore.setEnums(mockEnums);
      expect(configStore.enums).toEqual(mockEnums);
    });
  });

  describe('clear', () => {
    it('clears config, enums, and loaded', () => {
      configStore.setConfig(mockConfig);
      configStore.setEnums(mockEnums);
      configStore.clear();
      expect(configStore.config).toBeNull();
      expect(configStore.enums).toBeNull();
      expect(configStore.loaded).toBe(false);
    });
  });

  describe('subscribeConfig', () => {
    it('notifies on setConfig', () => {
      const listener = vi.fn();
      subscribeConfig(listener);
      configStore.setConfig(mockConfig);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on setEnums', () => {
      const listener = vi.fn();
      subscribeConfig(listener);
      configStore.setEnums(mockEnums);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on clear', () => {
      const listener = vi.fn();
      subscribeConfig(listener);
      configStore.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = subscribeConfig(listener);
      unsub();
      configStore.setConfig(mockConfig);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getConfigSnapshot', () => {
    it('returns current state', () => {
      configStore.setConfig(mockConfig);
      configStore.setEnums(mockEnums);
      const snapshot = getConfigSnapshot();
      expect(snapshot.config).toEqual(mockConfig);
      expect(snapshot.enums).toEqual(mockEnums);
      expect(snapshot.loaded).toBe(true);
    });

    it('returns null config when not loaded', () => {
      const snapshot = getConfigSnapshot();
      expect(snapshot.config).toBeNull();
      expect(snapshot.loaded).toBe(false);
    });
  });
});

describe('useConfigStore', () => {
  beforeEach(() => {
    configStore.clear();
  });

  it('returns default currency when config is null', () => {
    const result = useConfigStore();
    expect(result.currencyCode).toBe('INR');
    expect(result.currencySymbol).toBe('₹');
  });

  it('returns config values when config is set', () => {
    configStore.setConfig(mockConfig);
    const result = useConfigStore();
    expect(result.currencyCode).toBe('USD');
    expect(result.currencySymbol).toBe('$');
    expect(result.societyName).toBe('Test Society');
  });

  it('returns default date format when config is null', () => {
    const result = useConfigStore();
    expect(result.dateDisplayFormat).toBe('DD/MM/YYYY');
  });

  it('returns default searchMinChars when config is null', () => {
    const result = useConfigStore();
    expect(result.searchMinChars).toBe(2);
  });

  it('returns default pageSizeDefault when config is null', () => {
    const result = useConfigStore();
    expect(result.pageSizeDefault).toBe(25);
  });

  it('returns empty societyName when config is null', () => {
    const result = useConfigStore();
    expect(result.societyName).toBe('');
  });
});
