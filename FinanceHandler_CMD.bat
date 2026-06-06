@echo off

echo Starting Ollama...
start "" ollama serve

echo Waiting for Ollama to initialize...
timeout /t 5 /nobreak > nul

echo Loading model...
start "" cmd /c "ollama run qwen3-coder:30b"

echo Waiting for model to load...
timeout /t 10 /nobreak > nul

echo Starting application...
pnpm run start

pause