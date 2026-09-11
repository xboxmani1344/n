@echo off
setlocal

REM Anchor to this script's own folder. Double-clicking from Explorer can
REM otherwise start in C:\Windows\System32.
cd /d "%~dp0"

REM NOTE: goto labels instead of parenthesised if-blocks wherever a variable is
REM read near where it was set. Inside a ( ) block %VAR% is expanded when the
REM block is PARSED, not when it runs, so reading a variable set in the same
REM block silently yields an empty string. That bug would write an empty API
REM key here without any error.

echo.
echo ==========================================
echo   Buddy - Liara setup
echo ==========================================
echo.
echo This creates the disk and sets the environment
echo variables on your Liara app.
echo.
echo It does NOT deploy. Your app is already connected
echo to GitHub, so Liara deploys on its own.
echo.

REM --- Node ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :nonode

REM --- Liara CLI ----------------------------------------------------------
REM How the tool gets run is decided once, here, and every call below goes
REM through %LIARA%. A global install puts liara.cmd in the npm folder, which is
REM normally on PATH - but not on every machine, and a fresh install is not
REM always visible to the session that installed it. Rather than fail at that
REM point, fall back to npx, which fetches and runs it without installing.
set "LIARA=liara"

where liara >nul 2>nul
if not errorlevel 1 goto :havecli

echo [1/4] Installing the Liara command line tool...
echo.
call npm install -g @liara/cli
if not errorlevel 1 goto :cliinstalled

REM npm's own registry is frequently unreachable from Iran, which shows up as
REM ECONNRESET rather than as anything that names the cause. A public mirror
REM usually is reachable, so try one before giving up.
echo.
echo       npmjs.org did not respond. Trying a mirror...
echo.
call npm install -g @liara/cli --registry=https://registry.npmmirror.com
if errorlevel 1 goto :cliinstallfailed

:cliinstalled
echo.

where liara >nul 2>nul
if not errorlevel 1 goto :clidone
echo       Installed, but not on this session's PATH. Using npx instead.
set "LIARA=npx --yes @liara/cli"
goto :clidone

:havecli
echo [1/4] Liara command line tool already installed.

:clidone

REM --- Login --------------------------------------------------------------
echo.
echo [2/4] Signing in to Liara.
echo       Your password goes to Liara only. It is not stored by this script.
echo.
call %LIARA% login
if errorlevel 1 goto :loginfailed

REM --- Which app ----------------------------------------------------------
echo.
echo [3/4] Which app?
echo       Enter the app id - the part before .liara.run
echo       For https://studybuddy.liara.run that is:  studybuddy
echo.
set "APPNAME="
set /p "APPNAME=App id: "
if not defined APPNAME goto :noapp

REM --- Disk ---------------------------------------------------------------
echo.
echo       Creating a 1 GB disk named "data"...
call %LIARA% disk:create --app "%APPNAME%" --name data --size 1
if errorlevel 1 goto :diskfailed
echo       Disk created.
goto :diskdone

:diskfailed
echo.
echo       Could not create the disk.
echo       If it already exists that is fine - carrying on.

:diskdone

REM --- Environment variables ----------------------------------------------
echo.
echo [4/4] Liara AI settings.
echo.
echo       From your Liara AI panel. If you have not bought it
echo       yet, press Enter three times to skip - you can run
echo       this script again later.
echo.
set "AIKEY="
set /p "AIKEY=  AI_API_KEY  (your key):        "
set "AIURL="
set /p "AIURL=  AI_BASE_URL (service address): "
set "AIMODEL="
set /p "AIMODEL=  MODEL_ID    (model name):      "

if not defined AIKEY goto :basiconly
if not defined AIURL goto :basiconly
if not defined AIMODEL goto :basiconly

echo.
echo       Setting all five variables...
call %LIARA% env:set --app "%APPNAME%" --force "NODE_ENV=production" "SHARED_API_KEY=1" "AI_API_KEY=%AIKEY%" "AI_BASE_URL=%AIURL%" "MODEL_ID=%AIMODEL%"
if errorlevel 1 goto :envfailed
goto :done

:basiconly
echo.
echo       No AI details given, so setting only the two that
echo       do not need them. The site will run; the chat will
echo       not reply until you run this again with the AI details.
echo.
call %LIARA% env:set --app "%APPNAME%" --force "NODE_ENV=production" "SHARED_API_KEY=1"
if errorlevel 1 goto :envfailed

:done
echo.
echo ==========================================
echo   Done.
echo.
echo   Liara restarts the app after a variable
echo   change. Give it a minute, then open:
echo.
echo     https://%APPNAME%.liara.run
echo.
echo   Then open the app's Logs tab in the panel
echo   and check these three lines:
echo.
echo     node      22.x        - version is right
echo     database  ... (on its own disk)
echo     ai        ...liara... - not Google
echo.
echo   Send those logs to Claude if anything
echo   looks wrong. Your key is never printed.
echo ==========================================
echo.
pause
exit /b 0


REM ============================ error exits ==================================

:nonode
echo [X] Node.js is not installed.
echo.
echo     Download the "LTS" version from https://nodejs.org
echo     then run this script again.
echo.
pause
exit /b 1

:cliinstallfailed
echo.
echo [X] Could not download the Liara tool.
echo.
echo     If the error above says ECONNRESET, ETIMEDOUT or
echo     "network", npm's servers are unreachable from your
echo     connection - not a problem with this script or with
echo     your account.
echo.
echo     Three ways round it, quickest first:
echo.
echo       1. Do it in the Liara panel instead. It is about
echo          five clicks and always works, because the panel
echo          itself clearly loads for you. See
echo          docs\deploy-liara.md, steps 2 and 4.
echo.
echo       2. Turn your VPN on and run this again.
echo.
echo       3. If the error mentions permissions rather than
echo          the network, right-click this file and choose
echo          "Run as administrator".
echo.
pause
exit /b 1

:loginfailed
echo.
echo [X] Sign in did not complete, so nothing was changed.
echo.
pause
exit /b 1

:noapp
echo.
echo [X] No app id entered, so nothing was changed.
echo.
pause
exit /b 1

:envfailed
echo.
echo [X] Could not set the variables. The error is above.
echo.
echo     Check that the app id is spelled exactly as it appears
echo     in your Liara panel.
echo.
pause
exit /b 1
