/**
 * 設定
 */
const SPREADSHEET_ID = "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc";
const SHEET_MENU = "商品リスト"; // id, name, price, category
const SHEET_ORDERS = "注文履歴"; // 注文番号, 日時, テーブル番号, 商品, 単価, ステータス
const SHEET_SUMMARY = "会計サマリ"; // 注文番号, 商品, 合計点数, 合計金額

/**
 * JSONレスポンス
 */
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * GET
 *  - action=getMenu     : メニュー取得
 *  - action=getOrders   : 注文一覧（集計して返却）
 */
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "";
    if (action === "getMenu") {
      return jsonOutput({ success: true, data: getMenuGrouped() });
    }
    if (action === "getOrders") {
      return jsonOutput({ success: true, data: getOrdersAggregated() });
    }
    return jsonOutput({ success: false, error: "Unknown action" });
  } catch (err) {
    return jsonOutput({ success: false, error: String(err) });
  }
}

/**
 * POST
 *  - FormData/x-www-form-urlencoded:  action=saveOrder, payload=JSON
 *  - application/json（旧互換）:       bodyにJSON
 *  - payload: { tableNumber, items:[{id,name,price,quantity}], totalAmount, totalCount }
 *  - updateStatus: { uniqueId:'注文番号::商品', newStatus:'pending|delivered|cancelled' }
 */
function doPost(e) {
  try {
    let body = {};
    // ★ FormData / x-www-form-urlencoded
    if (e && e.parameter && (e.parameter.payload || e.parameter.action)) {
      if (e.parameter.payload) {
        try {
          body = JSON.parse(e.parameter.payload);
        } catch (err) {
          body = {};
        }
      }
      body.action = e.parameter.action || body.action || "";
    }
    // ★ application/json（旧互換）
    else if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        body = {};
      }
      body.action = body.action || "";
    }

    const action = body.action || "";

    if (action === "saveOrder") {
      const res = saveOrder(body);
      return jsonOutput({ success: true, orderNumber: res.orderNumber });
    }

    if (action === "updateStatus") {
      const { uniqueId, newStatus } = body;
      if (!uniqueId || !newStatus) {
        return jsonOutput({
          success: false,
          error: "uniqueId / newStatus が不足",
        });
      }
      updateStatusByUniqueId(uniqueId, newStatus);
      return jsonOutput({ success: true });
    }

    return jsonOutput({ success: false, error: "Unknown action" });
  } catch (err) {
    return jsonOutput({ success: false, error: String(err) });
  }
}

/**
 * 商品リスト → カテゴリ毎に整形
 *  { coffee:[{id,name,price,category}], softDrink:[...], food:[...], other:[...] }
 */
