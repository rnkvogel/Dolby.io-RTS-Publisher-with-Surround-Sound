
(function () {
  'use strict';

  const LAYOUTS = {
    '5.1': {
      inputs: [
        { key: 'input_1', label: 'Input 1', role: 'Front Left', slot: 0, gain: 1 },
        { key: 'input_2', label: 'Input 2', role: 'Front Right', slot: 1, gain: 1 },
        { key: 'input_3', label: 'Input 3', role: 'Front Center', slot: 2, gain: 1 },
        { key: 'input_4', label: 'Input 4', role: 'Rear Left', slot: 4, gain: 1 },
        { key: 'input_5', label: 'Input 5', role: 'Rear Right', slot: 5, gain: 1 },
        { key: 'input_6', label: 'Input 6', role: 'LFE', slot: 3, gain: 1 }
      ],
      busChannels: 6,
      sdp: {
        rtpmap: 'multiopus/48000/6',
        fmtp: 'channel_mapping=0,4,1,2,3,5;coupled_streams=2;minptime=10;num_streams=4;useinbandfec=1'
      }
    },
    '7.1': {
      inputs: [
        { key: 'input_1', label: 'Input 1', role: 'Front Left', slot: 0, gain: 1 },
        { key: 'input_2', label: 'Input 2', role: 'Front Right', slot: 1, gain: 1 },
        { key: 'input_3', label: 'Input 3', role: 'Front Center', slot: 2, gain: 1 },
        { key: 'input_4', label: 'Input 4', role: 'Rear Left', slot: 4, gain: 1 },
        { key: 'input_5', label: 'Input 5', role: 'Rear Right', slot: 5, gain: 1 },
        { key: 'input_6', label: 'Input 6', role: 'LFE', slot: 3, gain: 1 },
        { key: 'input_7', label: 'Input 7', role: 'Left Middle', slot: 6, gain: 0.5 },
        { key: 'input_8', label: 'Input 8', role: 'Right Middle', slot: 7, gain: 0.5 }
      ],
      busChannels: 8,
      sdp: {
        rtpmap: 'multiopus/48000/8',
        fmtp: 'channel_mapping=0,6,1,2,3,4,5,7;coupled_streams=3;minptime=10;num_streams=5;useinbandfec=1'
      }
    }
  };

  const APP = {
    audioContext: null,
    merger: null,
    destination: null,
    channelEntries: new Map(),
    patchInstalled: false,
    currentLayout: null
  };

  function log(...args) {
    console.log('[AUDIOBUS]', ...args);
  }

  function els() {
    return {
      mode: document.getElementById('audioModeSelect'),
      wrap: document.getElementById('audioBusStripWrap'),
      grid: document.getElementById('audioBusStripGrid'),
      refresh: document.getElementById('refreshAudioBusInputsBtn'),
      apply: document.getElementById('applyAudioSettingsBtn'),
      bitrate: document.getElementById('audioBitrateSelect'),
      sampleRate: document.getElementById('audioSampleRateSelect'),
      echo: document.getElementById('audioEchoCancellationToggle'),
      noise: document.getElementById('audioNoiseSuppressionToggle'),
      agc: document.getElementById('audioAutoGainToggle')
    };
  }

  function getMode() {
    return els().mode?.value || 'voice';
  }

  function cleanupAudioGraph() {
    APP.channelEntries.forEach((entry) => {
      if (entry.raf) cancelAnimationFrame(entry.raf);
      try { entry.source?.disconnect?.(); } catch (_) {}
      try { entry.analyser?.disconnect?.(); } catch (_) {}
      try { entry.gainNode?.disconnect?.(); } catch (_) {}
      try { entry.filterNode?.disconnect?.(); } catch (_) {}
      entry.mediaStream?.getTracks?.().forEach((t) => t.stop());
    });
    APP.channelEntries.clear();
    APP.destination = null;
    APP.merger = null;
    APP.audioContext = null;
  }

  function stripTemplate(ch) {
    return `
      <div class="audio-strip" id="strip-${ch.key}">
        <div class="audio-strip-head">
          <div>
            <div class="audio-strip-title">${ch.label}</div>
            <div class="audio-strip-role">${ch.role} • Bus slot ${ch.slot}</div>
          </div>
          <label class="audio-strip-on"><input id="enabled-${ch.key}" type="checkbox" checked> On</label>
        </div>
        <div class="audio-strip-meter-fader">
          <div class="audio-strip-meter"><div class="audio-strip-meter-fill" id="meter-${ch.key}"></div></div>
          <input class="audio-strip-fader" id="gain-${ch.key}" type="range" min="0" max="2" step="0.05" value="${ch.gain}">
          <div class="audio-strip-meta">
            <div><span>State</span><strong id="state-${ch.key}">Idle</strong></div>
            <div><span>Level</span><strong id="level-${ch.key}">0%</strong></div>
            <div><span>Gain</span><strong id="gainRead-${ch.key}">${ch.gain.toFixed(2)}</strong></div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm mute-btn" id="mute-${ch.key}">Mute</button>
        <div>
          <label for="device-${ch.key}">Audio input</label>
          <select id="device-${ch.key}"><option value="">Default audio input</option></select>
        </div>
        <div>
          <label for="filter-${ch.key}">Voice mapping / filter</label>
          <select id="filter-${ch.key}">
            <option value="none" selected>No filter</option>
            <option value="lfe">LFE low-pass</option>
          </select>
        </div>
      </div>
    `;
  }

  async function enumerateInputs(layout) {
    try {
      const temp = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      temp.getTracks().forEach((track) => track.stop());
    } catch (_) {}
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    layout.inputs.forEach((channel) => {
      const select = document.getElementById(`device-${channel.key}`);
      if (!select) return;
      const current = select.value || '';
      select.innerHTML = '<option value="">Default audio input</option>';
      inputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        select.appendChild(option);
      });
      if ([...select.options].some((opt) => opt.value === current)) select.value = current;
    });
  }

  function ensureAudio(layout) {
    if (APP.audioContext) return;
    APP.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    APP.merger = APP.audioContext.createChannelMerger(layout.busChannels);
    APP.destination = APP.audioContext.createMediaStreamDestination();
    try { APP.destination.channelCount = layout.busChannels; } catch (_) {}
    try { APP.destination.channelCountMode = 'explicit'; } catch (_) {}
    try { APP.destination.channelInterpretation = 'speakers'; } catch (_) {}
    try { APP.merger.channelCountMode = 'explicit'; } catch (_) {}
    try { APP.merger.channelInterpretation = 'speakers'; } catch (_) {}
    APP.merger.connect(APP.destination);
  }

  function createFilterNode(channelKey) {
    const mode = document.getElementById(`filter-${channelKey}`)?.value || 'none';
    if (mode !== 'lfe' || !APP.audioContext) return null;
    const biquad = APP.audioContext.createBiquadFilter();
    biquad.type = 'lowpass';
    biquad.frequency.value = 120;
    biquad.Q.value = 0.707;
    return biquad;
  }

  function startMeterLoop(key, analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs((data[i] - 128) / 128));
      const pctValue = Math.max(3, Math.min(100, Math.round(peak * 220)));
      const pct = `${pctValue}%`;
      const meter = document.getElementById(`meter-${key}`);
      if (meter) meter.style.height = pct;
      const level = document.getElementById(`level-${key}`);
      if (level) level.textContent = pct;
      const entry = APP.channelEntries.get(key);
      if (entry) entry.raf = requestAnimationFrame(update);
    };
    update();
  }

  function installMultiOpusMunging(layout) {
    APP.currentLayout = layout;
    if (APP.patchInstalled) return;
    const NativePC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!NativePC) throw new Error('RTCPeerConnection not available');

    class PatchedRTCPeerConnection extends NativePC {
      async setLocalDescription(description) {
        if (description && description.type === 'offer' && description.sdp && APP.currentLayout?.sdp) {
          const payloadMatch = description.sdp.match(/^a=rtpmap:(\d+) opus\/48000\/2$/mi);
          if (!payloadMatch) return super.setLocalDescription(description);
          const pt = payloadMatch[1];
          let next = description.sdp.replace(
            new RegExp(`^a=rtpmap:${pt} opus/48000/2$`, 'mi'),
            `a=rtpmap:${pt} ${APP.currentLayout.sdp.rtpmap}`
          );
          const fmtpRegex = new RegExp(`^a=fmtp:${pt} .*?$`, 'mi');
          const multiopusFmtp = `a=fmtp:${pt} ${APP.currentLayout.sdp.fmtp}`;
          if (fmtpRegex.test(next)) next = next.replace(fmtpRegex, multiopusFmtp);
          else next = next.replace(
            new RegExp(`^a=rtpmap:${pt} ${APP.currentLayout.sdp.rtpmap.replace('/', '\\/')}$`, 'mi'),
            `a=rtpmap:${pt} ${APP.currentLayout.sdp.rtpmap}\r\n${multiopusFmtp}`
          );
          const preview = document.getElementById('sdpPreview');
          if (preview) preview.value = next;
          log('Local SDP munged', { layout: APP.currentLayout.sdp.rtpmap, fmtp: APP.currentLayout.sdp.fmtp });
          return super.setLocalDescription({ type: description.type, sdp: next });
        }
        return super.setLocalDescription(description);
      }
    }

    window.RTCPeerConnection = PatchedRTCPeerConnection;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PatchedRTCPeerConnection;
    APP.patchInstalled = true;
  }

  async function prepareBusForPublish() {
    const mode = getMode();
    if (!LAYOUTS[mode]) return { active: false, reason: 'not-multiopus-mode' };

    const layout = LAYOUTS[mode];
    cleanupAudioGraph();
    ensureAudio(layout);
    await APP.audioContext.resume();
    installMultiOpusMunging(layout);

    const e = els();
    const cleanupOn = !!(e.echo?.checked || e.noise?.checked || e.agc?.checked);
    const sampleRate = parseInt(e.sampleRate?.value || '48000', 10);

    let activeCount = 0;
    for (const channel of layout.inputs) {
      if (!document.getElementById(`enabled-${channel.key}`)?.checked) {
        const state = document.getElementById(`state-${channel.key}`);
        if (state) state.textContent = 'Disabled';
        continue;
      }

      const deviceId = (document.getElementById(`device-${channel.key}`)?.value || '').trim();
      const constraints = {
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: sampleRate },
          latency: { ideal: 0.02 },
          echoCancellation: cleanupOn,
          noiseSuppression: cleanupOn,
          autoGainControl: cleanupOn
        },
        video: false
      };
      if (deviceId) constraints.audio.deviceId = { exact: deviceId };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = mediaStream.getAudioTracks()[0];
      if (track) track.contentHint = 'music';

      const source = APP.audioContext.createMediaStreamSource(mediaStream);
      const analyser = APP.audioContext.createAnalyser();
      const gainNode = APP.audioContext.createGain();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      gainNode.gain.value = Number(document.getElementById(`gain-${channel.key}`)?.value || channel.gain);

      source.connect(analyser);
      analyser.connect(gainNode);

      const filterNode = createFilterNode(channel.key);
      if (filterNode) {
        gainNode.connect(filterNode);
        filterNode.connect(APP.merger, 0, channel.slot);
      } else {
        gainNode.connect(APP.merger, 0, channel.slot);
      }

      const entry = { key: channel.key, mediaStream, track, source, analyser, gainNode, filterNode, muted: false, raf: null };
      APP.channelEntries.set(channel.key, entry);
      startMeterLoop(channel.key, analyser);

      const gainEl = document.getElementById(`gain-${channel.key}`);
      const gainRead = document.getElementById(`gainRead-${channel.key}`);
      const muteBtn = document.getElementById(`mute-${channel.key}`);
      const state = document.getElementById(`state-${channel.key}`);

      gainEl?.addEventListener('input', () => {
        const val = Number(gainEl.value || channel.gain);
        if (gainRead) gainRead.textContent = val.toFixed(2);
        if (!entry.muted) entry.gainNode.gain.value = val;
      });

      muteBtn?.addEventListener('click', () => {
        entry.muted = !entry.muted;
        entry.gainNode.gain.value = entry.muted ? 0 : Number(gainEl?.value || channel.gain);
        muteBtn.textContent = entry.muted ? 'Unmute' : 'Mute';
        if (state) state.textContent = entry.muted ? 'Muted' : 'Live';
      });

      if (state) state.textContent = 'Live';
      activeCount += 1;
    }

    const busTrack = APP.destination.stream.getAudioTracks()[0];
    if (!busTrack) throw new Error('No bus track created');
    await window.__setPublisherAudioTrack?.(busTrack);

    const bitrate = parseInt(e.bitrate?.value || '128', 10);
    try { await window.__applyPublisherAudioSenderBitrate?.(bitrate); } catch (_) {}
    log('Bus prepared before publish', { mode, activeCount, busChannels: layout.busChannels });
    return { active: true, mode, activeCount, busChannels: layout.busChannels };
  }

  async function renderBus() {
    const e = els();
    const mode = getMode();
    if (!e.wrap || !e.grid) return;

    if (!LAYOUTS[mode]) {
      e.grid.innerHTML = '';
      e.wrap.classList.add('hidden');
      return;
    }

    const layout = LAYOUTS[mode];
    e.grid.innerHTML = layout.inputs.map(stripTemplate).join('');
    e.wrap.classList.remove('hidden');

    const channelCount = document.getElementById('audioChannelCountSelect');
    if (channelCount) channelCount.value = String(layout.busChannels);
    if (e.echo) e.echo.checked = false;
    if (e.noise) e.noise.checked = false;
    if (e.agc) e.agc.checked = false;

    await enumerateInputs(layout);
  }

  function wire() {
    const e = els();
    e.mode?.addEventListener('change', async () => { await renderBus(); });
    e.refresh?.addEventListener('click', async () => { await renderBus(); });
    e.apply?.addEventListener('click', async () => {
      const mode = getMode();
      if (LAYOUTS[mode]) {
        try {
          await prepareBusForPublish();
        } catch (err) {
          console.error('[AUDIOBUS] apply failed', err);
        }
      }
    });

    window.__prepareMultiOpusForPublish = prepareBusForPublish;
    renderBus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();
