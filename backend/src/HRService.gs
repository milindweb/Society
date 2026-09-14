/**
 * HRService.js — employees, daily attendance, and attendance-based monthly salary.
 *
 * Rules:
 * - Employees unique: employeeCode; Employee_Types configurable; never hard-delete.
 * - Employee_Attendance unique: employeeId + attendanceDate; status PRESENT/ABSENT/LEAVE/HALF_DAY/HOLIDAY.
 * - Employee_Salary unique: employeeId + periodKey; netSalary server-computed from stored components.
 * - Salary status DRAFT → APPROVED → PAID; self-approval refused when Users.employeeId matches.
 * - Salary/payment history maintained month-wise; attendanceWorkHours and salaryPayDay from config.
 * - Audit row written for employee create/update/archive, salary approve/pay.
 */
var HRService = (function () {
  'use strict';

  var ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'HOLIDAY'];
  var SALARY_STATUSES = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function readAll(sheetName, filter) {
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      if (filter) {
        var match = Object.keys(filter).every(function (k) { return String(rec[k]) === String(filter[k]); });
        if (!match) { continue; }
      }
      rows.push(rec);
    }
    return rows;
  }

  function findByUnique(sheetName, uniqueKey) {
    var result = Repository.countBy(sheetName, uniqueKey);
    if (!result.exists) { return null; }
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return null; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      var match = Object.keys(uniqueKey).every(function (k) { return String(rec[k]) === String(uniqueKey[k]); });
      if (match) { return rec; }
    }
    return null;
  }

  function getConfigNumber(key) {
    var result = Repository.countBy('Society_Config', { configKey: key });
    if (!result.exists) { return 0; }
    var sheet = Repository.getSheet('Society_Config');
    var map = Repository.headerMap('Society_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return 0; }
    var columns = Schema.columnsOf('Society_Config');
    var valIdx = map['configValue'] - 1;
    var keyIdx = map['configKey'] - 1;
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][keyIdx]) === key) { return Utils.toNumber(values[i][valIdx], 0); }
    }
    return 0;
  }

  function generateEmployeeCode() {
    var seq = 1;
    var existing = readAll('Employees');
    if (existing.length > 0) {
      var codes = existing.map(function (e) {
        var m = (e.employeeCode || '').match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
      seq = Math.max.apply(null, codes) + 1;
    }
    return 'EMP' + String(seq).padStart(4, '0');
  }

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------

  function listEmployees(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.employeeTypeId) { filter.employeeTypeId = o.employeeTypeId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var employees = readAll('Employees', Object.keys(filter).length > 0 ? filter : null);
    employees.sort(function (a, b) { return (a.fullName || '').localeCompare(b.fullName || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = employees.length;
    var start = (page - 1) * pageSize;
    var paged = employees.slice(start, start + pageSize);

    return {
      ok: true, data: paged,
      page: { page: page, pageSize: pageSize, total: total, totalPages: Math.ceil(total / pageSize) || 1, hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
    };
  }

  function getEmployee(ctx) {
    var emp = Repository.findById('Employees', ctx.payload.employeeId);
    if (!emp) { return { ok: false, error: 'NOT_FOUND' }; }

    // Attach recent attendance and salary history
    var attendance = readAll('Employee_Attendance', { employeeId: emp.employeeId });
    attendance.sort(function (a, b) { return (b.attendanceDate || '').localeCompare(a.attendanceDate || ''); });

    var salary = readAll('Employee_Salary', { employeeId: emp.employeeId });
    salary.sort(function (a, b) { return (b.periodKey || '').localeCompare(a.periodKey || ''); });

    return {
      ok: true,
      data: {
        employee: emp,
        recentAttendance: attendance.slice(0, 30),
        salaryHistory: salary.slice(0, 12)
      }
    };
  }

  function createEmployee(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    // Check uniqueness
    if (o.employeeCode) {
      var existing = findByUnique('Employees', { employeeCode: o.employeeCode });
      if (existing) { return { ok: false, error: 'CONFLICT_ERROR', message: 'Employee code already exists.' }; }
    }

    var emp = {
      employeeCode: o.employeeCode || generateEmployeeCode(),
      fullName: o.fullName || '',
      employeeTypeId: o.employeeTypeId || '',
      mobile: o.mobile || '',
      altMobile: o.altMobile || '',
      email: o.email || '',
      address: o.address || '',
      joinDate: o.joinDate || Utils.today(),
      exitDate: '',
      monthlySalary: String(Utils.toNumber(o.monthlySalary, 0)),
      statusKey: 'ACTIVE',
      bankName: o.bankName || '',
      bankAccount: o.bankAccount || '',
      ifsc: o.ifsc || '',
      emergencyName: o.emergencyName || '',
      emergencyMobile: o.emergencyMobile || '',
      idProofType: o.idProofType || '',
      idProofNumber: o.idProofNumber || '',
      notes: o.notes || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Employees', emp, { userId: userId });
    }, 'hr:create-employee');

    Audit.write({
      action: 'EMPLOYEE_CREATED', entity: 'Employees', entityId: created.employeeId,
      after: created, sourceSheet: 'Employees', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  function updateEmployee(ctx) {
    var emp = Repository.findById('Employees', ctx.payload.employeeId);
    if (!emp) { return { ok: false, error: 'NOT_FOUND' }; }

    var ALLOWED = ['fullName', 'employeeTypeId', 'mobile', 'altMobile', 'email', 'address', 'monthlySalary', 'bankName', 'bankAccount', 'ifsc', 'emergencyName', 'emergencyMobile', 'idProofType', 'idProofNumber', 'notes', 'statusKey'];
    var patch = {};
    var o = ctx.payload;
    for (var i = 0; i < ALLOWED.length; i++) {
      if (o.hasOwnProperty(ALLOWED[i])) { patch[ALLOWED[i]] = o[ALLOWED[i]]; }
    }
    if (patch.monthlySalary !== undefined) { patch.monthlySalary = String(Utils.toNumber(patch.monthlySalary, 0)); }

    if (Object.keys(patch).length === 0) { return { ok: true, data: emp }; }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Employees', emp.employeeId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'hr:update-employee');

    Audit.write({
      action: 'EMPLOYEE_UPDATED', entity: 'Employees', entityId: emp.employeeId,
      before: emp, after: updated, sourceSheet: 'Employees', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  function archiveEmployee(ctx) {
    var emp = Repository.findById('Employees', ctx.payload.employeeId);
    if (!emp) { return { ok: false, error: 'NOT_FOUND' }; }

    var ts = Utils.now();
    var patch = { statusKey: 'ARCHIVED', exitDate: ts.substring(0, 10) };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Employees', emp.employeeId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'hr:archive-employee');

    Audit.write({
      action: 'EMPLOYEE_ARCHIVED', entity: 'Employees', entityId: emp.employeeId,
      before: emp, after: updated, reason: ctx.payload.reason, sourceSheet: 'Employees', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  function listAttendance(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.employeeId) { filter.employeeId = o.employeeId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var rows = readAll('Employee_Attendance', Object.keys(filter).length > 0 ? filter : null);

    if (o.from) { rows = rows.filter(function (r) { return (r.attendanceDate || '') >= o.from; }); }
    if (o.to) { rows = rows.filter(function (r) { return (r.attendanceDate || '') <= o.to; }); }

    rows.sort(function (a, b) { return (b.attendanceDate || '').localeCompare(a.attendanceDate || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = rows.length;
    var start = (page - 1) * pageSize;
    var paged = rows.slice(start, start + pageSize);

    return {
      ok: true, data: paged,
      page: { page: page, pageSize: pageSize, total: total, totalPages: Math.ceil(total / pageSize) || 1, hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
    };
  }

  function markAttendance(ctx) {
    var rows = ctx.payload.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'At least one attendance row is required.' };
    }

    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';
    var created = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.employeeId || !r.attendanceDate || !r.statusKey) { continue; }
      if (ATTENDANCE_STATUSES.indexOf(r.statusKey) === -1) { continue; }

      var existing = findByUnique('Employee_Attendance', { employeeId: r.employeeId, attendanceDate: r.attendanceDate });
      var patch = {
        statusKey: r.statusKey,
        inTime: r.inTime || '',
        outTime: r.outTime || '',
        overtimeHours: String(Utils.toNumber(r.overtimeHours, 0)),
        remarks: r.remarks || '',
        markedByUserId: userId,
        markedAt: ts
      };

      if (existing) {
        Repository.withLock(function (eid, p) {
          Repository.updateById('Employee_Attendance', existing.attendanceId, p, { userId: userId });
        }.bind(null, existing.attendanceId, patch), 'hr:attendance-update');
      } else {
        var record = {
          employeeId: r.employeeId,
          attendanceDate: r.attendanceDate,
          statusKey: r.statusKey,
          inTime: r.inTime || '',
          outTime: r.outTime || '',
          workedHours: r.workedHours || '',
          overtimeHours: String(Utils.toNumber(r.overtimeHours, 0)),
          remarks: r.remarks || '',
          markedByUserId: userId,
          markedAt: ts
        };
        Repository.withLock(function (rec) {
          created.push(Repository.insert('Employee_Attendance', rec, { userId: userId }));
        }.bind(null, record), 'hr:attendance-insert');
      }
    }

    return { ok: true, data: { marked: rows.length, newlyCreated: created.length } };
  }

  function attendanceSummary(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.employeeId) { filter.employeeId = o.employeeId; }

    var rows = readAll('Employee_Attendance', Object.keys(filter).length > 0 ? filter : null);

    if (o.from) { rows = rows.filter(function (r) { return (r.attendanceDate || '') >= o.from; }); }
    if (o.to) { rows = rows.filter(function (r) { return (r.attendanceDate || '') <= o.to; }); }
    if (o.periodKey) {
      rows = rows.filter(function (r) { return (r.attendanceDate || '').indexOf(o.periodKey) === 0; });
    }

    var summary = {};
    for (var i = 0; i < rows.length; i++) {
      var empId = rows[i].employeeId;
      if (!summary[empId]) { summary[empId] = { present: 0, absent: 0, leave: 0, halfDay: 0, holiday: 0 }; }
      switch (rows[i].statusKey) {
        case 'PRESENT': summary[empId].present++; break;
        case 'ABSENT': summary[empId].absent++; break;
        case 'LEAVE': summary[empId].leave++; break;
        case 'HALF_DAY': summary[empId].halfDay++; break;
        case 'HOLIDAY': summary[empId].holiday++; break;
      }
    }

    return { ok: true, data: summary };
  }

  // ---------------------------------------------------------------------------
  // Salary
  // ---------------------------------------------------------------------------

  function computeNetSalary(baseSalary, presentDays, workingDays, overtimeHours, allowanceAmount, advanceDeduction, otherDeduction) {
    var base = Utils.toNumber(baseSalary, 0);
    var wd = Utils.toNumber(workingDays, 1);
    var pd = Utils.toNumber(presentDays, 0);
    var ot = Utils.toNumber(overtimeHours, 0);
    var allowance = Utils.toNumber(allowanceAmount, 0);
    var advance = Utils.toNumber(advanceDeduction, 0);
    var other = Utils.toNumber(otherDeduction, 0);

    var perDay = wd > 0 ? base / wd : 0;
    var attendanceAdj = perDay * pd;
    var otRate = wd > 0 ? (base / wd / (CONFIG.num('attendanceWorkHours') || 8)) : 0;
    var otAmount = otRate * ot;

    return Utils.round2(attendanceAdj + otAmount + allowance - advance - other);
  }

  function listSalary(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.periodKey) { filter.periodKey = o.periodKey; }
    if (o.employeeId) { filter.employeeId = o.employeeId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }

    var rows = readAll('Employee_Salary', Object.keys(filter).length > 0 ? filter : null);
    rows.sort(function (a, b) { return (b.periodKey || '').localeCompare(a.periodKey || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = rows.length;
    var start = (page - 1) * pageSize;
    var paged = rows.slice(start, start + pageSize);

    return {
      ok: true, data: paged,
      page: { page: page, pageSize: pageSize, total: total, totalPages: Math.ceil(total / pageSize) || 1, hasNext: page < Math.ceil(total / pageSize), hasPrev: page > 1 }
    };
  }

  function getSalary(ctx) {
    var salary = Repository.findById('Employee_Salary', ctx.payload.salaryId);
    if (!salary) { return { ok: false, error: 'NOT_FOUND' }; }

    var emp = Repository.findById('Employees', salary.employeeId);
    var attendance = readAll('Employee_Attendance', { employeeId: salary.employeeId });
    attendance = attendance.filter(function (a) { return (a.attendanceDate || '').indexOf(salary.periodKey) === 0; });

    return {
      ok: true,
      data: {
        salary: salary,
        employee: emp,
        attendanceBreakdown: attendance
      }
    };
  }

  function prepareSalary(ctx) {
    var o = ctx.payload;
    var periodKey = o.periodKey;
    if (!periodKey) { return { ok: false, error: 'VALIDATION_ERROR', message: 'periodKey is required.' }; }

    var employees = readAll('Employees', { statusKey: 'ACTIVE' });
    if (o.employeeIds && Array.isArray(o.employeeIds) && o.employeeIds.length > 0) {
      employees = employees.filter(function (e) { return o.employeeIds.indexOf(e.employeeId) !== -1; });
    }

    var created = [];
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    for (var i = 0; i < employees.length; i++) {
      var emp = employees[i];

      // Check idempotency
      var existing = findByUnique('Employee_Salary', { employeeId: emp.employeeId, periodKey: periodKey });
      if (existing) { continue; }

      // Get attendance for the period
      var attendance = readAll('Employee_Attendance', { employeeId: emp.employeeId });
      attendance = attendance.filter(function (a) { return (a.attendanceDate || '').indexOf(periodKey) === 0; });

      var presentDays = 0;
      var absentDays = 0;
      var leaveDays = 0;
      var halfDays = 0;
      var holidayDays = 0;
      var overtimeHours = 0;

      for (var j = 0; j < attendance.length; j++) {
        switch (attendance[j].statusKey) {
          case 'PRESENT': presentDays++; break;
          case 'ABSENT': absentDays++; break;
          case 'LEAVE': leaveDays++; break;
          case 'HALF_DAY': halfDays++; presentDays += 0.5; break;
          case 'HOLIDAY': holidayDays++; break;
        }
        overtimeHours += Utils.toNumber(attendance[j].overtimeHours, 0);
      }

      var baseSalary = Utils.toNumber(emp.monthlySalary, 0);
      var workingDays = 30; // default, could be config-driven
      var perDayAmount = workingDays > 0 ? baseSalary / workingDays : 0;

      var overrides = o.overrides && o.overrides[emp.employeeId] ? o.overrides[emp.employeeId] : {};
      var allowanceAmount = Utils.toNumber(overrides.allowanceAmount, 0);
      var advanceDeduction = Utils.toNumber(overrides.advanceDeduction, 0);
      var otherDeduction = Utils.toNumber(overrides.otherDeduction, 0);

      var netSalary = computeNetSalary(baseSalary, presentDays, workingDays, overtimeHours, allowanceAmount, advanceDeduction, otherDeduction);

      var salary = {
        employeeId: emp.employeeId,
        periodKey: periodKey,
        baseSalary: String(baseSalary),
        workingDays: String(workingDays),
        presentDays: String(presentDays),
        absentDays: String(absentDays),
        leaveDays: String(leaveDays),
        halfDays: String(halfDays),
        holidayDays: String(holidayDays),
        perDayAmount: Utils.round2(perDayAmount),
        attendanceAdjustment: Utils.round2(perDayAmount * presentDays),
        overtimeHours: String(overtimeHours),
        overtimeAmount: '0',
        allowanceAmount: String(allowanceAmount),
        advanceDeduction: String(advanceDeduction),
        otherDeduction: String(otherDeduction),
        bonusAmount: '0',
        otherAdjustment: '0',
        netSalary: String(netSalary),
        paymentDate: '',
        paymentModeKey: '',
        referenceNumber: '',
        statusKey: 'DRAFT',
        remarks: '',
        attachmentRef: ''
      };

      var createdSalary = Repository.withLock(function (s) {
        return Repository.insert('Employee_Salary', s, { userId: userId });
      }.bind(null, salary), 'hr:prepare-salary');

      created.push(createdSalary);
    }

    return {
      ok: true,
      data: {
        periodKey: periodKey,
        created: created.length,
        rows: created
      }
    };
  }

  function updateSalary(ctx) {
    var salary = Repository.findById('Employee_Salary', ctx.payload.salaryId);
    if (!salary) { return { ok: false, error: 'NOT_FOUND' }; }

    if (salary.statusKey !== 'DRAFT') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Only DRAFT salary can be updated.' };
    }

    var ALLOWED = ['overtimeHours', 'allowanceAmount', 'advanceDeduction', 'otherDeduction', 'bonusAmount', 'otherAdjustment', 'remarks'];
    var patch = {};
    var o = ctx.payload;
    for (var i = 0; i < ALLOWED.length; i++) {
      if (o.hasOwnProperty(ALLOWED[i])) { patch[ALLOWED[i]] = o[ALLOWED[i]]; }
    }

    // Recompute netSalary
    var netSalary = computeNetSalary(
      salary.baseSalary, salary.presentDays, salary.workingDays,
      Utils.toNumber(patch.overtimeHours !== undefined ? patch.overtimeHours : salary.overtimeHours, 0),
      Utils.toNumber(patch.allowanceAmount !== undefined ? patch.allowanceAmount : salary.allowanceAmount, 0),
      Utils.toNumber(patch.advanceDeduction !== undefined ? patch.advanceDeduction : salary.advanceDeduction, 0),
      Utils.toNumber(patch.otherDeduction !== undefined ? patch.otherDeduction : salary.otherDeduction, 0)
    );
    patch.netSalary = String(netSalary);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Employee_Salary', salary.salaryId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'hr:update-salary');

    return { ok: true, data: updated };
  }

  function approveSalary(ctx) {
    var salary = Repository.findById('Employee_Salary', ctx.payload.salaryId);
    if (!salary) { return { ok: false, error: 'NOT_FOUND' }; }

    if (salary.statusKey !== 'DRAFT') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Only DRAFT salary can be approved.' };
    }

    // Self-approval check
    var callerEmpId = ctx.user ? ctx.user.employeeId : '';
    if (callerEmpId && callerEmpId === salary.employeeId) {
      return { ok: false, error: 'FORBIDDEN', message: 'Self-approval is not allowed.' };
    }

    var patch = { statusKey: 'APPROVED' };
    var updated = Repository.withLock(function () {
      return Repository.updateById('Employee_Salary', salary.salaryId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'hr:approve-salary');

    Audit.write({
      action: 'SALARY_APPROVED', entity: 'Employee_Salary', entityId: salary.salaryId,
      before: salary, after: updated, sourceSheet: 'Employee_Salary', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  function paySalary(ctx) {
    var salary = Repository.findById('Employee_Salary', ctx.payload.salaryId);
    if (!salary) { return { ok: false, error: 'NOT_FOUND' }; }

    if (salary.statusKey !== 'APPROVED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Only APPROVED salary can be paid.' };
    }

    var patch = {
      statusKey: 'PAID',
      paymentDate: ctx.payload.paymentDate || Utils.today(),
      paymentModeKey: ctx.payload.paymentModeKey || '',
      referenceNumber: ctx.payload.referenceNumber || '',
      remarks: ctx.payload.remarks || ''
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Employee_Salary', salary.salaryId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'hr:pay-salary');

    Audit.write({
      action: 'SALARY_PAID', entity: 'Employee_Salary', entityId: salary.salaryId,
      before: salary, after: updated, sourceSheet: 'Employee_Salary', requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listEmployees: listEmployees,
    getEmployee: getEmployee,
    createEmployee: createEmployee,
    updateEmployee: updateEmployee,
    archiveEmployee: archiveEmployee,
    listAttendance: listAttendance,
    markAttendance: markAttendance,
    attendanceSummary: attendanceSummary,
    listSalary: listSalary,
    getSalary: getSalary,
    prepareSalary: prepareSalary,
    updateSalary: updateSalary,
    approveSalary: approveSalary,
    paySalary: paySalary,
    computeNetSalary: computeNetSalary
  };
})();
