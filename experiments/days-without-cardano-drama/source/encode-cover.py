"""Reproduce the frozen AVIF cover from the included raster master."""
from pathlib import Path
import hashlib,subprocess,sys
source=Path(__file__).with_name('cover-master.png');out=Path(sys.argv[1]);assert not out.exists()
subprocess.run(['ffmpeg','-n','-hide_banner','-loglevel','error','-i',str(source),'-vf','scale=360:410','-frames:v','1','-c:v','libaom-av1','-still-picture','1','-crf','52','-cpu-used','6','-pix_fmt','yuv420p',str(out)],check=True)
actual=hashlib.sha256(out.read_bytes()).hexdigest();assert actual=='b113560143b30c4e264b7d684af801e9d26125c187f068b8c9de68f04d0cfe11','Encoder output differs: compare recorded FFmpeg/libaom versions before using it.'
print(actual)
