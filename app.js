// Öğrenci Takip — telefonda tek başına çalışan sürüm.
// Sunucu yoktur: bütün veriler bu cihazın içinde (tarayıcının IndexedDB deposunda) durur
// ve hiçbir yere gönderilmez.
'use strict';

// =====================================================================
// 1) Yardımcılar: tarih hesapları ve HTML güvenliği
// =====================================================================
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const bugun = () => iso(new Date());
const tarihCoz = (s) => { const [y, m, g] = String(s).split('-').map(Number); return new Date(y, m - 1, g); };
const tarihGecerli = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(tarihCoz(s));
const gunEkle = (s, n) => { const d = tarihCoz(s); d.setDate(d.getDate() + n); return iso(d); };
const haftaAraligi = (s) => { const bas = gunEkle(s, -((tarihCoz(s).getDay() + 6) % 7)); return [bas, gunEkle(bas, 6)]; };
const ayAraligi = (s) => { const d = tarihCoz(s); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; };
const trTarih = (s) => (s ? String(s).split('-').reverse().join('.') : '');
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const gunAdi = (s) => GUNLER[tarihCoz(s).getDay()];
const e = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const sayiYaz = (n) => (n === null || n === undefined || n === '' ? '' : Number.isInteger(n) ? String(n) : Number(n).toFixed(2).replace('.', ',').replace(/,00$/, ''));
const yuvarla = (n) => Math.round(n * 100) / 100;
const yuzde = (pay, payda) => (payda > 0 ? Math.round((pay / payda) * 100) : null);

// =====================================================================
// 2) Tablo tanımları — her sayfa (liste, form, kayıt) bunlardan üretilir.
//    Yeni bir sütun eklemek için buraya bir satır eklemek yeterlidir.
// =====================================================================
const DURUM = ['Bekliyor', 'Devam ediyor', 'Tamamlandı', 'Yapılmadı'];
const DURUM_TURU = {
  'Tamamlandı': 'iyi', 'Katıldı': 'iyi', 'Kontrol edildi': 'iyi',
  'Devam ediyor': 'orta', 'Eksik': 'orta', 'Geç katıldı': 'orta',
  'Bekliyor': 'bekle', 'Planlandı': 'bekle', 'İzinli': 'bekle', 'Kontrol edilmedi': 'bekle',
  'Yapılmadı': 'kotu', 'Katılmadı': 'kotu',
};
const TANIMLAR = {
  'ogrenciler': {
    tablo: 'ogrenciler', baslik: 'Öğrenciler', tekil: 'Öğrenci', ogrenciYok: true,
    alanlar: [
      { ad: 'ad_soyad', etiket: 'Ad Soyad', tip: 'metin', zorunlu: true },
      { ad: 'sinif', etiket: 'Sınıf / Grup', tip: 'metin' },
      { ad: 'veli_telefon', etiket: 'Veli telefonu', tip: 'metin' },
      { ad: 'notlar', etiket: 'Notlar', tip: 'uzun' },
    ],
  },
  'odev-takip': {
    tablo: 'odev', baslik: 'Ödev Takip', tekil: 'Ödev', durumAlani: 'durum', tamamDegeri: 'Tamamlandı',
    alanlar: [
      { ad: 'tarih', etiket: 'Tarih', tip: 'tarih', zorunlu: true },
      { ad: 'ders', etiket: 'Ders', tip: 'metin', oneri: 'dersler', zorunlu: true },
      { ad: 'odev', etiket: 'Ödev', tip: 'uzun', zorunlu: true },
      { ad: 'verilis', etiket: 'Veriliş tarihi', tip: 'tarih' },
      { ad: 'son_teslim', etiket: 'Son teslim tarihi', tip: 'tarih' },
      { ad: 'durum', etiket: 'Tamamlanma durumu', tip: 'secim', secenekler: ['Bekliyor', 'Eksik', 'Tamamlandı', 'Yapılmadı'] },
      { ad: 'kontrol', etiket: 'Kontrol durumu', tip: 'secim', secenekler: ['Kontrol edilmedi', 'Kontrol edildi'] },
      { ad: 'degerlendirme', etiket: 'Öğretmen değerlendirmesi', tip: 'uzun' },
    ],
  },
  'test-cozum': {
    tablo: 'test', baslik: 'Test Çözüm Takip', tekil: 'Test sonucu',
    alanlar: [
      { ad: 'tarih', etiket: 'Tarih', tip: 'tarih', zorunlu: true },
      { ad: 'ders', etiket: 'Ders', tip: 'metin', oneri: 'dersler', zorunlu: true },
      { ad: 'konu', etiket: 'Konu', tip: 'metin' },
      { ad: 'kaynak', etiket: 'Kaynak kitap', tip: 'metin', oneri: 'onceki' },
      { ad: 'test_no', etiket: 'Test numarası', tip: 'metin' },
      { ad: 'toplam', etiket: 'Toplam soru', tip: 'sayi', zorunlu: true },
      { ad: 'dogru', etiket: 'Doğru', tip: 'sayi' },
      { ad: 'yanlis', etiket: 'Yanlış', tip: 'sayi' },
      { ad: 'bos', etiket: 'Boş', tip: 'sayi', ipucu: 'Boş bırakırsanız otomatik hesaplanır' },
      { ad: 'net', etiket: 'Net', tip: 'hesap' },
      { ad: 'degerlendirme', etiket: 'Öğretmen değerlendirmesi', tip: 'uzun' },
    ],
  },
};
const TAKIP_SAYFALARI = ['gunluk-program', 'takviye-ders', 'odev-takip', 'test-cozum', 'nehari-program'];
const TABLOLAR = Object.values(TANIMLAR).map((t) => t.tablo);
const SAYFA_BASLIK = { 'gunluk-program': 'Günlük Program', 'takviye-ders': 'Takviye Ders', 'odev-takip': 'Ödev Takip', 'test-cozum': 'Test Çözüm Takip', 'nehari-program': 'Nehari Günlük Program' };

// Program sayfaları (Günlük Program, Takviye Ders, Nehari) öğrenci kaydı değildir:
// öğretmenin Excel gibi doldurup bıraktığı, istediğinde değiştirdiği serbest tablolardır.
// Aşağıdakiler yalnızca ilk açılışta gelen başlangıç şablonlarıdır; her şeyi değiştirilebilir.
const HAFTA_ICI = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA'];
const CIZELGE_SABLON = {
  'gunluk-program': { baslik: 'GÜNLÜK PROGRAM', sutunlar: ['Başlama Saati', 'Bitiş Saati', 'Süre', 'Program'], satirlar: Array.from({ length: 15 }, () => ['', '', '', '']) },
  'takviye-ders': { baslik: 'TAKVİYE DERS', sutunlar: ['Sınıfı', '6. Sınıf', '7. Sınıf'], satirlar: HAFTA_ICI.map((g) => [g, '', '']) },
  'nehari-program': { baslik: 'NEHARİ GÜNLÜK PROGRAM', sutunlar: ['Saat', 'Faaliyet', 'Açıklama'], satirlar: [1, 2, 3, 4, 5].map(() => ['', '', '']) },
};
const KISA = { 'gunluk-program': 'Günlük', 'takviye-ders': 'Takviye', 'odev-takip': 'Ödev', 'test-cozum': 'Test', 'nehari-program': 'Nehari' };

// =====================================================================
// 3) Depo — veriler bu cihazda saklanır (IndexedDB). "D" hafızadaki kopyadır;
//    her değişiklikten sonra kaydet() ile kalıcı depoya yazılır.
// =====================================================================
const UYGULAMA = 'ogrenci-takip';
let D = null;

function bosVeri() {
  const d = {
    sayac: 0,
    ayarlar: {
      dersler: 'Türkçe\nMatematik\nFen Bilimleri\nSosyal Bilgiler\nİngilizce\nDin Kültürü',
      faaliyetler: "Etüt\nKitap okuma\nEzber\nTekrar\nKur'an-ı Kerim",
      net_kurali: 4, son_yedek: null,
    },
  };
  for (const t of TABLOLAR) d[t] = [];
  return d;
}
function depoAc() {
  return new Promise((coz, reddet) => {
    const istek = indexedDB.open(UYGULAMA, 1);
    istek.onupgradeneeded = () => istek.result.createObjectStore('kv');
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => reddet(istek.error);
  });
}
async function depoIslem(tur, is) {
  const vt = await depoAc();
  try {
    return await new Promise((coz, reddet) => {
      const islem = vt.transaction('kv', tur);
      const istek = is(islem.objectStore('kv'));
      islem.oncomplete = () => coz(istek.result);
      islem.onerror = islem.onabort = () => reddet(islem.error);
    });
  } finally { vt.close(); }
}
const depoOku = (anahtar) => depoIslem('readonly', (s) => s.get(anahtar));
const depoYaz = (anahtar, deger) => depoIslem('readwrite', (s) => s.put(deger, anahtar));
const kaydet = () => depoYaz('veri', D);

