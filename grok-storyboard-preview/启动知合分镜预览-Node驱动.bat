@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "ASSETS=%ROOT%assets"
set "PAGE=zhihe-storyboard-preview-flashback.html"
set "PREVIEW_PORT=12731"
set "BRIDGE_PORT=12732"
set "PREVIEW_HEALTH=http://127.0.0.1:%PREVIEW_PORT%/health"
set "BRIDGE_HEALTH=http://127.0.0.1:%BRIDGE_PORT%/health"
set "URL=http://127.0.0.1:%PREVIEW_PORT%/%PAGE%?chatBase=http://127.0.0.1:%BRIDGE_PORT%&chatPath=/v1/chat/completions"

echo ========================================
echo 知合分镜预览（Node驱动）一键启动
echo Root: %ROOT%
echo ========================================
echo.

if not exist "%ROOT%bridge-server.js" (
  echo [ERROR] 找不到 bridge-server.js
  pause
  exit /b 1
)

if not exist "%ROOT%preview-server.js" (
  echo [ERROR] 找不到 preview-server.js
  pause
  exit /b 1
)

if not exist "%ASSETS%\%PAGE%" (
  echo [ERROR] 找不到预览页面文件：%ASSETS%\%PAGE%
  pause
  exit /b 1
)

echo [1/4] 清理旧 bridge 端口占用（%BRIDGE_PORT%）...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%BRIDGE_PORT% ^| findstr LISTENING') do (
  taskkill /PID %%p /F >nul 2>nul
)

echo [2/4] 启动聊天 bridge...
start "grok-storyboard-chat-bridge-%BRIDGE_PORT%" /D "%ROOT%" cmd /k node bridge-server.js

set "BRIDGE_READY="
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%BRIDGE_HEALTH%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "BRIDGE_READY=1"
    goto :bridge_ready
  )
  timeout /t 1 >nul
)

:bridge_ready
if not defined BRIDGE_READY (
  echo [ERROR] Bridge 启动失败，%BRIDGE_PORT% 未就绪。
  pause
  exit /b 1
)

echo [3/4] 清理旧预览端口占用（%PREVIEW_PORT%）...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PREVIEW_PORT% ^| findstr LISTENING') do (
  taskkill /PID %%p /F >nul 2>nul
)

echo [4/4] 启动预览服务...
start "grok-storyboard-preview-%PREVIEW_PORT%" /D "%ROOT%" cmd /k node preview-server.js %PREVIEW_PORT%

set "PREVIEW_READY="
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%PREVIEW_HEALTH%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "PREVIEW_READY=1"
    goto :preview_ready
  )
  timeout /t 1 >nul
)

:preview_ready
if not defined PREVIEW_READY (
  echo [ERROR] 预览服务启动失败，%PREVIEW_PORT% 未就绪。
  pause
  exit /b 1
)

echo [OK] 一键启动成功，正在打开页面：
echo %URL%
start "" "%URL%"

echo.
echo [INFO] 如页面未更新，请按 Ctrl+F5 强制刷新。
endlocal
