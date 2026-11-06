@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installa Node.js 24 LTS prima di avviare il prototipo.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Installazione delle dipendenze del progetto...
  set "NODE_USE_SYSTEM_CA=1"
  call npm.cmd ci
  if errorlevel 1 (
    echo Installazione non riuscita. Controlla la connessione e riprova.
    pause
    exit /b 1
  )
)
echo Avvio su http://127.0.0.1:5173
echo Lascia aperta questa finestra. Premi Ctrl+C per interrompere.
call npm.cmd run dev -- --port 5173 --strictPort --open
if errorlevel 1 pause
