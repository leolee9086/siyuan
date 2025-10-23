@echo off
echo 正在请求管理员权限...
powershell -Command "Start-Process cmd -ArgumentList '/c cd /d d:/study/siyuan-note && node build.js' -Verb RunAs"
pause