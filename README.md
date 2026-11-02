# ⚡ TurboBox Pro v2.0 — ZTE G5B2 / MC888 Gizli Ayarlar ve Optimizasyon Paneli

**TurboBox Pro v2.0**, Turkcell Superbox / ZTE **G5B2** ve **MC888** serisi 4.5G/5G modemlerin standart web arayüzünde (`192.168.0.1`) gizlenmiş olan gelişmiş radyo, bant kilitleme, baz istasyonu (hücre) sabitleme, DNS ve termal izleme ayarlarını açığa çıkaran modern bir kontrol panelidir.

Modemin orijinal `goform` ve `cookWithRequest` güvenlik mimarisiyle **%100 uyumlu** çalışır; tarayıcı üzerinden anlık olarak enjekte edilir ve modeminize kalıcı bir yazılım (firmware) müdahalesinde bulunmaz.

---

## 🚀 Nasıl Kullanılır? (Adım Adım Kurulum)

### Yöntem 1: Geliştirici Konsolu (F12) ile Çalıştırma (Önerilen)

1. Tarayıcınızdan (Chrome, Edge, Brave veya Firefox) modem arayüzüne girin: **`http://192.168.0.1`**
2. Modem şifrenizle **oturum açın** ve ana sayfanın tam olarak yüklenmesini bekleyin.
3. [`turbobox.js`](./turbobox.js) dosyasını açın, tüm kodu seçip kopyalayın (`Ctrl + A` ardından `Ctrl + C`).
4. Modem arayüzü sekmesinde klavyeden **`F12`** tuşuna (veya `Ctrl + Shift + I` / Sağ Tık -> **İncele**) basın.
5. Açılan geliştirici panelinde üst menüden **`Console` (Konsol)** sekmesine tıklayın.
   > 💡 **Not:** Tarayıcınız güvenlik amacıyla ilk kez kod yapıştırırken `allow pasting` (yapıştırmaya izin ver) yazmanızı isteyebilir. Böyle bir uyarı görürseniz konsola `allow pasting` yazıp `Enter` tuşuna basın.
6. Kopyaladığınız kodu konsola yapıştırın (`Ctrl + V`) ve **`Enter`** tuşuna basın.
7. Sayfanın en üstünde **⚡ TurboBox Pro v2.0** paneli anında açılacaktır!

---

## 🛠️ Panel Özellikleri ve Kullanım Rehberi

### 1. 📡 4.5G (LTE) Bant Seçimi ve "Band 20" Darboğazını Çözme
Baz istasyonları bazen sinyal gücü yüksek olduğu için modemi **Band 20 (800 MHz)** bandına atar. Band 20 geniş kapsama alanı sunar ancak bant genişliği dar (genelde 5-10 MHz) ve çok yoğun olduğu için hızınızı ciddi şekilde düşürür.

* **🚀 Hızlı Onar (B20 Kapat):** Panelin sağ üstündeki bu butona (veya Band 20 algılandığında çıkan kırmızı uyarı kutusundaki butona) tıkladığınızda modem anında **B1 + B3 + B7** yüksek hız bantlarına sabitlenir.
* **📡 4G Bant Seçimi Butonu:**
  * **🚀 Hız Modu (`B1 + B3 + B7`):** Şehir içi en yüksek indirme ve yükleme hızı için idealdir (Band 20 kapalıdır).
  * **🎯 Kararlı Mod (`B3 + B7`):** Sadece ana hız taşıyıcılarını kullanır.
  * **🔄 Otomatik (`AUTO`):** Modemi fabrika varsayılanı olan tüm bantlara geri döndürür.
  * **Özel Seçim:** Kutucukları işaretleyerek (B1, B3, B7, B8, B20, B28) istediğiniz kombinasyonu oluşturabilirsiniz.

---

### 2. 🗼 Hücre Sabitleme (Cell Lock) — Baz İstasyonu Atlama Sorunu
Modeminiz gün içinde sürekli farklı baz istasyonlarına veya farklı sektörlere (`PCI`) atlayıp ping yükselmesine ve hız dalgalanmalarına yol açıyorsa **Hücre Sabitle** özelliğini kullanabilirsiniz.

1. **`🗼 Hücre Sabitle (Cell Lock)`** butonuna tıklayın.
2. Açılan tabloda o an bağlı olduğunuz **PCC (Ana Hat)** ve **SCC (Ek Bantlar)** listelenir.
   * ⚠️ Eğer ek bantlardan biri ana hattınızdan farklı bir `PCI` değerine sahipse (farklı baz istasyonu sektöründen sinyal alıyorsa) ana ekranda **turuncu renkle** uyarılır.
3. En yüksek hızı aldığınız hücrenin yanındaki **`🔒 Bu Hücreye Sabitle`** butonuna tıklayın.
4. Ayarın tam devreye girmesi için paneldeki **`🔄 Yeniden Başlat`** butonuyla modemi yeniden başlatın.
5. **Kilidi Kaldırmak İçin:** Aynı penceredeki **`🔓 Kilidi Kaldır (0,0)`** butonuna basıp modemi yeniden başlatmanız yeterlidir.

---

### 3. 🌐 DNS Değiştirme (Cloudflare / Google / Otomatik)
Operatör DNS kısıtlamalarını aşmak veya sayfa açılış sürelerini hızlandırmak için kullanılır:
* **`🌐 DNS Değiştir`** butonuna tıklayın.
* Tek tıkla **Cloudflare (`1.1.1.1, 1.0.0.1`)**, **Cloudflare + Google (`1.1.1.1, 8.8.8.8`)** veya **Google DNS (`8.8.8.8, 8.8.4.4`)** seçebilirsiniz.
* Operatör varsayılanına dönmek için **`🔄 Operatör Varsayılanı (AUTO)`** butonuna tıklayın.

