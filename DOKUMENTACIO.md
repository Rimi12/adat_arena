# ⚡ ADAT-ARÉNA v2.0 – Számítógépes Adatrögzítő Kioszk

> **Pályaorientációs interaktív mérő- és bemutatórendszer**  
> Intézmény: Zöldmező EGYMI  
> Célcsoport: Pályaválasztás előtt álló diákok, nyílt napok és szakmai bemutatók látogatói

---

## 1. A projekt célja és összefoglalása

Az **ADAT-ARÉNA** egy kifejezetten oktatási intézmények, nyílt napok és pályaorientációs rendezvények számára tervezett, böngészőben futó interaktív kioszk alkalmazás. Elsődleges célja, hogy játékos, versenyszerű formában mutassa be a **Számítógépes adatrögzítő** szakma alapvető kompetenciáit:
* Magabiztos, vakíráson alapuló betű- és szövegrögzítés (QWERTZ kiosztás).
* Nagy sebességű numerikus adatbevitel (Numpad számlázás, összegek, cikkszámok).
* Figyelem és pontosság a hibás adatok kiszűrésében (adatellenőrzés / minőségbiztosítás).

Az alkalmazás nem igényel internetkapcsolatot, szervert vagy szoftvertelepítést: egyetlen önálló HTML fájlban tartalmazza a felületet, a stílusokat és a logikát.

---

## 2. Rendszerarchitektúra és technológiai háttér

| Tulajdonság | Részletek |
|---|---|
| **Architektúra** | *Single-File SPA* (Egyfájlos webalkalmazás: HTML5 + Beágyazott CSS3 + Vanilla JavaScript) |
| **Hálózati igény** | **100% Offline** (CDN-ek és külső függőségek nélkül azonnal indul lokális meghajtóról is) |
| **Kétmonitoros szinkron** | W3C szabványos `BroadcastChannel API` (böngészőablakok közötti, hálózatfüggetlen adatfolyam) |
| **Adattárolás** | Kliensoldali `localStorage` (ranglista és rekordok mentése gépen belül) |
| **Nyomtatás** | Dedikált `@media print` stíluslap zsebméretű névkártyához / matricához (85 × 54 mm) |
| **Böngésző kompatibilitás** | Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari (modern verziók) |

---

## 3. Játékmodulok és mérési mechanizmusok

### A. Gépíró Sprint (QWERTZ)
* **Cél:** Folyamatos magyar szöveg másolása időre (60 másodperces időkeret).
* **Mért mutatók:** 
  * **CPM (Characters Per Minute):** Valós percenkénti leütésszám.
  * **Pontosság (%):** Hibátlan karakterek aránya az összes leütéshez viszonyítva.
* **Vizuális segítség:** Színkódolt ujjzónás billentyűzet segédlet, amely automatikusan kiemeli a következő leütendő karaktert, és jelzi, melyik ujjal kell megnyomni.

### B. Numpad Számlázó (Numerikus blokk)
* **Cél:** Valós irodai tételek – számlaösszegek, bizonylatszámok, irányítószámok és cikkszámok – villámgyors bevitele a numerikus billentyűzetről.
* **Működés:** A számsor beírása után az `Enter` billentyű rögzíti az adatot és vált át a következő tételre.
* **Készségfejlesztés:** A numerikus vakbevitel gyakorlása, a jobb kéz ujjpozícióinak rögzítése.

### C. Adat Hibavadász (Ellenőrzés)
* **Cél:** Bizonylatok és másolatok összehasonlítása, elírások, számcsere-hibák (pl. *4401* vs. *4410*) és téves kódok észlelése.
* **Pontozás:** Helyes hibajelölés esetén bónuszpont, alaptalan jelölés esetén pontlevonás jár.

---

## 4. Kétmonitoros (Versenyző + Kivetítő) üzemmód

A bemutatók látványos lebonyolításához az alkalmazás támogatja az osztott kijelzős működést:

