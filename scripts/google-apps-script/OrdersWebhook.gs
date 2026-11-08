/**
 * JK Shop → Google Sheet order webhook
 *
 * Receives each new website order and appends it to the tab named after the
 * order's category ("Diamonds", "Pre-Order Event", "Shop Items", "Shop Skins", ...).
 * Categories without their own tab go to "Others". Event Skin Gifting orders go to
 * a separate tab per event (e.g. "Kagura Legend"), created automatically.
 * Columns are filled by HEADER NAME (row 1), so you can reorder or add columns
 * freely — unknown headers (Supplier, Supplier Price, Profit, ...) are left blank.
 *
 * SETUP (one time):
 *  1. Open the sheet → Extensions → Apps Script.
 *  2. Click + next to "Files" → Script → name it "OrdersWebhook", paste this whole file.
 *  3. Change SECRET below to a long random string (copy it, you'll need it in step 6).
 *  4. Deploy → New deployment → gear icon → "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     → Deploy → Authorize → copy the Web app URL (ends in /exec).
 *  5. Optional: run testWebhook() once from the editor to see a test row appear.
 *  6. In the website's .env (and on your host, e.g. Vercel → Settings → Environment Variables):
 *       GSHEET_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
 *       GSHEET_WEBHOOK_SECRET="<same string as SECRET>"
 *     then restart / redeploy the site.
 *
 *  If you edit this script later: Deploy → Manage deployments → edit (pencil) →
 *  Version: "New version" → Deploy. (The URL stays the same.)
 */

const SECRET = 'CHANGE-ME-to-a-long-random-string';
const FALLBACK_TAB = 'Others';
// Event Skin Gifting orders go to one tab PER EVENT (named after the event, e.g. "Kagura Legend").
// New event tabs are copied from this tab (headers + formatting, data rows cleared).
const GIFTING_CATEGORY = 'Event Skin Gifting';
const TIMEZONE = 'Asia/Manila';
const PESO_FORMAT = '₱#,##0.00';
// Overview of every order (all games/categories). Its Status column is a live formula that
// reads the Status cell of the same Order ID in the order's own tab — edit status there only.
const SUMMARY_TAB = 'All Orders';
const SUMMARY_HEADERS = ['Date', 'Order ID', 'Game', 'Tab', 'Order Details', 'Qty', 'Total', 'Payment', 'Facebook', 'Status', 'Open'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: 'bad secret' });
    if (body.action === 'addOrderIdColumns') {
      addOrderIdColumns();
      return json_({ ok: true, action: 'addOrderIdColumns' });
    }
    if (body.action === 'ensureEventTab') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        const sheet = ensureEventTab_(SpreadsheetApp.getActiveSpreadsheet(), body.eventName);
        return json_({ ok: true, action: 'ensureEventTab', tab: sheet.getName() });
      } finally {
        lock.releaseLock();
      }
    }
    if (body.action === 'applyStatusColors') {
      applySummaryStatusColors_(ensureSummaryTab_(SpreadsheetApp.getActiveSpreadsheet()));
      return json_({ ok: true, action: 'applyStatusColors' });
    }
    if (body.action === 'summaryBackfill') {
      // Adds existing orders (oldest first) to "All Orders" without touching the category tabs
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const summary = ensureSummaryTab_(ss);
        const existing = summaryOrderIds_(summary);
        let added = 0;
        (body.orders || []).forEach(function (o) {
          const code = o.orderCode || o.orderId;
          if (existing[code]) return;
          const tab = resolveTab_(ss, o, false);
          addSummaryRow_(summary, o, tab);
          existing[code] = true;
          added++;
        });
        return json_({ ok: true, action: 'summaryBackfill', added: added });
      } finally {
        lock.releaseLock();
      }
    }
    const tab = appendOrder_(body.order);
    return json_({ ok: true, tab: tab });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function appendOrder_(o) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const isGifting = o.category === GIFTING_CATEGORY;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // two orders at the same moment must not overwrite each other
  try {
    const sheet = resolveTab_(ss, o, true);
    if (!sheet) throw new Error('No tab named "' + o.category + '" or "' + FALLBACK_TAB + '"');

    ensureOrderIdColumn_(sheet);
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const date = Utilities.formatDate(new Date(o.createdAt), TIMEZONE, 'MMM d, h:mm a');
    const isOthers = sheet.getName() === FALLBACK_TAB;
    const details = (isOthers ? o.category + ' — ' : '') + o.orderDetails;
    const payment = o.paymentMethod;

    // Header (lower-cased, trimmed) → value. Several aliases cover both tab layouts.
    // On Event Skin Gifting, PAYMENT/PAID/SCHED/ADDED DATE are filled in by hand, so they stay blank.
    const values = {
      'date': date, 'order date': date, 'timestamp': date,
      'order id': o.orderCode || o.orderId,
      'user id': o.userId, 'id': o.userId,
      'server id': o.serverId, 'server': o.serverId,
      'ign': o.ign,
      'order details': details, 'order': details,
      'qty': o.quantity, 'quantity': o.quantity,
      'site item': o.item,
      'order status': 'Pending', 'status': isGifting ? 'PENDING' : 'Pending',
      'payment status': 'Unpaid',
      'payment': isGifting ? '' : payment, 'pay method': payment,
      'proof': o.proofUrl, 'proof of payment': o.proofUrl,
      'facebook': o.facebookName, 'name': o.facebookName, 'facebook account / name': o.facebookName,
      'email': o.email, 'email address': o.email,
      'customer price': o.totalPrice, 'price': o.totalPrice, 'balance': o.totalPrice,
      'event name': o.eventName || '', 'hero name': o.heroName || '',
      'game': o.game, 'category': o.category,
    };
    const moneyHeaders = { 'customer price': 1, 'price': 1, 'balance': 1 };

    const row = headers.map(function (h) {
      const key = String(h).trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
    });

    // Newest first: insert a fresh row 2 right under the headers (older orders shift down)
    const target = insertTopRow_(sheet, lastCol);
    sheet.getRange(target, 1, 1, row.length).setValues([row]);
    headers.forEach(function (h, i) {
      if (moneyHeaders[String(h).trim().toLowerCase()]) sheet.getRange(target, i + 1).setNumberFormat(PESO_FORMAT);
    });

    // Also list it in the "All Orders" overview (never let this break the order itself)
    try {
      addSummaryRow_(ensureSummaryTab_(ss), o, sheet);
    } catch (err) {
      console.error('All Orders row failed: ' + err);
    }
    return sheet.getName();
  } finally {
    lock.releaseLock();
  }
}

