const CONFIG = {
  SPREADSHEET_NAME: "MAD DAY REGISTRATION",
  SPREADSHEET_ID: "1COcsQEROTsW8G9uymFL3sQ3xt_GlcYynJbfqnSSSEBs",
  SPREADSHEET_URL: "",
  SHEET_NAME: "Лист1",
  TIMEZONE: "Europe/Moscow",
  FACTION_LIMITS: {
    "🔵 Корпус Стали": 60,
    "🔴 Новый Штат": 60,
  },
  TARIFFS: ["Рейдер", "Нефтешлам", "Мародер", "Бензиновый барон"],
};

const SHEET_HEADERS = [
  "ID",
  "Позывной",
  "Фамилия Имя",
  "Телефон",
  "Фракция",
  "Тариф",
  "Telegram ID",
  "Дата",
  "Оплата",
  "Дата оплаты",
];

function doGet(e) {
  const data = getRequestData(e);
  const callback = sanitizeCallback(String(data.callback || ""));

  if (!hasRequestPayload(data)) {
    return ContentService.createTextOutput("OK");
  }

  return handleRequest(data, { callback: callback, isWeb: false });
}

function doPost(e) {
  const data = getRequestData(e);
  const source = String(data.source || "").trim();
  return handleRequest(data, { callback: "", isWeb: source === "WEB" });
}

function handleRequest(data, transport) {
  Logger.log("REQUEST HIT");

  const source = String(data.source || "").trim();
  const action = String(data.action || "").trim();
  Logger.log("Source: " + source + ", action: " + action + ", callback: " + (transport.callback || "-"));

  const sheet = getSheet();
  ensureHeaders(sheet);
  Logger.log("Sheet name: " + sheet.getName());
  Logger.log("Last row before: " + sheet.getLastRow());

  if (action === "mark_paid") {
    const id = String(data.id || "").trim();
    if (!id) {
      Logger.log("Validation failed: missing_id");
      return respond({ ok: false, error: "missing_id" }, transport);
    }

    const paidAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd.MM.yyyy HH:mm");
    const updated = markPaid(sheet, id, paidAt);
    if (!updated) {
      Logger.log("Validation failed: id_not_found for " + id);
      return respond({ ok: false, error: "id_not_found", id: id }, transport);
    }

    Logger.log("Payment marked for id: " + id);
    return respond({ ok: true, action: "mark_paid", id: id, paid_at: paidAt }, transport);
  }

  const callsign = String(data.callsign || "").trim();
  const fullName = String(data.full_name || "").trim();
  const phone = String(data.phone || "").trim();
  const faction = String(data.faction || "").trim();
  const tariff = String(data.tariff || "").trim();
  Logger.log("Payload: callsign=" + callsign + ", full_name=" + fullName + ", faction=" + faction + ", tariff=" + tariff);

  if (!callsign || callsign.length < 2 || callsign.length > 32) {
    Logger.log("Validation failed: invalid_callsign");
    return respond({ ok: false, error: "invalid_callsign" }, transport);
  }
  if (!fullName || fullName.length < 2) {
    Logger.log("Validation failed: invalid_full_name");
    return respond({ ok: false, error: "invalid_full_name" }, transport);
  }
  if (!phone) {
    Logger.log("Validation failed: invalid_phone");
    return respond({ ok: false, error: "invalid_phone" }, transport);
  }
  if (!CONFIG.FACTION_LIMITS[faction]) {
    Logger.log("Validation failed: invalid_faction");
    return respond({ ok: false, error: "invalid_faction" }, transport);
  }
  if (CONFIG.TARIFFS.indexOf(tariff) === -1) {
    Logger.log("Validation failed: invalid_tariff");
    return respond({ ok: false, error: "invalid_tariff" }, transport);
  }

  const counts = factionCounts(sheet);
  Logger.log("Faction count for " + faction + ": " + (counts[faction] || 0));
  if ((counts[faction] || 0) >= CONFIG.FACTION_LIMITS[faction]) {
    Logger.log("Validation failed: faction_full");
    return respond({ ok: false, error: "faction_full" }, transport);
  }

  let id = "";
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    id = nextPlayerId(sheet);
    const now = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd.MM.yyyy HH:mm");
    const row = getNextWriteRow(sheet);
    Logger.log("Write row: " + row);

    sheet.getRange(row, 1, 1, 10).setValues([[
      id,
      callsign,
      fullName,
      phone,
      faction,
      tariff,
      "WEB",
      now,
      "не оплачено",
      "",
    ]]);
    Logger.log("Last row after: " + sheet.getLastRow());
  } finally {
    lock.releaseLock();
  }

  Logger.log("Registration stored with id: " + id);
  return respond({ ok: true, action: "register", id: id }, transport);
}

