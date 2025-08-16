const CACHE_NAME = 'pos-v3-cache-v1'; // キャッシュ名。更新したらバージョンを上げてください
const urlsToCache = [
  '/', // ルートパス
  '/index.html', // メインのHTMLファイル
  '/manifest.json', // manifestファイル自体もキャッシュ
  '/styles.css', // 必要なCSSファイル
  '/script.js', // 必要なJavaScriptファイル
  '/icons/icon-192x192.png', // アイコン画像
  '/icons/icon-512x512.png',
  // 他にもキャッシュしたい静的アセットがあればここに追加
];

// インストールイベント: Service Workerがインストールされたときに実行
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache); // 指定したファイルをキャッシュに追加
      })
  );
});

// フェッチイベント: ネットワークリクエストが発生するたびに実行
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにリクエストがあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得
        return fetch(event.request);
      })
  );
});

// アクティベートイベント: 古いキャッシュをクリーンアップ
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // ホワイトリストにない古いキャッシュを削除
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});