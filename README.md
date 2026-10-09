# Öğrenci Takip (telefon sürümü)

Öğretmenin öğrencilerini telefonundan takip ettiği, **tek başına çalışan** web uygulaması.

- Sunucu yoktur. Bütün kayıtlar yalnızca uygulamanın açıldığı cihazda (tarayıcının IndexedDB deposunda) durur, hiçbir yere gönderilmez.
- İlk açılıştan sonra internet olmadan çalışır (`sw.js` dosyaları cihaza kaydeder).
- Bu adreste yalnızca boş uygulama bulunur; adresi açan herkes kendi boş kopyasını görür.

## iPhone'da kurulum
1. Adresi **Safari** ile açın.
2. Alttaki **Paylaş** düğmesi → **Ana Ekrana Ekle** → **Ekle**.
3. Bundan sonra uygulamayı hep ana ekrandaki simgeden açın. (Safari sekmesinde girilen kayıtlar simgeden açılan uygulamada görünmez; ikisinin deposu ayrıdır.)

## Yedek
Ayarlar → **Yedeği kaydet / paylaş**. Dosyayı telefonun dışında bir yerde de saklayın. Yeni telefona geçerken: Ayarlar → **Yedekten geri yükle**.

## Dosyalar
| Dosya | Görevi |
|---|---|
| `index.html` | Sayfa iskeleti ve menüler |
| `app.js` | Uygulamanın tamamı: tablo tanımları, veri deposu, hesaplar, sayfalar |
| `stil.css` | Görünüm (telefonda tablolar karta dönüşür) |
| `sw.js` | Çevrimdışı çalışma. Dosyaları güncelleyince içindeki `SURUM` adını değiştirin |
| `manifest.webmanifest`, `ikon*.png` | Ana ekran simgesi ve uygulama adı |
