export interface QuickSummaryPoint {
  title: string;
  desc: string;
}

export interface TermsSubsection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  callout?: {
    type: 'warning' | 'info';
    title: string;
    text: string;
  };
}

export interface TermsSection {
  id: string;
  title: string;
  paragraphs?: string[];
  subsections?: TermsSubsection[];
  bullets?: string[];
  numbered?: string[];
  callout?: {
    type: 'warning' | 'info';
    title: string;
    text: string;
  };
  acknowledgmentBox?: string;
}

export interface TermsDocument {
  title: string;
  subtitle: string;
  application: string;
  effectiveDate: string;
  jurisdiction: string;
  quickSummary: {
    title: string;
    notice: string;
    points: QuickSummaryPoint[];
  };
  sections: TermsSection[];
}

export const termsEN: TermsDocument = {
  title: 'Terms of Use & Acceptable Usage Policy',
  subtitle: 'Official User Agreement & Operational Standards',
  application: 'Fluent Tindahan (Offline-First Sari-Sari Store & GCash Management PWA)',
  effectiveDate: 'October 14, 2026',
  jurisdiction: 'Republic of the Philippines',
  quickSummary: {
    title: 'Quick Summary for Store Owners',
    notice: 'Before using Fluent Tindahan, please understand these four (4) core rules:',
    points: [
      {
        title: 'Not a BIR-Accredited POS (Digital Notebook Only)',
        desc: 'Fluent Tindahan is an internal digital notebook and store tracker. Any printout or digital slip it generates is NOT an Official BIR Sales Invoice. You must still issue your manual BIR-registered Sales Invoices as required by law.'
      },
      {
        title: 'Not Affiliated with GCash',
        desc: 'The GCash module is strictly a digital logbook for your Cash-In and Cash-Out records. Always verify the actual wallet balance and SMS Reference Number inside your official GCash app before handing over physical cash.'
      },
      {
        title: 'Sync Regularly & Do Not Clear Browser Data',
        desc: 'Because this app works offline, your sales, inventory, and credit (utang) records are saved on your phone first before syncing to the cloud. Do not clear your browser cache/site data or use Incognito mode while you have unsynchronized records.'
      },
      {
        title: 'Protect Customer Privacy (RA 10173)',
        desc: 'Obtain permission from your regular customers (suki) before recording their names and mobile numbers in the Credit (Utang) or GCash logbooks, and never post screenshots of their debts on social media to shame them.'
      }
    ]
  },
  sections: [
    {
      id: 'sec-1',
      title: '1. Acceptance of Terms',
      paragraphs: [
        'By accessing, installing, or using the Fluent Tindahan Progressive Web Application ("the App", "the Platform", or "the Service"), you ("User", "Store Owner", "Merchant", or "Tenant") agree to be bound by these Terms of Use and Acceptable Usage Policy ("Terms"). If you do not agree to all of these Terms, you must not access or use the App.'
      ]
    },
    {
      id: 'sec-2',
      title: '2. Nature of the Service & Offline-First Architecture',
      paragraphs: [
        'Fluent Tindahan is an offline-first digital notebook (digital kwaderno), inventory and micro-retail (tingi) tracker, informal credit (utang) ledger, and e-wallet transaction logger designed for Philippine neighborhood stores (sari-sari stores) and micro-retailers.'
      ],
      subsections: [
        {
          id: 'sec-2-1',
          title: '2.1 Local-First Storage (IndexedDB)',
          paragraphs: [
            'The App operates on a local-first architecture:',
            'When you record a sale, adjust inventory, log a credit (palista) or repayment (bayad), or record a GCash entry, the transaction is initially saved locally inside your device browser\'s database (IndexedDB) and queued in a local synchronization table (syncQueue).',
            'When internet connectivity is available, the App\'s background synchronization engine uploads your queued transactions in batches to our cloud servers.'
          ]
        },
        {
          id: 'sec-2-2',
          title: '2.2 User Responsibility for Device & Sync Hygiene',
          paragraphs: [
            'Because records exist solely on your local device until synchronized to the cloud:'
          ],
          bullets: [
            'Do Not Clear Browser Storage: Clearing your browser cache, clearing site data, resetting your phone, or uninstalling your browser while offline mutations are pending in the syncQueue will permanently delete unsynchronized store records.',
            'No Incognito or Private Browsing: You must not use the App in Incognito or Private Browsing mode, as the browser will automatically wipe your local database when the window is closed.',
            'Deferred Updates During Active Sales: To protect open transactions, the App defers service worker updates while items are in your active POS cart. You agree to complete active transactions and allow periodic synchronization over stable internet connections.'
          ]
        }
      ]
    },
    {
      id: 'sec-3',
      title: '3. Non-Accreditation with the Bureau of Internal Revenue (BIR)',
      callout: {
        type: 'warning',
        title: 'CRITICAL TAX & REGULATORY DISCLAIMER',
        text: 'FLUENT TINDAHAN IS NOT A BIR-ACCREDITED POINT-OF-SALE (POS) SYSTEM, CASH REGISTER MACHINE (CRM), OR COMPUTERIZED ACCOUNTING SYSTEM (CAS).'
      },
      subsections: [
        {
          id: 'sec-3-1',
          title: '3.1 Strictly for Internal Record-Keeping ("Digital Notebook")',
          paragraphs: [
            'The Point-of-Sale (POS) calculator, barcode scanner, inventory tracker, and ledger features of Fluent Tindahan are provided strictly as an internal management aid and digital replacement for a handwritten store notebook (kwaderno).'
          ]
        },
        {
          id: 'sec-3-2',
          title: '3.2 Status of Thermal Printouts and Digital Slips',
          paragraphs: [
            'Any digital summary, order slip, or Bluetooth thermal printout generated by the App:'
          ],
          numbered: [
            'IS NOT a valid "Sales Invoice", "Official Receipt", or commercial invoice recognized by the Bureau of Internal Revenue (BIR) under the National Internal Revenue Code (NIRC) or Republic Act No. 11976 (Ease of Paying Taxes Act).',
            'MUST NOT be issued or represented to customers as an official tax invoice or proof of input tax credit.',
            'Must always bear or be understood to carry the notice: "FOR INTERNAL RECORD-KEEPING ONLY — THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX."'
          ]
        },
        {
          id: 'sec-3-3',
          title: '3.3 Merchant\'s Sole Responsibility for Tax Compliance',
          paragraphs: [
            'Using Fluent Tindahan does not exempt you from Philippine tax laws. Depending on your business registration status (e.g., Barangay Micro Business Enterprise (BMBE), Non-VAT Sole Proprietorship, or VAT-registered entity), you remain solely and exclusively responsible for:'
          ],
          bullets: [
            'Maintaining BIR-registered manual Books of Accounts;',
            'Issuing duly registered manual BIR Sales Invoices to your customers when required by law; and',
            'Filing accurate tax returns with the BIR and securing necessary Local Government Unit (LGU) and Barangay business permits.'
          ]
        }
      ]
    },
    {
      id: 'sec-4',
      title: '4. Non-Affiliation with GCash & FMCG Manufacturers',
      subsections: [
        {
          id: 'sec-4-1',
          title: '4.1 Independent E-Wallet Logbook Only',
          paragraphs: [
            'Fluent Tindahan is an independent software utility and is not affiliated with, endorsed by, sponsored by, or connected to GCash (G-Xchange, Inc. / Mynt — Globe Fintech Innovations, Inc.) or any other electronic money issuer (EMI) regulated by the Bangko Sentral ng Pilipinas (BSP).'
          ],
          bullets: [
            'No Financial Execution: Recording a "Cash-In" or "Cash-Out" transaction in Fluent Tindahan does not transfer actual digital funds. It merely records an entry in your internal digital logbook.',
            'Verification of Reference Numbers: You are solely responsible for verifying the authenticity of every e-wallet transaction, wallet balance change, and official SMS Reference Number inside the official GCash app before handing over physical cash or releasing merchandise. Fluent Tindahan is not liable for losses caused by fake GCash screenshots, spoofed SMS messages, or manual entry errors.'
          ]
        },
        {
          id: 'sec-4-2',
          title: '4.2 Pre-Loaded FMCG Product Catalog',
          paragraphs: [
            'The pre-loaded catalog of 138 Philippine Fast-Moving Consumer Goods (FMCG) products, brand names, categories, and EAN-13 barcodes (including products manufactured by Monde Nissin, Universal Robina Corporation, Nestlé Philippines, Kopiko, Century Pacific Food, San Miguel Foods, Unilever Philippines, Procter & Gamble, and others) is provided purely for merchant convenience and rapid inventory setup. All trademarks, brand names, and product identifiers remain the exclusive property of their respective owners.'
          ]
        }
      ]
    },
    {
      id: 'sec-5',
      title: '5. Credit Ledger (Utang / Palista) Rules & Disclaimers',
      subsections: [
        {
          id: 'sec-5-1',
          title: '5.1 Append-Only Financial Integrity',
          paragraphs: [
            'To prevent accidental deletion, tampering, and floating-point calculation drift, financial records inside Fluent Tindahan (Sale, SaleItem, UtangLedger, and GCashTxn) utilize integer-centavo math and an append-only ledger architecture. Once a credit (palista) or payment (bayad) is saved, it cannot be overwritten in place; adjustments must be logged as new offsetting entries.'
          ]
        },
        {
          id: 'sec-5-2',
          title: '5.2 Informal Credit Responsibility',
          paragraphs: [
            'Fluent Tindahan is not a lending company, financing company, bank, or debt collection agency:'
          ],
          bullets: [
            'Any extension of informal neighborhood credit (utang) to your customer (suki) is a private arrangement solely between you and your customer.',
            'We do not guarantee the accuracy, legal enforceability, or collectability of any running balance displayed in the Credit Ledger.'
          ]
        }
      ]
    },
    {
      id: 'sec-6',
      title: '6. Acceptable Usage Policy (AUP)',
      paragraphs: [
        'As a condition of using Fluent Tindahan, you agree NOT to use the App for any unlawful, harmful, or prohibited purpose under Philippine law.'
      ],
      subsections: [
        {
          id: 'sec-6-1',
          title: '6.1 Prohibited Retail & Financial Activities',
          paragraphs: [
            'You must not use the POS, Inventory, Tingi breakdown, Notebook, or GCash modules to track, facilitate, or record:'
          ],
          numbered: [
            'Illicit & Contraband Goods: The sale or distribution of dangerous drugs (in violation of RA 9165), counterfeit goods, smuggled cigarettes or vapes, expired food items, or stolen merchandise.',
            'Unlawful Sales to Minors: The sale of tobacco products, cigarettes (including single-stick tingi sales), vaporized nicotine products (vapes), or alcoholic beverages to minors in violation of Republic Act No. 9211 (Tobacco Regulation Act) and Republic Act No. 11900 (Vaporized Nicotine and Non-Nicotine Products Regulation Act).',
            'Illegal Gambling Operations: Recording bets, collections, kobrador tallies, or payouts for unlicensed numbers games or illegal gambling (including unauthorized jueteng, swertres, ending, or illegal online sabong).',
            'Money Laundering & E-Wallet Fraud: Using the GCash ledger to facilitate or conceal money laundering, terrorist financing, phishing proceeds, or unauthorized money-mule operations under Republic Act No. 9160 (Anti-Money Laundering Act).'
          ]
        },
        {
          id: 'sec-6-2',
          title: '6.2 Prohibition on "Debt Shaming" (Pamamahiya) & Unlawful Harassment',
          paragraphs: [
            'In strict compliance with National Privacy Commission (NPC) Circulars and Republic Act No. 10175 (Cybercrime Prevention Act of 2012 / Cyberlibel):'
          ],
          bullets: [
            'You MUST NOT screenshot, export, print, or publicly post the Credit (Utang) Ledger, customer names, mobile numbers, or unpaid balances on Facebook, TikTok, Messenger group chats, or physical community bulletin boards to shame, humiliate, or coerce customers into paying (pamamahiya).',
            'You MUST NOT position your phone or tablet screen at your store window grill in a way that publicly exposes your customers\' debt balances to passersby and neighbors.'
          ]
        },
        {
          id: 'sec-6-3',
          title: '6.3 Technical & System Integrity Restrictions',
          paragraphs: [
            'You agree not to:'
          ],
          bullets: [
            'Attempt to bypass Multi-Tenant Data Isolation (TenantId security filters) or access records belonging to another store owner.',
            'Manipulate, forge, or inject corrupted payloads or duplicate RFC4122 v4 UUIDs into the local IndexedDB database or the /api/sync/batch synchronization endpoint.',
            'Overload or disrupt the synchronization API with automated scripts, denial-of-service (DoS) attacks, or unauthorized payloads.',
            'Reverse-engineer, decompile, or redistribute the proprietary source code of Fluent Tindahan without written permission.'
          ]
        }
      ]
    },
    {
      id: 'sec-7',
      title: '7. Data Privacy & Compliance with RA 10173',
      paragraphs: [
        'Use of Fluent Tindahan is governed by Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules and Regulations.'
      ],
      subsections: [
        {
          id: 'sec-7-1',
          title: '7.1 Roles Under the Data Privacy Act',
          bullets: [
            'Store Owner as Personal Information Controller (PIC): When you collect and input your customers\' full names, nicknames, mobile phone numbers, and transaction histories into the Credit (Utang) Ledger or GCash logbook, you act as the Personal Information Controller.',
            'Fluent Tindahan as Personal Information Processor (PIP): We process and store synchronized cloud data solely on your behalf and according to your instructions to provide multi-device backup and synchronization services.'
          ]
        },
        {
          id: 'sec-7-2',
          title: '7.2 Your Obligations as a Store Owner',
          paragraphs: [
            'As the Personal Information Controller at your store, you warrant and agree that:'
          ],
          numbered: [
            'Informed Consent: You will inform your customers and obtain their consent before recording their personal details (such as their mobile number for GCash logs or their name and contact details for credit tracking).',
            'Data Minimization: You will only record information strictly necessary for legitimate store record-keeping. You must never record customers\' passwords, GCash MPINs, One-Time Passwords (OTPs), or sensitive government ID numbers inside the App\'s note fields.',
            'Device Security: You will secure the smartphone, tablet, or computer running Fluent Tindahan with a strong screen lock (PIN, pattern, password, or biometrics) to prevent unauthorized access if your device is lost, borrowed, or stolen.'
          ]
        }
      ]
    },
    {
      id: 'sec-8',
      title: '8. Disclaimers & Limitation of Liability',
      subsections: [
        {
          id: 'sec-8-1',
          title: '8.1 "As-Is" and "As-Available" Provision',
          paragraphs: [
            'Fluent Tindahan is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. While the App uses integer-centavo calculations and append-only ledgers to ensure high reliability, we do not warrant that the App will be completely error-free, uninterrupted, or immune to device hardware failures.'
          ]
        },
        {
          id: 'sec-8-2',
          title: '8.2 No Liability for Business, Tax, or Financial Losses',
          paragraphs: [
            'To the maximum extent permitted by Philippine law, the developers, operators, and contributors of Fluent Tindahan shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of or related to:'
          ],
          numbered: [
            'BIR Penalties or Tax Audits: Any fines, surcharges, compromises, or business closures imposed by the Bureau of Internal Revenue (BIR) or Local Government Unit (LGU) due to your failure to issue official BIR-registered manual Sales Invoices or use a BIR-accredited POS machine;',
            'Data Loss Prior to Sync: Loss of sales, inventory, GCash, or credit records caused by device loss, hardware damage, power outages, battery failure, or clearing of browser IndexedDB storage before background cloud synchronization could complete;',
            'Uncollected Credit (Utang) or Pricing Disputes: Any refusal or inability of a customer to pay their recorded credit balance, or any dispute over change (sukli) or micro-retail (tingi) pricing;',
            'GCash Fraud or Agent Losses: Financial losses resulting from fraudulent e-wallet screenshots, social engineering scams, transfers to incorrect mobile numbers, or duplicate cash payouts.'
          ]
        }
      ]
    },
    {
      id: 'sec-9',
      title: '9. Account Suspension & Termination',
      paragraphs: [
        'We reserve the right to suspend, restrict, or terminate your cloud synchronization access (TenantId account) immediately and without prior notice if we reasonably determine that:'
      ],
      bullets: [
        'You have violated the Acceptable Usage Policy (Section 6), including using the platform for illicit contraband, unlicensed gambling logs, or public debt-shaming;',
        'Your account activity compromises the security, stability, or multi-tenant isolation of the backend infrastructure; or',
        'We are required to do so by a lawful order of a Philippine court, the National Privacy Commission (NPC), the Bureau of Internal Revenue (BIR), the Bangko Sentral ng Pilipinas (BSP), or law enforcement authorities.'
      ]
    },
    {
      id: 'sec-10',
      title: '10. Governing Law & Venue of Action',
      paragraphs: [
        'These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any legal action, suit, or proceeding arising out of or relating to these Terms or the use of Fluent Tindahan shall be brought exclusively before the proper courts of competent jurisdiction in the Philippines, to the exclusion of all other venues.'
      ]
    },
    {
      id: 'sec-11',
      title: '11. In-App User Acknowledgment',
      paragraphs: [
        'For embedding in the PWA onboarding and Data Privacy consent dialog:'
      ],
      acknowledgmentBox:
        '"I have read and agree to the Terms of Use and Data Privacy Policy. I understand that Fluent Tindahan is an internal digital notebook and is NOT a BIR-accredited POS, is not affiliated with GCash, and that I am solely responsible for issuing official BIR Sales Invoices and protecting my customers\' data privacy in accordance with Republic Act No. 10173."'
    }
  ]
};

