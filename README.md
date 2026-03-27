
# 6TMT_registration

6TMT2 報名網頁與後端，使用 Node.js、osu! API v2 OAuth2 與 PostgreSQL，可部署於 Railway。

## 功能特色

- 首頁有「使用 osu! 帳號報名」按鈕，並要求填寫 Discord ID
- 點擊後導向 osu! OAuth2 授權頁，授權後自動取得玩家資訊
- 取得玩家 user id、username、標準模式 (osu) 全球排名與 Discord ID，存入 PostgreSQL 或本地檔案
- 提供管理員頁面，可查詢、手動新增、刪除玩家

## 環境變數設定

請將 `.env.example` 複製為 `.env`，並依需求填寫：

- `PORT`：本地伺服器埠號，預設 3000(Railway 會自動設定)
- `OSU_CLIENT_ID`：osu OAuth 應用的 Client ID
- `OSU_CLIENT_SECRET`：osu OAuth 應用的 Secret
- `OSU_REDIRECT_URI`：osu OAuth 註冊的 callback URL(本地測試用 `http://localhost:3000/auth/osu/callback`，Railway 請填正式網址，通常會是`https://{PROJECT_NAME}.up.railway.app/auth/osu/callback`)
- `USE_POSTGRES`：設為 `true` 時啟用 PostgreSQL資料庫，否則預設用本地檔案(`data/participants.json`)儲存
- `DATABASE_URL`：PostgreSQL 連線字串(有啟用PostgreSQL資料庫才需填寫。Railway 會自動提供；本地測試請見下方說明)
- `PGSSLMODE`：Railway 請設 `require`，本地測試請設 `disable`
- `ADMIN_TOKEN`：管理頁密碼(如果不設定的話，所有人都可以使用管理頁面)

## 本機開發與測試

1. 安裝：

	```bash
	npm install
	```

2. 啟動伺服器(本機測試用)：

	```bash
	npm run dev
	```

3. 開啟瀏覽器：
	- http://localhost:3000

點擊「使用 osu! 帳號報名」後，會跳轉 osu 授權頁，授權後自動完成報名，資料會存入資料庫或本地檔案。

### 管理員頁面

- http://localhost:3000/admin
- 名單查詢是公開只讀的；若 `.env` 有設 `ADMIN_TOKEN`，只有在「新增 / 更新」、「刪除」、「重新整理所有玩家」這些會修改資料的操作時才需要在頁面上方輸入 token
- 可查詢、手動新增/更新、刪除玩家，並顯示該玩家在 osu 標準模式下的全球排名
- 一鍵重新整理所有玩家的 username 與全球排名（透過 osu API）

### 本機測試 PostgreSQL 資料庫 (可選)

若要在本機測試 PostgreSQL 資料庫，請依下列步驟操作：

1. 安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 並啟動
2. 在專案目錄執行以下指令，建立一個 PostgreSQL 容器：
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
- 用 `docker rm 6tmt2-pg` 才會刪除資料(除非有掛載 volume)
- 若要永久保存資料(即使刪除容器)，可用：
  ```powershell
  docker run --name 6tmt2-pg -e POSTGRES_PASSWORD=pgpass -e POSTGRES_USER=pguser -e POSTGRES_DB=6tmt2 -p 5432:5432 -v D:/artworks/6TMT2/pgdata:/var/lib/postgresql/data -d postgres:16
  ```
  這樣資料會存在 `../pgdata` 資料夾。

## Railway 雲端部署

1. 到 [Railway](https://railway.com/) 登入你的帳號，並且連結你的 GitHub 帳號
2. 到 dashbord，點選右上角「+New」新增專案，選擇「GitHub Repository」並點選這個 Repository `tim25871014/6TMT_registration` （或是把這個repo clone 下來之後推到你自己的 repo 上面）
3. 新增專案後，進入你的專案頁面點選右上角「+Create」→「Database」→「Add PostgreSQL」新增資料庫，專案內會多出一個Postgres的框框，並且 Railway 會自動幫你設定 `DATABASE_URL` 環境變數
4. 點擊專案中你的Repo的框框，到Variables設定下新增環境變數：
	- `OSU_CLIENT_ID`：osu OAuth 應用的 Client ID
	- `OSU_CLIENT_SECRET`：osu OAuth 應用的 Secret
	- `OSU_REDIRECT_URI`：設定成 railway 的 callback 網址 (例：`https://{PROJECT_NAME}.up.railway.app/auth/osu/callback`)
	- `DATABASE_URL`：設定為字串 `${{Postgres.DATABASE_URL}}`
5. Railway 會自動偵測 `npm start` 為啟動指令，如果兩個框框(repo與PostgreSQL)都亮綠燈表示部署成功
6. osu OAuth 後台記得將 callback 設為 Railway callback URL，系統才會正確導回

部署完成後，使用者可直接用 Railway 網址報名，資料會存進雲端 PostgreSQL，並且可以用管理頁面進行管理。

