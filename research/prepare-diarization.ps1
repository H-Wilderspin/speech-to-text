$ErrorActionPreference = 'Stop'
$outputRoot = Join-Path $PSScriptRoot 'private/diarization-runtime'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$revision = '9403a6902bb58e3d5ae8c7e77c3422de279db2e0'
$base = "https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/$revision"
foreach ($name in @('model.int8.onnx', 'LICENSE', 'README.md')) {
  $destination = Join-Path $outputRoot $name
  if (!(Test-Path -LiteralPath $destination)) {
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$name" -OutFile $destination
  }
}
$model = Join-Path $outputRoot 'model.int8.onnx'
if ((Get-FileHash -LiteralPath $model).Hash.ToLowerInvariant() -ne 'd582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d') {
  throw 'Segmentation model checksum mismatch; inspect/remove the research download and retry.'
}
Get-Item -LiteralPath $model | Select-Object Name, Length
