# news-image-20261124

[![competition](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/toirant/news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/toirant/news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124)

Sum up 24 November's world news in one image — entry for the
[news-image-20261124](https://make.fun/bounty/news-image-20261124) bounty on
[make.fun](https://make.fun).

## The image

A newspaper front page, "THE WORLD IN ONE DAY — TUESDAY 24 NOVEMBER 2026",
drawn entirely in code. It covers the day's news as reported by the morning
of 24 November 2026:

- **Lead — Huang is back at Nvidia.** Nvidia's board voted on Monday to
  reinstate Jensen Huang as chief executive, 12 days after he resigned over
  affairs including one with a woman alleged to be a Chinese spy. President
  Trump lobbied the board and sent Vice President JD Vance to press the
  case; shares jumped about 30%.
- **War goes global.** Ukraine says seven sea drones sank the Russian
  corvette Merkury at Benghazi, Libya, destroyed a Ka-27 helicopter on
  board, and hit the cargo ship MV Angara.
- **A weapon in orbit?** Allies warn Russia may launch a nuclear space
  weapon next month; NATO vowed to strengthen its space defences.
- **Kyiv region.** Russian strikes killed at least 14 people.
- **Also today.** Trump speeds up federal executions; US states sue Musk
  firms over Grok; China hands a death sentence for spying; more bodies
  found in the Indonesia factory fire; drones hit homes and a UN site in
  Sudan; the US will host the 2031 Women's World Cup.

## How it is built

`main.ts` (Node 22, standard library only) draws the front page on a
1024x1024 RGB canvas with a hand-built 5x7 bitmap font, then writes it as
a PNG with a hand-written encoder (zlib deflate, CRC32, chunk framing).
No network, no clock, no randomness: two runs write byte-identical output.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It writes `out/entry.png` (1024x1024, under 1 MiB). Two runs from a clean
output directory write byte-identical files.

Sources for the stories: AP, Reuters, CNN, WSJ and SCMP coverage of
24 November 2026.

## License

MIT — see [LICENSE](LICENSE).
