@echo off
title Sistema de Elecciones - I.E. San Marcelino Champagnat
color 1F

echo ================================================================
echo    SISTEMA DE ELECCIONES ESCOLARES (RED LOCAL LAN)
echo    Colegio: I.E. SAN MARCELINO CHAMPAGNAT
echo ================================================================
echo.
echo Iniciando el servidor principal... Por favor no cierres esta ventana.
echo.

set "PATH=C:\Users\USER\.gemini\antigravity\scratch\nodejs;%PATH%"
cd /d "C:\Users\USER\.gemini\antigravity\scratch\municipio-escolar"

timeout /t 2 /nobreak >nul
start "" http://localhost:3000/admin.html
start "" http://localhost:3000

node server.js

pause
