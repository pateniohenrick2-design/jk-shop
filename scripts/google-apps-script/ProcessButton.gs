/** @OnlyCurrentDoc */
/**
 * JK SHOP — PROCESS button for the MLBB order tabs
 *
 * Setup (one time):
 *   1. Extensions → Apps Script → open the PROCESS script file → replace it with this whole file → Save.
 *      (Keep the separate OrdersWebhook file as it is.)
 *   2. Reload the spreadsheet. A "JK Orders" menu appears.
 *   3. Add the button on each tab you process from (Diamonds, Pre-Order Event):
 *      Insert → Drawing → draw a box with the text PROCESS → Save and close,
 *      then click the drawing → ⋮ → Assign script → type: processSelected → OK.
 *   4. Update the Tampermonkey script to jk-autofill.user.js v2.0 (it supports both sites).
 *   5. JK Orders → Turn on auto-Pending for new orders (once). Approve the permission prompt.
 *
 * Daily use:
 *   Click any cell in the order's row → press PROCESS → choose the site.
 *   The site opens already filled, Status becomes "Processing" and Supplier is set to that site.
 */

const RECEIPT_EMAIL = '';   // e.g. 'you@gmail.com' — fills the site's receipt email box. Leave blank to skip.

// Your top-up sites. To add another site later, copy one block and change the name and url.
const SITES = [
  { name: 'egamesscredits', url: 'https://egamesscredits.com/games/ml-bang-bang' },
  { name: 'Ethanoxe',       url: 'https://ethanoxe-games.com/games/mobile-legends-ph-v1a' },
];

// Tabs whose Status column is a formula (never write values there)
const SKIP_TABS = ['All Orders'];

// The order's status column. Website tabs call it "Order Status", older tabs "Status".
// hdr = header row, already trimmed + lower-cased. Returns the 0-based index or -1.
function statusCol_(hdr) {
  const i = hdr.indexOf('order status');
  return i >= 0 ? i : hdr.indexOf('status');
}

// "Processing" / "PENDING" etc. in the same case style as the header (STATUS → upper case)
function statusWord_(headerText, word) {
  return headerText === headerText.toUpperCase() ? word.toUpperCase() : word;
}

// ---------- Menu ----------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('JK Orders')
    .addItem('Process selected order', 'processSelected')
    .addSeparator()
    .addItem('Turn on auto-Pending for new orders', 'setupAutoPending')
    .addToUi();
  fillPending(); // also catch anything that came in while the sheet was closed
}

// ---------- Auto "Pending" for new orders ----------

// Run once from the menu: every new form submission then sets Status = Pending on its row.
function setupAutoPending() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onNewOrder')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onNewOrder').forSpreadsheet(ss).onFormSubmit().create();
  fillPending();
  SpreadsheetApp.getUi().alert('Done. New orders will be set to Pending automatically.');
}

function onNewOrder() {
  SpreadsheetApp.flush();
  Utilities.sleep(3000); // give the tab formulas a moment to show the new row
  fillPending();
}

// On every order tab: rows that have a date but an empty Status get "Pending".
function fillPending() {
  SpreadsheetApp.getActive().getSheets().forEach(sheet => {
    if (SKIP_TABS.indexOf(sheet.getName()) !== -1) return;
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    if (lastCol < 1 || lastRow < 2) return;
    const hdrRaw = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => h.trim());
    const hdr = hdrRaw.map(h => h.toLowerCase());
    const st = statusCol_(hdr);
    const dt = hdr.findIndex(h => /^(order )?date$/.test(h));
    if (st < 0 || dt < 0) return;
    const pending = statusWord_(hdrRaw[st], 'Pending');

    const dates = sheet.getRange(2, dt + 1, lastRow - 1, 1).getDisplayValues();
    const statusRange = sheet.getRange(2, st + 1, lastRow - 1, 1);
    const status = statusRange.getValues();
    let changed = false;
    for (let i = 0; i < status.length; i++) {
      if (dates[i][0] !== '' && status[i][0] === '') { status[i][0] = pending; changed = true; }
    }
    if (changed) statusRange.setValues(status);
  });
}

