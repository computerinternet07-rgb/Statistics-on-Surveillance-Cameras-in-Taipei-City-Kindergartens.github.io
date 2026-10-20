# 臺北市幼兒園監視器查詢 — GitHub 上傳資料夾

本資料夾已填入你提供的 GAS 正式部署網址，GitHub 程式不需再修改。首頁、查詢連接、臺北市地圖、監視器互動及所需函式庫皆已附上。

## 上傳方式

1. 解壓縮後，開啟「GitHub_直接上傳」資料夾。
2. 在 GitHub 儲存庫選「Add file → Upload files」，將資料夾內的 index.html、config.js、assets 資料夾與 README.md 一起上傳。能選取 .nojekyll 時也一起上傳；這份專案不含底線開頭的資源，漏掉它不影響既有檔案路徑。
3. 確認 index.html 位於儲存庫最外層，assets 內的子資料夾及檔案保持原結構。不要只上傳 ZIP，也不要把整個「GitHub_直接上傳」資料夾變成儲存庫裡的另一層。
4. 儲存庫「Settings → Pages」選擇「Deploy from a branch」，指定上傳的分支及「/(root)」，儲存。已啟用 Pages 的儲存庫只需更新檔案。
5. 等 GitHub Pages 部署完成，開啟 Pages 顯示的網站網址。

## GAS 連接設定（首次使用時核對）

在資料試算表的「_網站設定」分頁，找到 ALLOWED_PARENT_ORIGINS，設定值填入 GitHub Pages 的網站來源。

例如網站網址為 https://abc.github.io/camera/，此欄填 https://abc.github.io 。不包含 /camera/，末尾也不加斜線；自訂網域請填實際的 https://網域。這是既有 GAS 的嵌入授權設定，僅修改 GitHub 檔案不能代替這個步驟。

若此欄已設定正確，不必重填。設定完成後，使用試算表「監視器公開查詢 → 更新公開資料快取」，再重新整理網站。GAS 需已完成 setup_，並以「執行身分：我」、「誰可以存取：所有人」部署；修改過 GAS 程式時須更新部署版本。

## 檔案

- index.html：正式首頁。
- config.js：已填入你的 GAS 網址。
- assets/：樣式、查詢、立體互動、臺北市區界及本機 Three.js 函式庫。
- .nojekyll：靜態網站標記。

這是正式網站檔案，不含資料快照或假資料；數字與園所清單由你的 GAS 讀取試算表。來源端尚未連通時，首頁不會用預覽數值代替。

## 本次核對

已核對部署網址、HTML 與 JavaScript 的相對資源路徑、必要函式庫、程式語法及壓縮檔完整性。未在你的 GitHub 儲存庫進行上傳或正式跨站連線驗收；目前讀取工具無法開啟提供的 GAS 網址，不能據此判定該部署正常或異常。

Three.js 授權全文位於 assets/vendor/THREE-LICENSE.txt。
