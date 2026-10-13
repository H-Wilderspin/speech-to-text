$ErrorActionPreference = 'Stop'
$outputRoot = Join-Path $PSScriptRoot 'private/comparison'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
Add-Type -AssemblyName System.Speech
# Collect synthesizer-provided word onset times, not wall-clock callback times.
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class BenchmarkWord {
    public string text;
    public double start;
}
public class BenchmarkVoice {
    public static BenchmarkWord[] Render(string voice, string text, string path) {
        var words = new List<BenchmarkWord>();
        using (var synth = new SpeechSynthesizer()) {
            synth.SelectVoice("Microsoft " + voice + " Desktop");
            synth.SpeakProgress += (sender, e) => words.Add(new BenchmarkWord {
                text = e.Text, start = e.AudioPosition.TotalSeconds
            });
            synth.SetOutputToWaveFile(path, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            synth.Speak(text);
        }
        return words.ToArray();
    }
}
'@
$texts = [ordered]@{
    profile = 'We walked through the garden beside the old station. There were flowers along the path and a small wooden bench under a tree.'
    breakfast = 'Would you like a cup of tea with your breakfast today?'
    shopping = 'I am going to the shops after lunch. Please write down everything that we need.'
    short = 'One down, three to go.'
    ending = 'Can you tell the difference between my voice and someone else?'
}
$clips = @()
foreach ($voice in @('Hazel', 'Zira')) {
    foreach ($entry in $texts.GetEnumerator()) {
        $name = "$voice-$($entry.Key)"
        $words = [BenchmarkVoice]::Render($voice, $entry.Value, (Join-Path $outputRoot "$name.wav"))
        $clips += @{ id = $name; voice = $voice; text = $entry.Value; words = @($words) }
    }
}
@{ synthetic = $true; sampleRate = 16000; clips = $clips } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $outputRoot 'clips.json')
Write-Output "Generated $($clips.Count) synthetic clips with word onset metadata."