function getMenuGrouped() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_MENU);
  if (!sh) throw new Error("商品リストシートが見つかりません");

  const values = sh.getDataRange().getValues();
  const header = values.shift(); // [id, name, price, category]
  const idxId = header.indexOf("id");
  const idxName = header.indexOf("name");
  const idxPrice = header.indexOf("price");
  const idxCat = header.indexOf("category");

  const groups = { coffee: [], softDrink: [], food: [], other: [] };

  values.forEach((row) => {
    if (row.every((v) => v === "" || v === null)) return; // 空行スキップ
    const item = {
      id: String(row[idxId]),
      name: String(row[idxName]),
      price: Number(row[idxPrice]),
      category: String(row[idxCat] || "other"),
    };
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  return groups;
}

/**
 * 次の注文番号（1からの通し番号）を採番
 *  - 会計サマリの最大番号 + 1
 *  - ロックして排他制御
 */
function getNextOrderNumber_(ss) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = ss.getSheetByName(SHEET_SUMMARY);
    if (!sh) throw new Error("会計サマリシートが見つかりません");

    const lastRow = sh.getLastRow();
    if (lastRow <= 1) return 1; // 見出しのみ
    const col = 1; // 注文番号列
    const values = sh
      .getRange(2, col, lastRow - 1, 1)
      .getValues()
      .flat();
    const maxNo = values.reduce((m, v) => Math.max(m, Number(v) || 0), 0);
    return maxNo + 1;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 注文保存
 * - 注文履歴: 注文番号, 日時, テーブル番号, 商品, 単価, ステータス
 *   → 数量分だけ行を追加（1行=1アイテム）
 *   → ステータスは 'pending'（未提供）で初期化
 * - 会計サマリ: 注文番号, 商品(要約文字列), 合計点数, 合計金額
 */
function saveOrder(body) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const now = new Date();

  const tableNumber = String(body.tableNumber || "");
  const items = Array.isArray(body.items) ? body.items : [];
  const totalAmount = Number(body.totalAmount || 0);
  const totalCount = Number(body.totalCount || 0);

  if (items.length === 0) throw new Error("items が空です");

  const orderNumber = getNextOrderNumber_(ss);

  // 注文履歴に追記
  const shOrder = ss.getSheetByName(SHEET_ORDERS);
  if (!shOrder) throw new Error("注文履歴シートが見つかりません");
  const rows = [];
  items.forEach((it) => {
    const price = Number(it.price || 0);
    const name = String(it.name || "");
    const qty = Number(it.quantity || 0);
    for (let i = 0; i < qty; i++) {
      rows.push([orderNumber, now, tableNumber || "", name, price, "pending"]);
    }
  });
  if (rows.length > 0) {
    shOrder
      .getRange(shOrder.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }

  // サマリ（商品は "商品名×個数, ..." の要約文字列）
  const summaryText = items
    .map((it) => `${String(it.name)}×${Number(it.quantity || 0)}`)
    .join(", ");
  const shSum = ss.getSheetByName(SHEET_SUMMARY);
  if (!shSum) throw new Error("会計サマリシートが見つかりません");
  shSum
    .getRange(shSum.getLastRow() + 1, 1, 1, 4)
    .setValues([[orderNumber, summaryText, totalCount, totalAmount]]);

  return { orderNumber };
}

/**
 * 注文一覧（キッチン表示用）
 * - 注文履歴を「注文番号×商品」で集約して返す
 *   返却: [{ID, 日時, テーブル番号, 商品名, 単価, 数量, ステータス}]
 *   ID = `${注文番号}::${商品名}` とする
 *   ステータスは、pendingが1つでもあれば 'pending'、全てdeliveredなら 'delivered'、全てcancelledなら 'cancelled'
 */
function getOrdersAggregated() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_ORDERS);
  if (!sh) throw new Error("注文履歴シートが見つかりません");

  const values = sh.getDataRange().getValues();
  const header = values.shift(); // [注文番号, 日時, テーブル番号, 商品, 単価, ステータス]
  const idxNo = header.indexOf("注文番号");
  const idxDt = header.indexOf("日時");
  const idxTbl = header.indexOf("テーブル番号");
  const idxName = header.indexOf("商品");
  const idxPrice = header.indexOf("単価");
  const idxStatus = header.indexOf("ステータス");

  // 注文番号×商品 で集計
  const map = new Map();
  values.forEach((row) => {
    if (row.every((v) => v === "" || v === null)) return; // 空行スキップ
    const no = row[idxNo];
    const dt = row[idxDt];
    const tbl = row[idxTbl];
    const name = row[idxName];
    const price = row[idxPrice];
    const st = row[idxStatus];

    const key = `${no}::${name}`;
    if (!map.has(key)) {
      map.set(key, {
        ID: key,
        注文番号: no,
        日時: dt,
        テーブル番号: tbl,
        商品名: name,
        単価: Number(price || 0),
        数量: 0,
        _pending: 0,
        _delivered: 0,
        _cancelled: 0,
      });
    }
    const obj = map.get(key);
    obj.数量 += 1;
    if (st === "pending") obj._pending++;
    else if (st === "delivered") obj._delivered++;
    else if (st === "cancelled") obj._cancelled++;
  });

  const list = Array.from(map.values()).map((x) => {
    let status = "pending";
    if (x._pending > 0) status = "pending";
    else if (x._delivered > 0 && x._cancelled === 0) status = "delivered";
    else if (x._cancelled > 0 && x._delivered === 0) status = "cancelled";
    // 混在はpending優先
    return {
      ID: x.ID,
      日時: x.日時,
      テーブル番号: x.テーブル番号,
      商品名: x.商品名,
      単価: x.単価,
      数量: x.数量,
      ステータス: status,
    };
  });

  return list;
}

/**
 * ステータス更新
 * - uniqueId = '注文番号::商品名' に一致する全行のステータスを newStatus へ一括更新
 */
function updateStatusByUniqueId(uniqueId, newStatus) {
  const [noStr, name] = String(uniqueId).split("::");
  const orderNo = Number(noStr);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_ORDERS);
  if (!sh) throw new Error("注文履歴シートが見つかりません");

  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return;

  const values = sh.getRange(2, 1, lastRow - 1, 6).getValues(); // 6列: 注文番号~ステータス
  const statusCol = 6;
  const toUpdate = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const no = Number(row[0]);
    const product = String(row[3]);
    if (no === orderNo && product === name) {
      toUpdate.push(i + 2);
    }
  }
  if (toUpdate.length === 0) return;

  // 連続でない可能性があるため1セルずつ更新
  toUpdate.forEach((r) => {
    sh.getRange(r, statusCol, 1, 1).setValue(newStatus);
  });
}