// Yüklenen veya yedekten gelen veriyi eksik alanlara karşı tamamlar.
function veriDuzelt(v) {
  const bos = bosVeri();
  const d = { ...bos, ...v, ayarlar: { ...bos.ayarlar, ...(v.ayarlar || {}) } };
  for (const t of TABLOLAR) if (!Array.isArray(d[t])) d[t] = [];
  const enBuyuk = Math.max(0, ...TABLOLAR.flatMap((t) => d[t].map((k) => Number(k.id) || 0)));
  d.sayac = Math.max(Number(d.sayac) || 0, enBuyuk);
  // Program tabloları: hiç yoksa şablondan oluştur (kullanıcı hepsini sildiyse boş kalır).
  if (!d.cizelgeler || typeof d.cizelgeler !== 'object') d.cizelgeler = {};
  for (const [slug, sablon] of Object.entries(CIZELGE_SABLON)) {
    if (!Array.isArray(d.cizelgeler[slug])) d.cizelgeler[slug] = [{ id: ++d.sayac, ...JSON.parse(JSON.stringify(sablon)) }];
  }
  // Önceki sürümün Günlük Program şablonu (Saat / 6. Sınıf / 7. Sınıf) hiç doldurulmadıysa yeni düzene çevir.
  const g = d.cizelgeler['gunluk-program'];
  if (g.length === 1 && g[0].sutunlar.join('|') === 'Saat|6. Sınıf|7. Sınıf' && g[0].satirlar.every((r) => !r.slice(1).some(Boolean))) {
    g[0] = { id: g[0].id, ...JSON.parse(JSON.stringify(CIZELGE_SABLON['gunluk-program'])) };
  }
  return d;
}
const ogrenciler = () => [...D.ogrenciler].sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));
const ogrenciAdi = (id) => (D.ogrenciler.find((o) => o.id === id) || {}).ad_soyad || '?';
const satirlar = (metin) => [...new Set(String(metin || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];

// =====================================================================
// 4) Hesaplar — haftalık / aylık ilerleme
// =====================================================================
function ozet(bas, bit, ogrenciId) {
  const sec = (tablo) => D[tablo].filter((k) => k.tarih >= bas && k.tarih <= bit && (!ogrenciId || k.ogrenci_id === ogrenciId));
  const topla = (liste, alan) => liste.reduce((s, k) => s + (Number(k[alan]) || 0), 0);
  const say = (liste, kosul) => liste.filter(kosul).length;
  const gun = bugun();
  const o = sec('odev'), t = sec('test');
  return {
    odev: { n: o.length, tamam: say(o, (k) => k.durum === 'Tamamlandı'), kontrol: say(o, (k) => k.kontrol === 'Kontrol edildi'),
      geciken: say(o, (k) => k.durum !== 'Tamamlandı' && k.son_teslim && k.son_teslim < gun) },
    test: { n: t.length, soru: topla(t, 'toplam'), dogru: topla(t, 'dogru'), yanlis: topla(t, 'yanlis'), bos: topla(t, 'bos'), net: topla(t, 'net') },
  };
}
function dersBazinda(bas, bit, ogrenciId) {
  const grup = new Map();
  for (const k of D.test) {
    if (k.tarih < bas || k.tarih > bit || k.ogrenci_id !== ogrenciId) continue;
    const g = grup.get(k.ders) || { ders: k.ders, n: 0, soru: 0, dogru: 0, yanlis: 0, bos: 0, net: 0 };
    g.n++; g.soru += k.toplam || 0; g.dogru += k.dogru || 0; g.yanlis += k.yanlis || 0; g.bos += k.bos || 0; g.net += k.net || 0;
    grup.set(k.ders, g);
  }
  return [...grup.values()].sort((a, b) => b.soru - a.soru);
}
function dilimler(bas, bit, donem) {
  const sonuc = [];
  if (donem === 'hafta') { for (let g = bas; g <= bit; g = gunEkle(g, 1)) sonuc.push([g, g]); return sonuc; }
  for (let g = bas; g <= bit;) {
    const haftaSonu = haftaAraligi(g)[1];
    const son = haftaSonu < bit ? haftaSonu : bit;
    sonuc.push([g, son]);
    g = gunEkle(son, 1);
  }
  return sonuc;
}

// =====================================================================
// 5) Görünüm — sayfaların HTML'i
// =====================================================================
const ikon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IKON = {
  ana: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  'gunluk-program': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'takviye-ders': '<path d="M12 7v13M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
  'odev-takip': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 13l2 2 4-4"/>',
  'test-cozum': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  'nehari-program': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  ogrenciler: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  ilerleme: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  ayarlar: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};
const rozet = (deger) => (deger ? `<span class="rozet ${DURUM_TURU[deger] || 'bekle'}">${e(deger)}</span>` : '');
const secenek = (deger, etiket, secili) => `<option value="${e(deger)}"${String(secili ?? '') === String(deger) ? ' selected' : ''}>${e(etiket)}</option>`;
const cubuk = (y) => `<div class="cubuk"><i style="width:${y ?? 0}%"></i></div>`;
const oran = (tamam, n) => (n > 0 ? `${tamam}/${n}` : '—');
const cizgi = '<span class="soluk">—</span>';
const sorguYap = (nesne) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(nesne)) if (v !== '' && v != null) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };

function menuleriCiz(yol) {
  const aktif = (y) => (yol === y || (y !== '/' && yol.startsWith(y)) ? ' class="aktif"' : '');
  const bag = (y, ad, ik) => `<a href="#${y}"${aktif(y)}>${ikon(IKON[ik])}<span>${ad}</span></a>`;
  const yonetim = bag('/ogrenciler', 'Öğrenciler', 'ogrenciler') + bag('/ilerleme', 'İlerleme', 'ilerleme') + bag('/ayarlar', 'Ayarlar', 'ayarlar');
  document.getElementById('yanMenu').innerHTML = bag('/', 'Ana Sayfa', 'ana') + '<p>Takip</p>' + TAKIP_SAYFALARI.map((s) => bag('/' + s, SAYFA_BASLIK[s], s)).join('') + '<p>Yönetim</p>' + yonetim;
  document.getElementById('ustMenu').innerHTML = yonetim;
  document.getElementById('altMenu').innerHTML = TAKIP_SAYFALARI.map((s) => bag('/' + s, KISA[s], s)).join('');
}

function hucre(alan, kayit) {
  const v = kayit[alan.ad];
  if (v === null || v === undefined || v === '') return '';
  if (alan.tip === 'tarih') return trTarih(v);
  if (alan.tip === 'secim') return rozet(v);
  if (alan.tip === 'sayi' || alan.tip === 'hesap') return sayiYaz(v);
  return e(v);
}

