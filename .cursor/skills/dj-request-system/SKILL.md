---
name: dj-request-system
description: Remiks İstanbul DJ İstek Sistemi geliştirme skill'i. Canlı etkinliklerde QR kod ile şarkı isteği, oylama, DJ yönetim paneli ve LED display ekranı. Use when building, debugging, or extending the DJ request system.
---

# DJ İstek Sistemi - Geliştirme Rehberi

## Sistem Mimarisi

```
[Katılımcı Telefonu] → QR → /request (React)
                              ↕ Socket.io
                        [Express Sunucu]
                         ↕           ↕
              [DJ Panel /dj]    [Display /display]
                         ↕
                    [SQLite DB]
```

## Veritabanı Şeması

```sql
-- Etkinlikler
events (id, name, slug, status, created_at)
-- status: waiting | active | paused | ended

-- İstekler
requests (id, event_id, song_name, artist, album_art, spotify_id, device_id, votes, status, created_at)
-- status: pending | approved | playing | played | rejected

-- Oylar
votes (id, request_id, device_id, created_at)
-- device_id: localStorage UUID ile takip
```

## Socket.io Events

```
Client → Server:
  new-request      {eventSlug, songName, artist, albumArt, spotifyId, deviceId}
  vote             {requestId, deviceId}
  join-event       {eventSlug, role: 'audience'|'dj'|'display'}

Server → Client:
  request-added    {request}
  vote-updated     {requestId, votes}
  list-reordered   {requests[]}
  now-playing      {request}
  event-status     {status, countdown?}
  request-rejected {requestId}
```

## DJ Panel Aksiyonları
- Etkinlik oluştur/başlat/duraklat/bitir
- Geri sayım başlat (X dakika)
- İstek onayla/reddet/sıraya al
- "Şimdi Çalıyor" işaretle
- İstek almayı aç/kapat
- **Dil değiştir (TR/EN)** → tek tuşla tüm ekranlar anlık değişir

## i18n (Çoklu Dil) Sistemi
- DJ panelinde TR/EN toggle butonu
- Dil değiştiğinde Socket.io ile `language-changed {lang}` event yayınlanır
- Tüm bağlı ekranlar (request, display) anlık güncellenir
- Şarkı adları ve sanatçı isimleri çevrilMEZ (orijinal kalır)
- Sadece arayüz metinleri çevrilir (butonlar, başlıklar, placeholder'lar)
- Dil dosyaları: `client/src/i18n/tr.json` ve `client/src/i18n/en.json`

## Display Durumları
1. **waiting** → Logo + "Yakında başlıyor" + QR kod
2. **countdown** → Geri sayım timer + QR kod
3. **active** → Hot Requests listesi + Şimdi Çalıyor + QR
4. **paused** → Mola ekranı + QR kod
5. **ended** → Teşekkür + confetti

## Spotify API Kullanımı
- Client Credentials Flow (sunucu tarafında)
- `/v1/search?q={query}&type=track&limit=5`
- Kapak fotoğrafı: `track.album.images[1].url` (300x300)
- Rate limit: 100 req/min (yeterli)
