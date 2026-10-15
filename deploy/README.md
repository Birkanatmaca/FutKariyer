# Sunucu kurulumu

Tek sunucuda Docker Compose ile çalışır: PostgreSQL 16 (dışarı açık değil) ve API (port 8092).
Sunucudaki diğer Docker uygulamalarına dokunmaz; proje adı `futcareer`, dizin `/opt/futcareer`.

## Güncelleme

```sh
deploy/build.sh
rsync -az --delete --exclude .env deploy/out/ root@SUNUCU:/opt/futcareer/
ssh root@SUNUCU 'cd /opt/futcareer && docker compose up -d --build'
```

API her başlangıçta bekleyen migration'ları uygular. Veritabanı şifresi yalnızca sunucudaki
`/opt/futcareer/.env` dosyasındadır (izin 600); depoya konmaz. Örnek: `deploy/.env.example`.

## İlk yönetici

Şifre ekranda görünmeden sorulur:

```sh
ssh -t root@SUNUCU 'cd /opt/futcareer && read -p "Ad soyad: " N && read -p "E-posta: " E && read -p "Kullanıcı adı: " U && read -s -p "Şifre (en az 10 karakter): " P && echo && docker compose exec -e ADMIN_FULL_NAME="$N" -e ADMIN_EMAIL="$E" -e ADMIN_USERNAME="$U" -e ADMIN_PASSWORD="$P" api /app/admin'
```

## Demo ortamı

Kullanıcı kararıyla (15 Ekim 2026) sunucuda, giriş yapınca uygulamayı başkaları da kullanıyormuş gibi gösteren kurgusal bir demo verisi kurulabilir. Demo verisi **migration değildir** (migration her ortama kalıcı olarak giderdi); API imajındaki ayrı `/app/seed` komutuyla kurulur ve kaldırılır. Şifre her çalıştırmada rastgele üretilir ve yalnızca stdout'a yazılır; dosyaya root'tan başkasının okuyamayacağı biçimde yönlendir:

```sh
ssh root@SUNUCU 'cd /opt/futcareer && umask 077 && docker compose exec -T api /app/seed demo > /root/futcareer-demo-girisleri.txt'
ssh root@SUNUCU 'cd /opt/futcareer && umask 077 && docker compose exec -T api /app/seed demo --follow-email sen@ornek.com > /root/futcareer-demo-girisleri.txt'
ssh root@SUNUCU 'cd /opt/futcareer && docker compose exec -T api /app/seed demo --status'
ssh root@SUNUCU 'cd /opt/futcareer && docker compose exec -T api /app/seed demo --remove'
```

- `demo` önceki demo verisini aynı transaction içinde silip yeniden kurar (tekrar çalıştırmak çoğaltmaz, şifreyi yeniler). Sayılar stderr'e yazılır.
- `--follow-email` var olan, etkin bir sporcu/kulüp/antrenör hesabını altı demo sporcuya takip ettirir, son üç gönderisini beğendirir ve iki bekleyen tanışma isteği + bildirimi gönderir. Yalnızca o hesap etkilenir; sonraki `demo` çalıştırmasında bayrak verilmezse bu etkileşimler kalkar.
- `--remove` tüm demo hesaplarını ve onlara bağlı her kaydı (gönderi, beğeni, yanıt, takip, başvuru, kadro, tanışma isteği, haber, demo ligi, turnuva, bildirim) siler. Gerçek hesapların demo içerikle etkileşimleri de gider; gerçek bir sporcunun demo kulübe yaptığı takım başvurusu silinir ve hakkı geri döner.
- Demo hesapları `@demo.futcareer.test` e-postalarıyla (sporcular) ve `demo.` ile başlayan kullanıcı adlarıyla (kulüp/organizasyon; bunların e-postası da aynı alan adındadır) tanınır. Gerçek hesaplara bu ön ek/alan adı verilmemelidir.

## Yönetici paneli

`http://SUNUCU/securityadmin`. HTTPS kurulana kadar `.env` içinde `ADMIN_ORIGIN=http://SUNUCU` ve `ADMIN_ALLOW_INSECURE_HTTP=true` gerekir. Daha güvenli seçenek: `ADMIN_ALLOW_INSECURE_HTTP` kaldırılıp `ADMIN_ORIGIN=http://localhost:8092` ile yalnızca SSH tüneli (`ssh -L 8092:localhost:8092 root@SUNUCU`).

## Açık işler

- Alan adı ve TLS: iOS/Android yayın sürümleri HTTPS ister; `ADMIN_ORIGIN` da HTTPS olmalıdır.
- API şu an düz HTTP ile 80 ve 8092 portlarında yayında; admin paneli `ADMIN_ALLOW_INSECURE_HTTP=true` ile `http://SUNUCU/securityadmin` adresinde açık. Oturumlar şifresiz gider.
- Mobil uygulama geçici olarak düz HTTP kullanıyor: `mobile/src/shared/lib/config.ts` (`productionApiUrl`, `allowInsecureApi`) ve `mobile/ios/FutCareer/Info.plist` (`NSAllowsArbitraryLoads=true`; `NSAllowsLocalNetworking` bu süre boyunca olmamalı, çünkü varken iOS `NSAllowsArbitraryLoads`'u yok sayar). HTTPS kurulunca üçü de geri alınmalı; App Store bu ayarla uygulamayı reddeder.
