document.addEventListener('DOMContentLoaded', function() {
    const currentMenuItemsDiv = document.getElementById('currentMenuItems');
    const backToPosBtn = document.getElementById('backToPosBtn');

    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');

    // ハンバーガーメニューのクリックイベント
    hamburgerMenu.addEventListener('click', function() {
        hamburgerMenu.classList.toggle('open');
        sideMenu.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    // オーバーレイのクリックイベント (メニューを閉じる)
    overlay.addEventListener('click', function() {
        hamburgerMenu.classList.remove('open');
        sideMenu.classList.remove('open');
        overlay.classList.remove('active');
    });

    // Google Apps ScriptのデプロイURL
    // !!! ここをあなたのデプロイURLに置き換えてください !!!
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxa7lbZFEcWhcGy0S_HDRErB6yHDbxXtCP7k2TchGc12jokBcNCWFb9b-DifMeOWm8X/exec'; 

    // メニューデータをGASから取得
    async function getMenuItemsFromGAS() {
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=getMenu`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                return data.data;
            } else {
                console.error('GASからメニューデータの取得に失敗しました:', data.error);
                return {};
            }
        } catch (error) {
            console.error('GASへのリクエスト中にエラーが発生しました:', error);
            return {};
        }
    }

    // メニューアイテムを画面に表示
    async function displayMenuItems() {
        currentMenuItemsDiv.innerHTML = '<p>メニューデータを読み込み中...</p>';
        const menuItems = await getMenuItemsFromGAS();
        currentMenuItemsDiv.innerHTML = ''; // ローディングメッセージをクリア

        if (Object.keys(menuItems).length === 0) {
            currentMenuItemsDiv.innerHTML = '<p>メニューデータがありません。スプレッドシートを確認してください。</p>';
            return;
        }

        for (const category in menuItems) {
            if (menuItems[category].length > 0) {
                const categoryHeader = document.createElement('h4');
                categoryHeader.textContent = getCategoryDisplayName(category);
                currentMenuItemsDiv.appendChild(categoryHeader);

                const ul = document.createElement('ul');
                ul.className = 'menu-list-items';
                menuItems[category].forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${item.name} (¥${item.price}) - ${getCategoryDisplayName(item.category)}</span>
                    `;
                    ul.appendChild(li);
                });
                currentMenuItemsDiv.appendChild(ul);
            }
        }
    }

    // カテゴリ表示名を取得
    function getCategoryDisplayName(category) {
        switch (category) {
            case 'coffee': return 'コーヒー';
            case 'softDrink': return 'ソフトドリンク';
            case 'food': return 'フード';
            case 'other': return 'その他';
            default: return category;
        }
    }

    // 初回表示
    displayMenuItems();

    // POSレジに戻るボタン
    backToPosBtn.addEventListener('click', function() {
        window.location.href = 'index.html';
    });
});
