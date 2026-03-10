# WBC 2026 台灣隊預賽 C 組成績視覺化分析儀表板

本專案提供 WBC（世界棒球經典賽）2026 預賽台灣隊的逐球數據 (Play-by-Play) 與進階投打指標 (Advanced Sabermetrics) 視覺化。透過資料無縫處理與 D3.js 動態繪製，幫助球評與球迷洞察賽況背後的數據意義。

## 🌟 專案特色架構：無打包建構 (Zero-Build)

> [!CAUTION]
>
> ### 🛑 開發警語
>
> 本應用程式設計為純靜態網站（Vanilla JS + Vanilla CSS），**不依賴**任何前端打包框架（如 Webpack, Vite 或 React/Vue）。
> 根目錄的 `package.json` 僅是為了讓特定的輔助除錯腳本（位於 `scripts/debug/`）能使用 Node.js 執行，**並不是**啟動此專案的先決要件。
>
> **請勿** 執行 `npm install` 或尋找 `npm run dev` 來啟動專案。

### 如何啟動本地端開發

您只需要任何一個基礎的 HTTP 伺服器，將網頁資源伺服出去即可。

例如，若您已安裝 Python 3，請在終端機開啟本專案根目錄並執行：

```bash
python3 -m http.server 8765
```

接著，請打開瀏覽器造訪 `http://localhost:8765` 即可開始預覽與開發。

---

## 📂 專案核心目錄與結構

- `index.html`：主視覺介面，定義所有的圖表容器(Containers)與 UI (Toggles/Tabs)。
- `src/`：前端應用的核心邏輯區塊。
  - `app.js`：應用的進入點（Entry Point），負責監聽 UI 操作事件（切換分頁、選手選擇）、驅動資料載入與畫面渲染。
  - `dataProcessor.js`：資料處理引擎，負責併發(Concurrent)抓取 CSV，並將扁平的逐球資料（Play-by-play）彙整(Aggregate)為高階聚合指標（例如 wOBA, 被長打率, 得點圈打擊率）。
  - `styles.css`：設計系統，包含所有的 CSS Variables、暗色系主題以及 RWD 響應式斷點。
  - `charts/`：圖表繪製模組的存放區。原始龐大的 `charts.js` 已按領域邏輯切分為 `core.js`, `battingCharts.js`, `pitchingCharts.js`, `gameCharts.js` 與 `advancedCharts.js`。
  - `fetch_wbc_data.R`：使用 R 語言 `baseballr` 套件的自動化資料收集器。定期透過 GitHub Actions 執行。
- `data/`：靜態 JSON/CSV 儲存區。
- `scripts/debug/`：臨時性的一次性分析或驗證用 Node.js 腳本。

---

## 📈 現有進階視覺化圖表重點

### 🏏 打擊分析 (Batting Analytics)

- **台灣英雄五圍雷達圖 (Hero Radar)**：將打者能力分為五維（安打、長打、選球、暴力、心臟），尋找六邊形戰士。
- **擊球品質散布圖 (EV x LA Scatter)**：擊球初速與仰角分佈，並標註 Barrel 區域。
- **得點圈心臟大顆指數圖 (RISP Clutch Bubbles)**：洞悉打者在危機與關鍵時刻的火力貢獻度。
- **逆境抗壓王 (Two-Strike Clutch Bar)**：檢視兩好球劣勢狀況下的抗壓與纏鬥能力。
- **球季擬真落點噴射圖 (Spray Chart Hexbin)**：以模擬棒球場視角渲染擊球落點，輔以六角形大小表示落點頻度、深淺表示擊球初速。
- **選球紀律四象限 (Plate Discipline)**：K%（三振率）與 BB%（保送率）綜合衡量。

### ⚾ 投球分析 (Pitching Analytics)

- **好球帶進壘圖 (Strike Zone Tracker)**：精確繪製不同變化球系掉進九宮格捕手視角的實際位置。
- **牛棚拆彈專家 (Reliever Crisis Donut)**：評量後援投手登板面對「壘上有人」危機時成功化解的機率與排行。
- **配球馬可夫鏈網絡圖 (Pitch Sequencing)**：用有向線條寬度來分析投手於特定球種後續偏好的追擊配球策略。
- **壞球引誘熱區 (Chase% Heatmap)**：視覺化呈現投手誘使打者出棒揮空的拿手刁鑽地帶。
- **主審變形蟲好球帶 (Umpire Amoeba Zone)**：分析特定主審（Umpire）的好壞球判決尺度與錯判熱區。

---

## 🛠️ 維護與資料更新

此儀表板搭配 `fetch_wbc_data.R` 運作。每次有新賽事結束，該腳本將從 Statcast 自動化拉取最新資料並發佈至 `data/` 資料夾，靜態網頁端即會透過 `APP_VERSION` 快取破壞機制取得最新賽況分析。
