@echo off
setlocal
chcp 65001 >nul

set "ROOT=%~dp0"
set "BRIDGE_BAT=%ROOT%start-chat-bridge.bat"
set "PREVIEW_BAT=%ROOT%start-local-preview.bat"
set "URL=http://127.0.0.1:12731/zhihe-storyboard-preview-flashback.html?chatBase=http://127.0.0.1:12732&chatPath=/v1/chat/completions"

echo ========================================
echo 知合分镜预览（Node驱动）一键启动
echo Root: %ROOT%
echo ========================================
echo.

if not exist "%BRIDGE_BAT%" (
  echo [ERROR] 缺少文件：%BRIDGE_BAT%
  pause
  exit /b 1
)

if not exist "%PREVIEW_BAT%" (
  echo [ERROR] 缺少文件：%PREVIEW_BAT%
  pause
  exit /b 1
)

echo [1/2] 启动聊天 bridge...
start "storyboard-bridge" /D "%ROOT%" cmd /c call "%BRIDGE_BAT%"
timeout /t 2 >nul

echo [2/2] 启动预览服务...
start "storyboard-preview" /D "%ROOT%" cmd /c call "%PREVIEW_BAT%" 12731
timeout /t 2 >nul

echo [OK] 正在打开页面：%URL%
start "" "%URL%"

echo.
echo [INFO] 如页面未更新，按 Ctrl+F5 强制刷新。
endlocal
