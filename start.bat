@echo off
setlocal enabledelayedexpansion
title YourScript - Bot + AI Selfbot
cd /d "%~dp0"

echo ==========================================
echo    YourScript - Bot Server + AI Selfbot
echo ==========================================
echo.

:: ============================================
:: STEP 1: Prisma Client
:: ============================================
if exist "node_modules\.prisma\client\index.js" (
    echo [1/7] Prisma Client OK - skip
) else (
    echo [1/7] Generating Prisma Client...
    call pnpm db:generate
    if !errorlevel! neq 0 (
        echo ERROR: Prisma generate failed!
        pause
        exit /b 1
    )
)

:: ============================================
:: STEP 2: Database
:: ============================================
if exist "prisma\dev.db" (
    echo [2/7] Database OK - skip
) else (
    echo [2/7] Creating database...
    call pnpm db:push
    if !errorlevel! neq 0 (
        echo ERROR: Prisma db push failed!
        pause
        exit /b 1
    )
)

:: ============================================
:: STEP 3: Check for schema changes (new models)
:: ============================================
echo [3/7] Syncing database schema...
call pnpm db:push 2>nul
if !errorlevel! neq 0 (
    echo WARNING: Schema sync had issues, continuing anyway...
)

:: ============================================
:: STEP 4: Build Bot Server
:: ============================================
set "NEED_BUILD=0"
if not exist "dist\index.js" (
    set "NEED_BUILD=1"
) else (
    for /f "delims=" %%F in ('powershell -nologo -noprofile -command "if((Get-ChildItem src -Recurse -Filter *.ts | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime -gt (Get-Item dist\index.js).LastWriteTime){'1'}else{'0'}"') do set "NEED_BUILD=%%F"
)

if "!NEED_BUILD!"=="1" (
    echo [4/7] Building bot server...
    call pnpm build
    if !errorlevel! neq 0 (
        echo ERROR: Bot build failed!
        pause
        exit /b 1
    )
) else (
    echo [4/7] Bot build up to date - skip
)

:: ============================================
:: STEP 5: Install Selfbot Dependencies
:: ============================================
if exist "selfbot\node_modules" (
    echo [5/7] Selfbot dependencies OK - skip
) else (
    echo [5/7] Installing selfbot dependencies...
    cd selfbot
    call npm install
    cd ..
    if !errorlevel! neq 0 (
        echo ERROR: Selfbot npm install failed!
        pause
        exit /b 1
    )
)

:: ============================================
:: STEP 6: Build Selfbot
:: ============================================
set "NEED_SELFBOT_BUILD=0"
if not exist "selfbot\dist\index.js" (
    set "NEED_SELFBOT_BUILD=1"
) else (
    for /f "delims=" %%F in ('powershell -nologo -noprofile -command "if((Get-ChildItem selfbot\src -Recurse -Filter *.ts | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime -gt (Get-Item selfbot\dist\index.js).LastWriteTime){'1'}else{'0'}"') do set "NEED_SELFBOT_BUILD=%%F"
)

if "!NEED_SELFBOT_BUILD!"=="1" (
    echo [6/7] Building selfbot...
    cd selfbot
    call npm run build
    cd ..
    if !errorlevel! neq 0 (
        echo ERROR: Selfbot build failed!
        pause
        exit /b 1
    )
) else (
    echo [6/7] Selfbot build up to date - skip
)

:: ============================================
:: STEP 7: Check Selfbot Config
:: ============================================
set "SELFBOT_READY=1"

:: Check if selfbot .env has a token
if not exist "selfbot\.env" (
    echo [7/7] Selfbot .env not found - selfbot will NOT start
    set "SELFBOT_READY=0"
) else (
    findstr /r "^SELFBOT_TOKEN=." "selfbot\.env" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [7/7] SELFBOT_TOKEN is empty - selfbot will NOT start
        echo      Fill in selfbot\.env to enable AI
        set "SELFBOT_READY=0"
    ) else (
        findstr /r "^OPENROUTER_API_KEY=." "selfbot\.env" >nul 2>&1
        if !errorlevel! neq 0 (
            echo [7/7] OPENROUTER_API_KEY is empty - selfbot will NOT start
            echo      Fill in selfbot\.env to enable AI
            set "SELFBOT_READY=0"
        ) else (
            echo [7/7] Selfbot config OK
        )
    )
)

echo.
echo ==========================================

:: ============================================
:: LAUNCH
:: ============================================
if "!SELFBOT_READY!"=="1" (
    echo  Starting Bot Server + AI Selfbot...
    echo ==========================================
    echo.

    :: Start selfbot in background
    start "AI Selfbot" /min cmd /c "cd /d "%~dp0selfbot" && node dist/index.js & pause"

    :: Small delay to let selfbot start connecting
    timeout /t 2 /nobreak >nul

    :: Start bot server in foreground
    echo [BOT] Starting bot server...
    call pnpm start

    :: If bot stops, kill selfbot too
    echo.
    echo Bot server stopped. Closing selfbot...
    taskkill /fi "WINDOWTITLE eq AI Selfbot" >nul 2>&1
) else (
    echo  Starting Bot Server only (no AI)
    echo ==========================================
    echo.
    call pnpm start
)

echo.
echo Everything stopped.
pause