// Which tab an order belongs in: its event's tab (Event Skin Gifting), its category's tab, or "Others".
// create=false never creates tabs (used by the backfill).
function resolveTab_(ss, o, create) {
  if (o.category === GIFTING_CATEGORY && o.eventName) {
    if (create) return ensureEventTab_(ss, o.eventName);
    const evName = String(o.eventName).replace(/[:\\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 99);
    const ev = ss.getSheetByName(evName);
    if (ev) return ev;
  }
  return ss.getSheetByName(o.category) || ss.getSheetByName(FALLBACK_TAB);
}

// ---------- "All Orders" overview ----------

function ensureSummaryTab_(ss) {
  let sheet = ss.getSheetByName(SUMMARY_TAB);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SUMMARY_TAB, 0); // first tab
  const n = SUMMARY_HEADERS.length;
  sheet.getRange(1, 1, 1, n).setValues([SUMMARY_HEADERS])
    .setFontWeight('bold').setBackground('#0a0f0a').setFontColor('#f2f5f2');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 120);  // Date
  sheet.setColumnWidths(2, 1, 115);  // Order ID
  sheet.setColumnWidths(3, 1, 170);  // Game
  sheet.setColumnWidths(4, 1, 130);  // Tab
  sheet.setColumnWidths(5, 1, 260);  // Order Details
  sheet.setColumnWidths(6, 1, 45);   // Qty
  sheet.setColumnWidths(7, 1, 90);   // Total
  sheet.setColumnWidths(8, 1, 90);   // Payment
  sheet.setColumnWidths(9, 1, 150);  // Facebook
  sheet.setColumnWidths(10, 1, 110); // Status
  sheet.setColumnWidths(11, 1, 70);  // Open

  applySummaryStatusColors_(sheet);

  // Filter on the headers so you can show only Pending, one game, etc.
  sheet.getRange(1, 1, sheet.getMaxRows(), n).createFilter();

  // "Pending by game" box on the right
  sheet.getRange('M1').setValue('Pending by game').setFontWeight('bold');
  sheet.getRange('M2').setFormula(
    "=IFERROR(QUERY(A:K, \"select C, D, count(B) where B is not null and lower(J) contains 'pending' group by C, D order by count(B) desc label C 'Game', D 'Tab', count(B) 'Pending'\", 1), \"No pending orders 🎉\")"
  );
  sheet.setColumnWidths(13, 1, 170);
  sheet.setColumnWidths(14, 1, 130);
  return sheet;
}

