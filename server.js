const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { customAlphabet } = require('nanoid');

const catalog = require('./data/catalog.json');
const newId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 8);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- REST API (пригодится и сайту, и будущему ТВ-приложению) ----
app.get('/api/catalog', (req, res) => res.json(catalog));

const rooms = new Map(); // roomId -> { source, title, playing, time, updatedAt, users: Map }

function parseSource(input) {
  if (!input) return null;
  if (input.type && input.url) return input;
  try {
    const u = new URL(input);
    const yt = u.hostname.includes('youtu.be')
      ? u.pathname.slice(1)
      : u.hostname.includes('youtube.com') ? u.searchParams.get('v') : null;
    if (yt) return { type: 'youtube', url: yt };
    if (u.pathname.endsWith('.m3u8')) return { type: 'hls', url: input };
    return { type: 'file', url: input };
  } catch { return null; }
}

app.post('/api/rooms', (req, res) => {
  const { movieId, url } = req.body || {};
  const movie = catalog.find((m) => m.id === movieId);
  const source = movie ? movie.source : parseSource(url);
  if (!source) return res.status(400).json({ error: 'Нужен фильм из каталога или ссылка на видео' });
  const id = newId();
  rooms.set(id, {
    source, title: movie ? movie.title : 'Видео по ссылке',
    playing: false, time: 0, updatedAt: Date.now(), users: new Map(), host: null,
  });
  res.json({ id });
});

app.get('/api/rooms/:id', (req, res) => {
  const r = rooms.get(req.params.id);
  r ? res.json(publicState(r)) : res.status(404).json({ error: 'Комната не найдена' });
});

function publicState(r) {
  return { source: r.source, title: r.title, playing: r.playing, time: r.time,
           updatedAt: r.updatedAt, users: [...r.users.values()], host: r.host };
}

// ---- Реалтайм: синхронизация и чат ----
io.on('connection', (socket) => {
  socket.on('join', ({ roomId, name }, ack) => {
    const room = rooms.get(roomId);
    if (!room) return ack?.({ error: 'Комната не найдена' });
    name = String(name || 'Гость').slice(0, 24);
    socket.data = { roomId, name };
    socket.join(roomId);
    room.users.set(socket.id, name);
    if (!room.host) room.host = socket.id;
    ack?.({ ok: true, me: socket.id, state: publicState(room), serverNow: Date.now() });
    io.to(roomId).emit('users', { users: [...room.users.values()], host: room.host });
    io.to(roomId).emit('chat', { system: true, text: `${name} присоединился` });
  });

  socket.on('control', (s) => {
    const room = rooms.get(socket.data?.roomId);
    if (!room) return;
    if (typeof s.playing === 'boolean') room.playing = s.playing;
    if (Number.isFinite(s.time)) room.time = Math.max(0, s.time);
    if (s.url) {
      const src = parseSource(s.url);
      if (!src) return;
      room.source = src; room.title = 'Видео по ссылке'; room.time = 0; room.playing = true;
    }
    room.updatedAt = Date.now();
    io.to(socket.data.roomId).emit('state', { ...publicState(room), by: socket.id });
  });

  socket.on('chat', (text) => {
    const { roomId, name } = socket.data || {};
    text = String(text || '').trim().slice(0, 500);
    if (roomId && text) io.to(roomId).emit('chat', { name, text, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const { roomId, name } = socket.data || {};
    const room = rooms.get(roomId);
    if (!room) return;
    room.users.delete(socket.id);
    if (room.host === socket.id) room.host = room.users.keys().next().value || null;
    io.to(roomId).emit('users', { users: [...room.users.values()], host: room.host });
    io.to(roomId).emit('chat', { system: true, text: `${name} вышел` });
    if (room.users.size === 0) setTimeout(() => room.users.size === 0 && rooms.delete(roomId), 10 * 60 * 1000);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`WatchParty: http://localhost:${PORT}`));
