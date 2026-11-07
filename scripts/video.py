"""Assemble the demo video from the recorded side-panel screencast (.dev/rec) and stage backgrounds (.dev/video)."""
import json, subprocess, os
R, V = ".dev/rec", ".dev/video"
d = json.load(open(f"{R}/frames.json"))
fr, m = d["frames"], d["marks"]
slot = json.load(open(f"{V}/slot.json"))
SEARCH_SPEED = 10.0  # the search itself is sped up

def out_dur(t0, t1):
    # map a real-time interval to output seconds (search window compressed)
    a, b = m["click"] + 1.0, m["results"]
    inside = max(0.0, min(t1, b) - max(t0, a))
    return (t1 - t0) - inside + inside / SEARCH_SPEED

lines, total = [], 0.0
bounds = {}
for i, f in enumerate(fr):
    t0 = f["t"]; t1 = fr[i + 1]["t"] if i + 1 < len(fr) else m["end"]
    if t1 <= t0: continue
    dur = out_dur(t0, t1)
    for k in ("click", "results", "scrolled"):
        if k not in bounds and t1 >= m[k]: bounds[k] = total + out_dur(t0, min(t1, m[k]))
    lines += [f"file '{os.path.abspath(f['file'])}'", f"duration {dur:.4f}"]
    total += dur
lines.append(f"file '{os.path.abspath(fr[-1]['file'])}'")
open(f"{V}/frames.txt", "w").write("\n".join(lines) + "\n")
print("main length", round(total, 1), bounds)

run = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)
w, h = slot["w"], slot["h"]
run("-f", "concat", "-safe", "0", "-i", f"{V}/frames.txt", "-vf", f"scale={w}:-2,crop={w}:{h}:0:0,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", f"{V}/panel.mp4")

segs = [("bg-open.png", bounds["click"] + 0.6), ("bg-search.png", bounds["results"] - bounds["click"] - 0.6),
        ("bg-found.png", bounds["scrolled"] - bounds["results"]), ("bg-free.png", total - bounds["scrolled"])]
inputs, filt = [], []
for i, (bg, dur) in enumerate(segs):
    inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", f"{V}/{bg}"]
filt.append("".join(f"[{i}:v]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0,fps=30[bg]")
run(*inputs, "-i", f"{V}/panel.mp4", "-filter_complex", ";".join(filt) + f";[bg][{len(segs)}:v]overlay={slot['x']}:{slot['y']}:shortest=1,format=yuv420p[v]",
    "-map", "[v]", "-c:v", "libx264", "-crf", "18", "-r", "30", f"{V}/main.mp4")

# portrait cut
ps = json.load(open(f"{V}/pslot.json"))
run("-f", "concat", "-safe", "0", "-i", f"{V}/frames.txt", "-vf", f"scale={ps['w']}:-2,crop={ps['w']}:{ps['h']}:0:0,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", f"{V}/ppanel.mp4")
inputs = []
for bg, dur in segs:
    inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", f"{V}/p-{bg}"]
run(*inputs, "-i", f"{V}/ppanel.mp4", "-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex",
    "".join(f"[{i}:v]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0,fps=30[bg];[bg][{len(segs)}:v]overlay={ps['x']}:{ps['y']}:shortest=1,format=yuv420p[v]",
    "-map", "[v]", "-map", f"{len(segs)+1}:a", "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "media/easy-rental-search-demo-vertical.mp4")

for name, dur in (("intro", 2.6), ("outro", 3.6)):
    run("-loop", "1", "-t", str(dur), "-i", f"{V}/{name}.png", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "18", f"{V}/{name}.mp4")
os.makedirs("media", exist_ok=True)
run("-i", f"{V}/intro.mp4", "-i", f"{V}/main.mp4", "-i", f"{V}/outro.mp4", "-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0,fade=t=in:st=0:d=0.4[v]", "-map", "[v]", "-map", "3:a", "-shortest",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "media/easy-rental-search-demo.mp4")
print("wrote media/easy-rental-search-demo.mp4")
