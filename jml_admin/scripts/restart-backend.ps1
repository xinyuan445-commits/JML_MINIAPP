$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe).Source
& $node (Join-Path $PSScriptRoot 'start-with-webapi.js') --restart backend
exit $LASTEXITCODE