function listeSayfasi(slug, q) {
  const t = TANIMLAR[slug];
  const gun = bugun();
  const tumOgrenciler = ogrenciler();
  if (!t.ogrenciYok && !tumOgrenciler.length) {
    return `<div class="baslik"><h1>${e(t.baslik)}</h1></div>
      <div class="bos-durum"><p>Kayıt ekleyebilmek için önce bir öğrenci eklemelisiniz.</p><a class="dugme" href="#/ogrenciler/yeni">＋ Öğrenci ekle</a></div>`;
  }
  const f = {
    ogrenci: /^\d+$/.test(q.ogrenci || '') ? q.ogrenci : '', bas: tarihGecerli(q.bas) ? q.bas : '', bit: tarihGecerli(q.bit) ? q.bit : '',
    durum: ['tamam', 'eksik'].includes(q.durum) ? q.durum : '',
  };
  let kayitlar;
  if (t.ogrenciYok) kayitlar = tumOgrenciler;
  else {
    kayitlar = D[t.tablo].filter((k) => {
      if (f.ogrenci && k.ogrenci_id !== Number(f.ogrenci)) return false;
      if (f.bas && k.tarih < f.bas) return false;
      if (f.bit && k.tarih > f.bit) return false;
      if (f.durum && t.durumAlani) { const iyi = DURUM_TURU[k[t.durumAlani]] === 'iyi'; if ((f.durum === 'tamam') !== iyi) return false; }
      return true;
    }).sort((a, b) => b.tarih.localeCompare(a.tarih) || (t.saatli ? (a.saat || '').localeCompare(b.saat || '') : 0) || b.id - a.id);
  }

  const hizli = (ad, bas, bit) => {
    const secili = f.bas === (bas || '') && f.bit === (bit || '');
    return `<a class="hap${secili ? ' secili' : ''}" href="#/${slug}${sorguYap({ ogrenci: f.ogrenci, durum: f.durum, bas, bit })}">${ad}</a>`;
  };
  const filtreFormu = t.ogrenciYok ? '' : `
  <form class="filtre" data-form="filtre" data-yol="/${slug}">
    <label>Öğrenci<select name="ogrenci" data-otomatik>${secenek('', 'Tüm öğrenciler', f.ogrenci)}${tumOgrenciler.map((o) => secenek(o.id, o.ad_soyad, f.ogrenci)).join('')}</select></label>
    <label>Başlangıç<input type="date" name="bas" value="${e(f.bas)}"></label>
    <label>Bitiş<input type="date" name="bit" value="${e(f.bit)}"></label>
    ${t.durumAlani ? `<label>Durum<select name="durum" data-otomatik>${secenek('', 'Tümü', f.durum)}${secenek('tamam', 'Tamamlananlar', f.durum)}${secenek('eksik', 'Eksik kalanlar', f.durum)}</select></label>` : ''}
    <button class="dugme ikincil">Filtrele</button>
    <div class="haplar">${hizli('Bugün', gun, gun)}${hizli('Bu hafta', ...haftaAraligi(gun))}${hizli('Bu ay', ...ayAraligi(gun))}${hizli('Tümü')}</div>
  </form>`;

  const topla = (alan) => kayitlar.reduce((s, k) => s + (Number(k[alan]) || 0), 0);
  const oz = [];
  if (t.durumAlani) {
    const tamam = kayitlar.filter((k) => DURUM_TURU[k[t.durumAlani]] === 'iyi').length;
    oz.push(['Kayıt', kayitlar.length], ['Tamamlanan', tamam, 'iyi'], ['Eksik kalan', kayitlar.length - tamam, kayitlar.length - tamam ? 'kotu' : '']);
  }
  if (slug === 'gunluk-program') oz.push(['Soru (yapılan / hedef)', `${topla('gercek_soru')} / ${topla('hedef_soru')}`]);
  if (slug === 'odev-takip') oz.push(['Gecikmiş', kayitlar.filter((k) => k.durum !== 'Tamamlandı' && k.son_teslim && k.son_teslim < gun).length], ['Kontrol edilen', kayitlar.filter((k) => k.kontrol === 'Kontrol edildi').length]);
  if (slug === 'test-cozum') oz.push(['Test', kayitlar.length], ['Soru', topla('toplam')], ['Doğru', topla('dogru'), 'iyi'], ['Yanlış', topla('yanlis'), 'kotu'], ['Boş', topla('bos')], ['Toplam net', sayiYaz(yuvarla(topla('net'))) || '0']);
  const ozetSeridi = oz.length ? `<div class="ozet">${oz.map(([ad, deger, tur]) => `<div class="${tur || ''}"><b>${e(deger)}</b><span>${e(ad)}</span></div>`).join('')}</div>` : '';

  const gosterilen = kayitlar.slice(0, 500);
  const basliklar = (t.ogrenciYok ? '' : '<th>Öğrenci</th>') + t.alanlar.map((a) => `<th>${e(a.etiket)}</th>`).join('') + '<th></th>';
  const govde = gosterilen.map((k) => {
    const tur = t.durumAlani ? DURUM_TURU[k[t.durumAlani]] || 'bekle' : '';
    const gecikti = slug === 'odev-takip' && k.durum !== 'Tamamlandı' && k.son_teslim && k.son_teslim < gun;
    const hucreler = t.alanlar.map((a) => {
      let ic = hucre(a, k);
      if (gecikti && a.ad === 'son_teslim') ic += ' <span class="rozet kotu">Gecikti</span>';
      const sinif = [a.tip === 'uzun' ? 'uzun' : '', a.tip === 'sayi' || a.tip === 'hesap' ? 'sayi' : '', ic === '' ? 'bos' : ''].filter(Boolean).join(' ');
      return `<td data-etiket="${e(a.etiket)}"${sinif ? ` class="${sinif}"` : ''}>${ic === '' ? '' : `<div>${ic}</div>`}</td>`;
    }).join('');
    const tamamla = t.durumAlani && tur !== 'iyi' ? `<button class="mini iyi" data-islem="tamamla" data-slug="${slug}" data-id="${k.id}">✓ ${e(t.tamamDegeri)}</button>` : '';
    const ek = t.ogrenciYok ? `<a class="mini" href="#/ilerleme?ogrenci=${k.id}">İlerleme</a>` : `<a class="mini" href="#/${slug}/yeni?kopya=${k.id}">Kopyala</a>`;
    return `<tr class="${tur}${gecikti ? ' gecikti' : ''}">
      ${t.ogrenciYok ? '' : `<td data-etiket="Öğrenci" class="kim"><div>${e(ogrenciAdi(k.ogrenci_id))}</div></td>`}${hucreler}
      <td class="islem">${tamamla}<a class="mini" href="#/${slug}/${k.id}">Düzenle</a>${ek}<button class="mini kotu" data-islem="sil" data-slug="${slug}" data-id="${k.id}">Sil</button></td>
    </tr>`;
  }).join('');

  return `<div class="baslik"><h1>${e(t.baslik)}</h1><a class="dugme" href="#/${slug}/yeni${sorguYap({ ogrenci: f.ogrenci })}">＋ Yeni ${e(t.tekil.toLocaleLowerCase('tr'))}</a></div>
  ${filtreFormu}${ozetSeridi}
  ${kayitlar.length
    ? `<div class="tablo-kutu"><table class="kayitlar"><thead><tr>${basliklar}</tr></thead><tbody>${govde}</tbody></table></div>${kayitlar.length > gosterilen.length ? `<p class="soluk">İlk ${gosterilen.length} kayıt gösteriliyor (toplam ${kayitlar.length}). Daha eskileri görmek için tarih filtresi kullanın.</p>` : ''}`
    : `<div class="bos-durum"><p>${t.ogrenciYok ? 'Henüz öğrenci eklenmemiş.' : 'Bu filtreye uyan kayıt yok.'}</p></div>`}`;
}

function oneriler(slug) {
  const t = TANIMLAR[slug], sonuc = {};
  for (const a of t.alanlar) {
    if (!a.oneri) continue;
    const kullanilan = [...D[t.tablo]].reverse().map((k) => k[a.ad]).filter(Boolean).slice(0, 200);
    sonuc[a.ad] = [...new Set([...(a.oneri === 'onceki' ? [] : satirlar(D.ayarlar[a.oneri])), ...kullanilan])].slice(0, 40);
  }
  return sonuc;
}

