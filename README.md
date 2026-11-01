# WatchParty — смотреть видео вместе

Комнаты с синхронным просмотром и чатом. Источники: каталог, YouTube, прямые ссылки `.mp4` и HLS `.m3u8`.

## Запуск
```bash
npm install
node server.js      # http://localhost:3000
```

## Структура
- `server.js` — Express + Socket.IO: REST API (`/api/catalog`, `/api/rooms`) и синхронизация комнат.
- `data/catalog.json` — каталог фильмов (сейчас открытые фильмы Blender Foundation, CC BY).
- `public/` — сайт: главная с каталогом, комната (`room.html` + `room.js`), навигация с пульта (`tvnav.js`).

## Как добавить фильм
Добавьте объект в `data/catalog.json`: `title`, `poster`, `source: { type: "file" | "hls" | "youtube", url }`.
Добавляйте только контент, на который у вас есть права: свой, лицензированный, CC/public domain или официальные встраиваемые плееры.

## План ТВ-приложения
Сайт уже сделан «TV-ready»: крупные карточки, фокус и навигация стрелками пульта.
1. **Android TV / Google TV**: обёртка WebView (или Capacitor) с `LEANBACK_LAUNCHER`, внутри — этот сайт. Позже — нативный ExoPlayer.
2. **Samsung Tizen** и **LG webOS**: это веб-платформы, тот же HTML/JS упаковывается в `.wgt` / `.ipk`.
3. Общий бэкенд и API — у всех клиентов один (`/api/*` + Socket.IO).