// ---------- PROCESS button ----------

function processSelected() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  const lastCol = sheet.getLastColumn();
  const hdr = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => h.trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = hdr.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    uid: col('user id'), zid: col('server id'), ign: col('ign'),
    order: col('order details', 'order'), item: col('site item'),
    status: statusCol_(hdr), supplier: col('supplier'),
  };
  if (c.uid < 0 || c.zid < 0) {
    return ui.alert(`This tab ("${sheet.getName()}") isn't an order tab.\n\nGo to Diamonds or Pre-Order Event, click a cell in the order's row, then press PROCESS.`);
  }

  const row = sheet.getActiveRange().getRow();
  if (row < 2) return ui.alert('Click a cell in the order row you want to process, then press PROCESS.');

  const v = sheet.getRange(row, 1, 1, lastCol).getDisplayValues()[0];
  const data = {
    u: v[c.uid].trim(),
    z: v[c.zid].trim().replace(/\D/g, ''),
    item: c.item >= 0 ? v[c.item].trim() : '',
    email: RECEIPT_EMAIL,
    row: row,
  };
  if (!data.u || !data.z) return ui.alert(`Row ${row} is missing a User ID or Server ID.`);
  if (!data.item) return ui.alert(`Row ${row} has no Site Item.\nOnly Diamonds and Pre-Order Event orders can be processed on the top-up sites.`);

  const ign = c.ign >= 0 ? v[c.ign] : '';
  const order = c.order >= 0 ? v[c.order] : '';
  const hash = '#jk=' + encodeURIComponent(JSON.stringify(data));

  const buttons = SITES.map((s, i) => `
    <a class="btn" href="${esc(s.url + hash)}" target="_blank" onclick="go(${i})">${esc(s.name)}</a>`).join('');

  const html = HtmlService.createHtmlOutput(`
    <style>
      body{font-family:Arial,sans-serif;margin:14px;color:#202124}
      .info{background:#F1F8EF;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px;line-height:1.6}
      .row{display:flex;gap:10px}
      .btn{flex:1;text-align:center;padding:12px 8px;border-radius:8px;text-decoration:none;font-weight:bold;
           background:#1F3A1F;color:#B7F5A4}
      .btn:hover{background:#2E5A2E}
      #msg{margin-top:10px;font-size:12px;color:#5f6368}
    </style>
    <div class="info">
      <b>Row ${row}</b> · ${esc(ign)}<br>
      ${esc(data.u)} (${esc(data.z)}) — <b>${esc(data.item)}</b><br>
      <span style="color:#5f6368">${esc(order)}</span>
    </div>
    <div style="font-size:13px;margin-bottom:8px">Process on which site?</div>
    <div class="row">${buttons}</div>
    <div id="msg"></div>
    <script>
      const SITES = ${JSON.stringify(SITES.map(s => s.name))};
      function go(i){
        document.getElementById('msg').textContent = 'Opening ' + SITES[i] + '…';
        google.script.run
          .withSuccessHandler(() => google.script.host.close())
          .withFailureHandler(e => { document.getElementById('msg').textContent = 'Site opened, but the sheet was not updated: ' + e.message; })
          .markProcessing(${JSON.stringify(sheet.getName())}, ${row}, SITES[i]);
      }
    </script>`).setWidth(400).setHeight(230);
  ui.showModalDialog(html, 'Process order');
}

// Called from the dialog after a site is chosen: Status → Processing, Supplier → site name (if empty)
function markProcessing(sheetName, row, siteName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) throw new Error('Tab "' + sheetName + '" not found.');
  const hdrRaw = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(h => h.trim());
  const hdr = hdrRaw.map(h => h.toLowerCase());
  const st = statusCol_(hdr);
  const sup = hdr.indexOf('supplier');
  if (st < 0) throw new Error('No "Order Status" or "Status" column on "' + sheetName + '".');
  sheet.getRange(row, st + 1).setValue(statusWord_(hdrRaw[st], 'Processing'));
  if (sup >= 0) {
    const cell = sheet.getRange(row, sup + 1);
    if (!cell.getDisplayValue()) cell.setValue(siteName);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