function formSayfasi(slug, kayit, hatalar, yeni) {
  const t = TANIMLAR[slug], on = oneriler(slug), tumOgrenciler = ogrenciler(), kural = Number(D.ayarlar.net_kurali);
  const alanHtml = t.alanlar.filter((a) => a.tip !== 'hesap').map((a) => {
    const v = kayit[a.ad] ?? '';
    const ortak = `id="a_${a.ad}" name="${a.ad}"${a.zorunlu ? ' required' : ''}`;
    let girdi;
    if (a.tip === 'tarih') girdi = `<input type="date" ${ortak} value="${e(v)}">`;
    else if (a.tip === 'saat') girdi = `<input type="time" ${ortak} value="${e(v)}">`;
    else if (a.tip === 'sayi') girdi = `<input type="number" inputmode="numeric" min="0" step="1" ${ortak} value="${e(v)}">`;
    else if (a.tip === 'uzun') girdi = `<textarea rows="3" ${ortak}>${e(v)}</textarea>`;
    else if (a.tip === 'secim') girdi = `<select ${ortak}>${a.secenekler.map((s) => secenek(s, s, v || a.secenekler[0])).join('')}</select>`;
    else {
      const liste = on[a.ad] && on[a.ad].length ? `<datalist id="l_${a.ad}">${on[a.ad].map((o) => `<option value="${e(o)}">`).join('')}</datalist>` : '';
      girdi = `<input type="text" ${ortak} value="${e(v)}"${liste ? ` list="l_${a.ad}"` : ''} autocomplete="off">${liste}`;
    }
    return `<label class="${a.tip === 'uzun' ? 'genis' : ''}${hatalar[a.ad] ? ' hatali' : ''}"><span>${e(a.etiket)}${a.zorunlu ? ' <i>*</i>' : ''}</span>${girdi}
      ${hatalar[a.ad] ? `<small class="hata">${e(hatalar[a.ad])}</small>` : a.ipucu ? `<small>${e(a.ipucu)}</small>` : ''}</label>`;
  }).join('');
  const ogrenciSecimi = t.ogrenciYok ? '' : `<label class="${hatalar.ogrenci_id ? 'hatali' : ''}"><span>Öğrenci <i>*</i></span>
    <select name="ogrenci_id" required>${secenek('', 'Seçiniz…', kayit.ogrenci_id)}${tumOgrenciler.map((o) => secenek(o.id, o.ad_soyad, kayit.ogrenci_id)).join('')}${yeni && tumOgrenciler.length > 1 ? secenek('hepsi', '★ Tüm öğrenciler (her biri için ayrı kayıt)', kayit.ogrenci_id) : ''}</select>
    ${hatalar.ogrenci_id ? `<small class="hata">${e(hatalar.ogrenci_id)}</small>` : ''}</label>`;
  const netKutusu = slug === 'test-cozum' ? `<div class="net-kutu" data-net="${kural}">Net: <b id="netDeger">—</b><small>${kural > 0 ? `${kural} yanlış 1 doğruyu götürür` : 'Yanlışlar doğruyu götürmez'} (Ayarlar'dan değiştirilebilir)</small></div>` : '';
  return `<div class="baslik"><h1>${yeni ? 'Yeni ' + e(t.tekil.toLocaleLowerCase('tr')) : e(t.tekil) + ' düzenle'}</h1></div>
  ${Object.keys(hatalar).length ? '<div class="bildirim kotu">Kayıt yapılamadı. Lütfen işaretli alanları düzeltin.</div>' : ''}
  <form class="kart form" data-form="kayit" data-slug="${slug}" data-id="${yeni ? '' : kayit.id}" novalidate>
    <div class="izgara">${ogrenciSecimi}${alanHtml}</div>
    ${netKutusu}
    <div class="dugmeler">
      <button class="dugme">Kaydet</button>
      ${yeni && !t.ogrenciYok ? '<button class="dugme ikincil" name="devam" value="1">Kaydet ve yeni ekle</button>' : ''}
      <a class="dugme sade" href="#${sonListe[slug] || '/' + slug}">Vazgeç</a>
    </div>
  </form>`;
}

const iosSafariSekmesi = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
function yedekUyarisi() {
  const kayitVar = TABLOLAR.some((t) => D[t].length) || Object.entries(D.cizelgeler).some(([slug, l]) => JSON.stringify(l.map(({ id, ...c }) => c)) !== JSON.stringify([CIZELGE_SABLON[slug]]));
  if (!kayitVar) return '';
  const son = D.ayarlar.son_yedek;
  const gun = son ? Math.round((tarihCoz(bugun()) - tarihCoz(son)) / 86400000) : null;
  if (son && gun < 7) return '';
  return `<div class="bildirim uyari">${son ? `Son yedeğin üzerinden ${gun} gün geçti.` : 'Henüz hiç yedek almadınız.'} Veriler yalnızca bu telefonda durur; telefon bozulursa kaybolmaması için yedek alın. <button class="mini" data-islem="yedek">Şimdi yedekle</button></div>`;
}

function anaSayfa() {
  const gun = bugun(), h = ozet(...haftaAraligi(gun));
  const bekleyen = D.odev.filter((k) => k.durum !== 'Tamamlandı');
  const geciken = bekleyen.filter((k) => k.son_teslim && k.son_teslim < gun).length;
  const kontrolsuz = D.odev.filter((k) => k.kontrol !== 'Kontrol edildi').length;
  const basari = yuzde(h.test.dogru, h.test.soru);
  const kutu = (ad, deger, alt, y, bag) => `<a class="kart olcu" href="#${bag}"><span>${ad}</span><b>${deger}</b>${y === undefined ? '' : cubuk(y)}<small>${alt}</small></a>`;
  return `${iosSafariSekmesi() ? '<div class="bildirim uyari"><b>Önce ana ekrana ekleyin.</b> Alttaki Paylaş düğmesi → “Ana Ekrana Ekle”. Sonra uygulamayı hep ana ekrandaki simgeden açın; Safari\'de girilen kayıtlar simgeden açılan uygulamada görünmez.</div>' : ''}
  ${yedekUyarisi()}
  <div class="baslik"><div><h1>Bugün</h1><p class="soluk">${gunAdi(gun)}, ${trTarih(gun)} · ${D.ogrenciler.length} öğrenci</p></div></div>
  <h2>Programlar</h2>
  <div class="hizli">${Object.keys(CIZELGE_SABLON).map((s) => `<a class="dugme sade" href="#/${s}">${ikon(IKON[s])} ${e(SAYFA_BASLIK[s])}</a>`).join('')}</div>
  <h2>Ödev ve test takibi</h2>
  ${D.ogrenciler.length === 0 ? '<div class="bos-durum"><p>Ödev ve test takibi için öğrencilerinizi ekleyin. (Programlar için öğrenci gerekmez.)</p><a class="dugme" href="#/ogrenciler/yeni">＋ Öğrenci ekle</a></div>' : `
  <div class="olculer">
    ${kutu('Bekleyen ödev', bekleyen.length, geciken ? `${geciken} tanesi gecikmiş` : 'geciken yok', undefined, '/odev-takip?durum=eksik')}
    ${kutu('Kontrol edilecek ödev', kontrolsuz, 'henüz kontrol edilmedi', undefined, '/odev-takip')}
    ${kutu('Bu hafta test', h.test.soru + ' soru', `${h.test.n} test · ${sayiYaz(yuvarla(h.test.net)) || 0} net`, undefined, '/test-cozum')}
    ${kutu('Bu hafta doğru oranı', basari === null ? '—' : '%' + basari, `${h.test.dogru} D / ${h.test.yanlis} Y / ${h.test.bos} B`, basari ?? 0, '/ilerleme')}
  </div>
  <div class="hizli" style="margin-top:.8rem">${['odev-takip', 'test-cozum'].map((s) => `<a class="dugme ikincil" href="#/${s}/yeni">${ikon(IKON[s])} ${e(KISA[s])} ekle</a>`).join('')}</div>`}`;
}

function donemAdi(bas, bit, donem) {
  const b = tarihCoz(bas), s = tarihCoz(bit);
  if (donem === 'ay') return `${AYLAR[b.getMonth()]} ${b.getFullYear()}`;
  return b.getMonth() === s.getMonth() ? `${b.getDate()}–${s.getDate()} ${AYLAR[s.getMonth()]} ${s.getFullYear()}`
    : `${b.getDate()} ${AYLAR[b.getMonth()]} – ${s.getDate()} ${AYLAR[s.getMonth()]} ${s.getFullYear()}`;
}

