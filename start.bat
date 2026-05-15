@echo off
echo 🎵 Démarrage de Chordia...
echo.
"C:\Program Files\nodejs\node.exe" -v
"C:\Program Files\nodejs\npm.cmd" install
"C:\Program Files\nodejs\node.exe" server.js
pause
