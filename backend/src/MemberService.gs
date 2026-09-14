/**
 * MemberService.js — CRUD for flats, members, family members, vehicles and flat charges.
 *
 * Authority: GAS-06-Members-and-Flats.md, SRS §3, database-schema.md §7, §14.
 *
 * Key rules:
 * - Flats unique: wingId + flatNumber; Members unique: memberCode; at most one isPrimary per flatId.
 * - Foreign keys (wingId, flatTypeId, flatId) validated before every write.
 * - MEMBERS: relationType in { OWNER, TENANT, FAMILY }.
 * - MEMBER_SELF: members see only their own flat; foreign flatId/memberId → FORBIDDEN.
 * - Flat status from Status_Config domain FLAT (OCCUPIED, VACANT, UNDER_MAINTENANCE, BLOCKED).
 * - Never hard-delete: member statusKey = ARCHIVED; master rows INACTIVE.
 * - Flat charge applicability (Flat_Charges) is data — Active/Inactive per flat, audited when toggled.
 */
var MemberService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Flat actions
  // ---------------------------------------------------------------------------

  /**
   * flats.list — paginated flat list with optional wingId/statusKey filters.
   * Resolves wing name for each flat.
   * @param {object} ctx  handler context { user, payload, permissions }
   * @return {{ ok: boolean, data?: object, page?: object, error?: string }}
   */
  function listFlats(ctx) {
    var p = ctx.payload || {};
    var filter = {};
    if (p.wingId) { filter.wingId = p.wingId; }
    if (p.statusKey) { filter.statusKey = p.statusKey; }

    var result = Repository.readSheet('Flats', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['flatNumber', 'remarks'],
      sort: p.sort || 'flatNumber',
      sortDir: p.sortDir || 'asc',
      filter: filter
    });

    // Resolve wing names
    var wingMap = buildWingMap();
    var flats = result.rows.map(function (flat) {
      flat.wingName = wingMap[flat.wingId] || '';
      return flat;
    });

    return { ok: true, data: flats, page: result.page };
  }

  /**
   * flats.get — single flat with charges, members and basic summary.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function getFlat(ctx) {
    var flatId = ctx.payload.flatId;
    var flat = Repository.findById('Flats', flatId);
    if (!flat) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Resolve wing name
    var wingMap = buildWingMap();
    flat.wingName = wingMap[flat.wingId] || '';

    // Resolve flat type name
    var flatType = Repository.findById('Flat_Types', flat.flatTypeId);
    flat.flatTypeName = flatType ? flatType.typeName : '';

    // Get charges for this flat
    flat.charges = listFlatCharges(flatId);

    // Get members for this flat
    var memberResult = Repository.readSheet('Members', {
      filter: { flatId: flatId },
      pageSize: 100
    });
    flat.members = memberResult.rows;

    return { ok: true, data: flat };
  }

  /**
   * flats.create — create a flat with validation.
   * Validates: wing exists, flatNumber unique per wing.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function createFlat(ctx) {
    var p = ctx.payload || {};
    var errors = [];

    // Validate wing exists
    if (!p.wingId) {
      errors.push({ field: 'wingId', message: 'Wing is required.' });
    } else {
      var wing = Repository.findById('Wings', p.wingId);
      if (!wing) {
        errors.push({ field: 'wingId', message: 'Wing not found.' });
      } else if (wing.status === 'INACTIVE') {
        errors.push({ field: 'wingId', message: 'Wing is inactive.' });
      }
    }

    // Validate flatTypeId if provided
    if (p.flatTypeId) {
      var flatType = Repository.findById('Flat_Types', p.flatTypeId);
      if (!flatType) {
        errors.push({ field: 'flatTypeId', message: 'Flat type not found.' });
      } else if (flatType.status === 'INACTIVE') {
        errors.push({ field: 'flatTypeId', message: 'Flat type is inactive.' });
      }
    }

    // Validate flatNumber is provided
    if (!p.flatNumber || !String(p.flatNumber).trim()) {
      errors.push({ field: 'flatNumber', message: 'Flat number is required.' });
    }

    // Validate statusKey against Status_Config domain FLAT
    if (p.statusKey) {
      var validFlatStatus = isValidStatusKey('FLAT', p.statusKey);
      if (!validFlatStatus) {
        errors.push({ field: 'statusKey', message: 'Invalid flat status: ' + p.statusKey });
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    // Check uniqueness: wingId + flatNumber
    var existing = Repository.countBy('Flats', { wingId: p.wingId, flatNumber: String(p.flatNumber).trim() });
    if (existing.exists) {
      return { ok: false, error: 'CONFLICT_ERROR', message: 'A flat with this number already exists in this wing.' };
    }

    // Set defaults
    var record = {
      wingId: p.wingId,
      flatNumber: String(p.flatNumber).trim(),
      floor: p.floor || '',
      flatTypeId: p.flatTypeId || '',
      carpetArea: p.carpetArea || '',
      builtUpArea: p.builtUpArea || '',
      statusKey: p.statusKey || 'OCCUPIED',
      occupancyType: p.occupancyType || '',
      sortOrder: p.sortOrder || '',
      remarks: p.remarks || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Flats', record, { userId: ctx.user.userId });
    }, 'flats:create');

    return { ok: true, data: created };
  }

  /**
   * flats.update — update a flat.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function updateFlat(ctx) {
    var p = ctx.payload || {};
    var flatId = p.flatId;
    var existing = Repository.findById('Flats', flatId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var errors = [];
    var patch = {};

    // Validate wing if changing
    if (p.wingId && p.wingId !== existing.wingId) {
      var wing = Repository.findById('Wings', p.wingId);
      if (!wing) {
        errors.push({ field: 'wingId', message: 'Wing not found.' });
      } else if (wing.status === 'INACTIVE') {
        errors.push({ field: 'wingId', message: 'Wing is inactive.' });
      }
      patch.wingId = p.wingId;
    }

    // Validate flatTypeId if changing
    if (p.flatTypeId !== undefined && p.flatTypeId !== existing.flatTypeId) {
      if (p.flatTypeId) {
        var flatType = Repository.findById('Flat_Types', p.flatTypeId);
        if (!flatType) {
          errors.push({ field: 'flatTypeId', message: 'Flat type not found.' });
        } else if (flatType.status === 'INACTIVE') {
          errors.push({ field: 'flatTypeId', message: 'Flat type is inactive.' });
        }
      }
      patch.flatTypeId = p.flatTypeId;
    }

    // Check flatNumber uniqueness if changing
    if (p.flatNumber && String(p.flatNumber).trim() !== existing.flatNumber) {
      var wingId = p.wingId || existing.wingId;
      var dupCheck = Repository.countBy('Flats', { wingId: wingId, flatNumber: String(p.flatNumber).trim() });
      if (dupCheck.exists) {
        return { ok: false, error: 'CONFLICT_ERROR', message: 'A flat with this number already exists in this wing.' };
      }
      patch.flatNumber = String(p.flatNumber).trim();
    }

    // Validate statusKey if changing
    if (p.statusKey && p.statusKey !== existing.statusKey) {
      var validFlatStatus = isValidStatusKey('FLAT', p.statusKey);
      if (!validFlatStatus) {
        errors.push({ field: 'statusKey', message: 'Invalid flat status: ' + p.statusKey });
      }
      patch.statusKey = p.statusKey;
    }

    // Copy allowed fields
    var allowedFields = ['floor', 'carpetArea', 'builtUpArea', 'occupancyType', 'sortOrder', 'remarks'];
    for (var i = 0; i < allowedFields.length; i++) {
      var field = allowedFields[i];
      if (p[field] !== undefined) {
        patch[field] = p[field];
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: existing };
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Flats', flatId, patch, { userId: ctx.user.userId });
    }, 'flats:update');

    return { ok: true, data: updated };
  }

  /**
   * flats.charges.list — list charge applicability rows for a flat.
   * @param {string} flatId
   * @return {Array<object>}
   */
  function listFlatCharges(flatId) {
    var result = Repository.readSheet('Flat_Charges', {
      filter: { flatId: flatId },
      pageSize: 100
    });

    // Resolve charge type names
    var chargeTypes = buildChargeTypeMap();
    return result.rows.map(function (fc) {
      fc.chargeName = chargeTypes[fc.chargeTypeId] || '';
      return fc;
    });
  }

  /**
   * flats.charges.list — action handler.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function listFlatChargesAction(ctx) {
    var flatId = ctx.payload.flatId;
    var flat = Repository.findById('Flats', flatId);
    if (!flat) {
      return { ok: false, error: 'NOT_FOUND' };
    }
    var charges = listFlatCharges(flatId);
    return { ok: true, data: charges };
  }

  /**
   * flats.charges.set — set charge applicability for a flat.
   * Audits FLAT_CHARGE_TOGGLED.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function setFlatCharge(ctx) {
    var p = ctx.payload || {};
    var flatId = p.flatId;
    var chargeTypeId = p.chargeTypeId;
    var isActive = p.isActive;
    var amountOverride = p.amountOverride;
    var remarks = p.remarks || '';

    // Validate flat
    var flat = Repository.findById('Flats', flatId);
    if (!flat) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Validate charge type
    var chargeType = Repository.findById('Charge_Types', chargeTypeId);
    if (!chargeType) {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'chargeTypeId', message: 'Charge type not found.' }] };
    }
    if (chargeType.status === 'INACTIVE') {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'chargeTypeId', message: 'Charge type is inactive.' }] };
    }

    // Validate isActive
    if (isActive === undefined || isActive === null) {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'isActive', message: 'isActive is required.' }] };
    }

    // Find existing Flat_Charge row for this flat + chargeType
    var existingResult = Repository.readSheet('Flat_Charges', {
      filter: { flatId: flatId, chargeTypeId: chargeTypeId },
      pageSize: 10
    });
    var existingRow = existingResult.rows.length > 0 ? existingResult.rows[0] : null;

    var beforeState = existingRow ? Object.assign({}, existingRow) : null;

    var result;
    if (existingRow) {
      // Update existing row
      var patch = {
        isActive: isActive ? 'TRUE' : 'FALSE'
      };
      if (amountOverride !== undefined) { patch.amountOverride = amountOverride; }
      if (remarks) { patch.remarks = remarks; }
      result = Repository.withLock(function () {
        return Repository.updateById('Flat_Charges', existingRow.flatChargeId, patch, { userId: ctx.user.userId });
      }, 'flats:charges:set');
    } else {
      // Create new row
      var record = {
        flatId: flatId,
        chargeTypeId: chargeTypeId,
        isActive: isActive ? 'TRUE' : 'FALSE',
        amountOverride: amountOverride || '',
        effectiveFrom: '',
        effectiveTo: '',
        remarks: remarks
      };
      result = Repository.withLock(function () {
        return Repository.insert('Flat_Charges', record, { userId: ctx.user.userId });
      }, 'flats:charges:set');
    }

    // Audit FLAT_CHARGE_TOGGLED
    Audit.write({
      action: 'FLAT_CHARGE_TOGGLED',
      entity: 'Flat_Charges',
      entityId: result.flatChargeId || (existingRow ? existingRow.flatChargeId : ''),
      entityLabel: 'Flat ' + flat.flatNumber + ' / ' + (chargeType.chargeName || chargeTypeId),
      before: beforeState,
      after: result,
      sourceSheet: 'Flat_Charges',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: result };
  }

  // ---------------------------------------------------------------------------
  // Member actions
  // ---------------------------------------------------------------------------

  /**
   * members.list — paginated member list with MEMBER_SELF scoping.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, page?: object, error?: string }}
   */
  function listMembers(ctx) {
    var p = ctx.payload || {};
    var filter = {};

    // MEMBER_SELF: narrow to caller's flatId
    if (ctx.user.flatId) {
      filter.flatId = ctx.user.flatId;
    } else if (p.flatId) {
      // Non-member users can filter by flatId
      filter.flatId = p.flatId;
    }

    if (p.relationType) {
      filter.relationType = p.relationType;
    }
    if (p.statusKey) {
      filter.statusKey = p.statusKey;
    }

    var result = Repository.readSheet('Members', {
      page: p.page || 1,
      pageSize: p.pageSize || CONFIG.pageSizeDefault(),
      search: p.search || '',
      searchFields: ['fullName', 'memberCode', 'mobile', 'email'],
      sort: p.sort || 'fullName',
      sortDir: p.sortDir || 'asc',
      filter: filter
    });

    return { ok: true, data: result.rows, page: result.page };
  }

  /**
   * members.get — single member with family members and vehicles.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string }}
   */
  function getMember(ctx) {
    var memberId = ctx.payload.memberId;
    var member = Repository.findById('Members', memberId);
    if (!member) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // MEMBER_SELF: ensure the member belongs to the caller's flat
    if (ctx.user.flatId && member.flatId !== ctx.user.flatId) {
      return { ok: false, error: 'FORBIDDEN' };
    }

    // Get family members
    var familyResult = Repository.readSheet('Family_Members', {
      filter: { memberId: memberId },
      pageSize: 100
    });
    member.familyMembers = familyResult.rows;

    // Get vehicles
    var vehicleResult = Repository.readSheet('Vehicles', {
      filter: { memberId: memberId },
      pageSize: 100
    });
    member.vehicles = vehicleResult.rows;

    return { ok: true, data: member };
  }

  /**
   * members.create — create a member with validation.
   * Validates: flat exists, memberCode unique, max one isPrimary per flat.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function createMember(ctx) {
    var p = ctx.payload || {};
    var errors = [];

    // Validate flat exists
    if (!p.flatId) {
      errors.push({ field: 'flatId', message: 'Flat is required.' });
    } else {
      var flat = Repository.findById('Flats', p.flatId);
      if (!flat) {
        errors.push({ field: 'flatId', message: 'Flat not found.' });
      }
    }

    // Validate fullName
    if (!p.fullName || !String(p.fullName).trim()) {
      errors.push({ field: 'fullName', message: 'Full name is required.' });
    }

    // Validate memberCode uniqueness
    if (p.memberCode) {
      var codeCheck = Repository.countBy('Members', { memberCode: String(p.memberCode).trim() });
      if (codeCheck.exists) {
        errors.push({ field: 'memberCode', message: 'Member code already exists.' });
      }
    }

    // Validate relationType
    if (p.relationType) {
      var validRelations = ['OWNER', 'TENANT', 'FAMILY'];
      if (validRelations.indexOf(p.relationType) === -1) {
        errors.push({ field: 'relationType', message: 'Relation type must be OWNER, TENANT, or FAMILY.' });
      }
    }

    // Validate isPrimary: at most one per flat
    if (p.isPrimary === 'TRUE' || p.isPrimary === true || p.isPrimary === 'true') {
      var primaryCheck = Repository.countBy('Members', { flatId: p.flatId, isPrimary: 'TRUE' });
      if (primaryCheck.exists) {
        errors.push({ field: 'isPrimary', message: 'This flat already has a primary member.' });
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    // Set defaults
    var record = {
      flatId: p.flatId,
      memberCode: p.memberCode ? String(p.memberCode).trim() : '',
      fullName: String(p.fullName).trim(),
      relationType: p.relationType || '',
      isPrimary: (p.isPrimary === 'TRUE' || p.isPrimary === true || p.isPrimary === 'true') ? 'TRUE' : 'FALSE',
      mobile: p.mobile || '',
      altMobile: p.altMobile || '',
      email: p.email || '',
      address: p.address || '',
      moveInDate: p.moveInDate || '',
      moveOutDate: p.moveOutDate || '',
      dateOfBirth: p.dateOfBirth || '',
      gender: p.gender || '',
      emergencyName: p.emergencyName || '',
      emergencyMobile: p.emergencyMobile || '',
      idProofType: p.idProofType || '',
      idProofNumber: p.idProofNumber || '',
      statusKey: p.statusKey || 'ACTIVE',
      notes: p.notes || ''
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Members', record, { userId: ctx.user.userId });
    }, 'members:create');

    // Audit
    Audit.write({
      action: 'MEMBER_CREATED',
      entity: 'Members',
      entityId: created.memberId,
      entityLabel: created.fullName,
      after: created,
      sourceSheet: 'Members',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: created };
  }

  /**
   * members.update — update a member.
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function updateMember(ctx) {
    var p = ctx.payload || {};
    var memberId = p.memberId;
    var existing = Repository.findById('Members', memberId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var errors = [];
    var patch = {};

    // Validate memberCode uniqueness if changing
    if (p.memberCode && String(p.memberCode).trim() !== existing.memberCode) {
      var codeCheck = Repository.countBy('Members', { memberCode: String(p.memberCode).trim() });
      if (codeCheck.exists) {
        errors.push({ field: 'memberCode', message: 'Member code already exists.' });
      }
      patch.memberCode = String(p.memberCode).trim();
    }

    // Validate relationType if changing
    if (p.relationType && p.relationType !== existing.relationType) {
      var validRelations = ['OWNER', 'TENANT', 'FAMILY'];
      if (validRelations.indexOf(p.relationType) === -1) {
        errors.push({ field: 'relationType', message: 'Relation type must be OWNER, TENANT, or FAMILY.' });
      }
      patch.relationType = p.relationType;
    }

    // Validate isPrimary: at most one per flat
    var newIsPrimary = p.isPrimary !== undefined ? (p.isPrimary === 'TRUE' || p.isPrimary === true || p.isPrimary === 'true') : (existing.isPrimary === 'TRUE');
    if (newIsPrimary && existing.isPrimary !== 'TRUE') {
      var primaryCheck = Repository.countBy('Members', { flatId: existing.flatId, isPrimary: 'TRUE' });
      if (primaryCheck.exists) {
        errors.push({ field: 'isPrimary', message: 'This flat already has a primary member.' });
      }
    }
    if (p.isPrimary !== undefined) {
      patch.isPrimary = newIsPrimary ? 'TRUE' : 'FALSE';
    }

    // Validate statusKey if changing
    if (p.statusKey && p.statusKey !== existing.statusKey) {
      var validEntityStatuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
      if (validEntityStatuses.indexOf(p.statusKey) === -1) {
        errors.push({ field: 'statusKey', message: 'Invalid status.' });
      }
      patch.statusKey = p.statusKey;
    }

    // Copy allowed fields
    var allowedFields = [
      'fullName', 'mobile', 'altMobile', 'email', 'address',
      'moveInDate', 'moveOutDate', 'dateOfBirth', 'gender',
      'emergencyName', 'emergencyMobile', 'idProofType', 'idProofNumber', 'notes'
    ];
    for (var i = 0; i < allowedFields.length; i++) {
      var field = allowedFields[i];
      if (p[field] !== undefined) {
        patch[field] = p[field];
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: 'VALIDATION_ERROR', details: errors };
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: existing };
    }

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Members', memberId, patch, { userId: ctx.user.userId });
    }, 'members:update');

    // Audit
    Audit.write({
      action: 'MEMBER_UPDATED',
      entity: 'Members',
      entityId: memberId,
      entityLabel: updated.fullName || existing.fullName,
      before: beforeState,
      after: updated,
      sourceSheet: 'Members',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  /**
   * members.archive — archive a member (statusKey = ARCHIVED).
   * Checks for active dependants (family members, vehicles).
   * @param {object} ctx
   * @return {{ ok: boolean, data?: object, error?: string, details?: Array }}
   */
  function archiveMember(ctx) {
    var p = ctx.payload || {};
    var memberId = p.memberId;
    var reason = p.reason;

    if (!reason || !String(reason).trim()) {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'reason', message: 'Reason is required for archiving.' }] };
    }

    var existing = Repository.findById('Members', memberId);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // Check for active family members
    var familyCheck = Repository.countBy('Family_Members', { memberId: memberId, statusKey: 'ACTIVE' });
    if (familyCheck.exists) {
      return {
        ok: false,
        error: 'DEPENDENCY_EXISTS',
        details: ['Active family members: ' + familyCheck.count],
        count: familyCheck.count
      };
    }

    // Check for active vehicles
    var vehicleCheck = Repository.countBy('Vehicles', { memberId: memberId, statusKey: 'ACTIVE' });
    if (vehicleCheck.exists) {
      return {
        ok: false,
        error: 'DEPENDENCY_EXISTS',
        details: ['Active vehicles: ' + vehicleCheck.count],
        count: vehicleCheck.count
      };
    }

    var beforeState = Object.assign({}, existing);

    var updated = Repository.withLock(function () {
      return Repository.updateById('Members', memberId, {
        statusKey: 'ARCHIVED',
        moveOutDate: existing.moveOutDate || Utils.today()
      }, { userId: ctx.user.userId });
    }, 'members:archive');

    // Audit
    Audit.write({
      action: 'MEMBER_ARCHIVED',
      entity: 'Members',
      entityId: memberId,
      entityLabel: existing.fullName,
      before: beforeState,
      after: updated,
      reason: reason,
      sourceSheet: 'Members',
      requestId: ctx.requestId,
      actor: { userId: ctx.user.userId, name: ctx.user.fullName || '', roleKeys: Utils.csvToArray(ctx.user.roleKeys) }
    });

    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a map of wingId → wingName from the Wings sheet.
   * @return {object}
   */
  function buildWingMap() {
    var map = {};
    var sheet = Repository.getSheet('Wings');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return map; }
    var columns = Schema.columnsOf('Wings');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Wings', values[i]);
      if (rec.wingId && rec.status === 'ACTIVE') {
        map[rec.wingId] = rec.wingName;
      }
    }
    return map;
  }

  /**
   * Build a map of chargeTypeId → chargeName from the Charge_Types sheet.
   * @return {object}
   */
  function buildChargeTypeMap() {
    var map = {};
    var sheet = Repository.getSheet('Charge_Types');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return map; }
    var columns = Schema.columnsOf('Charge_Types');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Charge_Types', values[i]);
      if (rec.chargeTypeId) {
        map[rec.chargeTypeId] = rec.chargeName;
      }
    }
    return map;
  }

  /**
   * Check if a statusKey is valid for a given Status_Config domain.
   * @param {string} domain  e.g. 'FLAT', 'ENTITY'
   * @param {string} statusKey
   * @return {boolean}
   */
  function isValidStatusKey(domain, statusKey) {
    var sheet = Repository.getSheet('Status_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return false; }
    var columns = Schema.columnsOf('Status_Config');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Status_Config', values[i]);
      if (rec.domain === domain && rec.statusKey === statusKey && rec.status === 'ACTIVE') {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    listFlats: listFlats,
    getFlat: getFlat,
    createFlat: createFlat,
    updateFlat: updateFlat,
    listFlatCharges: listFlatChargesAction,
    setFlatCharge: setFlatCharge,
    listMembers: listMembers,
    getMember: getMember,
    createMember: createMember,
    updateMember: updateMember,
    archiveMember: archiveMember
  };
})();