function ilerlemeSayfasi(q) {
  const donem = q.donem === 'ay' ? 'ay' : 'hafta';
  const aralik = donem === 'ay' ? ayAraligi : haftaAraligi;
  const [bas, bit] = aralik(tarihGecerli(q.tarih) ? q.tarih : bugun());
  const tumOgrenciler = ogrenciler();
  const ogrenci = tumOgrenciler.find((o) => String(o.id) === q.ogrenci) || null;
  const bag = (p) => '#/ilerleme' + sorguYap({ donem, tarih: bas, ogrenci: ogrenci ? ogrenci.id : '', ...p });
  const oranHucre = (tamam, n) => (n > 0 ? `<div class="oran"><span>${tamam}/${n}</span>${cubuk(yuzde(tamam, n))}</div>` : cizgi);
  const yuzdeHucre = (pay, payda) => (payda > 0 ? `<div class="oran"><span>%${yuzde(pay, payda)}</span>${cubuk(yuzde(pay, payda))}</div>` : cizgi);
  const net = (n) => sayiYaz(yuvarla(n)) || '0';
  const satirHucreleri = (z) => `
      <td data-etiket="Ödev (yapılan)">${oranHucre(z.odev.tamam, z.odev.n)}</td>
      <td data-etiket="Ödev (kontrol edilen)">${oranHucre(z.odev.kontrol, z.odev.n)}</td>
      <td data-etiket="Test" class="sayi">${z.test.n ? `<div>${z.test.n}</div>` : cizgi}</td>
      <td data-etiket="Test sorusu" class="sayi">${z.test.soru ? `<div>${z.test.soru}</div>` : cizgi}</td>
      <td data-etiket="Net" class="sayi">${z.test.n ? `<div>${net(z.test.net)}</div>` : cizgi}</td>
      <td data-etiket="Doğru oranı">${yuzdeHucre(z.test.dogru, z.test.soru)}</td>`;
  const basliklar = '<th>Ödev (yapılan)</th><th>Ödev (kontrol edilen)</th><th>Test</th><th>Test sorusu</th><th>Net</th><th>Doğru oranı</th>';

  const ust = `<div class="baslik"><h1>İlerleme</h1></div>
  <form class="filtre" data-form="filtre" data-yol="/ilerleme">
    <input type="hidden" name="tarih" value="${bas}">
    <label>Öğrenci<select name="ogrenci" data-otomatik>${secenek('', 'Tüm öğrenciler (genel bakış)', ogrenci && ogrenci.id)}${tumOgrenciler.map((o) => secenek(o.id, o.ad_soyad, ogrenci && ogrenci.id)).join('')}</select></label>
    <label>Dönem<select name="donem" data-otomatik>${secenek('hafta', 'Haftalık', donem)}${secenek('ay', 'Aylık', donem)}</select></label>
  </form>
  <div class="donem"><a class="dugme sade" href="${bag({ tarih: gunEkle(bas, -1) })}">‹ Önceki</a><b>${donemAdi(bas, bit, donem)}</b><a class="dugme sade" href="${bag({ tarih: gunEkle(bit, 1) })}">Sonraki ›</a></div>`;
  if (!tumOgrenciler.length) return ust + '<div class="bos-durum"><p>Henüz öğrenci eklenmemiş.</p></div>';

  if (!ogrenci) {
    const satir = tumOgrenciler.map((o) => `<tr>
      <td data-etiket="Öğrenci" class="kim"><a href="${bag({ ogrenci: o.id })}">${e(o.ad_soyad)}</a></td>${satirHucreleri(ozet(bas, bit, o.id))}</tr>`).join('');
    return ust + `<div class="tablo-kutu"><table class="kayitlar"><thead><tr><th>Öğrenci</th>${basliklar}</tr></thead><tbody>${satir}</tbody></table></div>
    <p class="soluk">Ayrıntı için öğrencinin adına dokunun.</p>`;
  }

  const z = ozet(bas, bit, ogrenci.id), p = ozet(...aralik(gunEkle(bas, -1)), ogrenci.id);
  const fark = (simdi, once, birim = '') => {
    if (simdi === null || once === null) return '';
    const d = yuvarla(simdi - once);
    if (d === 0) return '<em class="ayni">önceki dönemle aynı</em>';
    return `<em class="${d > 0 ? 'artti' : 'azaldi'}">${d > 0 ? '▲' : '▼'} ${sayiYaz(Math.abs(d))}${birim} önceki döneme göre</em>`;
  };
  const kutu = (ad, deger, alt, y, farkHtml) => `<div class="kart olcu"><span>${ad}</span><b>${deger}</b>${y === undefined ? '' : cubuk(y)}<small>${alt}</small>${farkHtml || ''}</div>`;
  const yz = (a) => yuzde(a.tamam, a.n);
  const kontrolY = yuzde(z.odev.kontrol, z.odev.n);
  const basari = yuzde(z.test.dogru, z.test.soru), oncekiBasari = yuzde(p.test.dogru, p.test.soru);
  const kutular = `<div class="olculer">
    ${kutu('Ödev (yapılan)', yz(z.odev) === null ? '—' : '%' + yz(z.odev), `${z.odev.tamam}/${z.odev.n} ödev tamamlandı${z.odev.geciken ? ` · ${z.odev.geciken} gecikmiş` : ''}`, yz(z.odev), fark(yz(z.odev), yz(p.odev), ' puan'))}
    ${kutu('Ödev (kontrol edilen)', kontrolY === null ? '—' : '%' + kontrolY, `${z.odev.kontrol}/${z.odev.n} ödev kontrol edildi`, kontrolY ?? 0)}
    ${kutu('Test neti', z.test.n ? net(z.test.net) : '—', `${z.test.n} test · ${z.test.soru} soru · ${z.test.dogru} D / ${z.test.yanlis} Y / ${z.test.bos} B`, undefined, z.test.n || p.test.n ? fark(z.test.net, p.test.net, ' net') : '')}
    ${kutu('Doğru oranı', basari === null ? '—' : '%' + basari, 'doğru / toplam soru', basari ?? 0, fark(basari, oncekiBasari, ' puan'))}
  </div>`;
  const ad = donem === 'hafta' ? 'Gün' : 'Hafta';
  const dilimTablo = `<h2>${donem === 'hafta' ? 'Gün gün' : 'Hafta hafta'}</h2>
  <div class="tablo-kutu"><table class="kayitlar"><thead><tr><th>${ad}</th>${basliklar}</tr></thead><tbody>
  ${dilimler(bas, bit, donem).map(([b, s]) => { const d = ozet(b, s, ogrenci.id); const dolu = d.odev.n + d.test.n; return `<tr${dolu ? '' : ' class="sessiz"'}>
    <td data-etiket="${ad}" class="kim"><div>${donem === 'hafta' ? `${gunAdi(b)} <span class="soluk">${trTarih(b).slice(0, 5)}</span>` : `${trTarih(b).slice(0, 5)} – ${trTarih(s).slice(0, 5)}`}${dolu ? '' : ' <span class="soluk yok">· kayıt yok</span>'}</div></td>${satirHucreleri(d)}</tr>`; }).join('')}
  </tbody></table></div>`;
  const dersler = dersBazinda(bas, bit, ogrenci.id);
  const dersTablo = dersler.length ? `<h2>Derslere göre test başarısı</h2>
  <div class="tablo-kutu"><table class="kayitlar"><thead><tr><th>Ders</th><th>Test</th><th>Soru</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Net</th><th>Doğru oranı</th></tr></thead><tbody>
  ${dersler.map((d) => `<tr><td data-etiket="Ders" class="kim">${e(d.ders)}</td><td data-etiket="Test" class="sayi">${d.n}</td><td data-etiket="Soru" class="sayi">${d.soru}</td>
    <td data-etiket="Doğru" class="sayi">${d.dogru}</td><td data-etiket="Yanlış" class="sayi">${d.yanlis}</td><td data-etiket="Boş" class="sayi">${d.bos}</td>
    <td data-etiket="Net" class="sayi">${net(d.net)}</td><td data-etiket="Doğru oranı">${yuzdeHucre(d.dogru, d.soru)}</td></tr>`).join('')}
  </tbody></table></div>` : '';
  return ust + `<h2 class="kisi">${e(ogrenci.ad_soyad)}${ogrenci.sinif ? ` <span class="soluk">· ${e(ogrenci.sinif)}</span>` : ''}</h2>` + kutular + dilimTablo + dersTablo;
}

// ---- Program tabloları (Excel gibi serbest tablolar) ----
const EN_COK_SUTUN = 20, EN_COK_SATIR = 200;
let taslak = null; // düzenlenmekte olan tablonun henüz kaydedilmemiş hali

// Sütun genişliği: adı saat/süre olan sütunlar dar tutulur ki yazı yazılan sütuna (ör. Program) yer kalsın.
const kisaSutun = (ad) => /saat|süre|sure/i.test(ad || '');
function en(c, j, metin = '') {
  if (!c.sutunlar.some(kisaSutun)) return '';
  if (kisaSutun(c.sutunlar[j])) return ' class="kisa"';
  return String(metin).length > 70 ? ' class="yazi cok-uzun"' : ' class="yazi"';
}
// Düzenleme ekranında yazı sütunları, içine yazılan en uzun yazıya göre kendiliğinden genişler.
function genislikAyarla() {
  const form = document.querySelector('form[data-form=cizelge]');
  if (!form) return;
  form.querySelectorAll('thead tr:first-child th.yazi').forEach((baslik) => {
    const j = baslik.cellIndex;
    let enUzun = baslik.querySelector('input').value.length;
    form.querySelectorAll(`tbody tr td:nth-child(${j + 1}) input`).forEach((el) => { enUzun = Math.max(enUzun, el.value.length); });
    baslik.style.minWidth = `max(340px, calc(${Math.min(enUzun, 90)}ch + 2.4rem))`;
  });
}
document.addEventListener('input', (olay) => { if (olay.target.closest('form[data-form=cizelge]')) genislikAyarla(); });