// Row colours in "All Orders" (whole row, by Status), matching the status chips in the order tabs.
// Text matching is case-insensitive, so "Pending" and "PENDING" both match.
// To change a colour, edit it here (or in Format → Conditional formatting on the All Orders tab).
const STATUS_COLORS = [
  // [words to match, background, text colour]
  [['pending', 'unpaid', 'waiting', 'to process'], '#fbeec6', '#000000'],   // same yellow as the order tabs
  [['progress', 'processing', 'ongoing', 'sending'], '#bfe1f6', '#0a3069'],
  [['success', 'done', 'complete', 'delivered', 'sent'], '#d4edbc', '#11734b'],
  [['paid'], '#34694f', '#ffffff'],                                           // same green as PAID in the event tabs
  [['refund'], '#e6cff2', '#5a3286'],
  [['fail', 'cancel', 'invalid', 'wrong'], '#ffcfc9', '#b10202'],
];

// Colours the WHOLE ROW (columns A–K) based on the Status in column J.
// Whole columns (A:K), so the rules never shift when new rows are added at the top.
function applySummaryStatusColors_(sheet) {
  const tableRange = sheet.getRange('A:K');
  const rules = STATUS_COLORS.map(function (entry) {
    // $J1 = this row's Status (the rule is written for row 1 and Sheets applies it to every row)
    const formula = '=REGEXMATCH(LOWER($J1),"' + entry[0].join('|') + '")';
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula).setBackground(entry[1]).setFontColor(entry[2])
      .setRanges([tableRange]).build();
  });
  // Keep rules you added yourself elsewhere; replace our old Status-column (J) and table (A–K) rules
  const others = sheet.getConditionalFormatRules().filter(function (r) {
    return !r.getRanges().some(function (rg) {
      const statusCol = rg.getColumn() === 10 && rg.getNumColumns() === 1;
      const table = rg.getColumn() === 1 && rg.getNumColumns() === 11;
      return statusCol || table;
    });
  });
  sheet.setConditionalFormatRules(others.concat(rules));
}

// Order IDs already listed in "All Orders" (so the backfill doesn't add duplicates)
function summaryOrderIds_(summary) {
  const last = summary.getLastRow();
  const seen = {};
  if (last < 2) return seen;
  summary.getRange(2, 2, last - 1, 1).getValues().forEach(function (r) { if (r[0]) seen[String(r[0])] = true; });
  return seen;
}

