document.addEventListener('DOMContentLoaded', function () {
  // ▼▼▼ あなたがデプロイしたGASのWebアプリURLに置き換えてください ▼▼▼
  const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxziVHQk8fDHsrZq0UxR2KFJbMw97oNX3AO1CYhbXiheIxm3YF2m7E3YhlL8pJe1nPv/exec';
  // ▲▲▲ ここまで ▲▲▲

  let menuItems = {};       // { coffee: [{id,name,price,category}], ... }
  let orderItems = [];      // [{id,name,price,quantity}, ...]
  let totalAmount = 0;
  let totalCount = 0;
  let receivedAmount = 0;
  let currentTableNumber = '';

  // UI参照
  const orderList = document.getElementById('orderList');
  const orderSummary = document.getElementById('orderSummary');
  const paymentBtn = document.getElementById('paymentBtn');
  const cancelOrderBtn = document.getElementById('cancelOrderBtn');
  const paymentScreen = document.getElementById('paymentScreen');
  const paymentTotal = document.getElementById('paymentTotal');
  const paymentTableNumber = document.getElementById('paymentTableNumber');
  const receivedAmountDisplay = document.getElementById('receivedAmount');
  const numKeys = document.querySelectorAll('.num-key');
  const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
  const completeBtn = document.getElementById('completeBtn');
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('overlay');
  const tableSelectScreen = document.getElementById('tableSelectScreen');
  const tableNumberDisplay = document.getElementById('tableNumberDisplay');
  const tableNumberKeypad = document.querySelectorAll('#tableNumberKeypad .num-key');
  const cancelTableSelectBtn = document.getElementById('cancelTableSelectBtn');
  const confirmTableBtn = document.getElementById('confirmTableBtn');

  paymentScreen.classList.add('hidden');
  tableSelectScreen.classList.add('hidden');

  hamburgerMenu.addEventListener('click', function () {
    hamburgerMenu.classList.toggle('open');
    sideMenu.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', function () {
    hamburgerMenu.classList.remove('open');
    sideMenu.classList.remove('open');
    overlay.classList.remove('active');
  });

  // ---------- メニュー読込 ----------
  async function loadMenuItems() {
    try {
      const resp = await fetch(`${GAS_WEB_APP_URL}?action=getMenu`, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.success) {
        menuItems = data.data || {};
      } else {
        console.error('getMenu失敗:', data.error);
        menuItems = {};
      }
    } catch (err) {
      console.error('getMenuエラー:', err);
      menuItems = {};
    }
  }

  function getCategoryDisplayName(category) {
    switch (category) {
      case 'coffee':
        return 'コーヒー';
      case 'softDrink':
        return 'ソフト<br>ドリンク';
      case 'food':
        return 'フード';
      case 'other':
        return 'その他';
      default:
        return category || 'その他';
    }
  }

  function getCategoryClass(category) {
    switch (category) {
      case 'coffee':
        return 'red';
      case 'softDrink':
        return 'blue';
      case 'food':
        return 'orange';
      case 'other':
        return 'green';
      default:
        return '';
    }
  }

  function renderMenuPanel() {
    const menuPanel = document.querySelector('.menu-panel');
    menuPanel.innerHTML = '';
    const categoryOrder = ['coffee', 'softDrink', 'food', 'other'];
    const itemsPerRow = 5;

    categoryOrder.forEach((categoryKey) => {
      const itemsInCategory = menuItems[categoryKey] || [];
      let itemIndex = 0;

      const group = document.createElement('div');
      group.className = 'product-group';
      const categoryButton = document.createElement('button');
      categoryButton.className = `product-category-button ${getCategoryClass(categoryKey)}`;
      categoryButton.setAttribute('data-category', categoryKey);
      categoryButton.innerHTML = getCategoryDisplayName(categoryKey);
      group.appendChild(categoryButton);

      for (let i = 0; i < itemsPerRow - 1 && itemIndex < itemsInCategory.length; i++) {
        const item = itemsInCategory[itemIndex++];
        const productButton = document.createElement('button');
        productButton.className = 'product-button';
        productButton.setAttribute('data-item-id', item.id);
        productButton.innerHTML = item.name.replace(' ', '<br>');
        group.appendChild(productButton);
      }
      menuPanel.appendChild(group);

      while (itemIndex < itemsInCategory.length) {
        const newGroup = document.createElement('div');
        newGroup.className = 'product-group';
        const placeholder = document.createElement('button');
        placeholder.className = 'product-button empty transparent';
        newGroup.appendChild(placeholder);

        for (let i = 0; i < itemsPerRow - 1 && itemIndex < itemsInCategory.length; i++) {
          const item = itemsInCategory[itemIndex++];
          const productButton = document.createElement('button');
          productButton.className = 'product-button';
          productButton.setAttribute('data-item-id', item.id);
          productButton.innerHTML = item.name.replace(' ', '<br>');
          newGroup.appendChild(productButton);
        }
        menuPanel.appendChild(newGroup);
      }
    });

    attachProductButtonListeners();
  }

  function attachProductButtonListeners() {
    document.querySelectorAll('.product-button').forEach((btn) => {
      btn.removeEventListener('click', handleProductButtonClick);
      btn.addEventListener('click', handleProductButtonClick);
    });
  }

  function handleProductButtonClick() {
    const itemId = this.getAttribute('data-item-id');
    if (!itemId) return;

    let found = null;
    for (const category in menuItems) {
      const cand = (menuItems[category] || []).find((x) => x.id === itemId);
      if (cand) {
        found = cand;
        break;
      }
    }
    if (!found) {
      console.error('IDに該当する商品が見つかりません:', itemId);
      return;
    }

    const idx = orderItems.findIndex((x) => x.id === found.id);
    if (idx >= 0) {
      orderItems[idx].quantity++;
    } else {
      orderItems.push({ id: found.id, name: found.name, price: Number(found.price), quantity: 1 });
    }
    updateOrderList();
  }

  function updateOrderList() {
    orderList.innerHTML = '';
    totalAmount = 0;
    totalCount = 0;

    orderItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'order-item';

      const nameElement = document.createElement('div');
      nameElement.className = 'item-name';
      nameElement.textContent = `${item.name}`;

      const quantityControl = document.createElement('div');
      quantityControl.className = 'item-quantity-control';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'quantity-button';
      minusBtn.textContent = '-';
      minusBtn.addEventListener('click', function () {
        if (item.quantity > 1) {
          item.quantity--;
        } else {
          orderItems.splice(index, 1);
        }
        updateOrderList();
      });

      const quantityDisplay = document.createElement('div');
      quantityDisplay.className = 'quantity-display';
      quantityDisplay.textContent = item.quantity;

      const plusBtn = document.createElement('button');
      plusBtn.className = 'quantity-button';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', function () {
        item.quantity++;
        updateOrderList();
      });

      quantityControl.appendChild(minusBtn);
      quantityControl.appendChild(quantityDisplay);
      quantityControl.appendChild(plusBtn);

      row.appendChild(nameElement);
      row.appendChild(quantityControl);
      orderList.appendChild(row);

      totalAmount += item.price * item.quantity;
      totalCount += item.quantity;
    });

    orderSummary.textContent = `${totalCount}点 合計 ¥${totalAmount}`;
  }

  cancelOrderBtn.addEventListener('click', function () {
    orderItems = [];
    currentTableNumber = '';
    tableNumberDisplay.textContent = '';
    updateOrderList();
  });

  paymentBtn.addEventListener('click', function () {
    if (orderItems.length === 0) {
      alert('注文アイテムがありません');
      return;
    }
    tableSelectScreen.classList.remove('hidden');
  });

  // テーブル番号選択
  tableNumberKeypad.forEach((key) => {
    key.addEventListener('click', function () {
      const keyValue = this.textContent;
      if (keyValue === 'C') {
        currentTableNumber = '';
      } else if (keyValue === 'T') {
        currentTableNumber = 'Takeout';
      } else {
        if (currentTableNumber === 'Takeout') currentTableNumber = '';
        currentTableNumber += keyValue;
      }
      tableNumberDisplay.textContent = currentTableNumber;
    });
  });

  cancelTableSelectBtn.addEventListener('click', function () {
    tableSelectScreen.classList.add('hidden');
    currentTableNumber = '';
    tableNumberDisplay.textContent = '';
  });

  confirmTableBtn.addEventListener('click', function () {
    if (!currentTableNumber) {
      alert('テーブル番号またはテイクアウトを選択してください');
      return;
    }
    tableSelectScreen.classList.add('hidden');
    paymentScreen.classList.remove('hidden');
    paymentTotal.textContent = `合計 ¥${totalAmount}`;
    paymentTableNumber.textContent = `テーブル: ${currentTableNumber}`;
    receivedAmount = 0;
    updatePaymentDisplay();
  });

  numKeys.forEach((key) => {
    key.addEventListener('click', function () {
      const keyValue = this.textContent;
      if (keyValue === 'C') {
        receivedAmount = 0;
      } else if (keyValue === '00') {
        receivedAmount = receivedAmount * 100;
      } else {
        receivedAmount = receivedAmount * 10 + parseInt(keyValue);
      }
      updatePaymentDisplay();
    });
  });

  function updatePaymentDisplay() {
    receivedAmountDisplay.textContent = `¥${receivedAmount}`;
    const change = receivedAmount - totalAmount;
    completeBtn.disabled = change < 0;
    completeBtn.style.opacity = change < 0 ? 0.5 : 1;
  }

  cancelPaymentBtn.addEventListener('click', function () {
    paymentScreen.classList.add('hidden');
  });

  // 注文保存（GASへ）
  async function saveToSpreadsheet(snapshot) {
    const payload = {
      action: 'saveOrder',
      tableNumber: snapshot.tableNumber,
      items: snapshot.items,                // [{id,name,price,quantity}, ...]
      totalAmount: snapshot.totalAmount,    // 合計金額
      totalCount: snapshot.totalCount       // 合計点数
    };

    const resp = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    if (!result.success) throw new Error(result.error || '保存に失敗しました');
    return result; // { success, orderNumber }
  }

  completeBtn.addEventListener('click', async function () {
    if (receivedAmount < totalAmount) {
      alert('預り金額が不足しています');
      return;
    }

    // ★ ここが重要：UIをクリアする前にスナップショットを作る
    const snapshot = {
      tableNumber: currentTableNumber,
      items: JSON.parse(JSON.stringify(orderItems)),
      totalAmount: totalAmount,
      totalCount: totalCount,
    };

    try {
      const { orderNumber } = await saveToSpreadsheet(snapshot);
      const changeAmount = receivedAmount - totalAmount;

      // UIリセット
      orderItems = [];
      currentTableNumber = '';
      tableNumberDisplay.textContent = '';
      updateOrderList();
      paymentScreen.classList.add('hidden');

      alert(`支払いが完了しました。\n注文番号: ${orderNumber}\nおつり：¥${changeAmount}`);
    } catch (err) {
      console.error(err);
      alert('注文データの保存に失敗しました。ネットワーク接続やGASの設定を確認してください。');
    }
  });

  // 初期ロード
  loadMenuItems().then(renderMenuPanel);

  // CSSのvh対策
  window.onload = function () {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    window.addEventListener('resize', function () {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    });
  };
});
