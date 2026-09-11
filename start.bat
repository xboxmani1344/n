@echo off
setlocal

REM Anchor to this script's own folder. Without this, double-clicking from
REM Explorer can start in C:\Windows\System32 and every path below breaks.
cd /d "%~dp0"

echo.
echo ==========================================
echo   Buddy
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
REM
REM Don't just test whether .env exists - ask the app's own loader whether it can
REM actually read a key out of it. A .env can exist and still be unusable: saved
REM by Notepad as .env.txt so this file is something else entirely, the key left
REM commented out, the wrong variable name, or UTF-16 encoding. Checking for the
REM file alone would report "already set up" and then fail at runtime with
REM "no AI API key yet", which tells the user nothing about the cause.
node -e "require('dotenv').config();process.exit((process.env.AI_API_KEY||process.env.GEMINI_API_KEY)?0:1)" 2>nul
if not errorlevel 1 goto :havekey

if exist ".env" goto :badkeyfile
echo.
echo [2/2] One-time setup: your free Gemini API key.
goto :askkey

:badkeyfile
echo.
echo [2/2] There's a .env file here, but no usable key could be read from it.
echo       Common causes: the line still starts with #, the name is misspelled,
echo       or Notepad saved it as .env.txt instead of .env.
echo.
echo       Entering your key below will add a correct line to the file.

:askkey
echo.
echo       Get a key at https://aistudio.google.com/apikey
echo       ^(click "Create API key", then copy it^)
echo.
echo       To paste into this window: right-click, or press Ctrl+V.
echo.
set "GEMKEY="
set /p "GEMKEY=Paste your key here and press Enter: "
if not defined GEMKEY goto :nokey

REM Append rather than overwrite, so any other settings already in .env survive.
>> ".env" echo AI_API_KEY=%GEMKEY%

REM Confirm the app can now actually read it, instead of assuming the write worked.
node -e "require('dotenv').config();process.exit((process.env.AI_API_KEY||process.env.GEMINI_API_KEY)?0:1)" 2>nul
if errorlevel 1 goto :keywritefailed
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
echo Buddy has stopped.
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

:keywritefailed
echo.
echo [X] The key was written to .env but still can't be read back.
echo.
echo     Open .env in Notepad and check there's a line reading:
echo         AI_API_KEY=your-key-here
echo     with no # in front of it.
echo.
pause
exit /b 1
