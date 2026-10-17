@echo off
title Subir Elecciones a GitHub
color 0A

echo ================================================================
echo      SUBIENDO SISTEMA DE ELECCIONES A GITHUB
echo      Repositorio: jmanosalvapinedo-hash/elecciones-champagnat
echo ================================================================
echo.

set "PATH=C:\Users\USER\.gemini\antigravity\scratch\mingit\cmd;C:\Users\USER\.gemini\antigravity\scratch\nodejs;%PATH%"
cd /d "%~dp0"

echo Enviando codigo a GitHub...
echo.

git push -u origin main

echo.
echo ================================================================
if %ERRORLEVEL% EQU 0 (
    echo    EXITO: El codigo se subio correctamente a GitHub!
    echo    Ahora puedes ir a Render.com para publicar tu enlace.
) else (
    echo    Hubo un detalle con la autorizacion de GitHub.
)
echo ================================================================
echo.
pause
