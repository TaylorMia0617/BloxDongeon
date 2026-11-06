using Godot;
namespace BloxDungoen;

public partial class NativeAudio : Node
{
    private readonly Dictionary<string, AudioStreamWav> _clips = [];
    private readonly List<AudioStreamPlayer> _players = [];
    private ulong _lastShot;
    public override void _Ready()
    {
        foreach (var (key, start, end, duration) in new[] { ("shot", 160f, 70f, .055f), ("hit", 85f, 38f, .08f), ("collect", 550f, 1100f, .11f), ("explode", 95f, 22f, .23f), ("click", 360f, 600f, .06f) })
        {
            int frames = (int)(22050 * duration); byte[] data = new byte[frames * 2]; float phase = 0;
            for (int i = 0; i < frames; i++) { float t = i / (float)frames; phase += MathF.Tau * (start + (end - start) * t) / 22050; short sample = (short)(MathF.Sin(phase) * MathF.Pow(1 - t, 2) * 4500); data[i * 2] = (byte)(sample & 255); data[i * 2 + 1] = (byte)((sample >> 8) & 255); }
            _clips[key] = new AudioStreamWav { Format = AudioStreamWav.FormatEnum.Format16Bits, MixRate = 22050, Data = data };
        }
        for (int i = 0; i < 12; i++) { var player = new AudioStreamPlayer { VolumeDb = -8 }; AddChild(player); _players.Add(player); }
    }
    public void PlayEffect(string key)
    {
        if (!_clips.TryGetValue(key, out var clip)) return;
        ulong now = Time.GetTicksMsec(); if (key == "shot" && now - _lastShot < 60) return; if (key == "shot") _lastShot = now;
        var player = _players.FirstOrDefault(p => !p.Playing); if (player == null) return; player.Stream = clip; player.Play();
    }
}
