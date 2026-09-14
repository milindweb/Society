import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  listAttendance,
  markAttendance,
  listSalary,
  getSalary,
  prepareSalary,
  approveSalary,
} from '../employeeService';

const mockApiClient = vi.fn();
vi.mock('@/services/apiClient', () => ({ apiClient: (...args: unknown[]) => mockApiClient(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.mockResolvedValue({});
});

describe('employeeService', () => {
  describe('listEmployees', () => {
    it('calls apiClient with employees.list action and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = {
        items: [{ id: 'e1', name: 'John' }],
        page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listEmployees(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'employees.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional employeeTypeId and statusKey filters', async () => {
      const params = { page: 1, employeeTypeId: 'type1', statusKey: 'ACTIVE' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listEmployees(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'employees.list',
        payload: params,
      });
    });
  });

  describe('getEmployee', () => {
    it('calls apiClient with employees.get and employeeId', async () => {
      const employee = { id: 'e1', name: 'John' };
      mockApiClient.mockResolvedValue(employee);
      const res = await getEmployee('e1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'employees.get',
        payload: { employeeId: 'e1' },
      });
      expect(res).toEqual(employee);
    });
  });

  describe('createEmployee', () => {
    it('calls apiClient with employees.create and data', async () => {
      const data = { name: 'Jane', employeeTypeId: 'type1' };
      mockApiClient.mockResolvedValue({ id: 'e2', ...data });
      const res = await createEmployee(data);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'employees.create',
        payload: data,
      });
      expect(res).toEqual({ id: 'e2', ...data });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('VALIDATION_ERROR'));
      await expect(createEmployee({})).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('listAttendance', () => {
    it('calls apiClient with attendance.list and params', async () => {
      const params = { page: 1, pageSize: 20 };
      const response = {
        items: [{ id: 'a1', employeeId: 'e1', date: '2026-09-15' }],
        page: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listAttendance(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'attendance.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional employeeId, from, to filters', async () => {
      const params = { page: 1, employeeId: 'e1', from: '2026-09-01', to: '2026-09-30' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listAttendance(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'attendance.list',
        payload: params,
      });
    });
  });

  describe('markAttendance', () => {
    it('calls apiClient with attendance.mark and rows', async () => {
      const rows = [{ employeeId: 'e1', date: '2026-09-15', statusKey: 'PRESENT' }];
      const result = [{ employeeId: 'e1', date: '2026-09-15', statusKey: 'PRESENT' }];
      mockApiClient.mockResolvedValue(result);
      const res = await markAttendance(rows);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'attendance.mark',
        payload: { rows },
      });
      expect(res).toEqual(result);
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('CONFLICT_ERROR'));
      await expect(markAttendance([])).rejects.toThrow('CONFLICT_ERROR');
    });
  });

  describe('listSalary', () => {
    it('calls apiClient with salary.list and params', async () => {
      const params = { page: 1, pageSize: 10 };
      const response = {
        items: [{ id: 's1', employeeId: 'e1', netAmount: 50000 }],
        page: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockApiClient.mockResolvedValue(response);
      const res = await listSalary(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.list',
        payload: params,
      });
      expect(res).toEqual(response);
    });

    it('passes optional periodKey, employeeId, statusKey filters', async () => {
      const params = { page: 1, periodKey: '2026-09', employeeId: 'e1', statusKey: 'PENDING' };
      mockApiClient.mockResolvedValue({ items: [], page: {} });
      await listSalary(params);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.list',
        payload: params,
      });
    });
  });

  describe('getSalary', () => {
    it('calls apiClient with salary.get and salaryId', async () => {
      const salary = { id: 's1', netAmount: 50000 };
      mockApiClient.mockResolvedValue(salary);
      const res = await getSalary('s1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.get',
        payload: { salaryId: 's1' },
      });
      expect(res).toEqual(salary);
    });
  });

  describe('prepareSalary', () => {
    it('calls apiClient with salary.prepare, periodKey, and employeeIds', async () => {
      const result = [{ employeeId: 'e1', netAmount: 50000 }];
      mockApiClient.mockResolvedValue(result);
      const res = await prepareSalary('2026-09', ['e1', 'e2']);
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.prepare',
        payload: { periodKey: '2026-09', employeeIds: ['e1', 'e2'] },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined employeeIds when not provided', async () => {
      mockApiClient.mockResolvedValue([]);
      await prepareSalary('2026-09');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.prepare',
        payload: { periodKey: '2026-09', employeeIds: undefined },
      });
    });
  });

  describe('approveSalary', () => {
    it('calls apiClient with salary.approve, salaryId, and reason', async () => {
      const result = { id: 's1', statusKey: 'APPROVED' };
      mockApiClient.mockResolvedValue(result);
      const res = await approveSalary('s1', 'Approved by manager');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.approve',
        payload: { salaryId: 's1', reason: 'Approved by manager' },
      });
      expect(res).toEqual(result);
    });

    it('sends undefined reason when not provided', async () => {
      mockApiClient.mockResolvedValue({});
      await approveSalary('s1');
      expect(mockApiClient).toHaveBeenCalledWith({
        action: 'salary.approve',
        payload: { salaryId: 's1', reason: undefined },
      });
    });

    it('propagates apiClient errors', async () => {
      mockApiClient.mockRejectedValue(new Error('NOT_FOUND'));
      await expect(approveSalary('s1')).rejects.toThrow('NOT_FOUND');
    });
  });
});