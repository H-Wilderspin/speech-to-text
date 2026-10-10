param(
  [string]$SherpaBuild = "$PSScriptRoot/../../sherpa-onnx/build-wasm-simd-vad-asr",
  [string]$Emsdk = "$PSScriptRoot/../../emsdk",
  [ValidateSet('speaker', 'asr', 'pipeline')][string]$Kind = 'speaker'
)
$ErrorActionPreference = 'Stop'
$buildRoot = (Resolve-Path -LiteralPath $SherpaBuild).Path
$sdkRoot = (Resolve-Path -LiteralPath $Emsdk).Path
$outputRoot = Join-Path $PSScriptRoot "private/$Kind-runtime"
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

# Re-link existing static libraries without the unrelated ASR/VAD model preload.
# This does not modify the source checkout or its existing build artifacts.
$libraries = @(
  'lib/libsherpa-onnx-c-api.a', 'lib/libsherpa-onnx-core.a',
  'lib/libkaldi-native-fbank-core.a', 'lib/libkissfft-float.a',
  'lib/libkaldi-decoder-core.a', 'lib/libsherpa-onnx-kaldifst-core.a',
  'lib/libssentencepiece_core.a', '_deps/onnxruntime-src/lib/libonnxruntime.a',
  'lib/libsherpa-onnx-fstfar.a', 'lib/libsherpa-onnx-fst.a'
) | ForEach-Object { (Resolve-Path -LiteralPath (Join-Path $buildRoot $_)).Path }
$exports = @(
  '_malloc', '_free', '_SherpaOnnxCreateSpeakerEmbeddingExtractor',
  '_SherpaOnnxDestroySpeakerEmbeddingExtractor', '_SherpaOnnxSpeakerEmbeddingExtractorDim',
  '_SherpaOnnxSpeakerEmbeddingExtractorCreateStream', '_SherpaOnnxSpeakerEmbeddingExtractorIsReady',
  '_SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding', '_SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding',
  '_SherpaOnnxOnlineStreamAcceptWaveform', '_SherpaOnnxOnlineStreamInputFinished', '_SherpaOnnxDestroyOnlineStream'
)
$runtimeMethods = 'FS,stringToUTF8,lengthBytesUTF8,HEAPF32,HEAPU8,HEAPU32'
if ($Kind -eq 'asr' -or $Kind -eq 'pipeline') {
  $speakerExports = $exports
  $exports = @(
    '_malloc', '_free', '_SherpaOnnxCreateOnlineRecognizer', '_SherpaOnnxDestroyOnlineRecognizer',
    '_SherpaOnnxCreateOnlineStream', '_SherpaOnnxDestroyOnlineStream',
    '_SherpaOnnxOnlineStreamAcceptWaveform', '_SherpaOnnxOnlineStreamInputFinished',
    '_SherpaOnnxIsOnlineStreamReady', '_SherpaOnnxDecodeOnlineStream',
    '_SherpaOnnxGetOnlineStreamResultAsJson', '_SherpaOnnxDestroyOnlineStreamResultJson',
    '_SherpaOnnxOnlineStreamIsEndpoint', '_SherpaOnnxOnlineStreamReset'
  )
  $runtimeMethods += ',setValue,UTF8ToString'
  if ($Kind -eq 'pipeline') {
    $exports = ($exports + $speakerExports + @(
      '_SherpaOnnxCreateVoiceActivityDetector', '_SherpaOnnxDestroyVoiceActivityDetector',
      '_SherpaOnnxVoiceActivityDetectorAcceptWaveform', '_SherpaOnnxVoiceActivityDetectorEmpty',
      '_SherpaOnnxVoiceActivityDetectorFront', '_SherpaOnnxVoiceActivityDetectorPop',
      '_SherpaOnnxVoiceActivityDetectorDetected',
      '_SherpaOnnxDestroySpeechSegment', '_SherpaOnnxVoiceActivityDetectorFlush'
      '_SherpaOnnxVoiceActivityDetectorReset'
    )) | Select-Object -Unique
  }
}
$env:EM_CONFIG = Join-Path $sdkRoot '.emscripten'
$env:EMSDK_PYTHON = Join-Path $sdkRoot 'python/3.13.3_64bit/python.exe'
$compiler = Join-Path $sdkRoot 'upstream/emscripten/em++.bat'
$linkArguments = @(
  '--no-entry', '-O3', '-msimd128', '-lpthread',
  '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sEXPORT_NAME=createSpeakerModule', '-sENVIRONMENT=web,worker,node',
  '-sFORCE_FILESYSTEM=1', '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=67108864',
  '-sSTACK_SIZE=5242880', '-sMAXIMUM_MEMORY=2147483648',
  ('-sEXPORTED_FUNCTIONS=' + ($exports -join ',')),
  "-sEXPORTED_RUNTIME_METHODS=$runtimeMethods",
  '-o', (Join-Path $outputRoot "$Kind-runtime.mjs")
) + $libraries
& $compiler @linkArguments
if ($LASTEXITCODE -ne 0) { throw "$Kind runtime link failed with exit code $LASTEXITCODE" }
Get-ChildItem -LiteralPath $outputRoot -File | Select-Object Name, Length
