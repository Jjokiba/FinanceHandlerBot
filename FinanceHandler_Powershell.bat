@echo off

powershell -NoExit -Command ^
"$ollama = Start-Process ollama -ArgumentList 'serve' -PassThru; ^
Start-Sleep 5; ^
cmd /c 'ollama run qwen3-coder:30b hello'; ^
pnpm run start; ^
Stop-Process -Id $ollama.Id"