---

### 4. 📶 5G NR Bant Seçimi
5G destekli bölgelerde veya 5G SIM kart kullanımlarında **`📶 5G Bant Seçimi`** menüsünden sadece **`n78` (3500 MHz)**, **`n1 + n3 + n78`** veya **`AUTO`** seçimi yapabilirsiniz. *(5G sinyali yoksa 5G sinyal kartı arayüzde yer kaplamaması için otomatik gizlenir.)*

---

### 5. 🔓 Gizli Modem Sayfaları (Secret Pages)
Panelin sağ altındaki **`🔓 Gizli Modem Sayfasına Git...`** açılır menüsünden ZTE'nin arayüzde gizlediği mühendislik sayfalarına doğrudan geçiş yapabilirsiniz:

| Kategori | Gizli Sayfa | Açıklama |
| :--- | :--- | :--- |
| **📡 Ağ ve Radyo** | `#network_info` | Detaylı ağ ve bağlantı durumu |
| | `#debug_page` | Mühendislik hata ayıklama (Debug) ekranı |
| | `#ant_switch` | Harici / Dahili anten geçiş ayarları |
| | `#rf_mmw` | RF ve mmWave radyo parametreleri |
| **🌡️ Sıcaklık ve Termal** | `#temp_status` | Modem içi sensör sıcaklık değerleri |
| | `#thermal_switch` | Aşırı ısınma (Thermal Throttling) koruma şalteri |
| | `#bsp_tc_settings` | BSP termal kontrol eşik ayarları |
| **📶 Wi-Fi Çip Ayarları** | `#wifi_main_chip1` | 2.4 GHz Wi-Fi çipinin gelişmiş donanım ayarları |
| | `#wifi_main_chip2` | 5 GHz Wi-Fi çipinin gelişmiş donanım ayarları |
| | `#wifi_mac_filter` | Gelişmiş Wi-Fi MAC filtreleme sayfası |
| **📞 VoIP Ayarları** | `#voip_setting` / `#voip_settings` | Sesli arama (VoIP/SIP) yapılandırma ekranları |
| | `#supplement_service` | Ek telefon servisleri |
| | `#voip_advanced_settings` | Gelişmiş VoIP kodek ve protokol ayarları |

---

## 📊 Sinyal Kalitesi Değerlerini Nasıl Yorumlamalısınız?

Panelde canlı grafiklerle (`Sparkline`) gösterilen 4.5G/5G sinyal metriklerinin anlamları:

* **RSRP (Sinyal Gücü):** Baz istasyonundan gelen sinyalin şiddetidir.
  * 🟢 **-85 dBm ve üzeri (Örn: -75 dBm):** Mükemmel
  * 🟢 **-85 ile -95 dBm arası:** İyi
  * 🟠 **-95 ile -105 dBm arası:** Orta
  * 🔴 **-105 dBm altı:** Zayıf (Modemi pencere kenarına yaklaştırın)
* **RSRQ (Sinyal Kalitesi / Yoğunluk):** Baz istasyonunun ne kadar yoğun veya gürültülü olduğunu gösterir.
  * 🟢 **-9 dB ve üzeri (Örn: -6 dB):** Temiz / Sakin istasyon
  * 🟠 **-9 ile -12 dB arası:** Normal
  * 🔴 **-12 dB altı:** Yoğun / Gürültülü baz istasyonu
* **SINR (Sinyal / Gürültü Oranı):** İndirme hızınızı doğrudan belirleyen en önemli değerdir.
  * 🟢 **13 dB ve üzeri:** Mükemmel (Maksimum hız potansiyeli)
  * 🟢 **8 ile 13 dB arası:** İyi
  * 🟠 **3 ile 8 dB arası:** Orta
  * 🔴 **3 dB altı:** Kötü (Parazit yüksek, farklı bant veya konum deneyin)
* **🌡️ 4G / 5G Çip Isısı:**
  * **62°C altı:** ✅ İdeal çalışma sıcaklığı
  * **62°C – 69°C:** 🌡️ Sıcak
  * **70°C ve üzeri:** ⚠️ Yüksek ısı! Modem kendini korumak için hızı düşürebilir (Thermal Throttling). Modemi doğrudan güneş ışığından uzaklaştırın ve hava akışı sağlayın.

---

## ❓ Sıkça Sorulan Sorular

* **Sayfayı yenileyince (F5) panel kayboluyor, ayarlarım da silinir mi?**
  * **Hayır.** Yaptığınız **Bant Seçimi**, **Hücre Kilidi** ve **DNS** ayarları doğrudan modemin kendi hafızasına (`NVRAM`) kaydedilir. Tarayıcıyı kapatsanız bile ayarlarınız aktif kalır. Sadece görsel paneli tekrar görmek istediğinizde kodu konsola yapıştırmanız yeterlidir.
* **"Modem ile iletişim kurulamadı (Oturum düşmüş olabilir)" uyarısı alıyorum, ne yapmalıyım?**
  * ZTE modemler belirli bir süre işlem yapılmadığında güvenlik amacıyla oturumu kapatır. Modem arayüzüne şifrenizle tekrar giriş yapıp kodu yeniden çalıştırın.
* **Bant veya Hücre kilitledikten sonra internet bağlantım koptuysa ne yapmalıyım?**
  * Seçtiğiniz bant bulunduğunuz bölgede çekmiyor olabilir. Panelden **`📡 4G Bant Seçimi -> 🔄 Otomatik (Tüm Bantlar)`** veya **`🗼 Hücre Sabitle -> 🔓 Kilidi Kaldır (0,0)`** seçeneğine tıklayarak anında varsayılan ayarlara dönebilirsiniz.

