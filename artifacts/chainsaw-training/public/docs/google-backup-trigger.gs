/**
 * Chainsaw Courses daily backup trigger.
 * Keep this Apps Script project private. No Gmail or Drive access is needed.
 * Add BACKUP_TRIGGER_SECRET under Project settings > Script properties.
 */
var BACKUP_URL = 'https://app.chainsawcourses.com/api/automation/backups/daily';
var BACKUP_TIMEZONE = 'Europe/London';

function backupConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var key = properties.getProperty('BACKUP_TRIGGER_SECRET') || '';
  if (!/^\S{32,256}$/.test(key)) {
    throw new Error('Add the dedicated 32–256 character BACKUP_TRIGGER_SECRET in Script properties.');
  }
  return { properties: properties, key: key };
}

function callBackup_(method, config) {
  // Never follow a redirect with the credential, and never log it.
  var response = UrlFetchApp.fetch(BACKUP_URL, {
    method: method,
    headers: { Authorization: 'Bearer ' + config.key },
    followRedirects: false,
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code !== 200 && code !== 202) {
    throw new Error('Backup connection returned HTTP ' + code +
      '. Check the production publish, the matching trigger key and admin backup status.');
  }
  var body;
  try { body = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('The backup service returned an unreadable response.'); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey || '')) {
    throw new Error('The backup service returned an invalid date.');
  }
  return body;
}

/** Safe connection check: does NOT create a backup. */
function checkBackupConnection() {
  var result = callBackup_('get', backupConfig_());
  if (result.state !== 'ready') throw new Error('Backup service is not ready.');
  console.log('Connection ready. No backup was started.');
}

/** Run once after publishing and adding the same dedicated key in both places. */
function installBackupTrigger() {
  checkBackupConnection();
  // Create the replacement before deleting old triggers, so a failed create keeps the old one.
  var oldTriggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'runDailyBackup';
  });
  ScriptApp.newTrigger('runDailyBackup').timeBased().everyMinutes(15).create();
  oldTriggers.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  console.log('Installed. Checks every 15 minutes; eligible from 06:00 Europe/London. No routine emails.');
}

/** Automatic callback. Failures remain visible in admin and are retried next tick. */
function runDailyBackup() {
  var lock;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return;
    var now = new Date();
    var dateKey = Utilities.formatDate(now, BACKUP_TIMEZONE, 'yyyy-MM-dd');
    if (Number(Utilities.formatDate(now, BACKUP_TIMEZONE, 'HH')) < 6) return;
    var config = backupConfig_();
    if (config.properties.getProperty('BACKUP_TERMINAL_DATE') === dateKey) return;
    var result = callBackup_('post', config);
    if (['succeeded', 'failed', 'busy', 'running', 'not_due'].indexOf(result.state) < 0) {
      throw new Error('The backup service returned an unknown state.');
    }
    // Never treat a timeout, lock conflict, or an old day's result as success.
    if (result.dateKey === dateKey && (result.state === 'succeeded' || result.state === 'failed')) {
      config.properties.setProperty('BACKUP_TERMINAL_DATE', dateKey);
      config.properties.setProperty('BACKUP_LAST_STATE', result.state);
    }
    console.log('Daily backup state: ' + result.state + '. Full details are in admin.');
  } catch (_) {
    // Do not leak response bodies/credentials or generate emails for ordinary retries.
    console.warn('Backup trigger could not confirm completion. Check admin; the next tick will retry.');
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

/** Stops only this project's daily backup trigger; does not delete any backups. */
function removeBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runDailyBackup') ScriptApp.deleteTrigger(trigger);
  });
  console.log('Daily backup trigger removed.');
}
