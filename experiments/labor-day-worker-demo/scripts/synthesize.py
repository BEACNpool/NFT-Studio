"""Original provisional whistle march. Fixed notes/seed; no sample or named melody input."""
from pathlib import Path
import math,random,wave,array,json,hashlib,subprocess
kit=Path(__file__).resolve().parent.parent
for folder in ['assets','work','evidence']:(kit/folder).mkdir(exist_ok=True)
rate=48000;beat=.45;duration=7.2;n=round(rate*duration);out=[0.0]*n;rng=random.Random(20260907)
notes=[(0,74,1),(1,74,.5),(1.5,77,.5),(2,81,1),(3,79,1),(4,77,1),(5,74,1),(6,76,1),(7,73,1),(8,74,1),(9,77,.5),(9.5,79,.5),(10,81,1),(11,84,1),(12,81,1),(13,79,1),(14,77,1),(15,74,1)]
for start,midi,beats in notes:
 begin=round((start*beat+.025)*rate);length=round((beats*beat-.065)*rate);freq=440*2**((midi-69)/12);phase=0
 for j in range(length):
  i=begin+j
  if i>=n:break
  t=j/rate;env=min(1,t/.024,max(0,(length-j)/rate/.07))
  drift=1+.003*min(1,t/.16)*math.sin(2*math.pi*5.2*t)+.002*math.exp(-t*30)
  phase+=2*math.pi*freq*drift/rate
  whistle=math.sin(phase)+.055*math.sin(2*phase)+.012*math.sin(3*phase)
  out[i]+=.39*env*whistle
for b in range(16):
 begin=round(b*beat*rate)
 for j in range(round(.13*rate)):
  i=begin+j
  if i>=n:break
  t=j/rate;phase=2*math.pi*(54*t+2.3*(1-math.exp(-t*18)))
  out[i]+=.18*math.sin(phase)*math.exp(-t*31)*min(1,t/.003)
 if b%2:
  for offset,amp in [(-.028,.045),(0,.13)]:
   start=begin+round(offset*rate);last=0
   for j in range(round(.115*rate)):
    i=start+j
    if i<0 or i>=n:continue
    t=j/rate;noise=rng.uniform(-1,1);hp=noise-last;last=noise
    out[i]+=amp*(.75*hp+.18*math.sin(2*math.pi*180*t))*math.exp(-t*35)*min(1,t/.001)
for i in range(n):out[i]*=min(1,i/rate/.015,(n-i)/rate/.06)
peak=max(abs(x) for x in out);scale=.58/peak
pcm=array.array('h',(round(max(-1,min(1,x*scale))*32767) for x in out))
with wave.open(str(kit/'work/original-whistle-march.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
command=['ffmpeg','-hide_banner','-loglevel','error','-fflags','+bitexact','-i',str(kit/'work/original-whistle-march.wav'),'-map_metadata','-1','-ac','1','-ar','24000','-c:a','libopus','-b:a','6400','-vbr','off','-compression_level','10','-application','audio','-frame_duration','60','-bsf:a','opus_metadata=gain=-1536','-flags:a','+bitexact','-fflags','+bitexact','-y',str(kit/'assets/original-whistle-march.ogg')]
subprocess.run(command,check=True)
recipe={'schema':'beacn.original-whistle-march.v1','status':'provisional-original-pending-user-selection','composition':'Original D-minor whistle march; no samples or named composition input','durationSeconds':duration,'beatsPerMinute':60/beat,'sampleRateMaster':rate,'seed':20260907,'notesBeatMidiDuration':notes,'audioEncoding':{'codec':'Opus','container':'Ogg','channels':1,'rate':24000,'targetBitsPerSecond':6400,'constantBitRate':True,'frameMilliseconds':60,'opusOutputGainDb':-6},'sourcePeak':peak,'masterPeakAfterScale':.58}
(kit/'evidence/audio-recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
print('SVG bytes',len((kit/'assets/happy-labor-day.svg').read_bytes()),'Audio bytes',len((kit/'assets/original-whistle-march.ogg').read_bytes()))