```
+------------------------------------+        BroadcastChannel API        +------------------------------------+
|         1. MONITOR (Kioszk)        |  ===============================>  |       2. MONITOR (Kivetítő)        |
|  - Játékos felülete                |        (Valós idejű szinkron,      |  - Élő CPM és pontszám kijelző     |
|  - Rejtett beviteli mező           |         szerver és hálózat         |  - Látványos animációk             |
|  - Ujjvezető billentyűzet          |            nélkül)                 |  - TOP 10 Ranglista                |
+------------------------------------+                                    +------------------------------------+
```

### Beállítási lépések:
1. Csatlakoztasd a gépre a kivetítőt vagy második monitort **Kiterjesztett asztal** (*Extend Display*) módban.
2. Nyisd meg a fő fájlt az 1. monitoron.
3. Kattints a jobb felső sarokban található **„📺 Kivetítő ablak”** gombra.
4. A megnyíló új ablakot húzd át a 2. monitorra / kivetítőre, majd tedd teljes képernyőre (`F11`).
5. A versenyző játék közben a kioszkon dolgozik, miközben a közönség a kivetítőn élőben látja a leütési sebességét és a toplistát.

---

## 5. Eredményértékelés és Matricanyomtatás

A 60 másodperces forduló végén az alkalmazás összesíti a teljesítményt:

* **Minősítési szintek:**
  * `0 – 119 CPM:` Gyakornok Adatrögzítő
  * `120 – 179 CPM:` Haladó Adatrögzítő ⭐
  * `180+ CPM (és ≥ 95% pontosság):` Mester Adatrögzítő 🏆

### Matrica / Oklevél nyomtatása:
* A diák beírhatja a nevét az eredményjelző ablakban.
* A **„🖨️ Matrica Nyomtatása”** gombra kattintva (vagy `Ctrl + P`) a böngésző kizárólag a névjegykártya méretű (85 × 54 mm) tanúsítványt nyomtatja ki; a menük, gombok és a háttér automatikusan elrejtésre kerülnek.

---

## 6. Gyors üzembe helyezési útmutató (Checklist a nyílt napra)

1. **Fájl elhelyezése:** Másold az `adat_arena.html` fájlt a bemutató gép asztalára.
2. **Megnyitás:** Kattints rá duplán (Chrome vagy Edge javasolt).
3. **Billentyűzet ellenőrzése:** Győződj meg róla, hogy a gép magyar (QWERTZ) billentyűzetkiosztásra van állítva, és a Numpadon be van kapcsolva a `Num Lock`.
4. **Próbamenet:** Kattints a játéktérre (autofókusz a beviteli mezőre), fuss le egy 60 másodperces tesztet.
5. **Kivetítő indítása:** Nyisd meg a kivetítő nézetet a második kijelzőn.
6. **Ranglista karbantartása:** Új nap vagy új csoport indításakor a jobb felső **„🗑️ Ranglista ürítése”** gombbal nullázható az eredménytábla.

---

## 7. Hibaelhárítási GYIK

* **Kérdés:** Miért esett szét a felület Times New Roman stílusúra a korábbi letöltéskor?  
  * **Ok:** Ha a HTML, CSS és JS fájlok külön vannak, és a rendszer letöltéskor átnevezi őket (pl. `gemini-code-xxx.html`), a HTML nem találja a benne hivatkozott `style.css`-t.  
  * **Megoldás:** Az egyfájlos (All-in-One) változat használata, ahol a CSS és a JS közvetlenül a HTML belsejében van, így sosem tud elszakadni egymástól.

* **Kérdés:** Nem regisztrálja a leütéseket a rendszer gépeléskor.  
  * **Megoldás:** Kattints a játéktér közepére. A rendszer ilyenkor automatikusan visszairányítja a fókuszt a háttérben lévő aktív beviteli mezőre.