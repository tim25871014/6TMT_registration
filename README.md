
# 6TMT_registration

6TMT2 報名網頁與後端，使用 Node.js、osu! API v2 OAuth2 與 PostgreSQL，可部署於 Railway。

## 功能特色

- 首頁有「使用 osu! 帳號報名」按鈕
- 點擊後導向 osu! OAuth2 授權頁，授權後自動取得玩家資訊
- 取得玩家 user id、username，存入 PostgreSQL 或本地檔案
- 提供管理員頁面，可查詢、手動新增、刪除玩家

## 環境變數設定

請將 `.env.example` 複製為 `.env`，並依需求填寫：

- `PORT`：本地伺服器埠號，預設 3000（Railway 會自動設定）
- `OSU_CLIENT_ID`：osu OAuth 應用的 Client ID
- `OSU_CLIENT_SECRET`：osu OAuth 應用的 Secret
- `OSU_REDIRECT_URI`：osu OAuth 註冊的 callback URL（本地測試用 `http://localhost:3000/auth/osu/callback`，Railway 請填正式網址）
- `USE_POSTGRES`：設為 `true` 時啟用 PostgreSQL，否則預設用本地檔案（`data/participants.json`）儲存
- `DATABASE_URL`：PostgreSQL 連線字串（Railway 會自動提供；本地測試請見下方說明）
- `PGSSLMODE`：Railway 請設 `require`，本地測試請設 `disable`
- `ADMIN_TOKEN`：管理頁 API 權杖（可選，設了才需驗證）

## 本地開發與測試

1. 安裝依賴：

	```bash
	npm install
	```

2. 啟動開發伺服器（自動重啟）：

	```bash
	npm run dev
	```

3. 開啟瀏覽器：
	- http://localhost:3000

點擊「使用 osu! 帳號報名」後，會跳轉 osu 授權頁，授權後自動完成報名，資料會存入資料庫或本地檔案。

### 管理員頁面

- http://localhost:3000/admin
- 若 `.env` 有設 `ADMIN_TOKEN`，請在頁面上方輸入 token 再操作
- 可查詢、手動新增/更新、刪除玩家

### 本地測試 PostgreSQL

建議用 Docker 快速啟動本地資料庫：

1. 安裝 Docker Desktop 並啟動
2. 在專案目錄執行：
	```powershell
	docker run --name 6tmt2-pg -e POSTGRES_PASSWORD=pgpass -e POSTGRES_USER=pguser -e POSTGRES_DB=6tmt2 -p 5432:5432 -d postgres:16
	```
3. `.env` 設定如下：
	```
	USE_POSTGRES=true
	DATABASE_URL=postgresql://pguser:pgpass@localhost:5432/6tmt2
	PGSSLMODE=disable
	```
4. 重新啟動伺服器即可。

#### 資料保存說明

- 只要用 `docker stop 6tmt2-pg` / `docker start 6tmt2-pg`，資料都會保留
- 用 `docker rm 6tmt2-pg` 才會刪除資料（除非有掛載 volume）
- 若要永久保存資料（即使刪除容器），可用：
  ```powershell
  docker run --name 6tmt2-pg -e POSTGRES_PASSWORD=pgpass -e POSTGRES_USER=pguser -e POSTGRES_DB=6tmt2 -p 5432:5432 -v D:/artworks/6TMT2/pgdata:/var/lib/postgresql/data -d postgres:16
  ```
  這樣資料會存在 `D:/artworks/6TMT2/pgdata` 資料夾。

## Railway 雲端部署

1. 將專案 push 至 GitHub、GitLab 等
2. Railway 新增專案，選擇「Deploy from Repo」並連接你的 repo
3. Railway 介面新增 PostgreSQL plugin，會自動產生 `DATABASE_URL`
4. Railway 設定下新增環境變數：
	- `OSU_CLIENT_ID`
	- `OSU_CLIENT_SECRET`
	- `OSU_REDIRECT_URI`（例：`https://你的-railway-app-url/auth/osu/callback`）
5. Railway 會自動偵測 `npm start` 為啟動指令
6. osu OAuth 後台記得加上 Railway callback URL

部署完成後，使用者可直接用 Railway 網址報名，資料會存進雲端 PostgreSQL。

