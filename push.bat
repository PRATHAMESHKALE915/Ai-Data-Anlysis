@echo off
echo ===================================================
echo   Pushing All Fixes to GitHub Repository...
echo ===================================================
cd /d "C:\Users\Prathamesh\Downloads\github-upload"
git branch -M main
git push -u origin main --force
echo.
echo ===================================================
echo   DONE! Press any key to close.
echo ===================================================
pause
