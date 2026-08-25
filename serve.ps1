# 設定連接埠為 8000
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
} catch {
    # 如果 8000 被佔用，自動隨機選擇 8001 到 9000 之間的連接埠
    Write-Host "連接埠 $port 已被佔用，嘗試使用其他連接埠..." -ForegroundColor Yellow
    $port = Get-Random -Minimum 8001 -Maximum 9000
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
}

$url = "http://127.0.0.1:$port/"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " 本地伺服器已成功啟動！" -ForegroundColor Green
Write-Host " 網址: $url" -ForegroundColor Cyan
Write-Host " 正在自動在瀏覽器中開啟..." -ForegroundColor Gray
Write-Host " 按 Ctrl + C 可以關閉此伺服器視窗。" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Green

# 自動使用預設瀏覽器開啟網址
Start-Process $url

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = $request.Url.LocalPath
        if ($rawPath -eq "/") {
            $rawPath = "/index.html"
        }

        # 處理儲存預設值 API (POST /api/save-defaults 或 POST /defaults.json)
        if ($request.HttpMethod -eq "POST" -and ($rawPath -eq "/api/save-defaults" -or $rawPath -eq "/defaults.json")) {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $defaultsFilePath = Join-Path $PSScriptRoot "defaults.json"
                [System.IO.File]::WriteAllText($defaultsFilePath, $body, [System.Text.Encoding]::UTF8)
                Write-Host "已成功直接覆蓋寫入 defaults.json: $defaultsFilePath" -ForegroundColor Green

                $jsonResponse = '{"status":"success","message":"defaults.json 已成功直接覆蓋更新"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                Write-Host "寫入 defaults.json 失敗: $_" -ForegroundColor Red
                $jsonResponse = '{"status":"error","message":"寫入失敗: ' + $_.Exception.Message + '"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            $response.Close()
            continue
        }

        # 解碼 URL 路徑，去除開頭的斜線並轉換成 Windows 路徑
        $decodedPath = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')
        $localPath = Join-Path $PSScriptRoot $decodedPath

        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # 根據副檔名設定適當的 MIME 類型 (MIME Type)
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".svg"  { "image/svg+xml" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".webp" { "image/webp" }
                ".ico"  { "image/x-icon" }
                ".xlsx" { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
                ".json" { "application/json; charset=utf-8" }
                default { "application/octet-stream" }
            }
            
            $response.ContentType = $contentType
            $file = Get-Item $localPath
            $response.ContentLength64 = $file.Length
            
            Write-Host "Serving: $decodedPath, Method: $($request.HttpMethod), Disk size: $($file.Length), Header: $($response.ContentLength64)"
            
            if ($request.HttpMethod -ne "HEAD") {
                $fs = [System.IO.File]::OpenRead($localPath)
                try {
                    $fs.CopyTo($response.OutputStream)
                } finally {
                    $fs.Close()
                }
            }
        } else {
            # 檔案不存在
            $response.StatusCode = 404
            $errorMessage = "404 Not Found: $rawPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write([byte[]]$bytes, 0, $bytes.Length)
            }
        }
        $response.Close()
    }
} catch {
    Write-Host "伺服器發生異常: $_`nStack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
} finally {
    $listener.Stop()
}
