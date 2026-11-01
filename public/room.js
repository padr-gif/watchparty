const $ = (id) => document.getElementById(id);
const roomId = new URLSearchParams(location.search).get('id');
const socket = io();

let name = localStorage.getItem('wp_name');
if (!name) { name = prompt('Ваше имя?') || 'Гость'; localStorage.setItem('wp_name', name); }

let me = null, clockOffset = 0, player = null, currentSrc = null, applyingRemote = false;

// ---------- Плееры: единый интерфейс play/pause/seek/getTime ----------
function makeVideoPlayer(src) {
  const v = document.createElement('video');
  v.controls = true; v.playsInline = true;
  $('stage').replaceChildren(v);
  if (src.type === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl') && window.Hls?.isSupported()) {
    const hls = new Hls(); hls.loadSource(src.url); hls.attachMedia(v);
  } else v.src = src.url;
  ['play', 'pause', 'seeked'].forEach((ev) => v.addEventListener(ev, () => onLocalChange()));
  return {
    play: () => v.play().catch(() => toast('Нажмите ▶ чтобы начать')),
    pause: () => v.pause(),
    seek: (t) => { v.currentTime = t; },
    getTime: () => v.currentTime,
    isPlaying: () => !v.paused,
    destroy: () => v.remove(),
  };
}

let ytReady = new Promise((res) => { window.onYouTubeIframeAPIReady = res; });
function loadYT() {
  if (window.YT?.Player) return Promise.resolve();
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s); return ytReady;
}
async function makeYouTubePlayer(src) {
  await loadYT();
  const div = document.createElement('div'); div.id = 'yt';
  $('stage').replaceChildren(div);
  return new Promise((resolve) => {
    const p = new YT.Player('yt', {
      videoId: src.url, playerVars: { rel: 0 },
      events: {
        onReady: () => resolve({
          play: () => p.playVideo(), pause: () => p.pauseVideo(),
          seek: (t) => p.seekTo(t, true), getTime: () => p.getCurrentTime(),
          isPlaying: () => p.getPlayerState() === YT.PlayerState.PLAYING,
          destroy: () => p.destroy(),
        }),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) onLocalChange();
        },
      },
    });
  });
}

// ---------- Синхронизация ----------
const serverNow = () => Date.now() + clockOffset;
const expectedTime = (s) => (s.playing ? s.time + (serverNow() - s.updatedAt) / 1000 : s.time);
let lastState = null;

async function applyState(s) {
  lastState = s;
  $('title').textContent = s.title;
  applyingRemote = true;
  if (!currentSrc || currentSrc.url !== s.source.url) {
    player?.destroy();
    currentSrc = s.source;
    player = s.source.type === 'youtube' ? await makeYouTubePlayer(s.source) : makeVideoPlayer(s.source);
  }
  const t = expectedTime(s);
  if (Math.abs(player.getTime() - t) > 1) player.seek(t);
  s.playing ? player.play() : player.pause();
  setTimeout(() => { applyingRemote = false; }, 600);
}

function onLocalChange() {
  if (applyingRemote || !player) return;
  socket.emit('control', { playing: player.isPlaying(), time: player.getTime() });
}

// Периодическая подстройка, если кто-то «уехал» больше чем на 2 секунды
setInterval(() => {
  if (!player || !lastState || applyingRemote || !lastState.playing) return;
  if (Math.abs(player.getTime() - expectedTime(lastState)) > 2) { applyingRemote = true; player.seek(expectedTime(lastState)); setTimeout(() => applyingRemote = false, 600); }
}, 3000);

socket.on('connect', () => {
  const sent = Date.now();
  socket.emit('join', { roomId, name }, (res) => {
    if (res.error) { $('stage').textContent = res.error; return; }
    me = res.me;
    clockOffset = res.serverNow - (sent + Date.now()) / 2;
    applyState(res.state);
  });
});
socket.on('state', (s) => { if (s.by !== me || s.source.url !== currentSrc?.url) applyState(s); else lastState = s; });
socket.on('users', ({ users }) => { $('users').textContent = `В комнате (${users.length}): ${users.join(', ')}`; });

// ---------- Чат ----------
socket.on('chat', (m) => {
  const d = document.createElement('div');
  d.className = 'msg' + (m.system ? ' system' : '');
  if (m.system) d.textContent = m.text;
  else { const b = document.createElement('b'); b.textContent = m.name + ': '; d.append(b, m.text); }
  $('chat').appendChild(d); $('chat').scrollTop = $('chat').scrollHeight;
});
const sendMsg = () => { socket.emit('chat', $('msg').value); $('msg').value = ''; };
$('send').onclick = sendMsg;
$('msg').onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };
$('setUrl').onclick = () => { socket.emit('control', { url: $('url').value.trim() }); $('url').value = ''; };
$('copy').onclick = () => navigator.clipboard.writeText(location.href).then(() => toast('Ссылка скопирована'));

function toast(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
}
