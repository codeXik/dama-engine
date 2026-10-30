# dama-engine

Türk daması için kural motoru ve bilgisayar oyuncusu. Ücretsizdir ve MIT lisansıyla dağıtılır. Başka hiçbir pakete ihtiyaç duymaz. Düz JavaScript ile yazıldığı için tarayıcıda da Node.js'te de derlemeden çalışır.

Motor şunları yapar:

- Başlangıç dizilişini kurar (8×8 tahta, her oyuncuda 16 taş).
- Sırası gelen oyuncunun yapabileceği bütün hamleleri verir: taşın ileri ve yana gitmesi, damanın uzağa gitmesi, zorunlu alma, en çok taş alan yolun seçilmesi, seri alma.
- Hamleyi uygular, taşın dama olmasını ve beraberlik sayacını işler.
- Oyunun bitip bitmediğini söyler: taşı kalmayan ya da hamle yapamayan kaybeder, uzun süre alma olmazsa berabere biter.
- Konumu kaydedilip sonra kaldığı yerden sürdürülebilir.
- Üç seviyede bilgisayar oyuncusu içerir: easy, normal ve hard.

Kuralların ayrıntısı: [docs/KURALLAR.md](docs/KURALLAR.md).

## Hızlı başlangıç

İki bilgisayarın bir oyunu sonuna kadar oynaması:

```js
import { initialState, applyMove, gameResult, chooseMove } from './src/index.js';

let durum = initialState();                     // beyaz alttan başlar ve yukarı doğru oynar
while (!gameResult(durum)) {
  const hamle = chooseMove(durum, 'normal', 50); // 50 ms düşünür
  durum = applyMove(durum, hamle);
}
console.log(gameResult(durum));                  // { winner: 1 | -1 | 0, reason: '...' }
```

## Tahta ve taşlar

Tahta 64 kareden oluşur; kare numarası `satır * 8 + sütun` olarak bulunur ve 0. satır en üsttedir. Kareyi okunur yazmak için `squareName(kare)` kullanılır (örneğin `a8`).

| Taraf | Değer | Yönü |
| --- | --- | --- |
| Beyaz (`WHITE`) | `1` | alttan başlar, yukarı gider |
| Siyah (`BLACK`) | `-1` | üstten başlar, aşağı gider |

Tahtadaki taşlar: `1` / `-1` taş (`MAN`), `2` / `-2` dama (`DAMA`). `0` boş kareyi gösterir.

## Bir oyunun oynanışı

Oyunun durumu `{ board, turn, quiet }` biçimindedir: `board` 64 elemanlı dizi, `turn` sırası gelen taraf, `quiet` alma ve taş hamlesi olmadan geçen yarım hamle sayısı.

| Yapılacak iş | Komut |
| --- | --- |
| Başlangıç durumu | `initialState()` |
| Yapılabilecek hamleler | `legalMoves(durum)` |
| Hamleyi oynamak | `applyMove(durum, hamle)` (yeni durumu verir, eskisini değiştirmez) |
| Oyun bitti mi | `gameResult(durum)` (devam ediyorsa `null`) |
| Taş sayıları | `countPieces(durum)` |
| İki hamle aynı mı | `sameMove(a, b)` |

Bir hamle şu biçimdedir: `{ from, to, path, caps }`. `from` taşın başladığı kare, `to` indiği kare, `path` uğradığı kareler (seri almada birden çok), `caps` aldığı taşların kareleri. Alma varsa `legalMoves` yalnız alma hamlelerini ve içlerinden en çok taş alanları verir.

Oyun bittiğinde `gameResult` `{ winner, reason }` döner. `winner` beyaz için `1`, siyah için `-1`, beraberlikte `0`. `reason`: `noPieces` (taşı kalmadı), `blocked` (hamle yapamıyor), `quiet` (100 yarım hamle alma ve taş hamlesi olmadı).

## Kaydetme ve yükleme

```js
const kayit = JSON.stringify(stateToJSON(durum));
const durum2 = stateFromJSON(JSON.parse(kayit));
```

## Bilgisayar oyuncusu

```js
const hamle = chooseMove(durum, 'hard');        // 'easy', 'normal' ya da 'hard'
const hizli = chooseMove(durum, 'hard', 300);   // en çok 300 ms düşünsün
```

Bilgisayar, sırası gelen tarafın hamlesini seçer; hamle yoksa `null` döner. Zamanla derinleşen bir alfa-beta aramasıdır.

| Seviye | Nasıl oynar |
| --- | --- |
| `easy` | Az derin düşünür ve ara sıra ikinci ya da üçüncü en iyi hamleyi oynar |
| `normal` | Orta derinlikte arar |
| `hard` | Süre elverdiğince derin arar |

Aramanın süresi seviyenin kendi süresidir (`LEVELS`); üçüncü parametreyle kısaltılabilir ya da uzatılabilir. Bilgisayarın düşündüğü süre uzun olabileceği için tarayıcıda arka plan işçisinde (Web Worker) çalıştırmak iyi olur.

## Testler

```bash
npm test
```

## Lisans

MIT. Skynon Labs Ltd. [dama98](https://skynonlabs.com/browser-extensions/dama98/) eklentisinin motorudur.
