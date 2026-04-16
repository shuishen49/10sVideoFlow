@echo off
setlocal
chcp 65001 >nul

set "PORT=12732"
set "ROOT=%~dp0"
set "HEALTH=http://127.0.0.1:%PORT%/health"

echo ========================================
echo Grok Storyboard Chat Bridge 启动脚本
echo Root: %ROOT%
echo Port: %PORT%
echo ========================================
echo.

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%HEALTH%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 (
  echo [INFO] 检测到 Bridge 已在运行，先尝试重启以加载最新代码...
  taskkill /F /T /FI "WINDOWTITLE eq grok-storyboard-chat-bridge-%PORT%*" >nul 2>nul
  timeout /t 1 >nul
)

if not exist "%ROOT%bridge-server.js" (
  echo [ERROR] 找不到 bridge-server.js
  pause
  exit /b 1
)

echo [INFO] 正在启动 storyboard-chat-bridge...
start "grok-storyboard-chat-bridge-%PORT%" /D "%ROOT%" cmd /k node bridge-server.js

echo [INFO] 等待服务就绪...
set "READY="
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%HEALTH%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "READY=1"
    goto :ready
  )
  timeout 1 >nul
)

:ready
if not defined READY (
  echo [ERROR] Bridge 启动失败，%PORT% 端口没有正常响应。
  echo [HINT] 请检查 bridge-config.json 的 OpenClaw 配置，尤其是 gatewayBase / gatewayToken / openclawAdapter。
  pause
  exit /b 1
)

echo [OK] Bridge 已启动：%HEALTH%

:end
pause
endlocal
