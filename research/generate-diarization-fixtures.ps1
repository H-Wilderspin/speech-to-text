$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$outputRoot = Join-Path $PSScriptRoot 'private/diarization-runtime'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
foreach ($voice in @('Hazel', 'Zira')) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $synth.SelectVoice("Microsoft $voice Desktop")
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToWaveFile((Join-Path $outputRoot "$voice.wav"), $format)
    $synth.Speak('The morning is bright and the room is quiet. Please bring a glass of water to the table.')
  } finally { $synth.Dispose() }
}
Get-ChildItem -LiteralPath $outputRoot -Filter '*.wav' | Select-Object Name, Length
