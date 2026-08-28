var MONAPAY_DEFAULT_BASE_URL = 'https://api.monapay.vn';
var MONAPAY_DEFAULT_SHEET_NAME = 'MONA Pay Transactions';
var MONAPAY_HEADERS = [
  'transaction_code',
  'amount',
  'description',
  'transfer_date',
  'account_number',
  'bank_name',
  'type',
  'synced_at',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MONA Pay')
    .addItem('Đồng bộ', 'monapaySync')
    .addSeparator()
    .addItem('Bật đồng bộ mỗi giờ', 'monapayInstallHourlyTrigger')
    .addItem('Tắt đồng bộ tự động', 'monapayRemoveTriggers')
    .addItem('Hướng dẫn cấu hình', 'monapayShowSetup')
    .addToUi();
}

function monapayShowSetup() {
  SpreadsheetApp.getUi().alert(
    'Cấu hình MONA Pay',
    'Vào Apps Script → Project Settings → Script Properties và thêm '
      + 'MONAPAY_USERNAME, MONAPAY_PASSWORD, MONAPAY_VIRTUAL_ACCOUNT_NUMBER. '
      + 'Có thể thêm MONAPAY_BASE_URL và MONAPAY_SHEET_NAME.',
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

function monapayInstallHourlyTrigger() {
  monapayRemoveTriggers_(false);
  ScriptApp.newTrigger('monapaySync').timeBased().everyHours(1).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã bật đồng bộ MONA Pay mỗi giờ.', 'MONA Pay', 5);
}

function monapayRemoveTriggers() {
  monapayRemoveTriggers_(true);
}

function monapayRemoveTriggers_(notify) {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'monapaySync') ScriptApp.deleteTrigger(trigger);
  });
  if (notify) SpreadsheetApp.getActiveSpreadsheet().toast('Đã tắt đồng bộ tự động.', 'MONA Pay', 5);
}

function monapaySync() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Một lượt đồng bộ MONA Pay khác đang chạy.');
  try {
    var config = monapayConfig_();
    var sheet = monapaySheet_(config.sheetName);
    var existingCodes = monapayExistingCodes_(sheet);
    var accessToken = monapayLogin_(config);
    var newRows = [];
    var page = 1;
    var lastPage = 1;

    do {
      var result = monapayRequest_(
        config.baseUrl + '/api/v1/acb/virtual-account/transactions'
          + '?virtual_account_number=' + encodeURIComponent(config.virtualAccountNumber)
          + '&page=' + page + '&limit=100',
        accessToken,
      );
      var transactions = result && Array.isArray(result.data) ? result.data : [];
      var reachedKnownTransaction = false;

      transactions.forEach(function (transaction) {
        var code = String(transaction.transaction_code || transaction.transaction_id || transaction.id || '');
        if (!code) return;
        if (existingCodes[code]) {
          reachedKnownTransaction = true;
          return;
        }
        existingCodes[code] = true;
        newRows.push(monapayRow_(transaction, code));
      });

      lastPage = Number(result && result.last_page ? result.last_page : page);
      if (reachedKnownTransaction || page >= lastPage || transactions.length === 0) break;
      page += 1;
    } while (page <= 100);

    if (newRows.length) {
      newRows.reverse();
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, MONAPAY_HEADERS.length).setValues(newRows);
      sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 1).setNumberFormat('#,##0');
    }
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Đã thêm ' + newRows.length + ' giao dịch mới.',
      'MONA Pay',
      5,
    );
    return newRows.length;
  } finally {
    lock.releaseLock();
  }
}

function monapayConfig_() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var required = ['MONAPAY_USERNAME', 'MONAPAY_PASSWORD', 'MONAPAY_VIRTUAL_ACCOUNT_NUMBER'];
  required.forEach(function (name) {
    if (!properties[name]) throw new Error('Thiếu Script Property ' + name + '.');
  });
  return {
    baseUrl: String(properties.MONAPAY_BASE_URL || MONAPAY_DEFAULT_BASE_URL).replace(/\/+$/, ''),
    username: properties.MONAPAY_USERNAME,
    password: properties.MONAPAY_PASSWORD,
    virtualAccountNumber: properties.MONAPAY_VIRTUAL_ACCOUNT_NUMBER,
    sheetName: properties.MONAPAY_SHEET_NAME || MONAPAY_DEFAULT_SHEET_NAME,
  };
}

function monapayLogin_(config) {
  var response = UrlFetchApp.fetch(config.baseUrl + '/api/v1/client/login', {
    method: 'post',
    contentType: 'application/json',
    headers: { Accept: 'application/json' },
    payload: JSON.stringify({ username: config.username, password: config.password }),
    muteHttpExceptions: true,
  });
  var data = monapayEnvelope_(response);
  if (!data || !data.access_token) throw new Error('Response đăng nhập không có access_token.');
  return data.access_token;
}

function monapayRequest_(url, accessToken) {
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    muteHttpExceptions: true,
  });
  return monapayEnvelope_(response);
}

function monapayEnvelope_(response) {
  var status = response.getResponseCode();
  var text = response.getContentText();
  var envelope;
  try {
    envelope = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('MONA Pay trả response không phải JSON (HTTP ' + status + ').');
  }
  if (status < 200 || status >= 300 || envelope.success === false) {
    var detail = typeof envelope.detail === 'string' ? envelope.detail : '';
    throw new Error(envelope.message || detail || 'MONA Pay API lỗi HTTP ' + status + '.');
  }
  return envelope.data;
}

function monapaySheet_(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, MONAPAY_HEADERS.length).setValues([MONAPAY_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, MONAPAY_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function monapayExistingCodes_(sheet) {
  var codes = {};
  if (sheet.getLastRow() < 2) return codes;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(function (row) {
    if (row[0]) codes[row[0]] = true;
  });
  return codes;
}

function monapayRow_(transaction, code) {
  return [
    code,
    Number(transaction.amount || 0),
    transaction.transaction_content || transaction.description || '',
    transaction.transaction_date || transaction.transfer_date || '',
    transaction.virtual_account_number || transaction.account_number || '',
    transaction.bank_name || 'ACB',
    transaction.type || 'income',
    Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss'),
  ];
}