// Inserts the order at row 2 of "All Orders". Status + Open are formulas that find the order
// in its tab by Order ID, so they keep working when rows move (newest-first inserts, sorting).
function addSummaryRow_(summary, o, tabSheet) {
  const code = String(o.orderCode || o.orderId);
  const tabName = tabSheet ? tabSheet.getName() : '';
  const q = (s) => String(s).replace(/"/g, '""');                 // escape for a formula string
  const ref = "'" + tabName.replace(/'/g, "''") + "'!A1:AZ";        // escape for a sheet reference

  // t = the tab, h = its headers, ic/sc = Order ID / Status columns, r = the order's row
  const lookup =
    'LET(t,INDIRECT("' + q(ref) + '"),h,INDEX(t,1,0),' +
    'ic,MATCH("Order ID",h,0),' +
    'sc,IFERROR(MATCH("Order Status",h,0),MATCH("Status",h,0)),' +
    'r,MATCH("' + q(code) + '",INDEX(t,0,ic),0),';
  const statusFormula = tabSheet ? '=IFERROR(' + lookup + 'INDEX(t,r,sc)),"—")' : '="(no tab)"';
  const openFormula = tabSheet
    ? '=IFERROR(' + lookup + 'HYPERLINK("#gid=' + tabSheet.getSheetId() + '&range=A"&r,"Open ↗")),"")'
    : '=""';

  const date = Utilities.formatDate(new Date(o.createdAt), TIMEZONE, 'MMM d, h:mm a');
  const details = o.orderDetails || o.item || '';

  // Shift only columns A–K down (the 'Pending by game' box in column M stays put)
  summary.getRange(2, 1, 1, SUMMARY_HEADERS.length).insertCells(SpreadsheetApp.Dimension.ROWS);
  const row = summary.getRange(2, 1, 1, SUMMARY_HEADERS.length);
  row.setFontWeight('normal').setBackground(null).setFontColor(null);
  summary.getRange(2, 1, 1, 9).setValues([[
    date, code, o.game || '', tabName, details, o.quantity || 1, o.totalPrice || 0, o.paymentMethod || '', o.facebookName || '',
  ]]);
  summary.getRange(2, 7).setNumberFormat(PESO_FORMAT);
  summary.getRange(2, 10).setFormula(statusFormula);
  summary.getRange(2, 11).setFormula(openFormula);
}

// Returns the tab for an event, creating it if needed: a copy of the "Event Skin Gifting"
// tab (same headers, formatting, dropdowns, column widths) with its data rows cleared,
// placed right after the "Event Skin Gifting" tab.
function ensureEventTab_(ss, eventName) {
  // Sheet names can't contain : \ / ? * [ ] and max out at 100 characters
  const name = String(eventName || '').replace(/[:\\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 99);
  if (!name) throw new Error('Missing event name');
  const existing = ss.getSheetByName(name);
  if (existing) return existing;

  const template = ss.getSheetByName(GIFTING_CATEGORY);
  let sheet;
  if (template) {
    sheet = template.copyTo(ss).setName(name);
    const rows = sheet.getMaxRows();
    if (rows > 1) sheet.getRange(2, 1, rows - 1, sheet.getMaxColumns()).clearContent();
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(template.getIndex() + 1);
  } else {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, 9).setValues([['ORDER DATE', 'ORDER ID', 'NAME', 'ID', 'SERVER', 'IGN', 'ORDER', 'STATUS', 'PRICE']]);
    sheet.setFrozenRows(1);
  }
  ensureOrderIdColumn_(sheet);
  return sheet;
}

// Adds an "Order ID" column right after the date column ("Date" / "ORDER DATE") the first
// time an order lands in a tab that doesn't have one yet. Existing rows are shifted, not lost.
function ensureOrderIdColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  if (headers.indexOf('order id') !== -1) return;
  let dateIdx = headers.indexOf('date');
  if (dateIdx === -1) dateIdx = headers.indexOf('order date');
  const after = dateIdx === -1 ? 1 : dateIdx + 1; // 1-based column to insert after
  sheet.insertColumnAfter(after);
  sheet.getRange(1, after + 1).setValue(sheet.getName() === 'Event Skin Gifting' ? 'ORDER ID' : 'Order ID');
}

// Run once from the editor to add the "Order ID" column to every order tab right away
// (otherwise each tab gets it automatically on its first website order).
function addOrderIdColumns() {
  const names = ['Diamonds', 'Pre-Order Event', 'Event Skin Gifting', 'Shop Items', 'Shop Skins', FALLBACK_TAB];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  names.forEach(function (n) { const s = ss.getSheetByName(n); if (s) ensureOrderIdColumn_(s); });
}

// Inserts an empty row at row 2 and gives it the same formatting + dropdowns as the
// order row below it (not the header's style). Returns 2.
function insertTopRow_(sheet, lastCol) {
  sheet.insertRowBefore(2);
  const newRow = sheet.getRange(2, 1, 1, lastCol);
  if (sheet.getLastRow() >= 3) {
    const below = sheet.getRange(3, 1, 1, lastCol);
    below.copyTo(newRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    below.copyTo(newRow, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  } else {
    newRow.setFontWeight('normal').setBackground(null); // first order: don't inherit header styling
  }
  return 2;
}

// Last row that has anything in it, ignoring rows that only have formatting,
// checkboxes or dropdowns (which make getLastRow() jump far down).
function lastDataRow_(sheet, lastCol) {
  const last = sheet.getLastRow();
  if (last < 2) return 1;
  const data = sheet.getRange(2, 1, last - 1, lastCol).getDisplayValues();
  for (let r = data.length - 1; r >= 0; r--) {
    if (data[r].some(function (c) { return c !== '' && c !== 'FALSE'; })) return r + 2;
  }
  return 1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run from the editor to check the setup. Adds a TEST row to the Diamonds tab — delete it afterwards.
function testWebhook() {
  const tab = appendOrder_({
    orderId: 'TEST', orderCode: 'TEST-0000000', createdAt: new Date().toISOString(), game: 'Mobile Legends: Bang Bang',
    category: 'Diamonds', item: '56 Diamonds', orderDetails: '56 Diamonds – ₱55 (TEST — delete me)',
    quantity: 1, unitPrice: 55, totalPrice: 55, userId: '123456789', serverId: '1234', ign: 'TestIGN',
    fields: {}, paymentMethod: 'GCash', proofUrl: '', facebookName: 'Test Customer', email: 'test@example.com',
  });
  Logger.log('Test row added to: ' + tab);
}
