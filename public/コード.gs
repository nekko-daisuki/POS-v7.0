/**
 * POSTリクエストを処理する関数
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // アクションに応じて処理を分岐
    if (data.action === "updateStatus") {
      return updateOrderStatus(data);
    } else {
      return saveOrder(data);
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 注文データをスプレッドシートに保存する
 */
function saveOrder(data) {
  let ss;
  try {
    Logger.log(
      "Attempting to open spreadsheet with ID: 1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    Logger.log("Spreadsheet opened successfully: " + ss.getName());
  } catch (e) {
    Logger.log("Error opening spreadsheet: " + e.toString()); // Log error if opening fails
    throw e; // Re-throw to be caught by doPost's try/catch
  }

  let salesSheet = ss.getSheetByName("売上データ");
  if (!salesSheet) {
    Logger.log('Sheet "売上データ" not found. Creating it.');
    salesSheet = ss.insertSheet("売上データ");
  }
  Logger.log("Sales sheet obtained: " + salesSheet.getName());

  // ヘッダー行の確認と設定
  if (salesSheet.getLastRow() === 0) {
    Logger.log("Sales sheet is empty. Appending headers.");
    salesSheet.appendRow([
      "ID",
      "日時",
      "テーブル番号",
      "商品名",
      "単価",
      "数量",
      "小計",
      "ステータス",
    ]);
    salesSheet.setColumnWidth(1, 150); // ID
    salesSheet.setColumnWidth(2, 180); // 日時
    salesSheet.setColumnWidth(3, 100); // テーブル番号
    salesSheet.setColumnWidth(4, 150); // 商品名
    salesSheet.setColumnWidth(8, 100); // ステータス
    Logger.log("Headers appended.");
  }

  const timestamp = new Date();
  const orderIdBase = timestamp.getTime();

  data.items.forEach(function (item, index) {
    const uniqueId = `${orderIdBase}_${index}`;
    const rowData = [
      uniqueId,
      timestamp,
      data.tableNumber,
      item.name,
      item.price,
      item.quantity,
      item.price * item.quantity,
      "pending",
    ];
    Logger.log(
      "Attempting to append row to sales sheet: " + JSON.stringify(rowData)
    );
    salesSheet.appendRow(rowData);
    Logger.log("Row appended to sales sheet.");
  });

  // 会計サマリー情報も記録
  const summarySheet =
    ss.getSheetByName("会計サマリー") || ss.insertSheet("会計サマリー");
  if (summarySheet.getLastRow() === 0) {
    summarySheet.appendRow([
      "日時",
      "テーブル番号",
      "合計点数",
      "合計金額",
      "預かり金額",
      "お釣り",
      "注文内容",
    ]);
    summarySheet.setColumnWidth(1, 180);
    summarySheet.setColumnWidth(2, 100);
    summarySheet.setColumnWidth(7, 300);
  }

  const orderDetails = data.items
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");
  summarySheet.appendRow([
    timestamp,
    data.tableNumber,
    data.totalCount,
    data.totalAmount,
    data.receivedAmount,
    data.changeAmount,
    orderDetails,
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: "注文データを保存しました" })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 注文のステータスを更新する
 */
function updateOrderStatus(data) {
  const ss = SpreadsheetApp.openById(
    "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
  );
  const sheet = ss.getSheetByName("売上データ");
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // IDに基づいて行を検索 (ヘッダーはスキップ)
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] == data.uniqueId) {
      // IDが一致
      sheet.getRange(i + 1, 8).setValue(data.newStatus); // ステータス列（8番目）を更新
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: "ステータスを更新しました" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(
    JSON.stringify({ success: false, message: "対象の注文が見つかりません" })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GETリクエストを処理する関数
 */
function doGet(e) {
  try {
    switch (e.parameter.action) {
      case "getMenu":
        return getMenuItems();
      case "getOrders":
        return getOrders();
      default:
        return ContentService.createTextOutput(
          JSON.stringify({ status: "active", message: "API is active" })
        ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 注文履歴をスプレッドシートから取得する
 */
function getOrders() {
  const ss = SpreadsheetApp.openById(
    "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
  );
  const sheet = ss.getSheetByName("売上データ");
  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, data: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data.shift() || [];

  const orders = data.map(function (row) {
    const orderItem = {};
    headers.forEach(function (header, index) {
      orderItem[header] = row[index];
    });
    return orderItem;
  });

  return ContentService.createTextOutput(
    JSON.stringify({ success: true, data: orders })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 日次売上レポートを生成する関数（時間トリガーで実行可能）
 */
function generateDailyReport() {
  var ss = SpreadsheetApp.openById(
    "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
  );
  var salesSheet = ss.getSheetByName("売上データ");
  var reportSheet =
    ss.getSheetByName("日次レポート") || ss.insertSheet("日次レポート");

  // 今日の日付を取得
  var today = new Date();
  var yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 日付フォーマット (yyyyMMdd)
  var dateString = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyyMMdd");

  // 売上データのすべての行を取得
  var allData = salesSheet.getDataRange().getValues();

  // ヘッダー行をスキップ
  var data = allData.slice(1);

  // 昨日の売上データをフィルタリング
  var yesterdaySales = data.filter(function (row) {
    var rowDate = new Date(row[1]); // Corrected: Index 1 for timestamp
    return (
      Utilities.formatDate(rowDate, "Asia/Tokyo", "yyyyMMdd") === dateString
    );
  });

  // 商品ごとの売上集計
  var salesByProduct = {};
  yesterdaySales.forEach(function (row) {
    var productName = row[3]; // Corrected: Index 3 for product name
    var quantity = row[5]; // Corrected: Index 5 for quantity
    var subtotal = row[6]; // Corrected: Index 6 for subtotal

    if (!salesByProduct[productName]) {
      salesByProduct[productName] = {
        quantity: 0,
        amount: 0,
      };
    }

    salesByProduct[productName].quantity += quantity;
    salesByProduct[productName].amount += subtotal;
  });

  // レポートシートにデータを追加
  reportSheet.clear();
  reportSheet.appendRow(["日次売上レポート " + dateString]);
  reportSheet.appendRow([""]);
  reportSheet.appendRow(["商品名", "販売数", "売上金額"]);

  var totalAmount = 0;

  // 商品ごとの売上を追加
  Object.keys(salesByProduct).forEach(function (product) {
    reportSheet.appendRow([
      product,
      salesByProduct[product].quantity,
      salesByProduct[product].amount,
    ]);

    totalAmount += salesByProduct[product].amount;
  });

  reportSheet.appendRow([""]);
  reportSheet.appendRow(["合計", "", totalAmount]);

  // レポートの書式を整える
  reportSheet.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  reportSheet
    .getRange(3, 1, 1, 3)
    .setFontWeight("bold")
    .setBackground("#D9D9D9");
  reportSheet.getRange("C:C").setNumberFormat("¥#,##0");

  // 全体の列幅を調整
  reportSheet.setColumnWidth(1, 200);
  reportSheet.setColumnWidth(2, 100);
  reportSheet.setColumnWidth(3, 120);

  Logger.log("日次レポートを生成しました: " + dateString);
}

/**
 * メニューデータをスプレッドシートから取得する関数
 */
function getMenuItems() {
  try {
    var ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    var sheet = ss.getSheetByName("メニュー");

    if (!sheet) {
      throw new Error("「メニュー」シートが見つかりません");
    }

    var data = sheet.getDataRange().getValues();
    var headers = data.shift(); // ヘッダー行を取得

    var menuItems = {};

    data.forEach(function (row) {
      var item = {};
      headers.forEach(function (header, index) {
        item[header] = row[index];
      });

      // カテゴリごとに分類
      var category = item.category;
      if (!menuItems[category]) {
        menuItems[category] = [];
      }
      menuItems[category].push(item);
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        data: menuItems,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
