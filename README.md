# 臺北市幼兒園監視器裝設查詢

正式版本：2026-10-31 純 JSON 與 CSP 防護更新。

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

## 內容安全與維護

瀏覽器先讀取同來源 JSON 快照，背景以 `fetch` 讀取 GAS 純 JSON；不載入 JSONP、不建立遠端 script，也沒有 JSONP 降級路徑。Google 或 CORS 受阻時繼續使用通過驗證的公開快照。所有請求均不攜帶登入憑證，且不傳送頁面 Referer。

首頁 CSP 在所有資源之前載入：程式、樣式與字型限同來源，禁止行內程式、事件屬性、eval、外掛、表單送出及子框架；連線僅允許同來源與 Google Apps Script 的兩個指定網域。3D 和材質所需的 CSS 屬性由本機程式設定。

GitHub Pages 使用 HTML meta CSP。這不等同伺服器 HTTP 安全標頭；`frame-ancestors` 無法透過 meta 生效，因此本次沒有加入虛假的嵌入來源限制，仍可由市府頁面嵌入。若日後需限制誰能嵌入，需由支援 HTTP 標頭的託管層設定實際核准的市府網域。

執行 `node --test .github/tests/security.test.mjs` 可驗證純 JSON、CSP、Google 連線失敗備援、回應大小與資料格式。此檢查會在 PR、main 更新及正式部署前執行。

分支保護須由擁有 repository administration 權限的管理員在 GitHub Settings 設定，並不能只靠此檔案或 workflow 宣告生效。建議 main 要求 PR、`Security checks` 成功、處理完討論、禁止強制推送及刪除；已有第二位維護人時再要求至少一位非作者核准，避免單人管理時無法合併。啟用規則後應實際確認規則處於 Active／生效狀態。

帳號雙因素驗證、機關帳號所有權及管理人交接由帳號持有人確認；本程式不替代這些設定。
