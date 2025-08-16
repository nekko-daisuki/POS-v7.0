document.addEventListener('DOMContentLoaded', function () {
  const orderManagementList = document.getElementById('orderManagementList');
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('overlay');
  const filterButtons = document.querySelectorAll('.filter-btn');

  // ▼▼▼ あなたがデプロイしたGASのWebアプリURLに置き換えてください ▼▼▼
  const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxcpO7poruXlhnGKk5f8oei9peUjSUOm-8S43LAQ7qR4Ss7YvBOQaEOHyuUdCnMNd3U/exec';
  // ▲▲▲ ここまで ▲▲▲

  let allItems = [];     // [{ID, 日時, テーブル番号, 商品名, 単価, 数量, ステータス}]
  let currentFilter = 'all';

  // 注文データ取得
  async function fetchOrders(silent = false) {
    if (!silent) orderManagementList.innerHTML = '<p>注文データを読み込み中...</p>';
    try {
      const resp = await fetch(`${GAS_WEB_APP_URL}?action=getOrders`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || '取得に失敗しました');
      allItems = result.data || [];
    } catch (err) {
      console.error(err);
      if (!silent) {
        orderManagementList.innerHTML = '<p>注文データの読み込みに失敗しました。再読み込みしてください。</p>';
      }
      allItems = [];
    }
  }

  // ステータス更新（★FormData送信に変更：プリフライト回避）
  async function updateStatus(uniqueId, newStatus) {
    try {
      const fd = new FormData();
      fd.append('action', 'updateStatus');
      fd.append('payload', JSON.stringify({ uniqueId, newStatus }));

      const resp = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: fd,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || '更新に失敗しました');
      return true;
    } catch (err) {
      console.error(err);
      alert('ステータスの更新に失敗しました。');
      return false;
    }
  }

  // クリックでトグル
  async function toggleStatus(uniqueId) {
    const item = allItems.find((x) => x.ID === uniqueId);
    if (!item) return;

    const next = item.ステータス === 'pending'
      ? 'delivered'
      : item.ステータス === 'delivered'
      ? 'cancelled'
      : 'pending';

    // 楽観的更新
    allItems = allItems.map((x) => (x.ID === uniqueId ? { ...x, ステータス: next } : x));
    render();

    // サーバー反映
    const ok = await updateStatus(uniqueId, next);
    if (!ok) {
      alert('更新に失敗したため再読み込みします。');
      location.reload();
    }
  }

  function statusText(s) {
    return s === 'pending' ? '未提供' : s === 'delivered' ? '提供済み' : s === 'cancelled' ? 'キャンセル' : '不明';
  }

  function render() {
    const scrollY = window.scrollY;
    orderManagementList.innerHTML = '';

    const filtered = allItems.filter((x) => (currentFilter === 'all' ? true : x.ステータス === currentFilter));
    filtered.sort((a, b) => new Date(b.日時) - new Date(a.日時));

    if (filtered.length === 0) {
      orderManagementList.innerHTML = '<p>表示する注文がありません。</p>';
      return;
    }

    filtered.forEach((item) => {
      // 1アイテムにつき「数量」分のカードを表示（個別ピックに便利）
      for (let i = 0; i < (Number(item.数量) || 1); i++) {
        const el = document.createElement('div');
        el.className = `order-management-item status-${item.ステータス}`;
        el.setAttribute('data-unique-id', item.ID);

        const t = new Date(item.日時).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const tableInfo = item.テーブル番号 === 'Takeout' ? 'テイクアウト' : `テーブル: ${item.テーブル番号}`;

        el.innerHTML = `
          <div class="item-header">
            <span class="item-time">${t}</span>
            <span class="item-table">${tableInfo}</span>
          </div>
          <div class="item-details">
            <span class="item-name">${item.商品名}</span>
            <span class="item-status-text">${statusText(item.ステータス)}</span>
          </div>
        `;
        el.addEventListener('click', () => toggleStatus(item.ID));
        orderManagementList.appendChild(el);
      }
    });

    window.scrollTo(0, scrollY);
  }

  async function refresh() {
    await fetchOrders(true);
    render();
  }

  async function init() {
    await fetchOrders(false);
    render();

    // 10秒ごとに自動更新
    setInterval(refresh, 10000);

    // フィルタ
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        filterButtons.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        render();
      });
    });

    // ハンバーガー
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