export const termsTL: TermsDocument = {
  title: 'Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit',
  subtitle: 'Opisyal na Kasunduan sa Paggamit at Pamantayan sa Operasyon',
  application: 'Fluent Tindahan (Offline-First Sari-Sari Store & GCash Management PWA)',
  effectiveDate: 'Oktubre 14, 2026',
  jurisdiction: 'Republika ng Pilipinas',
  quickSummary: {
    title: 'Mahalagang Paalala para sa mga May-ari ng Tindahan',
    notice: 'Bago gamitin ang Fluent Tindahan, mangyaring unawain ang apat (4) na pangunahing alituntuning ito:',
    points: [
      {
        title: 'Hindi ito BIR-Accredited POS (Digital Kwaderno Lamang)',
        desc: 'Ang Fluent Tindahan ay isang digital kwaderno at listahan para sa panloob na pamamahala ng iyong tindahan. Anumang printout o digital slip mula sa app na ito ay HINDI Opisyal na BIR Sales Invoice. Kailangan mo pa ring gumamit at mag-isyu ng iyong rehistradong manwal na resibo/Sales Invoice mula sa BIR.'
      },
      {
        title: 'Hindi Kami Konektado sa GCash',
        desc: 'Ang GCash module dito ay listahan (logbook) lamang ng iyong Cash-In at Cash-Out. Laging suriin ang aktwal na balanse at opisyal na SMS Reference Number sa loob mismo ng iyong opisyal na GCash app bago magbigay ng pera o paninda.'
      },
      {
        title: 'I-Sync ang App at Huwag Burahin ang Browser Data',
        desc: 'Dahil gumagana ang app na ito kahit offline (walang internet), ang iyong mga benta, paninda, at listahan ng utang ay naka-save muna sa iyong cellphone bago ma-sync sa cloud. Huwag burahin ang browser cache/site data o gumamit ng Incognito mode habang may mga transaksyong hindi pa na-i-sync.'
      },
      {
        title: 'Pangalagaan ang Privacy ng Iyong Suki (RA 10173)',
        desc: 'Humingi ng pahintulot sa iyong mga suki bago ilista ang kanilang pangalan at cellphone number sa Utang o GCash logbook, at huwag na huwag magpo-post ng screenshot ng kanilang utang sa social media upang ipahiya sila.'
      }
    ]
  },
  sections: [
    {
      id: 'sec-1',
      title: '1. Pagtanggap sa mga Tuntunin',
      paragraphs: [
        'Sa pamamagitan ng pag-access, pag-install, o paggamit ng Fluent Tindahan Progressive Web Application ("ang App", "ang Platform", o "ang Serbisyo"), ikaw ("User", "May-ari ng Tindahan", "Merchant", o "Tenant") ay sumasang-ayon na sumunod at mapasailalim sa Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit ("Mga Tuntunin") na ito. Kung hindi ka sumasang-ayon sa lahat ng Mga Tuntuning ito, huwag gamitin ang App.'
      ]
    },
    {
      id: 'sec-2',
      title: '2. Kalikasan ng Serbisyo at Offline-First na Sistema',
      paragraphs: [
        'Ang Fluent Tindahan ay isang offline-first digital kwaderno, talaan ng imbentaryo at panindang tingi, listahan ng utang (palista), at talaan ng transaksyon sa e-wallet na sadyang ginawa para sa mga sari-sari store at maliliit na tindahan sa Pilipinas.'
      ],
      subsections: [
        {
          id: 'sec-2-1',
          title: '2.1 Local-First na Pag-save ng Data (IndexedDB)',
          paragraphs: [
            'Ang App ay gumagamit ng local-first architecture:',
            'Tuwing magtatala ka ng benta, magbabago ng imbentaryo, maglilista ng utang (palista) o bayad, o magla-log ng GCash, ang rekord ay unang ise-save sa loob ng browser storage ng iyong cellphone o gadget (IndexedDB) at ipipila sa lokal na syncQueue.',
            'Kapag nagkaroon ng koneksyon sa internet, awtomatikong ipapadala ng App ang mga nakapilang rekord nang bultuhan (by batch) patungo sa aming cloud server.'
          ]
        },
        {
          id: 'sec-2-2',
          title: '2.2 Responsibilidad ng User sa Cellphone at Pag-Sync',
          paragraphs: [
            'Dahil ang mga rekord ay nasa iyong cellphone lamang hangga\'t hindi pa na-i-sync sa cloud:'
          ],
          bullets: [
            'Huwag Burahin ang Browser Storage: Ang pagbura sa browser cache, site data, pag-reset ng cellphone, o pag-uninstall ng browser habang may nakapilang rekord sa syncQueue ay permanenteng magbubura sa mga hindi pa na-i-sync na talaan ng iyong tindahan.',
            'Bawal Gamitin sa Incognito o Private Browsing: Huwag gamitin ang App sa Incognito o Private Browsing mode dahil kusang buburahin ng browser ang iyong lokal na database pagkasara ng window.',
            'Pagpapaliban ng Update Habang May Benta: Upang maprotektahan ang kasalukuyang transaksyon sa kaha, ipinagpapaliban ng App ang pag-reload para sa software update habang may laman pa ang iyong POS cart. Tungkulin mong tapusin ang transaksyon at regular na kumonekta sa internet upang makapag-sync.'
          ]
        }
      ]
    },
    {
      id: 'sec-3',
      title: '3. Kawalan ng Akreditasyon sa Bureau of Internal Revenue (BIR)',
      callout: {
        type: 'warning',
        title: 'MAHALAGANG PAUNAWA SA BUWIS AT REGULASYON',
        text: 'ANG FLUENT TINDAHAN AY HINDI BIR-ACCREDITED NA POINT-OF-SALE (POS) SYSTEM, CASH REGISTER MACHINE (CRM), O COMPUTERIZED ACCOUNTING SYSTEM (CAS).'
      },
      subsections: [
        {
          id: 'sec-3-1',
          title: '3.1 Para sa Panloob na Talaan Lamang ("Digital Kwaderno")',
          paragraphs: [
            'Ang POS calculator, barcode scanner, imbentaryo, at listahan sa loob ng Fluent Tindahan ay ibinibigay bilang panloob na gabay lamang sa pamamahala ng tindahan at digital na kapalit ng sulat-kamay na kwaderno.'
          ]
        },
        {
          id: 'sec-3-2',
          title: '3.2 Katayuan ng Thermal Printouts at Digital Slips',
          paragraphs: [
            'Anumang digital na buod, order slip, o imprenta mula sa Bluetooth thermal printer na galing sa App na ito:'
          ],
          numbered: [
            'AY HINDI valid na "Sales Invoice", "Official Receipt", o opisyal na resibong kinikilala ng Bureau of Internal Revenue (BIR) sa ilalim ng National Internal Revenue Code (NIRC) o Republic Act No. 11976 (Ease of Paying Taxes Act).',
            'AY HINDI DAPAT ibigay o ipakilala sa mamimili bilang opisyal na resibo sa buwis o patunay ng input tax credit.',
            'Ay dapat laging may nakasaad o ituring na may paalalang: "PARA SA PANLOOB NA TALAAN LAMANG — ANG DOKUMENTONG ITO AY HINDI VALID PARA SA PAG-CLAIM NG INPUT TAX" (FOR INTERNAL RECORD-KEEPING ONLY — THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX).'
          ]
        },
        {
          id: 'sec-3-3',
          title: '3.3 Tanging Responsibilidad ng May-ari ng Tindahan sa Buwis',
          paragraphs: [
            'Ang paggamit ng Fluent Tindahan ay hindi naglilibre sa iyo sa mga batas sa buwis ng Pilipinas. Depende sa kategorya ng rehistrasyon ng iyong negosyo (hal. Barangay Micro Business Enterprise (BMBE), Non-VAT Sole Proprietorship, o VAT-registered), ikaw lamang ang may buong responsibilidad sa:'
          ],
          bullets: [
            'Pagpapanatili ng rehistradong manwal na Books of Accounts sa BIR;',
            'Pag-iisyu ng opisyal at rehistradong manwal na BIR Sales Invoice sa iyong mga mamimili kapag hinihingi ng batas; at',
            'Paghahain ng tamang tax returns sa BIR at pagkuha ng kaukulang permiso sa Barangay at Munisipyo/Lungsod (LGU).'
          ]
        }
      ]
    },
    {
      id: 'sec-4',
      title: '4. Kawalan ng Kaugnayan sa GCash at mga Kompanya ng FMCG',
      subsections: [
        {
          id: 'sec-4-1',
          title: '4.1 Independiyenteng Listahan Lamang para sa E-Wallet',
          paragraphs: [
            'Ang Fluent Tindahan ay isang independiyenteng software at walang kaugnayan, hindi ineendorso, hindi isinusulong, at hindi konektado sa GCash (G-Xchange, Inc. / Mynt — Globe Fintech Innovations, Inc.) o sa anumang Electronic Money Issuer (EMI) na pinangangasiwaan ng Bangko Sentral ng Pilipinas (BSP).'
          ],
          bullets: [
            'Walang Aktwal na Paglipat ng Pera: Ang pagtatala ng "Cash-In" o "Cash-Out" sa Fluent Tindahan ay hindi naglilipat ng aktwal na balanse sa GCash. Ito ay nagsisilbing listahan lamang sa iyong digital kwaderno.',
            'Pagsusuri sa Reference Number: Ikaw ang may buong responsibilidad na suriin ang katotohanan ng bawat transaksyon sa GCash, pagbabago sa balanse, at opisyal na SMS Reference Number sa loob mismo ng opisyal na GCash app bago mag-abot ng pera o magbigay ng paninda. Walang pananagutan ang Fluent Tindahan sa anumang pagkalugi dulot ng pekeng GCash screenshot, pekeng text message, o pagkakamali sa pag-type ng numero.'
          ]
        },
        {
          id: 'sec-4-2',
          title: '4.2 Paunang Listahan ng mga Paninda (FMCG Product Catalog)',
          paragraphs: [
            'Ang kasamang listahan ng 138 na karaniwang paninda sa sari-sari store, mga tatak (brands), kategorya, at EAN-13 barcodes (kabilang ang mga produkto ng Monde Nissin, Universal Robina Corporation, Nestlé Philippines, Kopiko, Century Pacific Food, San Miguel Foods, Unilever Philippines, Procter & Gamble, at iba pa) ay inilagay lamang upang mapabilis ang pag-setup ng iyong imbentaryo. Ang lahat ng pangalan ng produkto, tatak, at trademark ay pag-aari ng kani-kanilang opisyal na kompanya.'
          ]
        }
      ]
    },
    {
      id: 'sec-5',
      title: '5. Mga Alituntunin sa Listahan ng Utang (Utang / Palista Ledger)',
      subsections: [
        {
          id: 'sec-5-1',
          title: '5.1 Append-Only na Talaang Pinansyal',
          paragraphs: [
            'Upang maiwasan ang hindi sinasadyang pagkabura, pandaraya, at pagkakamali sa kwenta ng sentimo (integer-centavo math), ang mga talaang pinansyal sa Fluent Tindahan (Sale, SaleItem, UtangLedger, at GCashTxn) ay gumagamit ng append-only ledger system. Kapag nai-save na ang isang palista (utang) o bayad, hindi na ito maaaring burahin o palitan nang patago; anumang pagtatama ay dapat ilista bilang bagong rekord ng bayad o adjustment.'
          ]
        },
        {
          id: 'sec-5-2',
          title: '5.2 Responsibilidad sa Pagpapautang',
          paragraphs: [
            'Ang Fluent Tindahan ay hindi isang kompanya ng pautang (lending/financing company), bangko, o ahensya ng paniningil (collection agency):'
          ],
          bullets: [
            'Ang pagpapautang (palista) sa iyong suki ay pribadong kasunduan sa pagitan mo lamang at ng iyong mamimili.',
            'Hindi namin ginagarantiyahan ang katumpakan, legal na bisa, o katiyakan na masisingil ang anumang balanseng nakalista sa Utang Ledger.'
          ]
        }
      ]
    },
    {
      id: 'sec-6',
      title: '6. Patakaran sa Katanggap-tanggap na Paggamit (Acceptable Usage Policy)',
      paragraphs: [
        'Bilang kondisyon sa paggamit ng Fluent Tindahan, sumasang-ayon kang HINDI gagamitin ang App sa anumang labag sa batas, mapang-abuso, o ipinagbabawal na gawain sa ilalim ng batas ng Pilipinas.'
      ],
      subsections: [
        {
          id: 'sec-6-1',
          title: '6.1 Mga Ipinagbabawal na Paninda at Gawain',
          paragraphs: [
            'Mahigpit na ipinagbabawal ang paggamit ng POS, Imbentaryo, Tingi breakdown, Notebook, o GCash module upang maglista, magbenta, o magpatakbo ng:'
          ],
          numbered: [
            'Ilegal at Kontrabandong Produkto: Pagbebenta o pamamahagi ng ipinagbabawal na gamot (labag sa RA 9165), pekeng produkto (counterfeit), puslit o smuggled na sigarilyo at vape, expired na pagkain, o nakaw na paninda.',
            'Ilegal na Pagbebenta sa mga Menor de Edad: Pagbebenta ng sigarilyo (kahit tingi o kada stick), vape, o nakalalasing na inumin sa mga menor de edad (wala pang 18 o 21 taong gulang ayon sa batas) na labag sa Republic Act No. 9211 (Tobacco Regulation Act) at Republic Act No. 11900 (Vaporized Nicotine and Non-Nicotine Products Regulation Act).',
            'Listahan ng Ilegal na Sugal: Pagtatala ng taya, kubransa, o panalo para sa mga ilegal na sugal (tulad ng jueteng, hindi awtorisadong swertres, ending, o ilegal na online sabong).',
            'Money Laundering at Panloloko sa E-Wallet: Paggamit sa GCash logbook upang itago o padaliin ang money laundering, panloloko (scam/phishing), o pagiging money mule na labag sa Republic Act No. 9160 (Anti-Money Laundering Act).'
          ]
        },
        {
          id: 'sec-6-2',
          title: '6.2 Pagbabawal sa "Pamamahiya sa Utang" (Debt Shaming) at Pangha-harass',
          paragraphs: [
            'Bilang mahigpit na pagsunod sa mga Circular ng National Privacy Commission (NPC) at Republic Act No. 10175 (Cybercrime Prevention Act of 2012 / Cyberlibel):'
          ],
          bullets: [
            'MAHIGPIT NA IPINAGBABAWAL ang pag-screenshot, pag-export, pag-print, o pag-post sa publiko ng Utang Ledger, pangalan ng suki, numero ng cellphone, o halaga ng utang sa Facebook, TikTok, Messenger group chat, o paskilan sa barangay upang ipahiya, takutin, o pilitin ang mamimili na magbayad (pamamahiya).',
            'IPINAGBABAWAL ang pagharap o pagpapakita ng screen ng Utang Ledger sa bintana o parilya ng tindahan kung saan malayang makikita ng ibang kapitbahay o dumadaan ang listahan ng utang ng iyong mga suki.'
          ]
        },
        {
          id: 'sec-6-3',
          title: '6.3 Seguridad ng Sistema at Multi-Tenant Isolation',
          paragraphs: [
            'Sumasang-ayon kang hindi gagawin ang mga sumusunod:'
          ],
          bullets: [
            'Subukang lampasan ang Multi-Tenant Data Isolation (TenantId) o buksan ang mga rekord na pag-aari ng ibang tindahan.',
            'Magpasok ng sirang data, pekeng rekord, o duplikadong RFC4122 v4 UUID sa lokal na IndexedDB o sa /api/sync/batch API.',
            'Magpadala ng automated scripts o Denial-of-Service (DoS) attacks na makakapagpabagal sa server.',
            'Kopyahin, i-reverse-engineer, o ipamahagi ang source code ng Fluent Tindahan nang walang pahintulot.'
          ]
        }
      ]
    },
    {
      id: 'sec-7',
      title: '7. Data Privacy at Pagsunod sa RA 10173',
      paragraphs: [
        'Ang paggamit ng Fluent Tindahan ay nasasaklawan ng Republic Act No. 10173 (Data Privacy Act of 2012) at ng mga Implementing Rules and Regulations nito.'
      ],
      subsections: [
        {
          id: 'sec-7-1',
          title: '7.1 Mga Gampanin sa Ilalim ng Data Privacy Act',
          bullets: [
            'Ang May-ari ng Tindahan bilang Personal Information Controller (PIC): Kapag inililista mo ang pangalan, palayaw, cellphone number, at kasaysayan ng transaksyon ng iyong mga suki sa Utang Ledger o GCash logbook, ikaw ay tumatayong Personal Information Controller (PIC).',
            'Ang Fluent Tindahan bilang Personal Information Processor (PIP): Pinoproseso at iniingatan lamang namin sa cloud ang iyong mga na-sync na rekord para sa iyong tindahan upang magsilbing backup at magamit mo sa iyong awtorisadong device.'
          ]
        },
        {
          id: 'sec-7-2',
          title: '7.2 Ang Iyong mga Tungkulin Bilang May-ari ng Tindahan',
          paragraphs: [
            'Bilang PIC sa iyong tindahan, sumasang-ayon at tinitiyak mo na:'
          ],
          numbered: [
            'May Pahintulot ng Suki (Informed Consent): Ipaaalam mo at hihingin ang pahintulot ng iyong mamimili bago ilista ang kanilang personal na impormasyon (tulad ng cellphone number sa GCash log o pangalan sa listahan ng utang).',
            'Limitadong Impormasyon Lamang (Data Minimization): Ang ililista mo lamang ay ang impormasyong kailangan sa lehitimong talaan ng tindahan. Huwag na huwag isusulat sa notes ng App ang password, GCash MPIN, One-Time Password (OTP), o sensitibong government ID number ng iyong mamimili.',
            'Seguridad ng Cellphone/Gadget: Lalagyan mo ng screen lock (PIN, pattern, password, o fingerprint) ang cellphone o tablet na ginagamit sa Fluent Tindahan upang hindi mabuksan ng ibang tao ang listahan sakaling mawala o manakaw ang iyong gadget.'
          ]
        }
      ]
    },
    {
      id: 'sec-8',
      title: '8. Pagtatanggi at Limitasyon ng Pananagutan (Limitation of Liability)',
      subsections: [
        {
          id: 'sec-8-1',
          title: '8.1 Pagbibigay ng Serbisyo "As-Is" at "As-Available"',
          paragraphs: [
            'Ang Fluent Tindahan ay ibinibigay nang "AS IS" at "AS AVAILABLE" nang walang anumang garantiya, hayag man o ipinahiwatig. Bagama\'t gumagamit ang App ng integer-centavo math at append-only ledgers para sa eksaktong kwenta, hindi namin ginagarantiyahan na ang App ay walang magiging aberya o ligtas sa pagkasira ng iyong cellphone.'
          ]
        },
        {
          id: 'sec-8-2',
          title: '8.2 Kawalan ng Pananagutan sa Pagkalugi sa Negosyo, Buwis, o Pera',
          paragraphs: [
            'Sa pinakamataas na antas na pinapayagan ng batas ng Pilipinas, ang mga bumuo at nagpapatakbo ng Fluent Tindahan ay walang pananagutan sa anumang direkta o hindi direktang pinsala o pagkalugi na nagmula sa:'
          ],
          numbered: [
            'Multa o Parusa mula sa BIR o LGU: Anumang multa, penalty, compromise, o pagpapasara ng tindahan na ipinataw ng BIR o LGU dahil sa hindi mo pag-iisyu ng opisyal na manwal na BIR Sales Invoice o hindi paggamit ng BIR-accredited POS;',
            'Pagkawala ng Data Bago Ma-Sync: Pagkawala ng rekord ng benta, imbentaryo, GCash, o utang dahil sa pagkawala o pagkasira ng cellphone, pagkaubos ng baterya, o pagbura sa browser IndexedDB cache bago pa makapag-sync sa internet;',
            'Hindi Nabayarang Utang o Pagtatalo sa Presyo/Sukli: Anumang pagtanggi o hindi pagbabayad ng suki sa kanyang nakalistang utang, o anumang hindi pagkakaunawaan sa sukli o presyo ng panindang tingi;',
            'Panloloko sa GCash (Scam): Pagkalugi ng pera dahil sa pekeng GCash screenshot, scam, maling nailistang numero ng cellphone, o dobleng pagbibigay ng cash-out.'
          ]
        }
      ]
    },
    {
      id: 'sec-9',
      title: '9. Pagsuspinde at Pagwawakas ng Account',
      paragraphs: [
        'May karapatan kaming suspindihin, limitahan, o wakasan ang iyong cloud synchronization account (TenantId) nang agaran kung mapatunayang:'
      ],
      bullets: [
        'Nilabag mo ang Patakaran sa Katanggap-tanggap na Paggamit (Seksyon 6), kabilang ang paglilista ng ilegal na kontrabando, ilegal na sugal, o pamamahiya ng may utang sa social media;',
        'Ang iyong account ay nagdudulot ng panganib sa seguridad o katatagan ng aming server; o',
        'Iniutos ito ng hukuman sa Pilipinas, National Privacy Commission (NPC), Bureau of Internal Revenue (BIR), Bangko Sentral ng Pilipinas (BSP), o ng mga awtoridad ng batas.'
      ]
    },
    {
      id: 'sec-10',
      title: '10. Sumasaklaw na Batas at Hukuman (Governing Law)',
      paragraphs: [
        'Ang Mga Tuntuning ito ay pamamahalaan at bibigyang-kahulugan alinsunod sa mga batas ng Republika ng Pilipinas. Anumang legal na aksyon o usapin na may kaugnayan sa Mga Tuntuning ito o sa paggamit ng Fluent Tindahan ay idudulog lamang sa mga nararapat na hukuman sa Pilipinas.'
      ]
    },
    {
      id: 'sec-11',
      title: '11. Pagsang-ayon ng User (In-App Consent Text sa Tagalog)',
      paragraphs: [
        'Maaaring ilagay sa checkbox ng onboarding at Data Privacy consent dialog ng PWA:'
      ],
      acknowledgmentBox:
        '"Nabasa at sinasang-ayunan ko ang Mga Tuntunin sa Paggamit (Terms of Use) at Patakaran sa Data Privacy. Naiintindihan ko na ang Fluent Tindahan ay isang digital kwaderno lamang at HINDI BIR-accredited POS, hindi konektado sa GCash, at tanging tungkulin ko ang mag-isyu ng opisyal na BIR Sales Invoice at pangalagaan ang data privacy ng aking mga suki alinsunod sa Republic Act No. 10173."'
    }
  ]
};
