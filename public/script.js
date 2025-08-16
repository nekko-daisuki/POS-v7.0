document.addEventListener('DOMContentLoaded', function() {
    let menuItems = {};

    // Google Apps ScriptのデプロイURL
    // !!! ここをあなたのデプロイURLに置き換えてください !!!
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxa7lbZFEcWhkGy0S_HDRErB6yHDbxXtCP7k2TchGc12jokBcNCWFb9b-DifMeOWm8X/exec'; 

    async function loadMenuItems() {
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=getMenu`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                menuItems = data.data;
            } else {
                console.error('GASからメニューデータの取得に失敗しました:', data.error);
                menuItems = {};
            }
        } catch (error) {
            console.error('GASへのリクエスト中にエラーが発生しました:', error);
            menuItems = {};
        }
    }

    function getCategoryDisplayName(category) {
        switch (category) {
            case 'coffee': return 'コーヒー';
            case 'softDrink': return 'ソフト<br>ドリンク';
            case 'food': return 'フード';
            case 'other': return 'その他';
            default: return category;
        }
    }

    function getCategoryClass(category) {
        switch (category) {
            case 'coffee': return 'red';
            case 'softDrink': return 'blue';
            case 'food': return 'orange';
            case 'other': return 'green';
            default: return '';
        }
    }

    function renderMenuPanel() {
        const menuPanel = document.querySelector('.menu-panel');
        menuPanel.innerHTML = '';
        const categoryOrder = ['coffee', 'softDrink', 'food', 'other'];
        const itemsPerRow = 5;
        categoryOrder.forEach(categoryKey => {
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
                if (item.id === 'iceCoffee') {
                    productButton.innerHTML = 'アイス<br>コーヒー';
                } else if (item.id === 'iceLatte') {
                    productButton.innerHTML = 'アイス<br>カフェオレ';
                } else if (item.id === 'appleJuice') {
                    productButton.innerHTML = 'アップル<br>ジュース';
                } else {
                    productButton.innerHTML = item.name.replace(' ', '<br>');
                }
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
                if (item.id === 'iceCoffee') {
                    productButton.innerHTML = 'アイス<br>コーヒー';
                } else if (item.id === 'iceLatte') {
                    productButton.innerHTML = 'アイス<br>カフェオレ';
                } else if (item.id === 'appleJuice') {
                    productButton.innerHTML = 'アップル<br>ジュース';
                } else {
                    productButton.innerHTML = item.name.replace(' ', '<br>');
                }
                newGroup.appendChild(productButton);
                }
                menuPanel.appendChild(newGroup);
            }
        });
        attachProductButtonListeners();
    }

    let orderItems = [];
    let totalAmount = 0;
    let totalCount = 0;
    let receivedAmount = 0;
    let currentTableNumber = '';

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

    hamburgerMenu.addEventListener('click', function() {
        hamburgerMenu.classList.toggle('open');
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', function() {
        hamburgerMenu.classList.remove('open');
        sideMenu.classList.remove('open');
        overlay.classList.remove('active');
    });

    function attachProductButtonListeners() {
        document.querySelectorAll('.product-button').forEach(btn => {
            btn.removeEventListener('click', handleProductButtonClick);
            btn.addEventListener('click', handleProductButtonClick);
        });
    }

    function handleProductButtonClick() {
        const itemId = this.getAttribute('data-item-id');
        if (!itemId) return;
        let itemFound = false;
        let item = null;
        for (const category in menuItems) {
            item = menuItems[category].find(menuItem => menuItem.id === itemId);
            if (item) {
                itemFound = true;
                break;
            }
        }
        if (itemFound) {
            const itemName = item.name;
            const itemPrice = item.price;
            const existingItemIndex = orderItems.findIndex(orderItem => orderItem.name === itemName);
            if (existingItemIndex !== -1) {
                orderItems[existingItemIndex].quantity++;
            } else {
                orderItems.push({ id: item.id, name: itemName, price: itemPrice, quantity: 1 });
            }
            updateOrderList();
        } else {
            console.error('指定されたIDのアイテムが見つかりません:', itemId);
        }
    }

    function updateOrderList() {
        orderList.innerHTML = '';
        totalAmount = 0;
        totalCount = 0;
        orderItems.forEach((item, index) => {
            const orderItemElement = document.createElement('div');
            orderItemElement.className = 'order-item';
            const nameElement = document.createElement('div');
            nameElement.className = 'item-name';
            nameElement.textContent = `${item.name}`;
            const quantityControl = document.createElement('div');
            quantityControl.className = 'item-quantity-control';
            const minusBtn = document.createElement('button');
            minusBtn.className = 'quantity-button';
            minusBtn.textContent = '-';
            minusBtn.addEventListener('click', function() {
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
            plusBtn.addEventListener('click', function() {
                item.quantity++;
                updateOrderList();
            });
            quantityControl.appendChild(minusBtn);
            quantityControl.appendChild(quantityDisplay);
            quantityControl.appendChild(plusBtn);
            orderItemElement.appendChild(nameElement);
            orderItemElement.appendChild(quantityControl);
            orderList.appendChild(orderItemElement);
            totalAmount += item.price * item.quantity;
            totalCount += item.quantity;
        });
        orderSummary.textContent = `${totalCount}点 合計 ¥${totalAmount}`;
    }

    cancelOrderBtn.addEventListener('click', function() {
        orderItems = [];
        currentTableNumber = '';
        tableNumberDisplay.textContent = '';
        updateOrderList();
    });

    paymentBtn.addEventListener('click', function() {
        if (orderItems.length === 0) {
            alert('注文アイテムがありません');
            return;
        }
        tableSelectScreen.classList.remove('hidden');
    });

    tableNumberKeypad.forEach(key => {
        key.addEventListener('click', function() {
            const keyValue = this.textContent;
            if (keyValue === 'C') {
                currentTableNumber = '';
            } else if (keyValue === 'T') {
                currentTableNumber = 'Takeout';
            } else {
                if (currentTableNumber === 'Takeout') {
                    currentTableNumber = '';
                }
                currentTableNumber += keyValue;
            }
            tableNumberDisplay.textContent = currentTableNumber;
        });
    });

    cancelTableSelectBtn.addEventListener('click', function() {
        tableSelectScreen.classList.add('hidden');
        currentTableNumber = '';
        tableNumberDisplay.textContent = '';
    });

    confirmTableBtn.addEventListener('click', function() {
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

    numKeys.forEach(key => {
        key.addEventListener('click', function() {
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
        if (change < 0) {
            completeBtn.disabled = true;
            completeBtn.style.opacity = 0.5;
        } else {
            completeBtn.disabled = false;
            completeBtn.style.opacity = 1;
        }
    }

    cancelPaymentBtn.addEventListener('click', function() {
        paymentScreen.classList.add('hidden');
    });

    completeBtn.addEventListener('click', async function() {
        if (receivedAmount < totalAmount) {
            alert('預り金額が不足しています');
            return;
        }
        const changeAmount = receivedAmount - totalAmount;

        // フロントエンドを即座に更新
        orderItems = [];
        currentTableNumber = '';
        tableNumberDisplay.textContent = '';
        updateOrderList();
        paymentScreen.classList.add('hidden');
        alert('支払いが完了しました。\nおつり：¥' + changeAmount);

        // バックグラウンドでスプレッドシートに送信
        saveToSpreadsheet(currentTableNumber).catch(error => {
            console.error('スプレッドシートへの保存に失敗しました:', error);
            alert('注文データの保存に失敗しました。ネットワーク接続を確認してください。');
        });
    });

    async function saveToSpreadsheet(tableNumber) {
        const payload = {
            tableNumber: tableNumber,
            items: orderItems,
            totalAmount: totalAmount,
            totalCount: totalCount,
            receivedAmount: receivedAmount,
            changeAmount: receivedAmount - totalAmount
        };

        console.log('Sending payload:', payload); // Debugging: Log payload

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                mode: 'no-cors' // Re-enabled for debugging
            });
            console.log('Request sent. Response status:', response.status); // Debugging: Log response status
            // In no-cors mode, response.ok is always true for network success, and status is 0
            // We cannot read response.text() in no-cors mode
            console.log('注文データを送信しました (no-cors mode)');
        } catch (error) {
            console.error('エラー:', error);
            throw new Error('スプレッドシートへの保存に失敗しました。');
        }
    }

    loadMenuItems().then(() => {
        renderMenuPanel();
    });
});

window.onload = function() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    window.addEventListener('resize', function() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    });
};