$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$outputRoot = Join-Path $PSScriptRoot 'private/attribution-fixtures'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$passages = @{
  profile = 'We walked through the garden beside the old station. There were flowers along the path and a small wooden bench under a tree.'
  calibration = 'A quiet afternoon is a good time to read a book. Later I will make some tea and put the cups away in the kitchen.'
  heldout = 'The morning is bright and the room is quiet. Please bring a glass of water to the table.'
}
foreach ($voice in @('Hazel', 'Zira')) {
  foreach ($kind in @('profile', 'calibration', 'heldout')) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
      $synth.SelectVoice("Microsoft $voice Desktop")
      $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
      $synth.SetOutputToWaveFile((Join-Path $outputRoot "$voice-$kind.wav"), $format)
      $synth.Speak($passages[$kind])
    } finally { $synth.Dispose() }
  }
}
Get-ChildItem -LiteralPath $outputRoot -Filter '*.wav' | Select-Object Name, Length
