# 臺北市幼兒園監視器裝設查詢

正式版本：2026-10-26 白金反射卡片。

## 更換 GAS 網址

只修改 `config.js` 的 `GAS_URL`，貼上正式部署的 `/exec` 網址，再儲存提交。其餘檔案不用修改。

## 網站檔案

- `index.html`：首頁與單一捲動頁面。
- `config.js`：資料來源網址。
- `core.js`、`query.js`、`app.js`、`data-client.js`：統計、查詢與公開資料讀取。
- `site.css`：響應式版面。
- `metal-cards.js`、`metal-cards.css`：白色閱讀區與金色反射邊緣，僅限室內全數裝設且室外已裝設的園所。
- `scene.js`、`map-data.js`、`enhance.js`：地圖、監視器與延後載入。
- `assets/`：原創圖標及自託管字型。請保留完整資料夾，不能將內容移至根目錄。
- `public-data.json`：真實公開資料快照。
- `.github/workflows/pages.yml`、`.github/scripts/publish-data.mjs`：定期同步資料與部署。

LINE 使用同來源公開快照，不需要 Google 登入或 iframe。Google 背景連線失敗時，已有資料的頁面正常呈現，不顯示連線警告。所有資料來源均不可用時，查詢區提供簡短的「再試一次」操作，不以 0% 代替缺少的資料。

GitHub Actions 每半小時排程同步；實際啟動時間取決於 GitHub 排程。同步失敗時保留七天內最近一次有效快照，沒有可用快照則停止該次部署，保留現有網站。更換 GAS 網址後，請確認新的部署提供 `?api=public-data` 公開 JSON。

監視器報表與試算表設定由 GAS 專案負責，未放在公開儲存庫。
