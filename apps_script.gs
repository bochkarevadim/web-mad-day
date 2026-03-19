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

function doGet() {
  return ContentService.createTextOutput("OK");
}

function doPost(e) {
  const data = e && e.parameter ? e.parameter : {};
  const source = (data.source || "").trim();
  const isWeb = source === "WEB";
  const action = (data.action || "").trim();

  const sheet = getSheet();
  ensureHeaders(sheet);

  if (action === "mark_paid") {
    const id = String(data.id || "").trim();
    if (!id) {
      return respond({ ok: false, error: "missing_id" }, isWeb);
    }
    const paidAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd.MM.yyyy HH:mm");
    const updated = markPaid(sheet, id, paidAt);
    if (!updated) {
      return respond({ ok: false, error: "id_not_found", id: id }, isWeb);
    }
    return respond({ ok: true, action: "mark_paid", id: id, paid_at: paidAt }, isWeb);
  }

  const callsign = (data.callsign || "").trim();
  const fullName = (data.full_name || "").trim();
  const phone = (data.phone || "").trim();
  const faction = (data.faction || "").trim();
  const tariff = (data.tariff || "").trim();

  if (!callsign || callsign.length < 2 || callsign.length > 32) {
    return respond({ ok: false, error: "invalid_callsign" }, isWeb);
  }
  if (!fullName || fullName.split(/\s+/).length < 2) {
    return respond({ ok: false, error: "invalid_full_name" }, isWeb);
  }
  if (!phone) {
    return respond({ ok: false, error: "invalid_phone" }, isWeb);
  }
  if (!CONFIG.FACTION_LIMITS[faction]) {
    return respond({ ok: false, error: "invalid_faction" }, isWeb);
  }
  if (CONFIG.TARIFFS.indexOf(tariff) === -1) {
    return respond({ ok: false, error: "invalid_tariff" }, isWeb);
  }

  const counts = factionCounts(sheet);
  if ((counts[faction] || 0) >= CONFIG.FACTION_LIMITS[faction]) {
    return respond({ ok: false, error: "faction_full" }, isWeb);
  }

  const id = nextPlayerId(sheet);
  const now = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd.MM.yyyy HH:mm");

  sheet.appendRow([
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
  ]);

  return respond({ ok: true, action: "register", id: id }, isWeb);
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
  const hasHeaders = SHEET_HEADERS.every((value, index) => firstRow[index] === value);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  }
}

function nextPlayerId(sheet) {
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  const numeric = values
    .map((row) => String(row[0] || ""))
    .filter((value) => /^\d+$/.test(value))
    .map((value) => parseInt(value, 10));
  const nextValue = numeric.length ? Math.max.apply(null, numeric) + 1 : 1;
  return ("" + nextValue).padStart(3, "0");
}

function factionCounts(sheet) {
  const data = sheet.getDataRange().getValues();
  const counts = {};
  Object.keys(CONFIG.FACTION_LIMITS).forEach((faction) => {
    counts[faction] = 0;
  });
  for (let i = 1; i < data.length; i += 1) {
    const faction = String(data[i][4] || "").trim();
    if (counts.hasOwnProperty(faction)) {
      counts[faction] += 1;
    }
  }
  return counts;
}


function respond(payload, isWeb) {
  return isWeb ? htmlResponse(payload) : jsonResponse(payload);
}

function htmlResponse(payload) {
  const safeJson = JSON.stringify(payload).replace(/</g, "\u003c");
  const html = '<!doctype html><html><body><script>window.parent.postMessage(' + safeJson + ', "*");</script></body></html>';
  return ContentService.createTextOutput(html)
    .setMimeType(ContentService.MimeType.HTML);
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
