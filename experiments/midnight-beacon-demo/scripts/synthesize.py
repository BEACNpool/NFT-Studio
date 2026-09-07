#!/usr/bin/env python3
"""Original BEACN Labs demo composition, 4 bars at 120 BPM. No samples/input media.
Pure deterministic oscillator/noise synthesis; writes one new 24kHz mono PCM WAV.
Exact PCM reproducibility is asserted on the recorded Python/libm environment.
"""
from array import array
import hashlib,json,math,pathlib,struct,sys,wave
out=pathlib.Path(sys.argv[1])
if out.exists(): raise SystemExit('Output exists; choose a new WAV path.')
RATE=24000; SECONDS=8; TAU=math.tau
buf=[0.0]*(RATE*SECONDS)
def freq(midi): return 440*2**((midi-69)/12)
def voice(start,length,midi,gain,kind):
 f=freq(midi); count=round(length*RATE); begin=round(start*RATE)
 for i in range(count):
  if begin+i>=len(buf): break
  t=i/RATE; p=TAU*f*t
  # Band-limited pulse / triangle timbres: deliberately no square-wave aliasing.
  if kind=='lead': s=(math.sin(p)+.30*math.sin(3*p)+.12*math.sin(5*p))/.96
  elif kind=='bass': s=(math.sin(p)-math.sin(3*p)/9+math.sin(5*p)/25)/1.04
  else: s=(math.sin(p)+.18*math.sin(2*p))/.95
  env=min(1,t/.006)*min(1,(length-t)/.045)*math.exp(-t*(3.0 if kind=='pluck' else .65))
  buf[begin+i]+=gain*s*env
# A-minor ascent answered by F-major; brighter C, suspended G resolving to A.
melody=[[76,81,83,84,88,86,84,83],[81,84,88,89,88,84,81,79],
        [79,84,86,88,91,88,86,84],[83,86,88,86,84,83,81,None]]
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
for bar in range(4):
 for step,note in enumerate(melody[bar]):
  if note is not None: voice(bar*2+step*.25,.205 if step!=6 or bar!=3 else .46,note,.205,'lead')
 for beat in range(4):
  root=[45,41,48,43][bar]
  if bar==3 and beat==3: root=45
  voice(bar*2+beat*.5,.43,root,.255,'bass')
 for step in range(16):
  if bar==3 and step>=14: continue
  voice(bar*2+step*.125+.012,.108,chords[bar][step%3]+12,.055,'pluck')
# Two restrained sine kicks per bar, a pitched noise snare, and offbeat ticks.
seed=0xBEAC0123
for beat in range(16):
 start=beat*.5
 for i in range(round(.19*RATE)):
  t=i/RATE; k=round(start*RATE)+i
  if beat%2==0:
   phase=TAU*(48*t+(92-48)*.026*(1-math.exp(-t/.026)))
   buf[k]+=.235*math.sin(phase)*math.exp(-t/ .050)*min(1,t/.001)
  else:
   seed=(1664525*seed+1013904223)&0xffffffff
   noise=seed/2147483648-1
   buf[k]+=.044*(noise+.35*math.sin(TAU*180*t))*math.exp(-t/.033)*min(1,t/.002)
 if beat<15:
  for i in range(round(.035*RATE)):
   t=i/RATE; seed=(1664525*seed+1013904223)&0xffffffff
   buf[round((start+.25)*RATE)+i]+=.027*(seed/2147483648-1)*math.exp(-t/.009)*min(1,t/.002)
# Echo is a deliberately quiet sixteenth-note copy, then soft saturation/fades.
dry=buf[:]
for i in range(round(.375*RATE),len(buf)): buf[i]+=.12*dry[i-round(.375*RATE)]
for i in range(len(buf)):
 t=i/RATE; buf[i]=math.tanh(buf[i]*1.16)*min(1,t/.012)*min(1,(SECONDS-t)/.12)
peak=max(abs(x) for x in buf); gain=.84/peak
pcm=b''.join(struct.pack('<h',round(x*gain*32767)) for x in buf)
with wave.open(str(out),'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)
print(json.dumps({'sampleRate':RATE,'channels':1,'seconds':SECONDS,'samples':len(buf),'pcmSha256':hashlib.sha256(pcm).hexdigest(),'wavSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'peakLinear':max(abs(x*gain) for x in buf),'rmsLinear':math.sqrt(sum((x*gain)**2 for x in buf)/len(buf))}))
