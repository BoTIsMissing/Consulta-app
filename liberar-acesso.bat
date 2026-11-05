@echo off
setlocal DisableDelayedExpansion
title Liberar acesso - Consulta BR

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

node "%~dp0backend\authorize-user-interactive.js"
set "grantExitCode=%errorlevel%"

echo.
pause
exit /b %grantExitCode%
