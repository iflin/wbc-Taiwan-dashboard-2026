# extract_extended_stats.R
# 用於從 WBC_2026_更多數據整理.xlsx 中萃取進階資料給前端使用
# 目標：輸出 data/wbc_extended_stats.json

library(readxl)
library(dplyr)
library(jsonlite)

# 設定路徑
base_dir <- "/Users/iflin_m4/Desktop/WBC台灣隊預賽成績頁面"
excel_path <- file.path(base_dir, "WBC_2026_更多數據整理.xlsx")
out_json_path <- file.path(base_dir, "data/wbc_extended_stats.json")

# 確保檔案存在
if (!file.exists(excel_path)) {
  stop("找不到 Excel 檔案: ", excel_path)
}

# 準備要輸出的總合列表
extended_data <- list()

# 1. 歷史縱深與敘事脈絡 
# 採用 "歷屆WBC台灣隊打擊能力比較" 作為打擊歷史，過濾無效年份與彙整列雜質
history_batting <- read_excel(excel_path, sheet = "歷屆WBC台灣隊打擊能力比較") %>% filter(!is.na(年份))
# 採用 "歷屆WBC台灣隊投手表現" 作為投球歷史，過濾無效年份與彙整列雜質
history_pitching <- read_excel(excel_path, sheet = "歷屆WBC台灣隊投手表現") %>% filter(!is.na(年份))

extended_data$history <- list(
  batting = history_batting,
  pitching = history_pitching
)

# 2. 英雄主義與極端數據展現
top_homeruns <- read_excel(excel_path, sheet = "飛行距離前10顆球")
top_fastballs <- read_excel(excel_path, sheet = "投手十大火球")
homerun_details <- read_excel(excel_path, sheet = "全壘打明細")

extended_data$extreme <- list(
  top_homeruns = top_homeruns,
  top_fastballs = top_fastballs,
  homerun_details = homerun_details
)

# 3. 戰術解構
team_pitch_arsenal <- read_excel(excel_path, sheet = "團隊球種使用比例")
team_rbi_source <- read_excel(excel_path, sheet = "團隊打點明細")

extended_data$tactics <- list(
  pitch_arsenal = team_pitch_arsenal,
  rbi_source = team_rbi_source
)

# 輸出為 JSON
json_output <- toJSON(extended_data, auto_unbox = TRUE, pretty = TRUE)
write(json_output, file = out_json_path)

cat(sprintf("\n✅ 成功轉換進階數據！\n📁 儲存至：%s\n", out_json_path))
