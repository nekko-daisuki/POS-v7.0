document.addEventListener('DOMContentLoaded', function() {
    const orderManagementList = document.getElementById('orderManagementList');
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // !!! ここをあなたのデプロイURLに置き換えてください !!!
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxa7lbZFEcWhcGy0S_HDRErB6yHDbxXtCP7k2TchGc12jokBcNCWFb9b-DifMeOWm8X/exec';

    let allOrders = [];
    let currentFilter = 'all';

    // GASから注文データを取得
    async function getOrdersFromGAS(silent = false) {
        if (!silent) {
            orderManagementList.innerHTML = '<p>注文データを読み込み中...</p>';
        }
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=getOrders`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (result.success) {
                allOrders = result.data;
            } else {
                console.error('GASからの注文データ取得に失敗:', result.error);
                if (!silent) allOrders = [];
            }
        } catch (error) {
            console.error('GASへのリクエスト中にエラー:', error);
            if (!silent) {
                orderManagementList.innerHTML = '<p>注文データの読み込みに失敗しました。再読み込みしてください。</p>';
                allOrders = [];
            }
        }
    }

    // GASにステータス更新をリクエスト
    async function updateOrderStatusInGAS(uniqueId, newStatus) {
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateStatus', uniqueId, newStatus }),
                mode: 'no-cors'
            });
            console.log('ステータス更新をリクエストしました。');
            return true;
        } catch (error) {
            console.error('ステータス更新リクエスト中にエラー:', error);
            alert('ステータスの更新に失敗しました。');
            return false;
        }
    }

    // ステータスを切り替える関数
    async function toggleStatus(uniqueId) {
        const item = allOrders.find(o => o.ID == uniqueId);
        if (!item) return;

        let newStatus;
        switch (item.ステータス) {
            case 'pending': newStatus = 'delivered'; break;
            case 'delivered': newStatus = 'cancelled'; break;
            case 'cancelled': newStatus = 'pending'; break;
            default: newStatus = 'pending';
        }

        // まず画面を楽観的に更新
        item.ステータス = newStatus;
        displayOrders();

        // 次にサーバーに更新をリクエスト
        const success = await updateOrderStatusInGAS(uniqueId, newStatus);
        if (!success) {
            // 失敗した場合はUIを元に戻すか、エラー表示
            alert('ステータス更新に失敗しました。ページを再読み込みします。');
            location.reload();
        }
    }

    // 注文を表示する関数
    function displayOrders() {
        const scrollPosition = window.scrollY;
        orderManagementList.innerHTML = '';

        const filteredItems = allOrders.filter(item => {
            if (currentFilter === 'all') return true;
            return item.ステータス === currentFilter && item.数量 > 0;
        });
        
        filteredItems.sort((a, b) => new Date(b.日時) - new Date(a.日時));

        if (filteredItems.length === 0) {
            orderManagementList.innerHTML = '<p>表示する注文がありません。</p>';
            return;
        }

        filteredItems.forEach(item => {
            for (let i = 0; i < item.数量; i++) {
                const itemElement = document.createElement('div');
                itemElement.className = `order-management-item status-${item.ステータス}`;
                itemElement.setAttribute('data-unique-id', item.ID);

                const orderDate = new Date(item.日時).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const tableInfo = item.テーブル番号 === 'Takeout' ? 'テイクアウト' : `テーブル: ${item.テーブル番号}`;

                itemElement.innerHTML = `
                    <div class="item-header">
                        <span class="item-time">${orderDate}</span>
                        <span class="item-table">${tableInfo}</span>
                    </div>
                    <div class="item-details">
                        <span class="item-name">${item.商品名}</span>
                        <span class="item-status-text">${getStatusText(item.ステータス)}</span>
                    </div>
                `;
                orderManagementList.appendChild(itemElement);
            }
        });

        document.querySelectorAll('.order-management-item').forEach(item => {
            item.addEventListener('click', function() {
                const uniqueId = this.getAttribute('data-unique-id');
                toggleStatus(uniqueId);
            });
        });
        window.scrollTo(0, scrollPosition);
    }

    function getStatusText(status) {
        switch (status) {
            case 'pending': return '未提供';
            case 'delivered': return '提供済み';
            case 'cancelled': return 'キャンセル';
            default: return '不明';
        }
    }

    async function refreshOrders() {
        await getOrdersFromGAS(true); // サイレント更新
        displayOrders();
    }

    // 初期表示と自動更新の設定
    async function init() {
        await getOrdersFromGAS(); // 初回ロード
        displayOrders();

        // 10秒ごとに自動更新
        setInterval(refreshOrders, 10000);

        // イベントリスナー（一度だけ設定）
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                displayOrders();
            });
        });

        hamburgerMenu.addEventListener('click', () => {
            sideMenu.classList.toggle('open');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sideMenu.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    init();
});