/**
 * ConfigService.js — cached reads/writes of Society_Config and Status_Config,
 * plus generic schema-driven CRUD for every configurable master-data entity.
 *
 * Rules:
 * - Config cached per group (CacheService, TTL = CACHE_TTL_SECONDS); invalidated per group on write.
 * - isSecret = TRUE rows returned to the API only as ''.
 * - One route family serves every master entity (config.entity.*).
 * - status = ACTIVE | INACTIVE; never hard-delete. setStatus(INACTIVE) refuses when dependants exist.
 * - All keys read in code must exist in the Schema.js seed list (test S8).
 * - No society/role/charge/category/type literal in source (test S6).
 */
var ConfigService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Society_Config helpers
  // ---------------------------------------------------------------------------

  /** Cache key for the full Society_Config map. */
  var CONFIG_CACHE_KEY = CONFIG.CACHE_KEYS.SOCIETY_CONFIG;

  /** Cache key for Status_Config by domain. */
  var STATUS_CACHE_PREFIX = CONFIG.CACHE_KEYS.STATUS_CONFIG + ':';

  /** Cache key for enums. */
  var ENUMS_CACHE_KEY = CONFIG.CACHE_KEYS.ENUMS;

  /**
   * Read all Society_Config rows from the sheet.
   * @return {Array<object>} config records
   */
  function readAllConfigRows() {
    var sheet = Repository.getSheet('Society_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var columns = Schema.columnsOf('Society_Config');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Society_Config', values[i]);
      if (rec.configKey) { rows.push(rec); }
    }
    return rows;
  }

  /**
   * Get the full config map from cache or sheet.
   * @return {object} { configKey: { configValue, valueType, groupKey, label, description, isSecret, sortOrder, status } }
   */
  function getConfigMap() {
    var cached = Repository.cacheGet(CONFIG_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { /* rebuild */ }
    }
    var rows = readAllConfigRows();
    var map = {};
    for (var i = 0; i < rows.length; i++) {
      map[rows[i].configKey] = rows[i];
    }
    Repository.cachePut(CONFIG_CACHE_KEY, Utils.safeJsonStringify(map));
    return map;
  }

  /** Invalidate the Society_Config cache. */
  function invalidateConfigCache() {
    Repository.cacheRemove(CONFIG_CACHE_KEY);
    Repository.cacheRemove(ENUMS_CACHE_KEY);
  }

  // ---------------------------------------------------------------------------
  // config.get — all Society_Config keys, secrets blanked
  // ---------------------------------------------------------------------------

  /**
   * Return all Society_Config key-value pairs (secrets returned as '').
   * @return {object} { configKey: value, ... }
   */
  function get() {
    var map = getConfigMap();
    var result = {};
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var rec = map[keys[i]];
      if (rec.status === 'INACTIVE') { continue; }
      if (rec.isSecret === 'TRUE' || rec.isSecret === true) {
        result[rec.configKey] = '';
      } else {
        result[rec.configKey] = castConfigValue(rec.configValue, rec.valueType);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // config.getGroup — config keys filtered by groupKey
  // ---------------------------------------------------------------------------

  /**
   * Return config values for a specific group.
   * @param {string} groupKey e.g. 'IDENTITY', 'LOCALE', 'FINANCE'
   * @return {object} { configKey: value, ... }
   */
  function getGroup(groupKey) {
    var map = getConfigMap();
    var result = {};
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var rec = map[keys[i]];
      if (rec.groupKey !== groupKey) { continue; }
      if (rec.status === 'INACTIVE') { continue; }
      if (rec.isSecret === 'TRUE' || rec.isSecret === true) {
        result[rec.configKey] = '';
      } else {
        result[rec.configKey] = castConfigValue(rec.configValue, rec.valueType);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // config.update — write config values, invalidate cache
  // ---------------------------------------------------------------------------

  /**
   * Update multiple Society_Config values at once.
   * @param {object} values { configKey: value, ... }
   * @param {object} [actor] { userId }
   * @return {{ updated: number, config: object }}
   */
  function update(values, actor) {
    if (!values || typeof values !== 'object') {
      return { updated: 0, config: get() };
    }

    var map = getConfigMap();
    var ts = Utils.now();
    var userId = actor && actor.userId ? actor.userId : '';
    var updated = 0;
    var keys = Object.keys(values);

    Repository.withLock(function () {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var rec = map[key];
        if (!rec) { continue; } // skip unknown keys silently

        var newVal = values[key];
        var strVal = castConfigValueForStorage(newVal, rec.valueType);

        // Find and update the row in the sheet
        var sheet = Repository.getSheet('Society_Config');
        var sheetMap = Repository.headerMap('Society_Config');
        var keyColIdx = sheetMap['configKey'];
        var lastRow = sheet.getLastRow();
        if (lastRow <= 1 || !keyColIdx) { continue; }

        var columns = Schema.columnsOf('Society_Config');
        var allValues = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
        for (var r = 0; r < allValues.length; r++) {
          if (String(allValues[r][keyColIdx - 1]) === key) {
            var record = Repository.fromRow('Society_Config', allValues[r]);
            record.configValue = strVal;
            record.updatedAt = ts;
            if (userId) { record.updatedBy = userId; }
            var rowValues = Repository.toRow('Society_Config', record);
            sheet.getRange(r + 2, 1, 1, rowValues.length).setValues([rowValues]);
            updated++;
            break;
          }
        }
      }
    }, 'config:update');

    invalidateConfigCache();
    return { updated: updated, config: get() };
  }

  // ---------------------------------------------------------------------------
  // config.enums — statuses, chargeTypes, paymentModes, categories, types, numbering, roles, permissions
  // ---------------------------------------------------------------------------

  /**
   * Return all enum/status data for the frontend dropdowns.
   * @return {object}
   */
  function getEnums() {
    var cached = Repository.cacheGet(ENUMS_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { /* rebuild */ }
    }

    var result = {};

    // Statuses by domain
    result.statuses = getStatusesByDomain();

    // Charge types (active only)
    result.chargeTypes = getActiveEntityRows('chargeTypes', 'chargeTypeId', ['chargeCode', 'chargeName']);

    // Payment modes (active only)
    result.paymentModes = getActiveEntityRows('paymentModes', 'modeKey', ['modeKey', 'modeName']);

    // Categories
    result.categories = {};
    result.categories.complaint = getActiveEntityRows('complaintCategories', 'categoryId', ['categoryKey', 'categoryName']);
    result.categories.expense = getActiveEntityRows('expenseCategories', 'categoryId', ['categoryKey', 'categoryName']);
    result.categories.document = getActiveEntityRows('documentCategories', 'categoryId', ['categoryKey', 'categoryName']);

    // Types
    result.types = {};
    result.types.vehicle = getActiveEntityRows('vehicleTypes', 'vehicleTypeId', ['typeKey', 'typeName']);
    result.types.visitor = getActiveEntityRows('visitorTypes', 'visitorTypeId', ['typeKey', 'typeName']);
    result.types.notice = getActiveEntityRows('noticeTypes', 'noticeTypeId', ['typeKey', 'typeName']);
    result.types.parking = getActiveEntityRows('parkingTypes', 'parkingTypeId', ['typeKey', 'typeName']);
    result.types.meeting = getActiveEntityRows('meetingTypes', 'meetingTypeId', ['typeKey', 'typeName']);
    result.types.employee = getActiveEntityRows('employeeTypes', 'employeeTypeId', ['typeKey', 'typeName']);

    // Numbering config
    result.numbering = getActiveEntityRows('numberingConfig', 'numberingId', ['docType', 'pattern']);

    // Roles (from Auth spreadsheet)
    result.roles = getActiveEntityRows('roles', 'roleKey', ['roleKey', 'roleName']);

    // Permissions (optional, only when requested)
    result.permissions = getActiveEntityRows('permissions', 'permissionKey', ['permissionKey', 'module', 'action']);

    // System enums from SchemaMeta
    result.enums = SchemaMeta.ENUM_OPTIONS;

    Repository.cachePut(ENUMS_CACHE_KEY, Utils.safeJsonStringify(result));
    return result;
  }

  /**
   * Get statuses grouped by domain with colorToken.
   * @return {object} { domain: [{ statusKey, statusName, isOpen, isTerminal, colorToken }] }
   */
  function getStatusesByDomain() {
    var sheet = Repository.getSheet('Status_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return {}; }
    var columns = Schema.columnsOf('Status_Config');
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var byDomain = {};
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Status_Config', values[i]);
      if (!rec.domain || !rec.statusKey) { continue; }
      if (rec.status === 'INACTIVE') { continue; }
      if (!byDomain[rec.domain]) { byDomain[rec.domain] = []; }
      byDomain[rec.domain].push({
        statusKey: rec.statusKey,
        statusName: rec.statusName,
        isOpen: rec.isOpen === 'TRUE' || rec.isOpen === true,
        isTerminal: rec.isTerminal === 'TRUE' || rec.isTerminal === true,
        colorToken: rec.colorToken || ''
      });
    }
    return byDomain;
  }

  /**
   * Get active rows from a master entity, projected to specific fields.
   * @param {string} entityKey camelCase key from SchemaMeta.MASTER_ENTITIES
   * @param {string} idField the id column name
   * @param {Array<string>} fields fields to project
   * @return {Array<object>}
   */
  function getActiveEntityRows(entityKey, idField, fields) {
    var entity = SchemaMeta.MASTER_ENTITIES[entityKey];
    if (!entity) { return []; }
    var sheetName = entity.sheet;
    var sheet = Repository.getSheet(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var columns = Schema.columnsOf(sheetName);
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      // Check status field — master entities use 'status' not 'statusKey'
      if (rec.status === 'INACTIVE') { continue; }
      var projected = {};
      projected[idField] = rec[idField];
      for (var f = 0; f < fields.length; f++) {
        projected[fields[f]] = rec[fields[f]];
      }
      rows.push(projected);
    }
    return rows;
  }

  // ---------------------------------------------------------------------------
  // config.entityMeta — entity descriptor(s)
  // ---------------------------------------------------------------------------

  /**
   * Return the entity descriptor(s) for the Settings UI.
   * @param {string} [entityKey] specific entity or all
   * @return {object|Array}
   */
  function entityMeta(entityKey) {
    if (entityKey) {
      var def = SchemaMeta.MASTER_ENTITIES[entityKey];
      if (!def) { return null; }
      return buildEntityMeta(entityKey, def);
    }
    // Return all
    var result = [];
    var keys = Object.keys(SchemaMeta.MASTER_ENTITIES);
    for (var i = 0; i < keys.length; i++) {
      result.push(buildEntityMeta(keys[i], SchemaMeta.MASTER_ENTITIES[keys[i]]));
    }
    return result;
  }

  /**
   * Build the API-facing entity metadata.
   * @param {string} key
   * @param {object} def
   * @return {object}
   */
  function buildEntityMeta(key, def) {
    return {
      entity: key,
      sheet: def.sheet,
      label: def.label,
      labelField: def.labelField,
      idColumn: Schema.idColumnOf(def.sheet),
      searchable: def.searchable || [],
      sortable: def.sortable || [],
      fields: def.fields || [],
      permissions: {
        read: 'config.read',
        write: 'config.write'
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Generic entity CRUD
  // ---------------------------------------------------------------------------

  /**
   * Resolve the sheet name and entity definition from a camelCase entity key.
   * @param {string} entityKey
   * @return {{ sheetName: string, def: object, idCol: string }|null}
   */
  function resolveEntity(entityKey) {
    var def = SchemaMeta.MASTER_ENTITIES[entityKey];
    if (!def) { return null; }
    var sheetName = def.sheet;
    var idCol = Schema.idColumnOf(sheetName);
    return { sheetName: sheetName, def: def, idCol: idCol };
  }

  /**
   * List rows for a master entity with pagination, search, sort, filter.
   * @param {string} entityKey
   * @param {object} opts { page, pageSize, search, sort, sortDir, filter, fields }
   * @return {{ rows: Array, page: object }}
   */
  function entityList(entityKey, opts) {
    var resolved = resolveEntity(entityKey);
    if (!resolved) { return { rows: [], page: Repository.readSheet(resolved ? resolved.sheetName : 'Flats', { page: 1, pageSize: 25 }).page }; }

    var entityDef = SchemaMeta.MASTER_ENTITIES[entityKey];
    var readOpts = {
      page: (opts && opts.page) || 1,
      pageSize: (opts && opts.pageSize) || CONFIG.pageSizeDefault(),
      search: (opts && opts.search) || '',
      searchFields: entityDef.searchable || [],
      sort: (opts && opts.sort) || (entityDef.sortable && entityDef.sortable[0]) || '',
      sortDir: (opts && opts.sortDir) || 'asc',
      filter: (opts && opts.filter) || {},
      fields: (opts && opts.fields) || []
    };

    // Only show ACTIVE rows by default (unless includeInactive is set)
    if (opts && !opts.includeInactive) {
      readOpts.filter = readOpts.filter || {};
      // Master entities use 'status' column, not 'statusKey'
      readOpts.filter.status = 'ACTIVE';
    }

    return Repository.readSheet(resolved.sheetName, readOpts);
  }

  /**
   * Get a single row by ID.
   * @param {string} entityKey
   * @param {string} idValue
   * @return {object|null}
   */
  function entityGet(entityKey, idValue) {
    var resolved = resolveEntity(entityKey);
    if (!resolved) { return null; }
    return Repository.findById(resolved.sheetName, idValue);
  }

  /**
   * Create a new row for a master entity.
   * @param {string} entityKey
   * @param {object} values
   * @param {object} [actor] { userId }
   * @return {object} created record
   */
  function entityCreate(entityKey, values, actor) {
    var resolved = resolveEntity(entityKey);
    if (!resolved) { throw new Error('Unknown entity: ' + entityKey); }

    // Validate required fields
    var entityDef = SchemaMeta.MASTER_ENTITIES[entityKey];
    var fields = entityDef.fields || [];
    var errors = [];
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (field.required && !values[field.key] && values[field.key] !== 0) {
        errors.push({ field: field.key, message: field.label + ' is required.' });
      }
    }
    if (errors.length > 0) {
      return { error: 'VALIDATION_ERROR', details: errors };
    }

    // Set default status to ACTIVE for master entities
    var record = Object.assign({}, values);
    if (!record.status && resolved.def.def && resolved.def.def.own && resolved.def.def.own.indexOf('status') !== -1) {
      record.status = 'ACTIVE';
    }
    // For sheets with status column (most master entities)
    if (!record.status) {
      var sheetDef = Schema.get(resolved.sheetName);
      if (sheetDef.own.indexOf('status') !== -1) {
        record.status = 'ACTIVE';
      }
    }

    var created = Repository.withLock(function () {
      return Repository.insert(resolved.sheetName, record, actor);
    }, 'config:entity:create:' + entityKey);

    invalidateConfigCache();
    return created;
  }

  /**
   * Update an existing row.
   * @param {string} entityKey
   * @param {string} idValue
   * @param {object} values
   * @param {object} [actor] { userId }
   * @return {object|null} updated record
   */
  function entityUpdate(entityKey, idValue, values, actor) {
    var resolved = resolveEntity(entityKey);
    if (!resolved) { return null; }

    var updated = Repository.withLock(function () {
      return Repository.updateById(resolved.sheetName, idValue, values, actor);
    }, 'config:entity:update:' + entityKey);

    if (updated) { invalidateConfigCache(); }
    return updated;
  }

  // ---------------------------------------------------------------------------
  // config.entity.setStatus — ACTIVE / INACTIVE with dependency check
  // ---------------------------------------------------------------------------

  /**
   * Dependency map: when deactivating an entity, check these sheets for references.
   * Key = MASTER_ENTITIES key, value = array of { sheet, refField, activeOnly }.
   */
  var DEPENDENCY_MAP = {
    wings: [
      { sheet: 'Flats', refField: 'wingId' }
    ],
    flatTypes: [
      { sheet: 'Flats', refField: 'flatTypeId' }
    ],
    chargeTypes: [
      { sheet: 'Flat_Charges', refField: 'chargeTypeId' },
      { sheet: 'Charge_Rates', refField: 'chargeTypeId' },
      { sheet: 'Demands', refField: 'chargeTypeId' }
    ],
    paymentModes: [
      { sheet: 'Payments', refField: 'paymentModeKey' },
      { sheet: 'Expenses', refField: 'paymentModeKey' },
      { sheet: 'Employee_Salary', refField: 'paymentModeKey' }
    ],
    employeeTypes: [
      { sheet: 'Employees', refField: 'employeeTypeId' }
    ],
    vehicleTypes: [
      { sheet: 'Vehicles', refField: 'vehicleTypeKey' }
    ],
    visitorTypes: [
      { sheet: 'Visitors', refField: 'visitorTypeId' }
    ],
    noticeTypes: [
      { sheet: 'Notices', refField: 'noticeTypeId' }
    ],
    documentCategories: [
      { sheet: 'Documents', refField: 'categoryId' }
    ],
    complaintCategories: [
      { sheet: 'Complaints', refField: 'categoryId' }
    ],
    complaintPriorities: [
      { sheet: 'Complaints', refField: 'priorityKey' }
    ],
    expenseCategories: [
      { sheet: 'Expenses', refField: 'categoryId' }
    ],
    meetingTypes: [
      { sheet: 'Meetings', refField: 'meetingTypeKey' }
    ],
    parkingTypes: [
      { sheet: 'Parking_Slots', refField: 'parkingTypeId' }
    ],
    vendors: [
      { sheet: 'Vendors_AMC', refField: 'vendorId' },
      { sheet: 'Expenses', refField: 'vendorId' }
    ],
    roles: [
      { sheet: 'Role_Permissions', refField: 'roleKey', authSheet: true }
    ],
    familyMembers: [
      // Family members are leaf entities; no dependants
    ],
    vehicles: [
      { sheet: 'Parking_Allocations', refField: 'vehicleId' }
    ],
    parkingSlots: [
      { sheet: 'Parking_Allocations', refField: 'parkingSlotId' }
    ]
  };

  /**
   * Check if an entity has active dependants.
   * @param {string} entityKey
   * @param {string} idValue the row's primary key value
   * @return {{ hasDependants: boolean, count: number, details: Array<string> }}
   */
  function checkDependencies(entityKey, idValue) {
    var deps = DEPENDENCY_MAP[entityKey];
    if (!deps || deps.length === 0) { return { hasDependants: false, count: 0, details: [] }; }

    var total = 0;
    var details = [];

    for (var i = 0; i < deps.length; i++) {
      var dep = deps[i];
      var predicate = {};
      predicate[dep.refField] = idValue;

      // For most entities, only count ACTIVE dependants
      // (financial rows like Demands may have statusKey instead)
      var sheetDef = Schema.get(dep.sheet);
      if (sheetDef.own.indexOf('status') !== -1) {
        predicate.status = 'ACTIVE';
      } else if (sheetDef.own.indexOf('statusKey') !== -1) {
        // For operational sheets, check for non-terminal statuses
        // Skip this check for simplicity — any row counts as a dep
      }

      var result = Repository.countBy(dep.sheet, predicate);
      if (result.count > 0) {
        total += result.count;
        details.push(dep.sheet + ': ' + result.count);
      }
    }

    return { hasDependants: total > 0, count: total, details: details };
  }

  /**
   * Set the status of a master entity row (ACTIVE or INACTIVE).
   * Refuses when dependants exist for INACTIVE transition.
   *
   * @param {string} entityKey
   * @param {string} idValue
   * @param {string} newStatus 'ACTIVE' or 'INACTIVE'
   * @param {object} [actor] { userId }
   * @return {{ ok: boolean, record?: object, error?: string, details?: Array }}
   */
  function entitySetStatus(entityKey, idValue, newStatus, actor) {
    if (newStatus !== 'ACTIVE' && newStatus !== 'INACTIVE') {
      return { ok: false, error: 'VALIDATION_ERROR', details: [{ field: 'status', message: 'Status must be ACTIVE or INACTIVE.' }] };
    }

    var resolved = resolveEntity(entityKey);
    if (!resolved) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    var existing = Repository.findById(resolved.sheetName, idValue);
    if (!existing) {
      return { ok: false, error: 'NOT_FOUND' };
    }

    // If deactivating, check for dependants
    if (newStatus === 'INACTIVE') {
      var deps = checkDependencies(entityKey, idValue);
      if (deps.hasDependants) {
        return {
          ok: false,
          error: 'DEPENDENCY_EXISTS',
          details: deps.details,
          count: deps.count
        };
      }
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById(resolved.sheetName, idValue, { status: newStatus }, actor);
    }, 'config:entity:setStatus:' + entityKey);

    invalidateConfigCache();
    return { ok: true, record: updated };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Cast a config value string to the appropriate JS type.
   * @param {string} value
   * @param {string} valueType 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'
   * @return {*}
   */
  function castConfigValue(value, valueType) {
    if (value === '' || value === null || value === undefined) {
      return valueType === 'BOOLEAN' ? false : (valueType === 'NUMBER' ? 0 : '');
    }
    switch (valueType) {
      case 'NUMBER': return Number(value) || 0;
      case 'BOOLEAN': return String(value).toLowerCase() === 'true' || String(value) === '1';
      case 'JSON': return Utils.safeJsonParse(value) || {};
      default: return String(value);
    }
  }

  /**
   * Cast a config value for storage in the sheet (always string).
   * @param {*} value
   * @param {string} valueType
   * @return {string}
   */
  function castConfigValueForStorage(value, valueType) {
    if (value === null || value === undefined) { return ''; }
    switch (valueType) {
      case 'BOOLEAN': return String(!!value).toUpperCase();
      case 'JSON': return typeof value === 'string' ? value : Utils.safeJsonStringify(value);
      default: return String(value);
    }
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    get: get,
    getGroup: getGroup,
    update: update,
    getEnums: getEnums,
    entityMeta: entityMeta,
    entityList: entityList,
    entityGet: entityGet,
    entityCreate: entityCreate,
    entityUpdate: entityUpdate,
    entitySetStatus: entitySetStatus,
    checkDependencies: checkDependencies,
    castConfigValue: castConfigValue,
    invalidateConfigCache: invalidateConfigCache
  };
})();