function getRequestData(e) {
  return e && e.parameter ? e.parameter : {};
}

function hasRequestPayload(data) {
  const ignoredKeys = {
    callback: true,
    _: true,
    _ts: true,
  };
  return Object.keys(data).some(function (key) {
    return !ignoredKeys[key];
  });
}

function getSheet() {
  let spreadsheet;
  if (CONFIG.SPREADSHEET_ID) {
    spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } else if (CONFIG.SPREADSHEET_URL) {
    spreadsheet = SpreadsheetApp.openByUrl(CONFIG.SPREADSHEET_URL);
  } else {
    const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
    if (!files.hasNext()) {
      throw new Error("Spreadsheet not found by name");
    }
    spreadsheet = SpreadsheetApp.openById(files.next().getId());
  }
  return CONFIG.SHEET_NAME ? spreadsheet.getSheetByName(CONFIG.SHEET_NAME) : spreadsheet.getSheets()[0];
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const hasHeaders = SHEET_HEADERS.every(function (value, index) {
    return firstRow[index] === value;
  });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  }
}

function nextPlayerId(sheet) {
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  const numeric = values
    .map(function (row) {
      return String(row[0] || "");
    })
    .filter(function (value) {
      return /^\d+$/.test(value);
    })
    .map(function (value) {
      return parseInt(value, 10);
    });
  const nextValue = numeric.length ? Math.max.apply(null, numeric) + 1 : 1;
  return ("" + nextValue).padStart(3, "0");
}

function getNextWriteRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return 1;
  }
  if (lastRow === 1) {
    return 2;
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let lastFilled = 1;
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || "").trim() !== "") {
      lastFilled = i + 2;
    }
  }
  return lastFilled + 1;
}

function factionCounts(sheet) {
  const data = sheet.getDataRange().getValues();
  const counts = {};
  Object.keys(CONFIG.FACTION_LIMITS).forEach(function (faction) {
    counts[faction] = 0;
  });
  for (let i = 1; i < data.length; i += 1) {
    const faction = String(data[i][4] || "").trim();
    if (Object.prototype.hasOwnProperty.call(counts, faction)) {
      counts[faction] += 1;
    }
  }
  return counts;
}

function respond(payload, transport) {
  if (transport.callback) {
    return jsonpResponse(payload, transport.callback);
  }
  return transport.isWeb ? htmlResponse(payload) : jsonResponse(payload);
}

function sanitizeCallback(name) {
  if (!name) {
    return "";
  }
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(name) ? name : "";
}

function jsonpResponse(payload, callbackName) {
  const safeCallback = sanitizeCallback(callbackName);
  if (!safeCallback) {
    return jsonResponse({ ok: false, error: "invalid_callback" });
  }
  const body = safeCallback + "(" + JSON.stringify(payload).replace(/</g, "\u003c") + ");";
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function htmlResponse(payload) {
  const safeJson = JSON.stringify(payload).replace(/</g, "\u003c");
  const html = '<!doctype html><html><body><script>window.parent.postMessage(' + safeJson + ', "*");</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function markPaid(sheet, id, paidAt) {
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || "").trim() === String(id)) {
      const row = i + 2;
      sheet.getRange(row, 9).setValue("оплачено");
      sheet.getRange(row, 10).setValue(paidAt);
      return true;
    }
  }
  return false;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
