/**
 * ===== 設定 =====
 * データを書き込むスプレッドシート
 */
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";

/**
 * シート名
 */
const SHEET_SUMMARY = "会計サマリー";
const SHEET_SALES   = "売上データ";

/**
 * タイムゾーン（JST）
 */
const TZ = "Asia/Tokyo";

/**
 * Webアプリ：POSTで受け取り
 * 期待ペイロード（JSON）:
 * {
 *   orderId: string,
 *   timestamp: ISO string,
 *   tableNumber: string,
 *   totalItems: number,
 *   totalAmount: number,
 *   tendered: number,
 *   change: number,
 *   itemsText: string,
 *   defaultStatus: string,
 *   items: [{ id, name, price, quantity, subtotal }]
 * }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: "No payload" });
    }
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sum = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY);
    const det = ss.getSheetByName(SHEET_SALES)   || ss.insertSheet(SHEET_SALES);

    ensureSummaryHeader_(sum);
    ensureSalesHeader_(det);

    // JST日時表記に整形
    const tsJst = Utilities.formatDate(new Date(data.timestamp || new Date()), TZ, "yyyy/MM/dd HH:mm:ss");

    // ========== 会計サマリー 1行追記 ==========
    // 列構成（固定）: [注文ID, 日時, テーブル番号, 合計点数, 合計金額, 預かり金額, お釣り, 注文内容]
    const summaryRow = [
      String(data.orderId || ""),
      tsJst,
      String(data.tableNumber || ""),
      toNumber_(data.totalItems),
      toNumber_(data.totalAmount),
      toNumber_(data.tendered),
      toNumber_(data.change),
      String(data.itemsText || "")
    ];
    sum.appendRow(summaryRow);

    // ========== 売上データ 複数行追記 ==========
    // 列構成（固定）: [ID, 日時, テーブル番号, 商品名, 単価, 数量, 小計, ステータス]
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length > 0) {
      const status = String(data.defaultStatus || "未提供");
      const rows = items.map((it) => ([
        String(data.orderId || ""),
        tsJst,
        String(data.tableNumber || ""),
        String(it.name || ""),
        toNumber_(it.price),
        toNumber_(it.quantity),
        toNumber_(it.subtotal != null ? it.subtotal : (toNumber_(it.price) * toNumber_(it.quantity))),
        status
      ]));
      // まとめて書き込みで高速化
      det.getRange(det.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return json({ ok: true, orderId: data.orderId, wroteSummary: 1, wroteSales: items.length });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/**
 * レスポンス(JSON)
 */
function json(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

/**
 * 数値正規化
 */
function toNumber_(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * 会計サマリーのヘッダを保証
 * A:注文ID B:日時 C:テーブル番号 D:合計点数 E:合計金額 F:預かり金額 G:お釣り H:注文内容
 */
function ensureSummaryHeader_(sheet) {
  const expected = ["注文ID","日時","テーブル番号","合計点数","合計金額","預かり金額","お釣り","注文内容"];
  const range = sheet.getRange(1, 1, 1, expected.length);
  const values = range.getValues()[0];
  const need = values.some((v, i) => String(v || "") !== expected[i]);
  if (sheet.getLastRow() === 0 || need) {
    range.setValues([expected]);
    sheet.setFrozenRows(1);
  }
}

/**
 * 売上データのヘッダを保証
 * A:ID B:日時 C:テーブル番号 D:商品名 E:単価 F:数量 G:小計 H:ステータス
 */
function ensureSalesHeader_(sheet) {
  const expected = ["ID","日時","テーブル番号","商品名","単価","数量","小計","ステータス"];
  const range = sheet.getRange(1, 1, 1, expected.length);
  const values = range.getValues()[0];
  const need = values.some((v, i) => String(v || "") !== expected[i]);
  if (sheet.getLastRow() === 0 || need) {
    range.setValues([expected]);
    sheet.setFrozenRows(1);
  }
}

/**
 * （任意）メニューから使える簡易テスト
 * 実行→ログで確認
 */
function testAppend_() {
  const dummy = {
    orderId: "TEST-" + new Date().getTime(),
    timestamp: new Date().toISOString(),
    tableNumber: "A1",
    totalItems: 3,
    totalAmount: 1220,
    tendered: 2000,
    change: 780,
    itemsText: "ホットコーヒー×2 (¥300), ケーキ×1 (¥500)",
    defaultStatus: "未提供",
    items: [
      { id: "coffee", name: "ホットコーヒー", price: 300, quantity: 2, subtotal: 600 },
      { id: "cake",   name: "ケーキ",       price: 500, quantity: 1, subtotal: 500 },
      { id: "tip",    name: "サービス",     price: 120, quantity: 1, subtotal: 120 },
    ]
  };
  const e = { postData: { contents: JSON.stringify(dummy) } };
  const res = doPost(e);
  Logger.log(res.getContent());
}
