suppressWarnings(suppressMessages(library(baseballr)))
suppressWarnings(suppressMessages(library(dplyr)))
suppressWarnings(suppressMessages(library(readr)))
suppressWarnings(suppressMessages(library(fs)))
suppressWarnings(suppressMessages(library(jsonlite)))

# =====================================================================
# 自動抓取 2026 年 WBC 全賽事逐球資料腳本
# =====================================================================

# 確保 data 目錄存在
output_dir <- "/Users/iflin_m4/Desktop/WBC台灣隊預賽成績頁面/data"
if (!dir_exists(output_dir)) {
  dir_create(output_dir)
}

cat("正在向 MLB API 獲取 2026 WBC 賽程總表...\n")
# 取得 SPORT ID = 51 (WBC) 的 2026 賽程
url <- "https://statsapi.mlb.com/api/v1/schedule?sportId=51&season=2026"
res <- tryCatch(fromJSON(url, flatten = TRUE), error = function(e) NULL)

if (is.null(res) || !("dates" %in% names(res)) || length(res$dates) == 0) {
  stop("無法取得 2026 WBC 賽程資訊。")
}

# 將各日期的比賽合併成一個完整的 DataFrame
all_games <- bind_rows(res$dates$games)

# C組隊伍名單
group_c_teams <- c("Japan", "Korea", "Chinese Taipei", "Australia", "Czechia")

# 過濾出正式的 WBC 賽事（排除熱身賽 Exhibition）
# 並且只限於對戰雙方都是 C 組隊伍的比賽
wbc_games <- all_games %>%
  filter(grepl("World Baseball Classic", seriesDescription) & !grepl("Exhibition", seriesDescription)) %>%
  filter(teams.away.team.name %in% group_c_teams & teams.home.team.name %in% group_c_teams)

cat(sprintf("共找到 %d 場 WBC C組預賽賽事。開始逐場下載資料...\n", nrow(wbc_games)))
cat("--------------------------------------------------\n")

success_count <- 0
downloaded_files <- list()

# 逐場抓取並儲存
for (i in seq_len(nrow(wbc_games))) {
  pk <- wbc_games$gamePk[i]
  away <- gsub(" ", "", wbc_games$teams.away.team.name[i])
  home <- gsub(" ", "", wbc_games$teams.home.team.name[i])
  date <- wbc_games$gameDate[i]
  # 取出 YYYY-MM-DD
  date_str <- substr(date, 1, 10)
  
  file_name <- sprintf("%d_%s_vs_%s_pbp.csv", pk, away, home)
  file_path <- path(output_dir, file_name)
  
  cat(sprintf("[%d/%d] 正在下載 Game PK: %d (%s vs %s)... ", i, nrow(wbc_games), pk, away, home))
  
  # 使用 baseballr 抓取資料
  pbp_data <- tryCatch({
    mlb_pbp(game_pk = pk)
  }, error = function(e) {
    cat(sprintf("❌ 失敗：%s\n", e$message))
    return(NULL)
  })
  
  if (!is.null(pbp_data) && nrow(pbp_data) > 0) {
    write_csv(pbp_data, file_path)
    cat(sprintf("✅ 成功 (共 %d 筆紀錄)\n", nrow(pbp_data)))
    success_count <- success_count + 1
    # 紀錄成功下載的檔案資訊，供前端使用
    downloaded_files[[length(downloaded_files) + 1]] <- list(
      file = paste0("data/", file_name),
      label = sprintf("%s vs %s", away, home),
      date = date_str
    )
  } else {
    cat("⚠️ 資料為空\n")
  }
}

# 將清單輸出成 JSON，讓前端 JS 能夠自動抓取有幾場比賽
json_out <- toJSON(downloaded_files, auto_unbox = TRUE, pretty = TRUE)
write(json_out, file = path(output_dir, "game_list.json"))

cat("--------------------------------------------------\n")
cat(sprintf("🎉 任務完成！共成功下載 %d / %d 場比賽的逐球資料，並已產生 game_list.json。\n", success_count, nrow(wbc_games)))
