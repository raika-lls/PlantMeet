@echo off
cd /d "%~dp0"
"runtime\llama-server.exe" -m "qwen3-4b.gguf" --alias smartedu-qwen --host 127.0.0.1 --port 8391 --ctx-size 8192 --parallel 1 --n-gpu-layers 99 --device Vulkan1
