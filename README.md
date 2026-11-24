# Nüve Dijital — web sitesi

Tek sayfalık statik site. Derleme adımı yok: `index.html` + `assets/`.

- **Kimlik:** Revak (turunç #FF5B1F, mürekkep #121212, kireç #EFEEE9), Archivo (Google Fonts), kemer işareti.
- **Hareket:** GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13 (`assets/vendor/`, yerel). `prefers-reduced-motion` açıkken pin/scrub kapanır, içerik doğrudan görünür.
- **HTML-in-Canvas (taslak 2):** `assets/js/kemer-gl.js`. Chrome/Edge 157+ gibi destekleyen tarayıcılarda üç bölüm WebGL tuvaline taşınır, HTML yerinde kalır (seçilir, tıklanır): giriş = kemer mercek, manifesto = mürekkep, iletişim = su. Desteklemeyen tarayıcı (Safari/iPhone dahil), az hareket tercihi ya da adrese `?efektsiz` eklenince site taslak 1 gibi davranır. Tuvale giren bölümlerdeki resimler aynı kaynaktan (ya da `data:`) gelmeli; `file://` ile açınca yerel resimler tuvale aktarılmaz, bu yüzden girişteki biDaha ikonu satır içi.
- **Görseller:** `assets/img/gen/` gpt-image-2 ile üretildi (kaynak PNG'ler `_kaynak-gorseller/`, yayına gerekmez). biDaha, Nabız ve Kafein'le görselleri gerçek ekran görüntüleri.

## Sürümler
- Taslak 1 (efektsiz): git etiketi `taslak-1`, ayrıca `~/Projects/nuve-dijital-web-taslak1/` kopyası.
- Taslak 2: bu klasör (taslak 1 + HTML-in-Canvas katmanı).

## Yerelde açmak
`index.html`'i tarayıcıda açın (dosya olarak açılır, sunucu gerekmez).

## Yayın (GitHub Pages)
Depoyu GitHub'a gönderin → Settings → Pages → Branch: `main`, klasör `/ (root)`. Alan adı için kök dizine `CNAME` dosyası (`nuvedijital.com`) ekleyin.

## Yer tutucular
- E-posta `merhaba@nuvedijital.com` ve Instagram `@nuvedijital` (`index.html`, iletişim bölümü).
- Kurucu fotoğrafı: `assets/img/oguzhan.jpg` koyup `index.html`'deki yorum satırını açın; kemer biçimli çerçeveye oturur.
