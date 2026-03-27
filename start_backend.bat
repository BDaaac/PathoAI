@echo off
cd /d "%~dp0backend"
echo Starting BioVision AI Backend on http://localhost:8000
python manage.py runserver 0.0.0.0:8000
pause
