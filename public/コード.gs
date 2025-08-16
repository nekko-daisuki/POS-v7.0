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
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * 注文データをスプレッドシートに保存する
 */
function saveOrder(data) {
  try {
    const ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    let salesSheet = ss.getSheetByName("売上データ");
    if (!salesSheet) {
      salesSheet = ss.insertSheet("売上データ");
    }

    // ヘッダー行の確認と設定
    if (salesSheet.getLastRow() === 0) {
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
    }

    const timestamp = new Date();
    const orderIdBase = timestamp.getTime();

    data.items.forEach(function (item, index) {
      const uniqueId = `${orderIdBase}_${index}`;
      salesSheet.appendRow([
        uniqueId,
        timestamp,
        data.tableNumber,
        item.name,
        item.price,
        item.quantity,
        item.price * item.quantity,
        "pending",
      ]);
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
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: e.toString() })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * 注文のステータスを更新する
 */
function updateOrderStatus(data) {
  try {
    const ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    const sheet = ss.getSheetByName("売上データ");
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] == data.uniqueId) {
        sheet.getRange(i + 1, 8).setValue(data.newStatus);
        return ContentService.createTextOutput(
          JSON.stringify({ success: true, message: "ステータスを更新しました" })
        )
          .setMimeType(ContentService.MimeType.JSON)
          .addHeader("Access-Control-Allow-Origin", "*");
      }
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "対象の注文が見つかりません" })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: e.toString() })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
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
        )
          .setMimeType(ContentService.MimeType.JSON)
          .addHeader("Access-Control-Allow-Origin", "*");
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * 注文履歴をスプレッドシートから取得する
 */
function getOrders() {
  try {
    const ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    const sheet = ss.getSheetByName("売上データ");
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, data: [] })
      )
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader("Access-Control-Allow-Origin", "*");
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
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: e.toString() })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * メニューデータをスプレッドシートから取得する関数
 */
function getMenuItems() {
  try {
    const ss = SpreadsheetApp.openById(
      "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
    );
    const sheet = ss.getSheetByName("メニュー");

    if (!sheet) {
      throw new Error("「メニュー」シートが見つかりません");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const menuItems = {};
    data.forEach(function (row) {
      const item = {};
      headers.forEach(function (header, index) {
        item[header] = row[index];
      });

      const category = item.category;
      if (!menuItems[category]) {
        menuItems[category] = [];
      }
      menuItems[category].push(item);
    });

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, data: menuItems })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .addHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * 日次売上レポートを生成する関数（時間トリガーで実行可能）
 */
function generateDailyReport() {
  const ss = SpreadsheetApp.openById(
    "1V2YyBjvv2P3N-quLNDZIaDwlKPIKIUXNTjuv6dvAzKc"
  );
  const salesSheet = ss.getSheetByName("売上データ");

  // 「売上データ」シートがなければ、レポートは作れないので処理を終了
  if (!salesSheet) {
    Logger.log(
      "「売上データ」シートが存在しないため、日次レポートは生成されませんでした。"
    );
    return;
  }

  const reportSheet =
    ss.getSheetByName("日次レポート") || ss.insertSheet("日次レポート");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateString = Utilities.formatDate(yesterday, "Asia/Tokyo", "yyyyMMdd");
  const allData = salesSheet.getDataRange().getValues();

  // データがヘッダー行のみの場合も処理を終了
  if (allData.length < 2) {
    Logger.log(
      "「売上データ」にレポート対象のデータがないため、日次レポートは生成されませんでした。"
    );
    return;
  }

  const data = allData.slice(1);
  const yesterdaySales = data.filter(function (row) {
    const rowDate = new Date(row[1]);
    return (
      Utilities.formatDate(rowDate, "Asia/Tokyo", "yyyyMMdd") === dateString
    );
  });

  const salesByProduct = {};
  yesterdaySales.forEach(function (row) {
    const productName = row[3];
    const quantity = row[5];
    const subtotal = row[6];
    if (!salesByProduct[productName]) {
      salesByProduct[productName] = { quantity: 0, amount: 0 };
    }
    salesByProduct[productName].quantity += quantity;
    salesByProduct[productName].amount += subtotal;
  });

  reportSheet.clear();
  reportSheet.appendRow(["日次売上レポート " + dateString]);
  reportSheet.appendRow([""]);
  reportSheet.appendRow(["商品名", "販売数", "売上金額"]);
  let totalAmount = 0;
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
  reportSheet.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  reportSheet
    .getRange(3, 1, 1, 3)
    .setFontWeight("bold")
    .setBackground("#D9D9D9");
  reportSheet.getRange("C:C").setNumberFormat("¥#,##0");
  reportSheet.setColumnWidth(1, 200);
  reportSheet.setColumnWidth(2, 100);
  reportSheet.setColumnWidth(3, 120);
  Logger.log("日次レポートを生成しました: " + dateString);
}
