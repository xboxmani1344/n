@echo off
setlocal

REM Anchor to this script's own folder. Without this, double-clicking from
REM Explorer can start in C:\Windows\System32 and every path below breaks.
cd /d "%~dp0"

echo.
echo ==========================================
echo   Study Buddy
echo ==========================================
echo.

REM NOTE: this script deliberately uses goto labels instead of parenthesised
REM if-blocks around anything that reads a variable set nearby. Inside a ( )
REM block, %VAR% is expanded when the block is *parsed*, not when it runs, so
REM reading a variable set in the same block silently yields an empty string.

REM --- Are we actually in the project folder? ---------------------------------
REM Unzipping often produces a nested folder (n-main\n-main). If package.json
REM isn't next to this script, we're in the outer shell of that nesting.
if not exist "package.json" goto :wrongfolder

REM --- Is Node installed, and new enough? -------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :nonode

REM The app uses Node's built-in SQLite, which needs 22.5 or newer.
REM Let Node compare its own version rather than parsing strings in batch.
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a>22||(a===22&&b>=5))?0:1)"
if errorlevel 1 goto :oldnode

REM --- Dependencies -----------------------------------------------------------
if exist "node_modules" goto :havedeps
echo [1/2] Installing dependencies. This takes a minute the first time...
echo.
call npm install
if errorlevel 1 goto :installfailed
echo.
goto :deps_done

:havedeps
echo [1/2] Dependencies already installed.

:deps_done

REM --- API key ----------------------------------------------------------------
REM Written straight to .env, which .gitignore excludes, so it stays on this PC.
if exist ".env" goto :havekey

echo.
echo [2/2] One-time setup: your free Gemini API key.
echo.
echo       Get one at https://aistudio.google.com/apikey
echo       ^(click "Create API key", then copy it^)
echo.
echo       To paste into this window: right-click, or press Ctrl+V.
echo.
set "GEMKEY="
set /p "GEMKEY=Paste your key here and press Enter: "
if not defined GEMKEY goto :nokey

> ".env" echo GEMINI_API_KEY=%GEMKEY%
echo.
echo       Saved to .env - you won't be asked again.
goto :key_done

:havekey
echo [2/2] API key already set up.

:key_done

REM --- Go ---------------------------------------------------------------------
echo.
echo ==========================================
echo   Starting up...
echo.
echo   Open this in your browser:
echo     http://localhost:3000
echo.
echo   Leave this window open while you study.
echo   Close it, or press Ctrl+C, to stop.
echo ==========================================
echo.

call npm start

REM npm start only returns once the server stops. If that was a crash rather
REM than the user closing it, pause so the error stays readable instead of the
REM window vanishing.
echo.
echo Study Buddy has stopped.
echo.
pause
exit /b 0


REM ============================ error exits ==================================

:wrongfolder
echo [X] This folder doesn't contain the app files.
echo.
echo     Look for another folder inside this one, open it,
echo     and run start.bat from in there instead.
echo.
pause
exit /b 1

:nonode
echo [X] Node.js isn't installed.
echo.
echo     Download the "LTS" version from https://nodejs.org
echo     then run start.bat again.
echo.
pause
exit /b 1

:oldnode
for /f "delims=" %%v in ('node -v') do set "NODEVER=%%v"
echo [X] Your Node.js ^(%NODEVER%^) is too old. Version 22.5 or newer is required.
echo.
echo     Install the "LTS" version from https://nodejs.org
echo     then run start.bat again.
echo.
pause
exit /b 1

:installfailed
echo.
echo [X] Installing dependencies failed. The error is above.
echo.
echo     The most common cause is no internet connection.
echo.
pause
exit /b 1

:nokey
echo.
echo [X] No key entered, so the AI wouldn't be able to reply.
echo     Run start.bat again when you have your key.
echo.
pause
exit /b 1
