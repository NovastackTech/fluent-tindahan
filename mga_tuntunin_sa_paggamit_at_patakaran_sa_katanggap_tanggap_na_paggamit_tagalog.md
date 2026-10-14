---
title: Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit (Tagalog)
tags: [legal, compliance, bir-disclaimer, aup, terms-of-use, data-privacy, philippines, tagalog, filipino]
updated: 2026-10-14
---

# 📜 Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit
*(Terms of Use & Acceptable Usage Policy — Bersyong Tagalog / Filipino)*

**Aplikasyon:** Fluent Tindahan (Offline-First Sari-Sari Store & GCash Management PWA)  
**Petsa ng Pagkakabisa:** Oktubre 14, 2026  
**Huridiksyon:** Republika ng Pilipinas  

> [!IMPORTANT]
> ### 🇵🇭 Mahalagang Paalala para sa mga May-ari ng Tindahan
> Bago gamitin ang **Fluent Tindahan**, mangyaring unawain ang apat (4) na pangunahing alituntuning ito:
> 1. **Hindi ito BIR-Accredited POS (Digital Kwaderno Lamang):** Ang Fluent Tindahan ay isang *digital kwaderno* at listahan para sa panloob na pamamahala ng iyong tindahan. Anumang *printout* o *digital slip* mula sa app na ito ay **HINDI** Opisyal na *BIR Sales Invoice*. Kailangan mo pa ring gumamit at mag-isyu ng iyong rehistradong manwal na resibo/*Sales Invoice* mula sa BIR.
> 2. **Hindi Kami Konektado sa GCash:** Ang GCash module dito ay listahan (*logbook*) lamang ng iyong Cash-In at Cash-Out. Laging suriin ang aktwal na balanse at opisyal na *SMS Reference Number* sa loob mismo ng iyong opisyal na GCash app bago magbigay ng pera o paninda.
> 3. **I-Sync ang App at Huwag Burahin ang Browser Data:** Dahil gumagana ang app na ito kahit *offline* (walang internet), ang iyong mga benta, paninda, at listahan ng *utang* ay naka-save muna sa iyong cellphone bago ma-sync sa *cloud*. Huwag burahin ang *browser cache/site data* o gumamit ng *Incognito mode* habang may mga transaksyong hindi pa na-i-sync.
> 4. **Pangalagaan ang Privacy ng Iyong Suki (RA 10173):** Humingi ng pahintulot sa iyong mga *suki* bago ilista ang kanilang pangalan at cellphone number sa *Utang* o *GCash* logbook, at **huwag na huwag** magpo-post ng *screenshot* ng kanilang utang sa social media upang ipahiya sila.

---

## 1. Pagtanggap sa mga Tuntunin

Sa pamamagitan ng pag-access, pag-install, o paggamit ng **Fluent Tindahan** Progressive Web Application ("ang App", "ang Platform", o "ang Serbisyo"), ikaw ("User", "May-ari ng Tindahan", "Merchant", o "Tenant") ay sumasang-ayon na sumunod at mapasailalim sa **Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit** ("Mga Tuntunin") na ito. Kung hindi ka sumasang-ayon sa lahat ng Mga Tuntuning ito, huwag gamitin ang App.

---

## 2. Kalikasan ng Serbisyo at Offline-First na Sistema

Ang **Fluent Tindahan** ay isang *offline-first digital kwaderno*, talaan ng imbentaryo at panindang *tingi*, listahan ng *utang* (*palista*), at talaan ng transaksyon sa *e-wallet* na sadyang ginawa para sa mga *sari-sari store* at maliliit na tindahan sa Pilipinas.

### 2.1 Local-First na Pag-save ng Data (IndexedDB)
Ang App ay gumagamit ng **local-first architecture**:
- Tuwing magtatala ka ng benta, magbabago ng imbentaryo, maglilista ng *utang* (*palista*) o *bayad*, o magla-log ng GCash, ang rekord ay unang ise-save sa loob ng *browser storage* ng iyong cellphone o gadget (**IndexedDB**) at ipipila sa lokal na `syncQueue`.
- Kapag nagkaroon ng koneksyon sa internet, awtomatikong ipapadala ng App ang mga nakapilang rekord nang bultuhan (*by batch*) patungo sa aming *cloud server*.

### 2.2 Responsibilidad ng User sa Cellphone at Pag-Sync
Dahil ang mga rekord ay nasa iyong cellphone lamang hangga't hindi pa na-i-sync sa *cloud*:
- **Huwag Burahin ang Browser Storage:** Ang pagbura sa *browser cache*, *site data*, pag-reset ng cellphone, o pag-uninstall ng browser habang may nakapilang rekord sa `syncQueue` ay permanenteng magbubura sa mga hindi pa na-i-sync na talaan ng iyong tindahan.
- **Bawal Gamitin sa Incognito o Private Browsing:** Huwag gamitin ang App sa *Incognito* o *Private Browsing mode* dahil kusang buburahin ng browser ang iyong lokal na database pagkasara ng window.
- **Pagpapaliban ng Update Habang May Benta:** Upang maprotektahan ang kasalukuyang transaksyon sa kaha, ipinagpapaliban ng App ang pag-reload para sa *software update* habang may laman pa ang iyong *POS cart*. Tungkulin mong tapusin ang transaksyon at regular na kumonekta sa internet upang makapag-sync.

---

## 3. Kawalan ng Akreditasyon sa Bureau of Internal Revenue (BIR)

> [!WARNING]
> **MAHALAGANG PAUNAWA SA BUWIS AT REGULASYON:**  
> **ANG FLUENT TINDAHAN AY HINDI BIR-ACCREDITED NA POINT-OF-SALE (POS) SYSTEM, CASH REGISTER MACHINE (CRM), O COMPUTERIZED ACCOUNTING SYSTEM (CAS).**

### 3.1 Para sa Panloob na Talaan Lamang ("Digital Kwaderno")
Ang POS calculator, barcode scanner, imbentaryo, at listahan sa loob ng Fluent Tindahan ay ibinibigay **bilang panloob na gabay lamang sa pamamahala ng tindahan at digital na kapalit ng sulat-kamay na kwaderno**.

### 3.2 Katayuan ng Thermal Printouts at Digital Slips
Anumang digital na buod, *order slip*, o imprenta mula sa *Bluetooth thermal printer* na galing sa App na ito:
1. **AY HINDI** valid na "Sales Invoice", "Official Receipt", o opisyal na resibong kinikilala ng Bureau of Internal Revenue (BIR) sa ilalim ng National Internal Revenue Code (NIRC) o Republic Act No. 11976 (*Ease of Paying Taxes Act*).
2. **AY HINDI DAPAT** ibigay o ipakilala sa mamimili bilang opisyal na resibo sa buwis o patunay ng *input tax credit*.
3. Ay dapat laging may nakasaad o ituring na may paalalang:  
   **`"PARA SA PANLOOB NA TALAAN LAMANG — ANG DOKUMENTONG ITO AY HINDI VALID PARA SA PAG-CLAIM NG INPUT TAX" (FOR INTERNAL RECORD-KEEPING ONLY — THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX).`**

### 3.3 Tanging Responsibilidad ng May-ari ng Tindahan sa Buwis
Ang paggamit ng Fluent Tindahan ay **hindi** naglilibre sa iyo sa mga batas sa buwis ng Pilipinas. Depende sa kategorya ng rehistrasyon ng iyong negosyo (hal. Barangay Micro Business Enterprise (BMBE), Non-VAT Sole Proprietorship, o VAT-registered), ikaw lamang ang may buong responsibilidad sa:
- Pagpapanatili ng rehistradong manwal na *Books of Accounts* sa BIR;
- Pag-iisyu ng opisyal at rehistradong manwal na *BIR Sales Invoice* sa iyong mga mamimili kapag hinihingi ng batas; at
- Paghahain ng tamang *tax returns* sa BIR at pagkuha ng kaukulang permiso sa Barangay at Munisipyo/Lungsod (LGU).

---

## 4. Kawalan ng Kaugnayan sa GCash at mga Kompanya ng FMCG

### 4.1 Independiyenteng Listahan Lamang para sa E-Wallet
Ang Fluent Tindahan ay isang **independiyenteng software** at **walang** kaugnayan, hindi ineendorso, hindi isinusulong, at hindi konektado sa **GCash (G-Xchange, Inc. / Mynt — Globe Fintech Innovations, Inc.)** o sa anumang *Electronic Money Issuer (EMI)* na pinangangasiwaan ng Bangko Sentral ng Pilipinas (BSP).
- **Walang Aktwal na Paglipat ng Pera:** Ang pagtatala ng "Cash-In" o "Cash-Out" sa Fluent Tindahan ay **hindi** naglilipat ng aktwal na balanse sa GCash. Ito ay nagsisilbing listahan lamang sa iyong *digital kwaderno*.
- **Pagsusuri sa Reference Number:** Ikaw ang may buong responsibilidad na suriin ang katotohanan ng bawat transaksyon sa GCash, pagbabago sa balanse, at opisyal na *SMS Reference Number* sa loob mismo ng opisyal na GCash app bago mag-abot ng pera o magbigay ng paninda. Walang pananagutan ang Fluent Tindahan sa anumang pagkalugi dulot ng pekeng *GCash screenshot*, pekeng text message, o pagkakamali sa pag-type ng numero.

### 4.2 Paunang Listahan ng mga Paninda (FMCG Product Catalog)
Ang kasamang listahan ng 138 na karaniwang paninda sa *sari-sari store*, mga tatak (*brands*), kategorya, at *EAN-13 barcodes* (kabilang ang mga produkto ng Monde Nissin, Universal Robina Corporation, Nestlé Philippines, Kopiko, Century Pacific Food, San Miguel Foods, Unilever Philippines, Procter & Gamble, at iba pa) ay inilagay lamang upang mapabilis ang pag-setup ng iyong imbentaryo. Ang lahat ng pangalan ng produkto, tatak, at *trademark* ay pag-aari ng kani-kanilang opisyal na kompanya.

---

## 5. Mga Alituntunin sa Listahan ng Utang (*Utang* / *Palista* Ledger)

### 5.1 Append-Only na Talaang Pinansyal
Upang maiwasan ang hindi sinasadyang pagkabura, pandaraya, at pagkakamali sa kwenta ng sentimo (*integer-centavo math*), ang mga talaang pinansyal sa Fluent Tindahan (`Sale`, `SaleItem`, `UtangLedger`, at `GCashTxn`) ay gumagamit ng **append-only ledger system**. Kapag nai-save na ang isang *palista* (utang) o *bayad*, hindi na ito maaaring burahin o palitan nang patago; anumang pagtatama ay dapat ilista bilang bagong rekord ng bayad o *adjustment*.

### 5.2 Responsibilidad sa Pagpapautang
Ang Fluent Tindahan ay **hindi** isang kompanya ng pautang (*lending/financing company*), bangko, o ahensya ng paniningil (*collection agency*):
- Ang pagpapautang (*palista*) sa iyong *suki* ay pribadong kasunduan sa pagitan mo lamang at ng iyong mamimili.
- Hindi namin ginagarantiyahan ang katumpakan, legal na bisa, o katiyakan na masisingil ang anumang balanseng nakalista sa *Utang Ledger*.

---

## 6. Patakaran sa Katanggap-tanggap na Paggamit (Acceptable Usage Policy)

Bilang kondisyon sa paggamit ng Fluent Tindahan, sumasang-ayon kang **HINDI** gagamitin ang App sa anumang labag sa batas, mapang-abuso, o ipinagbabawal na gawain sa ilalim ng batas ng Pilipinas.

### 6.1 Mga Ipinagbabawal na Paninda at Gawain
Mahigpit na **ipinagbabawal** ang paggamit ng POS, Imbentaryo, *Tingi* breakdown, Notebook, o GCash module upang maglista, magbenta, o magpatakbo ng:
1. **Ilegal at Kontrabandong Produkto:** Pagbebenta o pamamahagi ng ipinagbabawal na gamot (labag sa RA 9165), pekeng produkto (*counterfeit*), puslit o *smuggled* na sigarilyo at vape, expired na pagkain, o nakaw na paninda.
2. **Ilegal na Pagbebenta sa mga Menor de Edad:** Pagbebenta ng sigarilyo (kahit *tingi* o kada stick), vape, o nakalalasing na inumin sa mga menor de edad (wala pang 18 o 21 taong gulang ayon sa batas) na labag sa Republic Act No. 9211 (*Tobacco Regulation Act*) at Republic Act No. 11900 (*Vaporized Nicotine and Non-Nicotine Products Regulation Act*).
3. **Listahan ng Ilegal na Sugal:** Pagtatala ng taya, kubransa, o panalo para sa mga ilegal na sugal (tulad ng *jueteng*, hindi awtorisadong *swertres*, *ending*, o ilegal na *online sabong*).
4. **Money Laundering at Panloloko sa E-Wallet:** Paggamit sa GCash logbook upang itago o padaliin ang *money laundering*, panloloko (*scam/phishing*), o pagiging *money mule* na labag sa Republic Act No. 9160 (*Anti-Money Laundering Act*).

### 6.2 Pagbabawal sa "Pamamahiya sa Utang" (*Debt Shaming*) at Pangha-harass
Bilang mahigpit na pagsunod sa mga **Circular ng National Privacy Commission (NPC)** at **Republic Act No. 10175 (*Cybercrime Prevention Act of 2012 / Cyberlibel*)**:
- **MAHIGPIT NA IPINAGBABAWAL** ang pag-screenshot, pag-export, pag-print, o pag-post sa publiko ng *Utang Ledger*, pangalan ng *suki*, numero ng cellphone, o halaga ng utang sa Facebook, TikTok, Messenger group chat, o paskilan sa barangay upang ipahiya, takutin, o pilitin ang mamimili na magbayad (*pamamahiya*).
- **IPINAGBABAWAL** ang pagharap o pagpapakita ng screen ng *Utang Ledger* sa bintana o parilya ng tindahan kung saan malayang makikita ng ibang kapitbahay o dumadaan ang listahan ng utang ng iyong mga *suki*.

### 6.3 Seguridad ng Sistema at Multi-Tenant Isolation
Sumasang-ayon kang hindi gagawin ang mga sumusunod:
- Subukang lampasan ang **Multi-Tenant Data Isolation** (`TenantId`) o buksan ang mga rekord na pag-aari ng ibang tindahan.
- Magpasok ng sirang data, pekeng rekord, o duplikadong RFC4122 v4 UUID sa lokal na IndexedDB o sa `/api/sync/batch` API.
- Magpadala ng automated scripts o *Denial-of-Service (DoS)* attacks na makakapagpabagal sa server.
- Kopyahin, i-reverse-engineer, o ipamahagi ang source code ng Fluent Tindahan nang walang pahintulot.

---

## 7. Data Privacy at Pagsunod sa RA 10173

Ang paggamit ng Fluent Tindahan ay nasasaklawan ng **Republic Act No. 10173 (*Data Privacy Act of 2012*)** at ng mga Implementing Rules and Regulations nito.

### 7.1 Mga Gampanin sa Ilalim ng Data Privacy Act
- **Ang May-ari ng Tindahan bilang Personal Information Controller (PIC):** Kapag inililista mo ang pangalan, palayaw, cellphone number, at kasaysayan ng transaksyon ng iyong mga *suki* sa *Utang Ledger* o *GCash logbook*, **ikaw ay tumatayong Personal Information Controller (PIC)**.
- **Ang Fluent Tindahan bilang Personal Information Processor (PIP):** Pinoproseso at iniingatan lamang namin sa *cloud* ang iyong mga na-sync na rekord para sa iyong tindahan upang magsilbing *backup* at magamit mo sa iyong awtorisadong device.

### 7.2 Ang Iyong mga Tungkulin Bilang May-ari ng Tindahan
Bilang PIC sa iyong tindahan, sumasang-ayon at tinitiyak mo na:
1. **May Pahintulot ng Suki (Informed Consent):** Ipaaalam mo at hihingin ang pahintulot ng iyong mamimili bago ilista ang kanilang personal na impormasyon (tulad ng cellphone number sa GCash log o pangalan sa listahan ng *utang*).
2. **Limitadong Impormasyon Lamang (Data Minimization):** Ang ililista mo lamang ay ang impormasyong kailangan sa lehitimong talaan ng tindahan. **Huwag na huwag** isusulat sa *notes* ng App ang password, GCash MPIN, One-Time Password (OTP), o sensitibong government ID number ng iyong mamimili.
3. **Seguridad ng Cellphone/Gadget:** Lalagyan mo ng *screen lock* (PIN, pattern, password, o fingerprint) ang cellphone o tablet na ginagamit sa Fluent Tindahan upang hindi mabuksan ng ibang tao ang listahan sakaling mawala o manakaw ang iyong gadget.

---

## 8. Pagtatanggi at Limitasyon ng Pananagutan (Limitation of Liability)

### 8.1 Pagbibigay ng Serbisyo "As-Is" at "As-Available"
Ang Fluent Tindahan ay ibinibigay nang **"AS IS"** at **"AS AVAILABLE"** nang walang anumang garantiya, hayag man o ipinahiwatig. Bagama't gumagamit ang App ng *integer-centavo math* at *append-only ledgers* para sa eksaktong kwenta, hindi namin ginagarantiyahan na ang App ay walang magiging aberya o ligtas sa pagkasira ng iyong cellphone.

### 8.2 Kawalan ng Pananagutan sa Pagkalugi sa Negosyo, Buwis, o Pera
Sa pinakamataas na antas na pinapayagan ng batas ng Pilipinas, ang mga bumuo at nagpapatakbo ng Fluent Tindahan ay **walang pananagutan** sa anumang direkta o hindi direktang pinsala o pagkalugi na nagmula sa:
1. **Multa o Parusa mula sa BIR o LGU:** Anumang multa, *penalty*, *compromise*, o pagpapasara ng tindahan na ipinataw ng BIR o LGU dahil sa hindi mo pag-iisyu ng opisyal na manwal na *BIR Sales Invoice* o hindi paggamit ng BIR-accredited POS;
2. **Pagkawala ng Data Bago Ma-Sync:** Pagkawala ng rekord ng benta, imbentaryo, GCash, o *utang* dahil sa pagkawala o pagkasira ng cellphone, pagkaubos ng baterya, o pagbura sa *browser IndexedDB cache* bago pa makapag-sync sa internet;
3. **Hindi Nabayarang Utang o Pagtatalo sa Presyo/Sukli:** Anumang pagtanggi o hindi pagbabayad ng *suki* sa kanyang nakalistang *utang*, o anumang hindi pagkakaunawaan sa *sukli* o presyo ng panindang *tingi*;
4. **Panloloko sa GCash (Scam):** Pagkalugi ng pera dahil sa pekeng *GCash screenshot*, *scam*, maling nailistang numero ng cellphone, o dobleng pagbibigay ng *cash-out*.

---

## 9. Pagsuspinde at Pagwawakas ng Account

May karapatan kaming suspindihin, limitahan, o wakasan ang iyong *cloud synchronization account* (`TenantId`) nang agaran kung mapatunayang:
- Nilabag mo ang **Patakaran sa Katanggap-tanggap na Paggamit (Seksyon 6)**, kabilang ang paglilista ng ilegal na kontrabando, ilegal na sugal, o pamamahiya ng may utang sa social media;
- Ang iyong account ay nagdudulot ng panganib sa seguridad o katatagan ng aming server; o
- Iniutos ito ng hukuman sa Pilipinas, National Privacy Commission (NPC), Bureau of Internal Revenue (BIR), Bangko Sentral ng Pilipinas (BSP), o ng mga awtoridad ng batas.

---

## 10. Sumasaklaw na Batas at Hukuman (Governing Law)

Ang Mga Tuntuning ito ay pamamahalaan at bibigyang-kahulugan alinsunod sa mga batas ng **Republika ng Pilipinas**. Anumang legal na aksyon o usapin na may kaugnayan sa Mga Tuntuning ito o sa paggamit ng Fluent Tindahan ay idudulog lamang sa mga nararapat na hukuman sa Pilipinas.

---

## 11. Pagsang-ayon ng User (In-App Consent Text sa Tagalog)

*Maaaring ilagay sa checkbox ng onboarding at Data Privacy consent dialog ng PWA:*

> **"Nabasa at sinasang-ayunan ko ang Mga Tuntunin sa Paggamit (Terms of Use) at Patakaran sa Data Privacy.** Naiintindihan ko na ang **Fluent Tindahan ay isang digital kwaderno lamang at HINDI BIR-accredited POS**, hindi konektado sa GCash, at tanging tungkulin ko ang mag-isyu ng opisyal na BIR Sales Invoice at pangalagaan ang data privacy ng aking mga suki alinsunod sa Republic Act No. 10173."