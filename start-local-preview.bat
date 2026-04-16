@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "ASSETS=%~dp0assets"
set "PORT=12731"
set "PAGE=zhihe-storyboard-preview-flashback.html"
set "QUERY="

if not "%~1"=="" set "PORT=%~1"
if not "%~2"=="" set "QUERY=%~2"

set "URL=http://127.0.0.1:%PORT%/%PAGE%"
if not "%QUERY%"=="" (
  set "URL=%URL%?project=%QUERY%&chatBase=http://127.0.0.1:12732&chatPath=/v1/chat/completions"
) else (
  set "URL=%URL%?chatBase=http://127.0.0.1:12732&chatPath=/v1/chat/completions"
)

echo ========================================
echo Grok Storyboard Node 预览启动脚本
echo Root: %ROOT%
echo Assets: %ASSETS%
echo Port: %PORT%
echo Page: %PAGE%
echo ========================================
echo.

if not exist "%ROOT%preview-server.js" (
  echo [ERROR] 找不到 preview-server.js
  pause
  exit /b 1
)

if not exist "%ASSETS%\%PAGE%" (
  echo [ERROR] 找不到预览页面文件：
  echo %ASSETS%\%PAGE%
  pause
  exit /b 1
)

echo [INFO] 检查端口 %PORT% 是否已有旧服务...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
  echo [INFO] 发现旧进程 PID=%%p，准备结束...
  taskkill /PID %%p /F >nul 2>nul
)

echo [INFO] 正在启动 Node 预览服务...
start "grok-storyboard-preview-%PORT%" /D "%ROOT%" cmd /k node preview-server.js %PORT%

echo [INFO] 等待服务就绪...
set "READY="
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "READY=1"
    goto :ready
  )
  timeout 1 >nul
)

:ready
if not defined READY (
  echo [ERROR] 服务启动失败，%PORT% 端口没有正常响应。
  echo [HINT] 你可以手动在终端里执行：
  echo cd /d "%ROOT%"
  echo node preview-server.js %PORT%
  pause
  exit /b 1
)

echo [OK] 服务已启动：%URL%
echo [INFO] 聊天默认走本地 bridge：http://127.0.0.1:12732/v1/chat/completions
start "" "%URL%"
echo.
echo [INFO] 如果页面还是旧内容，请按 Ctrl+F5 强制刷新。
pause
endlocal