function cizelgeSayfasi(slug, q) {
  const tablolar = D.cizelgeler[slug];
  const duzenlenen = q.duzenle ? tablolar.find((c) => String(c.id) === q.duzenle) : null;
  if (!duzenlenen) taslak = null;
  else if (!taslak || taslak.id !== duzenlenen.id) taslak = { slug, ...JSON.parse(JSON.stringify(duzenlenen)) };

  const goster = (c) => `<section class="cizelge-kart">
    <div class="cizelge-baslik">${e(c.baslik)}</div>
    <div class="cizelge-kaydir"><table class="cizelge">
      <thead><tr>${c.sutunlar.map((s, j) => `<th${en(c, j)}>${e(s)}</th>`).join('')}</tr></thead>
      <tbody>${c.satirlar.map((r) => `<tr>${r.map((h, j) => (j === 0 ? `<th${en(c, j, h)}>${e(h)}</th>` : `<td${en(c, j, h)}>${e(h)}</td>`)).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="cizelge-islem"><a class="mini" href="#/${slug}?duzenle=${c.id}">Düzenle</a><button class="mini kotu" data-islem="c-sil" data-slug="${slug}" data-id="${c.id}">Tabloyu sil</button></div>
  </section>`;

  const duzenle = (c) => `<form class="cizelge-kart duzen" data-form="cizelge" data-slug="${slug}" data-id="${c.id}">
    <label class="cizelge-ad"><span>Tablo başlığı</span><input type="text" name="baslik" value="${e(c.baslik)}" autocomplete="off"></label>
    <p class="soluk">Kutulara dokunup yazın. Sütun adları da değiştirilebilir. Tablo sağa doğru kaydırılabilir.</p>
    <div class="cizelge-kaydir"><table class="cizelge">
      <thead>
        <tr>${c.sutunlar.map((s, j) => `<th><input type="text" name="s${j}" value="${e(s)}" aria-label="${j + 1}. sütun adı" autocomplete="off"></th>`.replace('<th>', `<th${en(c, j)}>`)).join('')}<th class="dar"></th></tr>
        <tr class="sil-satiri">${c.sutunlar.map((s, j) => `<td>${c.sutunlar.length > 1 ? `<button type="button" class="mini kotu" data-islem="c-sutun-sil" data-j="${j}">Sütunu sil</button>` : ''}</td>`).join('')}<td class="dar"></td></tr>
      </thead>
      <tbody>${c.satirlar.map((r, i) => `<tr>${r.map((h, j) => `<td><input type="text" name="h${i}_${j}" value="${e(h)}" aria-label="${i + 1}. satır, ${e(c.sutunlar[j])}" autocomplete="off"></td>`.replace('<td>', `<td${en(c, j)}>`)).join('')}<td class="dar"><button type="button" class="mini kotu" data-islem="c-satir-sil" data-i="${i}" aria-label="${i + 1}. satırı sil">✕</button></td></tr>`).join('')}</tbody>
    </table></div>
    <div class="dugmeler">
      <button type="button" class="dugme ikincil" data-islem="c-satir-ekle">＋ Satır ekle</button>
      <button type="button" class="dugme ikincil" data-islem="c-sutun-ekle">＋ Sütun ekle</button>
    </div>
    <div class="dugmeler"><button class="dugme">Kaydet</button><a class="dugme sade" href="#/${slug}">Vazgeç</a></div>
  </form>`;

  return `<div class="baslik"><h1>${e(SAYFA_BASLIK[slug])}</h1>${taslak ? '' : `<button class="dugme" data-islem="c-yeni" data-slug="${slug}">＋ Yeni tablo</button>`}</div>
  ${taslak ? duzenle(taslak) : tablolar.length ? tablolar.map(goster).join('') : '<div class="bos-durum"><p>Henüz tablo yok. “＋ Yeni tablo” ile başlayın.</p></div>'}`;
}

// Düzenleme formundaki yazılanları taslağa aktarır (satır/sütun eklerken yazılanlar kaybolmasın diye).
function taslakOku() {
  const form = document.querySelector('form[data-form=cizelge]');
  if (!form || !taslak) return;
  const al = (ad) => { const el = form.elements[ad]; return el ? el.value.trim().slice(0, 300) : ''; };
  taslak.baslik = al('baslik');
  taslak.sutunlar = taslak.sutunlar.map((_, j) => al('s' + j));
  taslak.satirlar = taslak.satirlar.map((r, i) => r.map((_, j) => al(`h${i}_${j}`)));
}
function taslakDegistir(is) {
  taslakOku();
  is(taslak);
  const kaydirma = window.scrollY;
  ciz();
  window.scrollTo(0, kaydirma);
}
const cizelgeIslemleri = {
  'c-satir-ekle': () => taslakDegistir((c) => { if (c.satirlar.length < EN_COK_SATIR) c.satirlar.push(c.sutunlar.map(() => '')); }),
  'c-sutun-ekle': () => taslakDegistir((c) => { if (c.sutunlar.length < EN_COK_SUTUN) { c.sutunlar.push('Yeni sütun'); c.satirlar.forEach((r) => r.push('')); } }),
  'c-satir-sil': (d) => taslakDegistir((c) => { const i = Number(d.dataset.i); if (!c.satirlar[i].some(Boolean) || window.confirm('Bu satır silinsin mi?')) c.satirlar.splice(i, 1); }),
  'c-sutun-sil': (d) => taslakDegistir((c) => { const j = Number(d.dataset.j); if (window.confirm(`“${c.sutunlar[j]}” sütunu ve içindekiler silinsin mi?`)) { c.sutunlar.splice(j, 1); c.satirlar.forEach((r) => r.splice(j, 1)); } }),
  'c-yeni': async (d) => {
    const slug = d.dataset.slug, sablon = JSON.parse(JSON.stringify(CIZELGE_SABLON[slug]));
    const yeni = { id: ++D.sayac, ...sablon, baslik: D.cizelgeler[slug].length ? 'YENİ TABLO' : sablon.baslik };
    D.cizelgeler[slug].push(yeni);
    await kaydet();
    git(`/${slug}?duzenle=${yeni.id}`);
  },
  'c-sil': async (d) => {
    const slug = d.dataset.slug, id = Number(d.dataset.id), c = D.cizelgeler[slug].find((x) => x.id === id);
    if (!c || !window.confirm(`“${c.baslik}” tablosu silinecek. Emin misiniz?`)) return;
    D.cizelgeler[slug] = D.cizelgeler[slug].filter((x) => x.id !== id);
    await kaydet();
    mesaj = ['iyi', 'Tablo silindi.'];
    ciz();
  },
};
async function cizelgeKaydet(form) {
  taslakOku();
  const slug = form.dataset.slug, i = D.cizelgeler[slug].findIndex((c) => c.id === Number(form.dataset.id));
  if (i < 0) { mesaj = ['kotu', 'Tablo bulunamadı (silinmiş olabilir).']; return git('/' + slug); }
  const { slug: _atla, ...temiz } = taslak;
  D.cizelgeler[slug][i] = { ...temiz, baslik: temiz.baslik || SAYFA_BASLIK[slug].toLocaleUpperCase('tr') };
  await kaydet();
  taslak = null;
  mesaj = ['iyi', 'Tablo kaydedildi.'];
  git('/' + slug);
}

function ayarlarSayfasi() {
  const a = D.ayarlar;
  const toplam = TABLOLAR.reduce((s, t) => s + D[t].length, 0) + Object.values(D.cizelgeler).reduce((s, l) => s + l.length, 0);
  return `<div class="baslik"><h1>Ayarlar</h1></div>
  <div class="kart"><h2>Yedekleme</h2>
    <p>Veriler <b>yalnızca bu cihazda</b> durur. Telefon bozulur, değişir veya Safari verileri silinirse kaybolmaması için düzenli yedek alın ve dosyayı telefonun dışında bir yerde de saklayın (kendinize e-posta, iCloud Drive, WhatsApp).</p>
    <p class="soluk">${toplam} kayıt ve tablo · Son yedek: ${a.son_yedek ? trTarih(a.son_yedek) : 'hiç alınmadı'}</p>
    <button class="dugme" data-islem="yedek">Yedeği kaydet / paylaş</button>
    <h3>Yedekten geri yükle</h3>
    <p class="soluk">Seçtiğiniz yedek, şu anki verilerin <b>yerine</b> geçer. Yeni telefona geçerken de bu kullanılır.</p>
    <div class="satir"><input type="file" id="yedekDosya" accept=".json,application/json"><button class="dugme ikincil" data-islem="geri-yukle">Geri yükle</button></div>
    ${geriAlinabilir ? '<p><button class="mini" data-islem="geri-al">Son geri yüklemeyi geri al</button></p>' : ''}
  </div>
  <form class="kart form" data-form="listeler"><h2>Listeler ve net hesabı</h2>
    <div class="izgara">
      <label class="genis"><span>Dersler (her satıra bir ders — formlarda öneri olarak çıkar)</span><textarea name="dersler" rows="6">${e(a.dersler)}</textarea></label>
      <label><span>Net hesabı</span><select name="net_kurali">${secenek(4, '4 yanlış 1 doğruyu götürür', a.net_kurali)}${secenek(3, '3 yanlış 1 doğruyu götürür', a.net_kurali)}${secenek(0, 'Yanlışlar doğruyu götürmez', a.net_kurali)}</select>
        <small>Değişiklik bundan sonra kaydedilen testlere uygulanır.</small></label>
    </div>
    <div class="dugmeler"><button class="dugme">Kaydet</button></div>
  </form>
  <div class="kart"><h2>Hakkında</h2>
    <p class="soluk"><b>Sürüm 10</b> · Bu uygulama internete veri göndermez; ilk açılıştan sonra internetsiz çalışır. Giriş şifresi yoktur — telefonunuzun kendi ekran kilidi korur.</p>
  </div>`;
}

// =====================================================================
// 6) İşlemler — kaydetme, silme, yedekleme
// =====================================================================
function kayitOku(slug, veri) {
  const t = TANIMLAR[slug], k = {}, hatalar = {};
  for (const a of t.alanlar) {
    if (a.tip === 'hesap') continue;
    let v = String(veri.get(a.ad) ?? '').trim().slice(0, 4000);
    if (a.zorunlu && v === '') hatalar[a.ad] = 'Bu alan zorunludur.';
    else if (a.tip === 'tarih' && v && !tarihGecerli(v)) hatalar[a.ad] = 'Geçerli bir tarih seçin.';
    else if (a.tip === 'saat' && v && !/^\d{2}:\d{2}/.test(v)) hatalar[a.ad] = 'Saati 09:30 biçiminde girin.';
    else if (a.tip === 'sayi' && v && !/^\d{1,6}$/.test(v)) hatalar[a.ad] = 'Sıfır veya daha büyük bir tam sayı girin.';
    if (a.tip === 'saat' && v) v = v.slice(0, 5);
    if (a.tip === 'secim' && !a.secenekler.includes(v)) v = a.secenekler[0];
    k[a.ad] = a.tip !== 'sayi' || hatalar[a.ad] ? v : v === '' ? null : Number(v);
  }
  if (slug === 'test-cozum' && !Object.keys(hatalar).length) {
    if (k.toplam < 1) hatalar.toplam = 'Toplam soru en az 1 olmalıdır.';
    else {
      k.dogru ??= 0; k.yanlis ??= 0;
      if (k.dogru + k.yanlis > k.toplam) hatalar.yanlis = 'Doğru + yanlış, toplam sorudan fazla olamaz.';
      else {
        k.bos ??= k.toplam - k.dogru - k.yanlis;
        if (k.dogru + k.yanlis + k.bos !== k.toplam) hatalar.bos = `Doğru + yanlış + boş toplamı ${k.toplam} olmalıdır.`;
        const kural = Number(D.ayarlar.net_kurali);
        k.net = yuvarla(k.dogru - (kural > 0 ? k.yanlis / kural : 0));
      }
    }
  }
  return { k, hatalar };
}

async function kayitGonder(form, gonderen) {
  const slug = form.dataset.slug, t = TANIMLAR[slug], id = Number(form.dataset.id) || null;
  const veri = new FormData(form);
  const { k, hatalar } = kayitOku(slug, veri);
  let hedefler = [null];
  const secilen = String(veri.get('ogrenci_id') ?? '');
  if (!t.ogrenciYok) {
    if (secilen === 'hepsi' && !id) hedefler = D.ogrenciler.map((o) => o.id);
    else if (D.ogrenciler.some((o) => String(o.id) === secilen)) hedefler = [Number(secilen)];
    else hatalar.ogrenci_id = 'Lütfen bir öğrenci seçin.';
  }
  if (Object.keys(hatalar).length) {
    icerik.innerHTML = formSayfasi(slug, { ...k, id, ogrenci_id: secilen }, hatalar, !id);
    formHazirla(); window.scrollTo(0, 0);
    return;
  }
  if (id) {
    const eski = D[t.tablo].find((x) => x.id === id);
    if (!eski) { mesaj = ['kotu', 'Kayıt bulunamadı (silinmiş olabilir).']; return git(sonListe[slug] || '/' + slug); }
    Object.assign(eski, k, t.ogrenciYok ? {} : { ogrenci_id: hedefler[0] });
    mesaj = ['iyi', 'Değişiklikler kaydedildi.'];
  } else {
    for (const ogrenciId of hedefler) D[t.tablo].push({ id: ++D.sayac, ...(t.ogrenciYok ? {} : { ogrenci_id: ogrenciId }), ...k });
    mesaj = ['iyi', hedefler.length > 1 ? `${hedefler.length} öğrenci için kaydedildi.` : 'Kaydedildi.'];
  }
  await kaydet();
  if (gonderen && gonderen.name === 'devam') {
    mesaj[1] += ' Sıradaki kaydı girebilirsiniz.';
    return git(`/${slug}/yeni${sorguYap({ ogrenci: secilen, tarih: k.tarih, n: Date.now() })}`);
  }
  git(sonListe[slug] || '/' + slug);
}

async function sil(slug, id) {
  const t = TANIMLAR[slug], kayit = D[t.tablo].find((k) => k.id === id);
  if (!kayit) return;
  const soru = t.ogrenciYok ? `${kayit.ad_soyad} ve bu öğrenciye ait TÜM takip kayıtları silinecek. Emin misiniz?` : 'Bu kayıt silinecek. Emin misiniz?';
  if (!window.confirm(soru)) return;
  D[t.tablo] = D[t.tablo].filter((k) => k.id !== id);
  if (t.ogrenciYok) for (const tablo of TABLOLAR) if (tablo !== 'ogrenciler') D[tablo] = D[tablo].filter((k) => k.ogrenci_id !== id);
  await kaydet();
  mesaj = ['iyi', t.ogrenciYok ? 'Öğrenci ve kayıtları silindi.' : 'Kayıt silindi.'];
  ciz();
}

async function tamamla(slug, id) {
  const t = TANIMLAR[slug], kayit = D[t.tablo].find((k) => k.id === id);
  if (!kayit) return;
  kayit[t.durumAlani] = t.tamamDegeri;
  await kaydet();
  mesaj = ['iyi', `“${t.tamamDegeri}” olarak işaretlendi.`];
  ciz();
}

async function yedekAl() {
  const simdi = new Date();
  const ad = `ogrenci-takip-yedek-${bugun()}-${pad(simdi.getHours())}${pad(simdi.getMinutes())}.json`;
  const metin = JSON.stringify({ uygulama: UYGULAMA, surum: 1, tarih: simdi.toISOString(), veri: D });
  const dosya = new File([metin], ad, { type: 'application/json' });
  let tamam = false;
  // iPhone'da paylaşım menüsü açılır: "Dosyalara Kaydet", e-posta, WhatsApp...
  if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya], title: 'Öğrenci Takip yedeği' }); tamam = true; }
    catch (hata) { if (hata.name === 'AbortError') return; }
  }
  if (!tamam) {
    const adres = URL.createObjectURL(dosya);
    const bag = Object.assign(document.createElement('a'), { href: adres, download: ad });
    document.body.appendChild(bag); bag.click(); bag.remove();
    setTimeout(() => URL.revokeObjectURL(adres), 10000);
  }
  D.ayarlar.son_yedek = bugun();
  await kaydet();
  mesaj = ['iyi', 'Yedek hazırlandı. Dosyayı telefonun dışında bir yerde de saklayın.'];
  ciz();
}

let geriAlinabilir = false;
async function geriYukle() {
  const dosya = document.getElementById('yedekDosya').files[0];
  const hata = (m) => { mesaj = ['kotu', m]; ciz(); };
  if (!dosya) return hata('Önce bir yedek dosyası seçin.');
  let gelen;
  try { gelen = JSON.parse(await dosya.text()); } catch { return hata('Bu dosya okunamadı; geçerli bir yedek dosyası değil.'); }
  if (!gelen || gelen.uygulama !== UYGULAMA || !gelen.veri || !TABLOLAR.every((t) => Array.isArray(gelen.veri[t]))) return hata('Bu dosya bu uygulamaya ait bir yedek değil.');
  const sayi = TABLOLAR.reduce((s, t) => s + gelen.veri[t].length, 0);
  if (!window.confirm(`Yedekte ${gelen.veri.ogrenciler.length} öğrenci ve toplam ${sayi} kayıt var (${trTarih(String(gelen.tarih || '').slice(0, 10))}).\n\nŞu anki veriler bu yedekle değiştirilecek. Devam edilsin mi?`)) return;
  await depoYaz('onceki', D);
  D = veriDuzelt(gelen.veri);
  await kaydet();
  geriAlinabilir = true;
  mesaj = ['iyi', 'Yedek geri yüklendi.'];
  ciz();
}
async function geriAl() {
  const onceki = await depoOku('onceki');
  if (!onceki || !window.confirm('Geri yüklemeden önceki verilere dönülsün mü?')) return;
  await depoYaz('onceki', D);
  D = veriDuzelt(onceki);
  await kaydet();
  mesaj = ['iyi', 'Önceki verilere dönüldü.'];
  ciz();
}

// =====================================================================
// 7) Yönlendirme — adres çubuğundaki "#/sayfa" kısmına göre doğru sayfayı çizer
// =====================================================================
const icerik = document.getElementById('icerik');
const sonListe = {}; // her sayfa için en son bakılan filtreli liste; kaydettikten sonra oraya dönülür
let mesaj = null;
const git = (hedef) => { if (location.hash === '#' + hedef) ciz(); else location.hash = hedef; };

function formHazirla() {
  const kutu = document.querySelector('.net-kutu');
  if (!kutu) return;
  const kural = Number(kutu.dataset.net);
  const al = (ad) => { const el = document.getElementById('a_' + ad); return el && el.value !== '' ? Number(el.value) : null; };
  const hesapla = () => {
    const toplam = al('toplam'), dogru = al('dogru') || 0, yanlis = al('yanlis') || 0;
    document.getElementById('netDeger').textContent = toplam === null ? '—' : String(yuvarla(dogru - (kural > 0 ? yanlis / kural : 0))).replace('.', ',');
    const bos = document.getElementById('a_bos');
    if (bos && toplam !== null) bos.placeholder = Math.max(0, toplam - dogru - yanlis);
  };
  ['toplam', 'dogru', 'yanlis'].forEach((ad) => document.getElementById('a_' + ad).addEventListener('input', hesapla));
  hesapla();
}

function ciz() {
  const [yolHam, sorguHam = ''] = (location.hash.slice(1) || '/').split('?');
  const q = Object.fromEntries(new URLSearchParams(sorguHam));
  const [, slug, ikinci] = yolHam.split('/');
  const yol = '/' + (slug || '');
  const t = TANIMLAR[slug];
  let html;
  if (!(CIZELGE_SABLON[slug] && q.duzenle)) taslak = null;
  if (yol === '/') html = anaSayfa();
  else if (yol === '/ilerleme') html = ilerlemeSayfasi(q);
  else if (yol === '/ayarlar') html = ayarlarSayfasi();
  else if (CIZELGE_SABLON[slug] && !ikinci) html = cizelgeSayfasi(slug, q);
  else if (t && !ikinci) { sonListe[slug] = location.hash.slice(1); html = listeSayfasi(slug, q); }
  else if (t && ikinci === 'yeni') {
    let kayit = { tarih: tarihGecerli(q.tarih) ? q.tarih : bugun(), verilis: bugun(), ogrenci_id: q.ogrenci || '' };
    const kaynak = q.kopya && D[t.tablo].find((k) => k.id === Number(q.kopya));
    if (kaynak) kayit = { ...kaynak, tarih: bugun(), gercek_soru: '', gerceklesen: '', ...(t.durumAlani ? { [t.durumAlani]: '' } : {}) };
    html = formSayfasi(slug, kayit, {}, true);
  } else if (t && /^\d+$/.test(ikinci)) {
    const kayit = D[t.tablo].find((k) => k.id === Number(ikinci));
    html = kayit ? formSayfasi(slug, kayit, {}, false) : '<div class="bos-durum"><p>Bu kayıt bulunamadı; silinmiş olabilir.</p></div>';
  } else html = '<div class="bos-durum"><p>Aradığınız sayfa bulunamadı.</p><a class="dugme" href="#/">Ana sayfaya dön</a></div>';

  const bildirim = mesaj ? `<div class="bildirim ${mesaj[0]}">${e(mesaj[1])}</div>` : '';
  mesaj = null;
  icerik.innerHTML = bildirim + html;
  menuleriCiz(yol);
  formHazirla();
  genislikAyarla();
}

window.addEventListener('hashchange', () => { ciz(); window.scrollTo(0, 0); });

document.addEventListener('submit', (olay) => {
  const form = olay.target;
  if (!form.dataset.form) return;
  olay.preventDefault();
  if (form.dataset.form === 'kayit') kayitGonder(form, olay.submitter).catch(hataGoster);
  else if (form.dataset.form === 'cizelge') cizelgeKaydet(form).catch(hataGoster);
  else if (form.dataset.form === 'filtre') git(form.dataset.yol + sorguYap(Object.fromEntries(new FormData(form))));
  else if (form.dataset.form === 'listeler') {
    const v = new FormData(form);
    D.ayarlar.dersler = satirlar(v.get('dersler')).join('\n');
    D.ayarlar.net_kurali = [0, 3, 4].includes(Number(v.get('net_kurali'))) ? Number(v.get('net_kurali')) : 4;
    kaydet().then(() => { mesaj = ['iyi', 'Ayarlar kaydedildi.']; ciz(); window.scrollTo(0, 0); }).catch(hataGoster);
  }
});
document.addEventListener('change', (olay) => {
  if (olay.target.matches('select[data-otomatik]')) olay.target.form.requestSubmit();
});
document.addEventListener('click', (olay) => {
  const dugme = olay.target.closest('[data-islem]');
  if (!dugme) return;
  olay.preventDefault();
  const id = Number(dugme.dataset.id), slug = dugme.dataset.slug;
  const is = { sil: () => sil(slug, id), tamamla: () => tamamla(slug, id), yedek: yedekAl, 'geri-yukle': geriYukle, 'geri-al': geriAl }[dugme.dataset.islem] || (cizelgeIslemleri[dugme.dataset.islem] && (() => cizelgeIslemleri[dugme.dataset.islem](dugme)));
  if (is) Promise.resolve(is()).catch(hataGoster);
});

function hataGoster(hata) {
  console.error(hata);
  icerik.insertAdjacentHTML('afterbegin', `<div class="bildirim kotu">Bir hata oluştu ve son işlem kaydedilememiş olabilir: ${e(hata && hata.message || hata)}</div>`);
  window.scrollTo(0, 0);
}

// =====================================================================
// 8) Başlangıç
// =====================================================================
(async function basla() {
  try {
    D = veriDuzelt((await depoOku('veri')) || {});
    geriAlinabilir = !!(await depoOku('onceki'));
  } catch (hata) {
    icerik.innerHTML = `<div class="bildirim kotu">Bu tarayıcıda veri saklanamıyor (${e(hata && hata.message || hata)}). Gizli sekmede açtıysanız normal sekmede açın.</div>`;
    return;
  }
  // Tarayıcıdan, yer açmak için bu verileri kendiliğinden silmemesini iste.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  ciz();
})();
