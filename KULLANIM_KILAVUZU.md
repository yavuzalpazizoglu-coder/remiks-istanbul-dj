# RemiksBox - Kullanım Kılavuzu

> **Remiks İstanbul DJ İstek & Oylama Sistemi**
> Sürüm: 1.0 | Tarih: Mart 2026

---

## İçindekiler

1. [Sistem Genel Bakış](#1-sistem-genel-bakış)
2. [DJ Paneline Giriş](#2-dj-paneline-giriş)
3. [Etkinlik Oluşturma](#3-etkinlik-oluşturma)
4. [DJ Panel Kontrolleri](#4-dj-panel-kontrolleri)
5. [Misafir İstek Sayfası](#5-misafir-istek-sayfası)
6. [Display Ekranı (LED/Sahne)](#6-display-ekranı)
7. [Açılış & Kapanış Animasyonları](#7-açılış--kapanış-animasyonları)
8. [Müzik Modları](#8-müzik-modları)
9. [DJ Fotoğrafları](#9-dj-fotoğrafları)
10. [Tema & Efekt Ayarları](#10-tema--efekt-ayarları)
11. [Etkinlik Akış Senaryosu](#11-etkinlik-akış-senaryosu)
12. [Sorun Giderme](#12-sorun-giderme)

---

## 1. Sistem Genel Bakış

RemiksBox, canlı etkinliklerde misafirlerin QR kod ile şarkı istemesini, oylama yapmasını ve DJ'in bu istekleri yönetmesini sağlayan bir sistemdir.

### Sistem Mimarisi

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Misafir Telefon │     │   DJ Panel       │     │  Display Ekranı │
│  (İstek & Oyla)  │◄───►│   (Yönetim)      │◄───►│  (LED/Projector) │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────┬───────┘─────────────────────────┘
                         │
                  ┌──────┴──────┐
                  │   Sunucu    │
                  │  (Railway)  │
                  └─────────────┘
```

### Sayfa Adresleri

| Sayfa | Adres |
|-------|-------|
| DJ Panel | `www.remiksistanbul.com/dj` |
| Display Ekranı | `www.remiksistanbul.com/display/ETKINLIK-KODU` |
| İstek Sayfası | `www.remiksistanbul.com/request/ETKINLIK-KODU` |

---

## 2. DJ Paneline Giriş

**Adres:** `www.remiksistanbul.com/dj`

### Giriş Ekranı

![DJ Panel Giriş Ekranı](assets/guide-01-login.png)

Giriş ekranında iki seçenek bulunur:

**A) Yeni Etkinlik Oluştur:**
1. "Etkinlik Adı" alanına etkinlik ismini yazın (örn: "TİHUD Kış Okulu 2026")
2. "DJ Şifresi" alanına şifrenizi girin
3. "Oluştur" butonuna basın

**B) Mevcut Etkinliğe Bağlan:**
1. Alt kısımdaki "Etkinlik kodu girin" alanına etkinlik kodunu yazın
2. "Bağlan" butonuna basın

> **Not:** Geçmiş etkinliklerinizi görmek için şifreyi girdikten sonra "Geçmiş Etkinlikleri Getir" butonunu kullanabilirsiniz.

---

## 3. Etkinlik Oluşturma

Etkinlik oluşturulduğunda sistem otomatik olarak:
- Benzersiz bir etkinlik kodu üretir (örn: `tihud-kis-okulu-2026`)
- QR kod oluşturur
- Display ve İstek sayfası linklerini hazırlar

### Etkinlik Durumları

| Durum | Açıklama |
|-------|----------|
| **Bekliyor** | Etkinlik oluşturuldu, istekler henüz açılmadı |
| **Geri Sayım** | İsteklerin açılmasına geri sayım başladı |
| **Aktif** | İstekler açık, misafirler şarkı isteyebilir |
| **Duraklatıldı** | İstekler geçici olarak durduruldu |
| **Bitti** | Etkinlik sonlandırıldı |

---

## 4. DJ Panel Kontrolleri

![DJ Panel Kontrol Ekranı](assets/guide-02-djpanel.png)

### 4.1 Üst Bar (Header)

Soldan sağa:
- **RemiksBox** logosu
- **Etkinlik adı** ve kodu
- **Dil değiştirme** (TR/EN) - tüm ekranları etkiler
- **Durum göstergesi** (Aktif, Bekliyor, vb.)

### 4.2 Kontrol Çubuğu

**Butonlar:**
- ▶ **İstekleri Başlat** - istekleri açar
- ⏸ **Duraklat** - istekleri geçici durdurur
- ⏹ **Etkinliği Bitir** - etkinliği sonlandırır

**Geri Sayım:**
- Süre presetleri: 5, 10, 15, 30 dakika veya özel süre
- ⏱ **Başlat** butonu ile geri sayım başlatılır
- Misafirler ekranda geri sayımı görür

**İstatistikler:**
- **Bekleyen** (turuncu) - onay bekleyen istek sayısı
- **Onaylı** (yeşil) - ekranda görünen istek sayısı
- **Oy** - toplam oy sayısı

**Hızlı Erişim:**
- 🔗 Link kopyala
- 📱 QR kod göster
- 🖥️ Display ekranını aç

### 4.3 İstek Listesi (Ön Kabul Sistemi)

Misafirlerden gelen istekler **önce DJ paneline** düşer. Misafirler onaylanana kadar göremez.

**Bekleyen İstekler** (turuncu sol kenarlı):
- ✓ **Onayla** - şarkıyı kabul et, ekranda göster
- ✕ **Reddet** - şarkıyı sil, kimse görmez

**Onaylanan İstekler** (normal görünüm):
- ♫ **Çalındı** - şarkı çalındığında bas (ateş efekti başlar)
- ✕ **Reddet** - listeden kaldır

**Kişi Başı Limit:**
- Sağ üstten 1 veya 2 olarak ayarlanabilir
- Her misafir bu kadar istek gönderebilir

### 4.4 Çalındı Efekti (Ateş Animasyonu)

![Ateş Efekti](assets/guide-08-fire-effect.png)

♫ butonuna basıldığında:
1. **0-35 saniye:** Şarkı satırı ateş çerçevesiyle yanar
2. **35-40 saniye:** Ateş yoğunlaşır, tüm satırı yakarak yok eder
3. Şarkı listeden kaybolur

---

## 5. Misafir İstek Sayfası

**Adres:** `www.remiksistanbul.com/request/ETKINLIK-KODU`

Misafirler bu sayfaya sahne arkasındaki QR kodu okutarak ulaşır.

![Misafir İstek Sayfası](assets/guide-03-request-page.png)

### 5.1 Tab Yapısı

Sayfanın üstünde iki sekme bulunur:

**🎵 İstek Gönder:**
- Spotify araması ile şarkı bulma
- Manuel şarkı adı ve sanatçı girişi
- Gönder butonu

**🔥 Oylama:**
- Onaylanmış şarkıların listesi
- ▲ butonuyla oy verme
- Canlı sıralama (oylar arttıkça liste değişir)

### 5.2 Spotify Araması

1. Arama kutusuna şarkı adı veya sanatçı yazın
2. Sonuçlardan şarkıyı seçin (albüm kapağı görünür)
3. "Gönder" butonuna basın

### 5.3 Manuel Giriş

1. "Veya elle yazın" kısmına tıklayın
2. Şarkı adı ve sanatçı bilgisini girin
3. "Gönder" butonuna basın

> **Not:** Misafirler sadece onaylanmış şarkıları görebilir ve oylayabilir.

---

## 6. Display Ekranı

**Adres:** `www.remiksistanbul.com/display/ETKINLIK-KODU`

Bu sayfa sahne arkasındaki LED ekran veya projektörde tam ekran açılır.

![Display Ekranı](assets/guide-04-display.png)

### 6.1 Ekran Düzeni

```
┌──────────────────────────────────────────────────┐
│              Remiks İstanbul Logosu               │
│              Etkinlik Adı + Motto                 │
│  ════════ Kayan Yazı Ticker'ı ═══════════════    │
├──────────────┬──────────────┬────────────────────┤
│              │              │                     │
│  İstek       │   Disko      │   QR Kod            │
│  Listesi     │   Topu       │   Kutusu            │
│  (Sol %30)   │   (Orta)     │   (Sağ %30)         │
│              │              │                     │
│  1. Şarkı    │              │   [QR KOD]          │
│  2. Şarkı    │              │   Telefonunuzla     │
│  3. Şarkı    │              │   okutun            │
│  ...         │              │                     │
│              │              │                     │
└──────────────┴──────────────┴────────────────────┘
```

### 6.2 İstek Listesi

- İlk 10 şarkı gösterilir
- İlk 3 sıra vurgulanır (büyük font)
- Oylama ile canlı sıralama değişir
- Çalınan şarkılar ateş efektiyle kaybolur

### 6.3 Kayan Yazı (Ticker)

- İstek yokken özel mesajlar gösterir
- DJ panelinden düzenlenebilir (her satıra bir mesaj)
- Sürekli ekranda akar

---

## 7. Açılış & Kapanış Animasyonları

![Açılış Animasyonu](assets/guide-05-opening.png)

### Kontrol

DJ panelindeki kontrol çubuğunda:
- 🎉 **Açılış** butonu - açılış animasyonunu başlatır
- ✨ **Kapanış** butonu - kapanış animasyonunu başlatır
- **Süre ayarı:** 5, 10, 15, 30 dakika veya özel süre

### Kullanım

1. Süre presetinden istediğiniz süreyi seçin
2. "Açılış" veya "Kapanış" butonuna basın
3. Display ekranında tam ekran animasyon başlar
4. Süre dolunca otomatik kapanır
5. Manuel kapatmak için butona tekrar basın

### Görünüm

- **Açılış:** "AÇILIŞ" yazısı + Remiks İstanbul logosu + spot ışıkları + kıvılcımlar
- **Kapanış:** "KAPANIŞ" yazısı + Remiks İstanbul logosu + yıldız efektleri

---

## 8. Müzik Modları

![Müzik Modu Overlay](assets/guide-06-music-mode.png)

7 farklı müzik modu bulunur. Her mod Display ekranında özel bir tam ekran overlay gösterir.

| Mod | Açıklama |
|-----|----------|
| 🎻 Remiks Arabesk Mode | Sıcak arabesk havası |
| 🎸 Remiks Rock | Enerjik rock vibes |
| 💿 90'lar Türkçe Pop | Retro nostaji |
| 🌹 Remiks Turkish Delight | Zarif Türk müziği |
| 🎧 Remiks Tech | Elektronik/tech enerji |
| 💃 Remiks Latino | Ritmik latin havası |
| 🎤 Remiks Rap | Hip-hop/rap atmosferi |

### Kullanım

1. DJ panelinde müzik modu butonuna tıklayın
2. Display ekranında mod overlay'i belirir (özel görsel + yanıp sönen çerçeve)
3. Kapatmak için aynı butona tekrar tıklayın
4. Aktif mod yeşil renkte yanıp söner

---

## 9. DJ Fotoğrafları

Müzik modlarıyla birlikte DJ fotoğrafları gösterilebilir.

### Kullanım

1. Müzik modu bölümündeki "📸 DJ Fotoğrafları" kısmından DJ'leri seçin
2. **DJ Derin** ve/veya **DJ Alp** butonlarına tıklayın (yeşil yanar)
3. Bir müzik modunu aktif edin
4. Display ekranında mod görseli + DJ fotoğrafları sol ve sağda görünür

### Display'de Görünüm

- Fotoğraflar ekranın sol ve sağ ortasında yuvarlak çerçevede
- Neon glow efekti ile
- **LIVE** badge'i (yanıp sönen kırmızı ışık)
- Altında DJ ismi

---

## 10. Tema & Efekt Ayarları

![Tema & Efekt Ayarları](assets/guide-09-settings.png)

### 10.1 Tema Renkleri

DJ panelindeki 🎨 Tema bölümünden Display ekranının renk temasını değiştirebilirsiniz:

| Renk | Kod |
|------|-----|
| Cyan | Varsayılan mavi-turkuaz |
| Mor | Mor tonları |
| Pembe | Pembe/magenta |
| Yeşil | Neon yeşil |
| Turuncu | Sıcak turuncu |
| Kırmızı | Kırmızı tonları |

### 10.2 Animasyon Yoğunluğu

✨ Efekt bölümünden 3 seviye seçilebilir:

| Seviye | Açıklama |
|--------|----------|
| **Düşük** | Hafif ambient glow efekti |
| **Orta** | Neon küreler (orbs) animasyonu |
| **Yüksek** | Tam disko atmosferi (parçacıklar + ışık hüzmeleri) |

### 10.3 Ekran Yazısı & Kayan Yazılar

- **📺 Ekran Yazısı:** Etkinlik adını değiştirir (Display üst kısmı)
- **📜 Kayan Yazılar:** Her satıra bir mesaj yazın, ticker'da dönüşümlü akar
  - Örnek: "Remiks İstanbul'a hoş geldiniz!"
  - Örnek: "Şarkı isteğinizi QR kodla gönderin!"

---

## 11. Etkinlik Akış Senaryosu

Tipik bir etkinlik gecesinin adım adım akışı:

![Etkinlik Akış Şeması](assets/guide-07-flow.png)

### Hazırlık (Etkinlik Öncesi)

1. `www.remiksistanbul.com/dj` adresinden giriş yapın
2. Etkinlik oluşturun (isim + şifre)
3. Display ekranını LED ekranda tam ekran açın
4. Ekran yazısını ve kayan yazıları ayarlayın
5. Tema rengini ve animasyon seviyesini seçin

### Açılış

6. **🎉 Açılış** butonuna basın (süre: 10-15 dk)
7. LED ekranda açılış animasyonu görünür
8. DJ setine başlayın

### İstekleri Açma

9. Açılış bitince **▶ İstekleri Başlat** butonuna basın
10. Veya geri sayım ile başlatın (5-10 dk)
11. Misafirler QR kodu okutarak istek göndermeye başlar

### İstekleri Yönetme

12. Gelen istekler DJ panelinde **turuncu** olarak belirir (bekleyen)
13. ✓ ile **onaylayın** → ekranda görünür, oylama başlar
14. ✕ ile **reddedin** → kimse görmez
15. Uygun zamanda ♫ ile **çalındı** işaretleyin → ateş efekti

### Müzik Modları

16. Çalacağınız türe göre müzik modunu aktif edin
17. İsterseniz DJ fotoğraflarını ekleyin
18. Şarkı bitince modu kapatın

### Kapanış

19. **⏹ Etkinliği Bitir** butonuna basın
20. **✨ Kapanış** animasyonunu başlatın
21. LED ekranda kapanış görseli görünür

---

## 12. Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| QR kod çalışmıyor | Display ekranını yenileyin, internet bağlantısını kontrol edin |
| İstekler ekranda görünmüyor | DJ panelinden ✓ ile onayladığınızdan emin olun |
| Bağlantı kesildi uyarısı | İnternet bağlantısını kontrol edin, sayfa otomatik yeniden bağlanır |
| Display ekranı boş | Etkinlik kodunu kontrol edin, sayfayı yenileyin |
| Spotify araması çalışmıyor | Railway'de Spotify env değişkenlerini kontrol edin |

### Teknik Bilgiler

- **Sunucu:** Railway.app
- **Domain:** www.remiksistanbul.com
- **Veritabanı:** SQLite (Railway Volume ile kalıcı)
- **Gerçek zamanlı:** Socket.io

---

> **RemiksBox** - Remiks İstanbul
> İstek · Oyla · Dans Et
