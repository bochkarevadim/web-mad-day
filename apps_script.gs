const CONFIG = {
  SPREADSHEET_NAME: "MAD DAY REGISTRATION",
  SPREADSHEET_ID: "",
  SPREADSHEET_URL: "",
  SHEET_NAME: "",
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
  const callsign = (data.callsign || "").trim();
  const fullName = (data.full_name || "").trim();
  const phone = (data.phone || "").trim();
  const faction = (data.faction || "").trim();
  const tariff = (data.tariff || "").trim();

  if (!callsign || callsign.length < 2 || callsign.length > 32) {
    return jsonResponse({ ok: false, error: "invalid_callsign" });
  }
  if (!fullName || fullName.split(/\s+/).length < 2) {
    return jsonResponse({ ok: false, error: "invalid_full_name" });
  }
  if (!phone) {
    return jsonResponse({ ok: false, error: "invalid_phone" });
  }
  if (!CONFIG.FACTION_LIMITS[faction]) {
    return jsonResponse({ ok: false, error: "invalid_faction" });
  }
  if (CONFIG.TARIFFS.indexOf(tariff) === -1) {
    return jsonResponse({ ok: false, error: "invalid_tariff" });
  }

  const sheet = getSheet();
  ensureHeaders(sheet);

  const counts = factionCounts(sheet);
  if ((counts[faction] || 0) >= CONFIG.FACTION_LIMITS[faction]) {
    return jsonResponse({ ok: false, error: "faction_full" });
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

  return jsonResponse({ ok: true, id: id });
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

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
