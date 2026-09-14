/* employeeService.ts — FE-10 */

import { apiClient } from './apiClient';
import type { Employee, Attendance, Salary } from '@/types/domain';
import type { PaginationParams } from '@/types/api';

interface PaginatedResponse<T> {
  items: T[];
  page: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}

export async function listEmployees(params: PaginationParams & { employeeTypeId?: string; statusKey?: string }): Promise<PaginatedResponse<Employee>> {
  return apiClient({ action: 'employees.list', payload: params });
}

export async function getEmployee(employeeId: string): Promise<Employee> {
  return apiClient({ action: 'employees.get', payload: { employeeId } });
}

export async function createEmployee(data: Record<string, unknown>): Promise<Employee> {
  return apiClient({ action: 'employees.create', payload: data });
}

export async function listAttendance(params: PaginationParams & { employeeId?: string; from?: string; to?: string }): Promise<PaginatedResponse<Attendance>> {
  return apiClient({ action: 'attendance.list', payload: params });
}

export async function markAttendance(rows: Record<string, unknown>[]): Promise<Attendance[]> {
  return apiClient({ action: 'attendance.mark', payload: { rows } });
}

export async function listSalary(params: PaginationParams & { periodKey?: string; employeeId?: string; statusKey?: string }): Promise<PaginatedResponse<Salary>> {
  return apiClient({ action: 'salary.list', payload: params });
}

export async function getSalary(salaryId: string): Promise<Salary> {
  return apiClient({ action: 'salary.get', payload: { salaryId } });
}

export async function prepareSalary(periodKey: string, employeeIds?: string[]): Promise<Salary[]> {
  return apiClient({ action: 'salary.prepare', payload: { periodKey, employeeIds } });
}

export async function approveSalary(salaryId: string, reason?: string): Promise<Salary> {
  return apiClient({ action: 'salary.approve', payload: { salaryId, reason } });
}
