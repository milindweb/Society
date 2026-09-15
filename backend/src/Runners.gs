/**
 * Runners.gs — top-level entry points so the Apps Script editor's "Run" dropdown can
 * invoke setup operations directly.
 *
 * The codebase is organised as IIFE namespaces (Setup.seedDummyData, Setup.install, …).
 * The editor's function dropdown only lists top-level `function name() {}` declarations,
 * so namespace methods are otherwise not runnable from the UI. These thin wrappers exist
 * solely to bridge that gap and contain no business logic.
 */

function seedDummyData() {
  return Setup.seedDummyData();
}

/**
 * One-time helper: set the spreadsheet/folder IDs in Script Properties.
 * Delete this function after first-time setup if you don't want the IDs in source.
 */
function configureIds() {
  return Setup.configureIds({
    societySheetId: '1bvgoFqay2LT92ahLQ2PC5KXGf1IjQ3hiXjaFZuQ5khA',
    authSheetId: '1ISCaMXFsZCDBFoD1dqvhpPU_97JnqutzSmat0GUqLWM',
    driveRootFolderId: '1xiVw5Z_dAbQQ4YNyrlu_7b1910Kv21Ec'
  });
}

/** One-click: configure IDs, install structure (if needed), and seed demo data. */
function setupAndSeed() {
  var ids = configureIds();
  var seed = Setup.seedDummyData();
  return { ids: ids, seed: seed };
}

function installSociety() {
  return Setup.install({ user: { userId: 'SYSTEM' } });
}

function migrateSchema() {
  return Setup.migrate({ user: { userId: 'SYSTEM' } });
}

function healthCheck() {
  return Setup.healthCheck();
}

function installTriggers() {
  return Setup.installTriggers();
}

function removeTriggers() {
  return Setup.removeTriggers();
}

/** Backfill any missing permissions for the ADMIN role. Run once after adding new permissions. */
function ensureAdminPermissions() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('AUTH_SHEET_ID'));
  var added = Setup.ensureAdminPermissions(ss);
  Logger.log('Added ' + added + ' missing ADMIN permissions');
  return added;
}
