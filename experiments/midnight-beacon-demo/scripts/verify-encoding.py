#!/usr/bin/env python3
"""Repeat synthesis/encoding in a fresh temp directory and inspect decoded samples."""
from pathlib import Path
import subprocess,hashlib,json,struct,math,platform,tempfile,datetime
p=Path(__file__).resolve().parent.parent
work=Path(tempfile.mkdtemp(prefix='beacn-demo-encoder-'))
encoded=p/'assets/midnight-beacon.ogg'; reference=work/'reference.wav'; repeated=work/'reencoded.ogg'
synth=subprocess.run(['python3',str(p/'scripts/synthesize.py'),str(reference)],check=True,capture_output=True,text=True)
cmd=['ffmpeg','-hide_banner','-loglevel','error','-n','-fflags','+bitexact','-i',str(reference),'-map_metadata','-1','-c:a','libopus','-b:a','7200','-vbr','off','-application','audio','-frame_duration','60','-compression_level','10','-ar','24000','-ac','1','-bsf:a','opus_metadata=gain=-768','-flags:a','+bitexact','-fflags','+bitexact',str(repeated)]
subprocess.run(cmd,check=True); assert encoded.read_bytes()==repeated.read_bytes(); header=encoded.read_bytes().index(b'OpusHead'); output_gain=struct.unpack('<h',encoded.read_bytes()[header+16:header+18])[0]; assert output_gain==-768
pcm=subprocess.run(['ffmpeg','-v','error','-i',str(encoded),'-f','f32le','-acodec','pcm_f32le','-'],check=True,capture_output=True).stdout
vals=struct.unpack('<'+'f'*(len(pcm)//4),pcm);assert all(math.isfinite(x) for x in vals)
probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(encoded)],check=True,capture_output=True,text=True).stdout);probe['format']['filename']='assets/midnight-beacon.ogg'
report={'schema':'beacn.original-music-encoder-check.v1','status':'PASS','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'python':platform.python_version(),'ffmpeg':subprocess.run(['ffmpeg','-version'],capture_output=True,text=True).stdout.splitlines()[0],'libopusPackage':subprocess.run(['dpkg-query','-W','-f=${Version}','libopus0'],capture_output=True,text=True).stdout,'repeatSynthesis':json.loads(synth.stdout),'repeatEncodingByteEqual':True,'opusOutputGainDb':output_gain/256,'encodedSha256':hashlib.sha256(encoded.read_bytes()).hexdigest(),'decodedFrames':len(vals),'decodedSampleRate':48000,'decodedDuration':len(vals)/48000,'decodedPcmSha256':hashlib.sha256(pcm).hexdigest(),'decodedPeak':max(abs(x) for x in vals),'decodedRms':math.sqrt(sum(x*x for x in vals)/len(vals)),'decodedClippedSamples':sum(abs(x)>=1 for x in vals),'sourceWavSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'ffprobe':probe,'limits':['Byte reproducibility observed for the recorded ffmpeg/libopus/Python environment; other encoder versions may differ.','Decoded technical levels and playback do not constitute human listening review.']}
assert report['decodedDuration']==8 and report['decodedClippedSamples']==0
(p/'evidence/encoder-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='ffprobe'},indent=2))
