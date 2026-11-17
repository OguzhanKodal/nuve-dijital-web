# Nüve Dijital — web sitesi

Tek sayfalık statik site. Derleme adımı yok: `index.html` + `assets/`.

- **Kimlik:** Revak (turunç #FF5B1F, mürekkep #121212, kireç #EFEEE9), Archivo (Google Fonts), kemer işareti.
- **Hareket:** GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13 (`assets/vendor/`, yerel). `prefers-reduced-motion` açıkken pin/scrub kapanır, içerik doğrudan görünür.
- **Görseller:** `assets/img/gen/` gpt-image-2 ile üretildi (kaynak PNG'ler `_kaynak-gorseller/`, yayına gerekmez). biDaha, Nabız ve Kafein'le görselleri gerçek ekran görüntüleri.

## Yerelde açmak
`index.html`'i tarayıcıda açın (dosya olarak açılır, sunucu gerekmez).

## Yayın (GitHub Pages)
Depoyu GitHub'a gönderin → Settings → Pages → Branch: `main`, klasör `/ (root)`. Alan adı `nuvedigital.com` (kökteki `CNAME` dosyası). Alan adı Squarespace'te, e-posta Google Workspace'te.

## Yer tutucular
- Kurucu fotoğrafı: `assets/img/oguzhan.jpg` koyup `index.html`'deki yorum satırını açın; kemer biçimli çerçeveye oturur.
