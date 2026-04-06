Dolby.io Real Time Streaming MultiOpus Audio Video Publisher for Surround Sound.
Includes Media Setting Options to control and improve your video in real time.
Connect multiple mics or your DAW to create immersive audio and visual experiences. 


[DEMO THIS](https://rnkvogel.github.io/Dolby.io-RTS-Publisher-with-Surround-Sound/)

Audio Bus includes Dolby.io/Millicast streams with MultiOpus (5.1 / 7.1) support.
Additional Audio options includes audio enhancements.

Features
🎧 MultiOpus audio playback (5.1 / 7.1)
📊 Real-time audio visualizer per track
<img width="1518" height="453" alt="Screenshot 2026-04-06 at 10 13 37 AM" src="https://github.com/user-attachments/assets/e8c40a52-f5ae-4ac8-9add-f2ff33057387" />

Media Settings

<img width="278" height="414" alt="Screenshot 2026-04-06 at 10 15 24 AM" src="https://github.com/user-attachments/assets/ebdf4554-a308-431e-bd79-2397c9189720" />

Publishing Stats

<img width="300" height="284" alt="Screenshot 2026-04-06 at 10 17 08 AM" src="https://github.com/user-attachments/assets/ef4587cf-aabd-4116-9d9b-84e17e647f15" />

This publisher includes many of the Advanced Publishing Feature Set but more suited for the audio enthuasiast. 

<img width="47" height="52" alt="Screenshot 2026-04-06 at 10 25 21 AM" src="https://github.com/user-attachments/assets/63674149-219a-4fd0-9399-df65a7ac5dda" />

Share Icon for Direct Millicast Viewer connection 

Select the Cog on the viewer to validate MultiOpus.

<img width="498" height="31" alt="Screenshot 2026-04-06 at 10 29 16 AM" src="https://github.com/user-attachments/assets/4954676f-77b2-4560-be3e-0d42d7252c49" />

Prerequisites
Account & Stream Setup
A valid Dolby.io (Millicast) Account ID
A valid Stream Name

Combined format:

streamAccountId/streamName

Track events
Connection state changes
SDP snippet (first ~1800 chars)
Receiver stats (codec, channels, payload, etc.)
Verification (Critical for MultiOpus)

Open:

chrome://webrtc-internals

Look for:

Expected (SUCCESS)
codec: audio/multiopus
channels: 6 (or 8)
If you see:
codec: opus
stereo=1

Chrome may downmix audio. 





