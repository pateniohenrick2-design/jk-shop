/**
 * JK Shop — Google Sheet → website status sync
 *
 * When you change an order's Status (or "Order Status") in any order tab, the website's
 * order gets the same status a few seconds later. Works for typing, dropdowns, pasting
 * over several rows, and the PROCESS button.
 *
 * Uses SECRET from the OrdersWebhook file (same project), so keep that file as it is.
 *
 * SETUP (one time):
 *  1. Extensions → Apps Script → click + next to "Files" → Script → name it "SheetSync",
 *     paste this whole file → Save.
 *  2. In the function dropdown at the top choose  installSyncTrigger  → Run → approve the
 *     permission prompt (it needs to "connect to an external service" = your website).
 *  3. Test: change an order's Status in the sheet, then open the website's Admin → Orders.
 *     (To check without the website, choose  testSync  → Run → View → Logs.)
 *
 * Sheet words → website status:
 *   Pending/Unpaid → Pending · Processing/In progress → In Progress · Done/Sent/Delivered → Done
 *   Success/Complete → Successful · Refund → Refund · Failed/Cancelled → Failed
 */

const SITE_URL = 'https://jkshopph.vercel.app';
const SYNC_SKIP_TABS = ['All Orders']; // its Status column is a formula copy, not the real one

// Run ONCE from the editor. Re-running is safe (it replaces the old trigger).
function installSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'onStatusEdit'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  Logger.log('Status sync is ON. Changing a Status in the sheet now updates the website.');
}

// Installable onEdit trigger (a plain onEdit can't contact the website)
function onStatusEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (SYNC_SKIP_TABS.indexOf(sheet.getName()) !== -1) return;

  const lastCol = sheet.getLastColumn();
  const hdr = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) { return h.trim().toLowerCase(); });
  let st = hdr.indexOf('order status');
  if (st < 0) st = hdr.indexOf('status');
  const id = hdr.indexOf('order id');
  if (st < 0 || id < 0) return;

  // Only react when the edit touched the Status column
  const col = st + 1;
  if (col < e.range.getColumn() || col > e.range.getLastColumn()) return;

  const firstRow = Math.max(2, e.range.getRow());
  const lastRow = e.range.getLastRow();
  if (lastRow < firstRow) return;
  syncRows_(sheet, firstRow, lastRow, st, id);
}

// Sends the Status of rows firstRow..lastRow to the website. st/id = 0-based column indexes.
function syncRows_(sheet, firstRow, lastRow, st, id) {
  const n = lastRow - firstRow + 1;
  const codes = sheet.getRange(firstRow, id + 1, n, 1).getDisplayValues();
  const statuses = sheet.getRange(firstRow, st + 1, n, 1).getDisplayValues();
  const changes = [];
  for (let i = 0; i < n; i++) {
    const code = String(codes[i][0]).trim();
    const status = String(statuses[i][0]).trim();
    if (code && status) changes.push({ orderCode: code, status: status });
  }
  if (changes.length) sendStatusChanges_(changes);
}

// Used by the PROCESS button too (script edits don't fire the edit trigger)
function syncStatusFor_(sheet, row) {
  const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (h) { return h.trim().toLowerCase(); });
  let st = hdr.indexOf('order status');
  if (st < 0) st = hdr.indexOf('status');
  const id = hdr.indexOf('order id');
  if (st >= 0 && id >= 0) syncRows_(sheet, row, row, st, id);
}

function sendStatusChanges_(changes) {
  try {
    const res = UrlFetchApp.fetch(SITE_URL + '/api/sheet-sync', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ secret: SECRET, changes: changes }),
      muteHttpExceptions: true,
    });
    const text = res.getContentText();
    if (res.getResponseCode() !== 200) console.error('Status sync failed: ' + res.getResponseCode() + ' ' + text.slice(0, 300));
    else console.log('Status sync: ' + text.slice(0, 500));
    return text;
  } catch (err) {
    console.error('Status sync could not reach the website: ' + err);
    return String(err);
  }
}

// Run from the editor to check the connection (sends a fake order code — changes nothing)
function testSync() {
  Logger.log(sendStatusChanges_([{ orderCode: 'TEST-0000000', status: 'Done' }]));
  // Expected: {"ok":true,"results":[{"orderCode":"TEST-0000000","result":"not found"}]}
  // "Bad secret" → SECRET in OrdersWebhook doesn't match GSHEET_WEBHOOK_SECRET on Vercel.
}
