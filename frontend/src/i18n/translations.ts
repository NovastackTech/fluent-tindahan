export type Language = 'tl' | 'en';

export interface Translations {
  common: {
    appTitle: string;
    storeSub: string;
    online: string;
    offline: string;
    syncing: string;
    queued: string;
    allSynced: string;
    dlqWarning: string;
    differentAccountSyncBlocked: string;
    tenantProvisioningSyncBlocked: string;
    forceSync: string;
    themeToggleDark: string;
    themeToggleLight: string;
    themeToggleSystem: string;
    themeModeLight: string;
    themeModeDark: string;
    themeModeSystem: string;
    languageToggle: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    confirm: string;
    pesos: string;
  };
  nav: {
    dashboard: string;
    pos: string;
    inventory: string;
    utang: string;
    gcash: string;
    import: string;
    settings: string;
  };
  pos: {
    title: string;
    searchPlaceholder: string;
    noProductsFound: string;
    emptyInventory: string;
    emptyInventorySub: string;
    goToInventoryBtn: string;
    allCategories: string;
    inStock: string;
    outOfStock: string;
    cartTitle: string;
    emptyCart: string;
    emptyCartSub: string;
    totalAmount: string;
    cashReceived: string;
    change: string;
    exactCash: string;
    completeCashSale: string;
    chargeToUtang: string;
    clearCart: string;
    saleSuccess: string;
    insufficientCash: string;
    itemAdded: string;
    receiptTitle: string;
    printReceipt: string;
    newSale: string;
    qty: string;
    price: string;
    subtotal: string;
    itemsInCart: string;
    pay: string;
    itemsList: string;
    each: string;
    checkoutConfirm: string;
    totalDue: string;
    cashTendered: string;
    exactAmount: string;
    changeLabel: string;
    gcashInstruction: string;
    gcashRefOptional: string;
    selectCustomer: string;
    selectCustomerPlaceholder: string;
    utangNote: string;
    cashAmount: string;
    gcashAmount: string;
    splitRemaining: string;
    checkoutBtn: string;
    completeSaleBtn: string;
    lowStockBadge: string;
    stockLabel: string;
    customerSelectRequired: string;
    addNewDebtorBtn: string;
    newDebtorTitle: string;
    saveAndSelectDebtor: string;
    debtorNameRequired: string;
  };
  utang: {
    title: string;
    subtitle: string;
    totalOutstanding: string;
    customersCount: string;
    searchCustomer: string;
    addNewCustomer: string;
    customerName: string;
    customerPhone: string;
    currentBalance: string;
    noDebt: string;
    historyTitle: string;
    noHistory: string;
    logPayment: string;
    addCredit: string;
    amount: string;
    notes: string;
    paymentSuccess: string;
    creditSuccess: string;
    customerAdded: string;
    customerNameLabel: string;
    customerNamePlaceholder: string;
    customerNameRequired: string;
    phoneLabel: string;
    initialDebtLabel: string;
    saveCustomer: string;
    noCustomerFound: string;
    noPhone: string;
    hasUtang: string;
    paid: string;
    currentDebt: string;
    payButton: string;
    addDebtButton: string;
    timelineTitle: string;
    noTransactions: string;
    recordPaymentTitle: string;
    paymentAmountLabel: string;
    paymentAmountInvalid: string;
    payAll: string;
    paymentNotesLabel: string;
    paymentNotesPlaceholder: string;
    confirmPayment: string;
    addCreditTitle: string;
    creditAmountLabel: string;
    creditNotesLabel: string;
    creditNotesPlaceholder: string;
    saveCredit: string;
  };
  gcash: {
    title: string;
    subtitle: string;
    cashIn: string;
    cashOut: string;
    refNo: string;
    customerPhone: string;
    fee: string;
    amount: string;
    notes: string;
    recordTransaction: string;
    todayCashIn: string;
    todayCashOut: string;
    todayFees: string;
    transactionSuccess: string;
    recentTransactions: string;
    freePlanLabel: string;
    noTransactions: string;
    amountLabel: string;
    feeLabel: string;
    feeAuto: string;
    refNoLabel: string;
    refNoPlaceholder: string;
    phoneLabel: string;
    notesLabel: string;
    notesPlaceholder: string;
    totalFromCustomer: string;
    totalToCustomer: string;
    saveTransaction: string;
    historyTitle: string;
    invalidAmountAlert: string;
    duplicateRefWarning: string;
    phoneInvalid: string;
  };
  dashboard: {
    title: string;
    todaySales: string;
    txnCount: string;
    totalUtang: string;
    gcashVolume: string;
    lowStockTitle: string;
    lowStockEmpty: string;
    topProductsTitle: string;
    topProductsEmpty: string;
    unitsSold: string;
    remaining: string;
    greeting: string;
    greetingSub: string;
    quickActions: string;
    posActionTitle: string;
    posActionSub: string;
    gcashActionTitle: string;
    gcashActionSub: string;
    utangActionTitle: string;
    utangActionSub: string;
    importActionTitle: string;
    importActionSub: string;
    todaySummary: string;
    debtorsWithBalance: string;
    recentSales: string;
    goToPos: string;
    noSalesToday: string;
  };
  importPage: {
    title: string;
    subtitle: string;
    downloadTemplate: string;
    selectFile: string;
    importButton: string;
    successMessage: string;
    uploadPrompt: string;
    formatHint: string;
    trySample: string;
    previewTitle: string;
    validBadge: string;
    errorBadge: string;
    importing: string;
    importProductsBtn: string;
    statusCol: string;
    nameCol: string;
    priceCol: string;
    costCol: string;
    barcodeCol: string;
    categoryCol: string;
    stockCol: string;
    notesCol: string;
    unnamed: string;
  };
  inventory: {
    title: string;
    subtitle: string;
    totalProducts: string;
    fullCapacityBadge: string;
    nearCapacityBadge: string;
    lowStockAlerts: string;
    filteringLowStockHint: string;
    lowStockRemainingHint: string;
    inventoryCost: string;
    retailValue: string;
    potentialProfit: string;
    avgMargin: string;
    searchPlaceholder: string;
    allCategories: string;
    filterAll: string;
    filterLowStock: string;
    filterOutOfStock: string;
    filterInStock: string;
    addProductBtn: string;
    importCsvBtn: string;
    colProduct: string;
    colBarcode: string;
    colCategory: string;
    colStock: string;
    colCost: string;
    colPrice: string;
    colMargin: string;
    colProfit: string;
    colActions: string;
    editPrice: string;
    editProduct: string;
    deleteProduct: string;
    quickRestock: string;
    restockSuccess: string;
    deleteConfirm: string;
    deleteSuccess: string;
    saveSuccess: string;
    addModalTitle: string;
    editModalTitle: string;
    productNameLabel: string;
    productNameRequired: string;
    categoryLabel: string;
    barcodeLabel: string;
    costLabel: string;
    costCannotBeNegative: string;
    priceLabel: string;
    priceMustBePositive: string;
    stockLabel: string;
    profitPreview: string;
    marginPreview: string;
    noProductsFound: string;
    lowStockBadge: string;
    outOfStockBadge: string;
    inStockBadge: string;
    customRestock: string;
  };
  barcode: {
    scannerTitle: string;
    scannerDesc: string;
    openCamera: string;
    closeCamera: string;
    cameraError: string;
    cameraPermissionDenied: string;
    flashlight: string;
    switchCamera: string;
    scanPrompt: string;
    notFoundTitle: string;
    notFoundPrompt: string;
    registerPromptBtn: string;
    registerModalTitle: string;
    registeredSuccess: string;
    barcodeLabel: string;
    productNameLabel: string;
    productNameRequired: string;
    categoryLabel: string;
    costLabel: string;
    costCannotBeNegative: string;
    priceLabel: string;
    priceMustBePositive: string;
    stockLabel: string;
    saveAndAddToCart: string;
    saveProduct: string;
    addedToCart: string;
  };
  settings: {
    title: string;
    subtitle: string;
    themeSection: string;
    themeDesc: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    languageSection: string;
    languageDesc: string;
    taglish: string;
    english: string;
    syncSection: string;
    forceSyncBtn: string;
    pullCatalogBtn: string;
    resetSeedBtn: string;
    storageSection: string;
    usedStorage: string;
    persistentStorage: string;
    persistentActive: string;
    persistentInactive: string;
    deviceInfoSection: string;
    deviceId: string;
    tenantId: string;
    userId: string;
    dangerZone: string;
    wipeDatabaseBtn: string;
    resetSeedConfirm: string;
    wipeConfirm: string;
    resetSuccess: string;
    storeNameLabel: string;
    ownerNameLabel: string;
    userPhoneLabel: string;
    editProfileBtn: string;
    pendingSync: string;
    dlqTitle: string;
    dlqClearBtn: string;
    dlqDesc: string;
    retryBtn: string;
    dataManagement: string;
    pullSuccessAlert: string;
    printerSection: string;
    printerDesc: string;
    printerPaperWidth: string;
    printerTestBtn: string;
    printerTestSuccess: string;
    gcashFeeSection: string;
    gcashFeeDesc: string;
    gcashFeeRange: string;
    gcashFixedFee: string;
  };
  receipt: {
    watermark: string;
    receiptTitle: string;
    dateLabel: string;
    txnLabel: string;
    totalLabel: string;
    paymentMethodLabel: string;
    tenderedLabel: string;
    changeLabel: string;
    customerLabel: string;
    remainingDebtLabel: string;
    thankYou: string;
    shareTitle: string;
    copyReceipt: string;
    copied: string;
    printReceipt: string;
    printing: string;
    printSuccess: string;
    bluetoothPrint: string;
    bluetoothConnecting: string;
    bluetoothError: string;
    bluetoothNotSupported: string;
    paperWidthLabel: string;
    paperWidth58: string;
    paperWidth80: string;
    printerDeviceLabel: string;
  };
  banner: {
    offlineTitle: string;
    offlineDesc: string;
  };
  privacy: {
    title: string;
    description: string;
    acceptBtn: string;
    declineBtn: string;
    closeBtn: string;
    viewTermsLink: string;
  };
  disclaimer: {
    buttonLabel: string;
    modalTitle: string;
    section1Title: string;
    section1Desc: string;
    section2Title: string;
    section2Desc: string;
    section3Title: string;
    section3Desc: string;
    section4Title: string;
    section4Desc: string;
    termsLink: string;
    termsSummaryTitle: string;
    termsSummary1Title: string;
    termsSummary1Desc: string;
    termsSummary2Title: string;
    termsSummary2Desc: string;
    termsSummary3Title: string;
    termsSummary3Desc: string;
    closeBtn: string;
    legalCardTitle: string;
    legalCardDesc: string;
    viewPrivacyBtn: string;
    viewFullTermsBtn: string;
    openFullTerms: string;
    termsModalTitle: string;
  };
  pwa: {
    installTitle: string;
    installDesc: string;
    installBtn: string;
    installedBadge: string;
    installUnavailable: string;
    dismissBtn: string;
    iosInstructionsTitle: string;
    iosInstructionsDesc: string;
    updateTitle: string;
    updateDesc: string;
    updateBtn: string;
    updateWaitMsg: string;
    updateOtherTabsWaitMsg: string;
    pwaSection: string;
    pwaDesc: string;
    appStatus: string;
    statusInstalled: string;
    statusBrowser: string;
    installHeaderTooltip: string;
    browserInstallTip: string;
    browserInstallNote: string;
  };
  subscription: {
    planSection: string;
    planDesc: string;
    currentPlan: string;
    libreTier: string;
    proTier: string;
    plusTier: string;
    managePlanBtn: string;
    upgradeBtn: string;
    statusActive: string;
    statusExpired: string;
    statusFree: string;
    expiresOn: string;
    daysRemaining: string;
    limitsTitle: string;
    productLimit: string;
    debtorLimit: string;
    gcashLimit: string;
    csvImportStatus: string;
    unlimited: string;
    lockedForLibre: string;
    unlocked: string;
    pricingToggleWeekly: string;
    pricingToggleMonthly: string;
    popularBadge: string;
  };
  onboarding: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    editTitle: string;
    editSubtitle: string;
    storeNameLabel: string;
    storeNamePlaceholder: string;
    storeNameRequired: string;
    submitError: string;
    ownerNameLabel: string;
    ownerNamePlaceholder: string;
    userPhoneLabel: string;
    userPhonePlaceholder: string;
    phoneInvalid: string;
    catalogSectionTitle: string;
    catalogSectionDesc: string;
    catalogStandardTitle: string;
    catalogStandardDesc: string;
    catalogEmptyTitle: string;
    catalogEmptyDesc: string;
    gcashToggleTitle: string;
    gcashToggleDesc: string;
    launchBtn: string;
    saveProfileBtn: string;
    cancelBtn: string;
  };
}

export const translations: Record<Language, Translations> = {
  tl: {
    common: {
      appTitle: 'Fluent Tindahan',
      storeSub: 'Aling Nena\'s Tindahan & GCash',
      online: 'Online',
      offline: 'Naka-Offline',
      syncing: 'Nagsi-sync...',
      queued: 'pila',
      allSynced: 'Lahat ay naka-sync sa cloud',
      dlqWarning: 'mga bagsak na item sa Dead Letter queue',
      differentAccountSyncBlocked: 'Naka-link ang tindahan sa device na ito sa ibang account. Mag-sign in muli sa tamang account para mag-sync. Nananatili sa device na ito ang mga nakabinbing pagbabago.',
      tenantProvisioningSyncBlocked: 'Hindi ma-verify ang tindahan sa server. Mag-sign in muli o kontakin ang suporta bago mag-sync. Nananatili sa device na ito ang mga nakabinbing pagbabago.',
      forceSync: 'Puwersahing mag-sync ngayon',
      themeToggleDark: 'Lumipat sa Dark theme',
      themeToggleLight: 'Lumipat sa Light theme',
      themeToggleSystem: 'Lumipat sa Ayon sa Sistema (System)',
      themeModeLight: 'Maliwanag (Light)',
      themeModeDark: 'Madilim (Dark)',
      themeModeSystem: 'Ayon sa Sistema (System)',
      languageToggle: 'TL/EN toggle (English)',
      save: 'I-save',
      cancel: 'Kanselahin',
      delete: 'Burahin',
      edit: 'Baguhin',
      close: 'Isara',
      confirm: 'Kumpirmahin',
      pesos: '₱'
    },
    nav: {
      dashboard: 'Dashboard',
      pos: 'Benta (POS)',
      inventory: 'Imbentaryo',
      utang: 'Utang',
      gcash: 'GCash',
      import: 'Import',
      settings: 'Sync'
    },
    pos: {
      title: 'Tindahan Point of Sale',
      searchPlaceholder: 'Mag-scan ng barcode o maghanap ng produkto...',
      noProductsFound: 'Walang nahanap na paninda. Subukan ang ibang paghahanap o kategorya.',
      emptyInventory: 'Wala pang paninda sa tindahan.',
      emptyInventorySub: 'Magdagdag ng produkto sa Imbentaryo upang magsimulang magbenta.',
      goToInventoryBtn: 'Pumunta sa Imbentaryo',
      allCategories: 'Lahat',
      inStock: 'stock',
      outOfStock: 'Ubos na',
      cartTitle: 'Kasalukuyang Resibo',
      emptyCart: 'Walang laman ang basket',
      emptyCartSub: 'Pumili ng mga paninda sa kaliwa upang magdagdag sa resibo.',
      totalAmount: 'Kabuuang Halaga',
      cashReceived: 'Bayad na Pera',
      change: 'Sukli',
      exactCash: 'Eksakto',
      completeCashSale: 'Bayaran (Cash)',
      chargeToUtang: 'Ilista sa Utang',
      clearCart: 'I-clear',
      saleSuccess: 'Benta matagumpay na naitala!',
      insufficientCash: 'Kulang ang ibinayad na pera!',
      itemAdded: 'Naidagdag sa basket',
      receiptTitle: 'Resibo ng Tindahan',
      printReceipt: 'I-print ang Resibo',
      newSale: 'Bagong Transaksyon',
      qty: 'Dami',
      price: 'Presyo',
      subtotal: 'Kabuo',
      itemsInCart: 'sa cart',
      pay: 'Bayad',
      itemsList: 'Listahan ng Bibilhin',
      each: 'bawat isa',
      checkoutConfirm: 'Kumpirmahin ang Bayad (Checkout)',
      totalDue: 'Kabuuang Babayaran',
      cashTendered: 'Bayad ng Kostumer (Cash Tendered):',
      exactAmount: 'Eksaktong Halaga',
      changeLabel: 'Sukli (Change):',
      gcashInstruction: 'I-scan ng customer ang Tindahan GCash QR o magpadala sa iyong registered number.',
      gcashRefOptional: 'Ref. Number ng GCash (opsyonal):',
      selectCustomer: 'Pumili ng Suki (Debtor):',
      selectCustomerPlaceholder: '-- Pumili ng Suki --',
      utangNote: 'Maitatala ito sa account ng suki at madaragdag sa kanyang kasalukuyang utang.',
      cashAmount: 'Halaga sa Cash:',
      gcashAmount: 'Halaga sa GCash:',
      splitRemaining: 'Kulang / Sukli:',
      checkoutBtn: 'Mag-Checkout',
      completeSaleBtn: 'Kumpletuhin ang Benta',
      lowStockBadge: 'Mababa',
      stockLabel: 'Stock',
      customerSelectRequired: 'Pakiusap pumili ng suki para sa bibilhing pautang.',
      addNewDebtorBtn: 'Magdagdag ng Suki',
      newDebtorTitle: 'Magrehistro ng Bagong Suki',
      saveAndSelectDebtor: 'I-save at Piliin',
      debtorNameRequired: 'Pakiusap ilagay ang pangalan ng suki.'
    },
    utang: {
      title: 'Talaan ng Utang ng mga Suki',
      subtitle: 'Subaybayan ang listahan ng pautang at mag-record ng hulog o bayad nang offline.',
      totalOutstanding: 'Kabuuang Utang sa Tindahan',
      customersCount: 'Mga May Utang',
      searchCustomer: 'Hanapin ang pangalan ng suki...',
      addNewCustomer: 'Magdagdag ng Bagong Suki',
      customerName: 'Pangalan ng Customer',
      customerPhone: 'Numero ng Telepono',
      currentBalance: 'Balanse ng Utang',
      noDebt: 'Walang utang (Bayad)',
      historyTitle: 'Kasaysayan ng Utang at Bayad',
      noHistory: 'Wala pang naitalang transaksyon para sa suki na ito.',
      logPayment: 'Magbayad ng Utang',
      addCredit: 'Magpatong ng Utang',
      amount: 'Halaga (₱)',
      notes: 'Mga Tala / Detalye (opsyonal)',
      paymentSuccess: 'Matagumpay na naitala ang bayad!',
      creditSuccess: 'Matagumpay na nailista ang dagdag na utang!',
      customerAdded: 'Matagumpay na naidagdag ang suki!',
      customerNameLabel: 'Pangalan ng Suki:*',
      customerNamePlaceholder: 'Hal. Aling Maria',
      customerNameRequired: 'Pakiusap ilagay ang pangalan ng suki.',
      phoneLabel: 'Cellphone Number:',
      initialDebtLabel: 'Simulang Utang (Initial Balance - opsyonal):',
      saveCustomer: 'I-save ang Suki',
      noCustomerFound: 'Walang natagpuang suki. Magdagdag sa pamamagitan ng "Bagong Suki".',
      noPhone: 'Walang numero',
      hasUtang: 'May Utang',
      paid: 'Bayad Na',
      currentDebt: 'Kasalukuyang Utang',
      payButton: 'Magbayad (Pay)',
      addDebtButton: 'Dagdagan ng Utang',
      timelineTitle: 'Kasaysayan ng Transaksyon (Timeline)',
      noTransactions: 'Walang tala ng transaksyon.',
      recordPaymentTitle: 'Magtala ng Bayad ni',
      paymentAmountLabel: 'Halaga ng Bayad (₱):',
      paymentAmountInvalid: 'Maglagay ng halagang higit sa ₱0.',
      payAll: 'Bayaran Lahat',
      paymentNotesLabel: 'Tala / Notes (opsyonal):',
      paymentNotesPlaceholder: 'Hal. Bayad sa GCash o cash',
      confirmPayment: 'Kumpirmahin ang Bayad',
      addCreditTitle: 'Magdagdag ng Utang kay',
      creditAmountLabel: 'Halaga ng Utang (₱):',
      creditNotesLabel: 'Tala / Mga Kinuha (Notes):',
      creditNotesPlaceholder: 'Hal. 2 sardinas, 1 bigas',
      saveCredit: 'Itala ang Utang'
    },
    gcash: {
      title: 'GCash Padala at Pera Hub',
      subtitle: 'Mag-record ng Cash-In at Cash-Out kahit walang internet. Awtomatikong magsi-sync sa cloud.',
      cashIn: 'Cash In (Pasok sa GCash)',
      cashOut: 'Cash Out (Bigay ng Pera)',
      refNo: 'Reference No. (Huling 4 o buong reference)',
      customerPhone: 'Numero ng Telepono ng Customer',
      fee: 'Kaltas / Singil (Service Fee ₱)',
      amount: 'Halaga ng Transaksyon (₱)',
      notes: 'Mga Tala (opsyonal)',
      recordTransaction: 'I-record ang Transaksyon',
      todayCashIn: 'Kabuuang Cash-In Ngayong Araw',
      todayCashOut: 'Kabuuang Cash-Out Ngayong Araw',
      todayFees: 'Kita sa Service Fees',
      transactionSuccess: 'GCash transaksyon matagumpay na naitala!',
      recentTransactions: 'Kamakailang mga Transaksyon',
      freePlanLabel: 'Libre',
      noTransactions: 'Wala pang naitalang transaksyon ngayong buwan.',
      amountLabel: 'Halaga (Amount ₱):*',
      feeLabel: 'Kaltas / Singil na Fee (₱):',
      feeAuto: 'Awtomatiko',
      refNoLabel: 'Reference Number:*',
      refNoPlaceholder: 'Hal. 901238471201',
      phoneLabel: 'Cellphone ng Customer:',
      notesLabel: 'Tala / Pangalan ng Receiver (Notes):',
      notesPlaceholder: 'Opsyonal na tala',
      totalFromCustomer: 'Kabuuang Kukunin sa Customer:',
      totalToCustomer: 'Kabuuang Ibibigay sa Customer:',
      saveTransaction: 'I-save ang Transaksyon',
      historyTitle: 'Kasaysayan ng GCash Ngayong Buwan',
      invalidAmountAlert: 'Maglagay ng wastong halaga.',
      duplicateRefWarning: 'Ginamit na ang reference number. Hindi maaaring magtala ng doble.',
      phoneInvalid: 'Dapat ay wastong 11-digit Philippine mobile number (09XXXXXXXXX).'
    },
    dashboard: {
      title: 'Pangkalahatang Dashboard ng Tindahan',
      todaySales: 'Benta Ngayong Araw',
      txnCount: 'Dami ng Transaksyon',
      totalUtang: 'Kabuuang Utang na Sisingilin',
      gcashVolume: 'GCash Kabuuang Halaga',
      lowStockTitle: 'Mga Paubos nang Paninda (Mababa sa 5)',
      lowStockEmpty: 'Lahat ng produkto ay may sapat pang imbentaryo.',
      topProductsTitle: 'Pinakamabiling mga Paninda',
      topProductsEmpty: 'Wala pang benta na naitala.',
      unitsSold: 'piraso nabenta',
      remaining: 'natitira',
      greeting: 'Magandang Araw! 👋',
      greetingSub: 'Handa na ang iyong tindahan para sa araw na ito.',
      quickActions: 'Mga Pangunahing Gawain (Quick Actions)',
      posActionTitle: 'Bagong Benta (POS)',
      posActionSub: 'Scan o pumili ng produkto',
      gcashActionTitle: 'GCash Transaction',
      gcashActionSub: 'Cash-In / Cash-Out',
      utangActionTitle: 'Listahan ng Utang',
      utangActionSub: 'Tingnan ang mga suki',
      importActionTitle: 'Import Inventory',
      importActionSub: 'Magbasa ng CSV file',
      todaySummary: 'Kabuuang Benta Ngayong Araw',
      debtorsWithBalance: 'suki na may balanse',
      recentSales: 'Huling Benta (Recent Sales)',
      goToPos: 'Pumunta sa POS',
      noSalesToday: 'Wala pang benta ngayong araw. Simulan ang unang benta sa POS!'
    },
    importPage: {
      title: 'Mag-import ng Imbentaryo (CSV)',
      subtitle: 'Mabilisang mag-upload ng iyong listahan ng mga paninda, SRP, at dami mula sa spreadsheet.',
      downloadTemplate: 'I-download ang Sample Template',
      selectFile: 'Pumili ng CSV File',
      importButton: 'Simulan ang Pag-import',
      successMessage: 'Matagumpay na nai-import ang mga produkto!',
      uploadPrompt: 'Piliin o I-drag ang iyong CSV Inventory File',
      formatHint: 'Format: name, price, cost, barcode, category, stockQty',
      trySample: 'Subukan gamit ang Sample Sari-Sari CSV',
      previewTitle: 'Preview at Pagpapatunay',
      validBadge: 'Wasto (Valid)',
      errorBadge: 'May Mali (Errors)',
      importing: 'Nag-i-import...',
      importProductsBtn: 'I-import ang mga Produkto',
      statusCol: 'Katayuan',
      nameCol: 'Pangalan',
      priceCol: 'Presyo',
      costCol: 'Puhunan',
      barcodeCol: 'Barcode',
      categoryCol: 'Kategorya',
      stockCol: 'Stock',
      notesCol: 'Puna',
      unnamed: '(Walang Pangalan)'
    },
    inventory: {
      title: 'Talaan ng Imbentaryo at Stocks',
      subtitle: 'Subaybayan ang dami ng paninda, baguhin ang presyo, suriin ang kita at margin, at mag-restock.',
      totalProducts: 'Kabuuang Paninda',
      fullCapacityBadge: 'Puno na',
      nearCapacityBadge: 'Halos puno',
      lowStockAlerts: 'Paubos na Paninda (≤ 5)',
      filteringLowStockHint: 'Ipinapakita ang paubos na paninda (pindutin para ipakita lahat)',
      lowStockRemainingHint: '≤ 5 piraso ang natitira',
      inventoryCost: 'Kabuuang Puhunan',
      retailValue: 'Kabuuang Benta',
      potentialProfit: 'Inaasahang Kita',
      avgMargin: 'Karaniwang Margin',
      searchPlaceholder: 'Maghanap ayon sa pangalan o barcode...',
      allCategories: 'Lahat ng Kategorya',
      filterAll: 'Lahat ng Stock',
      filterLowStock: '⚠️ Paubos na (≤ 5)',
      filterOutOfStock: '❌ Ubos na (0)',
      filterInStock: '✅ May Stock (> 5)',
      addProductBtn: 'Magdagdag ng Produkto',
      importCsvBtn: 'Mag-import ng CSV',
      colProduct: 'Produkto',
      colBarcode: 'Barcode',
      colCategory: 'Kategorya',
      colStock: 'Dami ng Stock',
      colCost: 'Puhunan (Cost)',
      colPrice: 'Tinda (SRP)',
      colMargin: 'Margin %',
      colProfit: 'Kita / piraso',
      colActions: 'Mga Aksyon',
      editPrice: 'Baguhin ang Presyo',
      editProduct: 'Baguhin ang Produkto',
      deleteProduct: 'Burahin ang Produkto',
      quickRestock: 'Mabilisang Restock',
      restockSuccess: 'Matagumpay na nadagdagan ang stock!',
      deleteConfirm: 'Sigurado ka bang nais mong burahin ang produktong ito?',
      deleteSuccess: 'Matagumpay na nabura ang produkto!',
      saveSuccess: 'Matagumpay na nai-save ang produkto!',
      addModalTitle: 'Magdagdag ng Bagong Produkto',
      editModalTitle: 'Baguhin ang Detalye ng Produkto',
      productNameLabel: 'Pangalan ng Produkto:*',
      productNameRequired: 'Ilagay ang pangalan ng produkto.',
      categoryLabel: 'Kategorya:*',
      barcodeLabel: 'Barcode (Opsyonal):',
      costLabel: 'Puhunan (Cost Price ₱):*',
      costCannotBeNegative: 'Hindi maaaring negatibo ang puhunan.',
      priceLabel: 'Presyo ng Tinda (SRP ₱):*',
      priceMustBePositive: 'Dapat mas mataas sa ₱0 ang presyo ng tinda.',
      stockLabel: 'Kasalukuyang Stock:*',
      profitPreview: 'Tinatayang Kita bawat piraso:',
      marginPreview: 'Profit Margin:',
      noProductsFound: 'Walang natagpuang produkto na tumutugma sa filter.',
      lowStockBadge: 'Paubos na',
      outOfStockBadge: 'Ubos na',
      inStockBadge: 'May Stock',
      customRestock: 'Magdagdag ng Stock'
    },
    barcode: {
      scannerTitle: 'Kamera Barcode Scanner',
      scannerDesc: 'Itapat ang barcode ng paninda sa loob ng kahon upang awtomatikong ma-scan.',
      openCamera: 'Buksan ang Scanner',
      closeCamera: 'Isara ang Scanner',
      cameraError: 'Hindi mabuksan ang camera. Pakisuri ang browser camera permissions.',
      cameraPermissionDenied: 'Kailangan ng pahintulot sa camera upang ma-scan ang barcode.',
      flashlight: 'Flashlight',
      switchCamera: 'Palitan ang Kamera',
      scanPrompt: 'Itapat ang barcode dito...',
      notFoundTitle: 'Hindi Nahanap ang Barcode',
      notFoundPrompt: 'Hindi pa rehistrado ang barcode na ito sa iyong tindahan. Nais mo ba itong irehistro bilang bagong produkto?',
      registerPromptBtn: 'Oo, Irehistro ang Produkto',
      registerModalTitle: 'Mabilisang Pagrehistro ng Produkto',
      registeredSuccess: 'Matagumpay na narehistro ang bagong produkto!',
      barcodeLabel: 'Nai-scan na Barcode:',
      productNameLabel: 'Pangalan ng Produkto:*',
      productNameRequired: 'Ilagay ang pangalan ng produkto.',
      categoryLabel: 'Kategorya:*',
      costLabel: 'Puhunan (Cost Price ₱):*',
      costCannotBeNegative: 'Hindi maaaring negatibo ang puhunan.',
      priceLabel: 'Presyo ng Tinda (SRP ₱):*',
      priceMustBePositive: 'Dapat mas mataas sa ₱0 ang presyo ng tinda.',
      stockLabel: 'Panimulang Stock:*',
      saveAndAddToCart: 'I-save at Idagdag sa Cart',
      saveProduct: 'I-save ang Produkto',
      addedToCart: 'Naidagdag na sa Cart!'
    },
    settings: {
      title: 'Sync & Offline Settings',
      subtitle: 'Pamahalaan ang offline synchronization, wika, lokal na database, at storage quota.',
      themeSection: 'Tema ng Interface (Theme)',
      themeDesc: 'Pumili ng hitsura ng interface: Maliwanag, Madilim, o awtomatikong sumusunod sa setting ng iyong device.',
      themeLight: '☀️ Maliwanag (Light)',
      themeDark: '🌙 Madilim (Dark)',
      themeSystem: '💻 Ayon sa Sistema (System)',
      languageSection: 'Wika ng Sistema (Language)',
      languageDesc: 'Pumili sa pagitan ng Taglish (Filipino) o English para sa buong interface.',
      taglish: '🇵🇭 Taglish (Filipino)',
      english: '🇺🇸 English',
      syncSection: 'Cloud Synchronization & Queue',
      forceSyncBtn: 'Puwersahing Mag-Sync Ngayon',
      pullCatalogBtn: 'Hilahin ang Produkto mula sa Cloud',
      resetSeedBtn: 'I-reset ang Local Sample Inventory (Seeder)',
      storageSection: 'Lokal na IndexedDB Storage',
      usedStorage: 'Nagamit na Local Storage',
      persistentStorage: 'Persistent Storage Status',
      persistentActive: 'Aktibo (Protektado sa auto-eviction ng browser)',
      persistentInactive: 'Hindi Aktibo',
      deviceInfoSection: 'Impormasyon ng Tindahan at Device',
      deviceId: 'Device Hardware ID',
      tenantId: 'Tindahan Tenant ID',
      userId: 'User ID ng May-ari',
      dangerZone: 'Delikadong Aksyon (Data Wipe)',
      wipeDatabaseBtn: 'I-wipe ang Data at Mag-Logout',
      resetSeedConfirm: 'Nais mo bang i-reset at i-seed muli ang 50 sari-sari store inventory catalog?',
      wipeConfirm: 'BABALA: Ito ay mag-wawipe ng lahat ng lokal na data sa teleponong ito at magla-logout. Sigurado ka ba?',
      resetSuccess: 'Na-reset at na-seed muli ang local tindahan database!',
      storeNameLabel: 'Pangalan ng Tindahan:',
      ownerNameLabel: 'May-ari / Tindera:',
      userPhoneLabel: 'Telepono / GCash:',
      editProfileBtn: 'I-edit ang Profile',
      pendingSync: 'Nakabinbing Sync Operations:',
      dlqTitle: 'Dead Letter Queue (Mga Bagsak na Sync):',
      dlqClearBtn: 'Linisin ang DLQ',
      dlqDesc: 'Ang mga transaksyong paulit-ulit na bumagsak ay inihihiwalay rito upang hindi maipit ang sync.',
      retryBtn: 'Subukan Muli',
      dataManagement: 'Pamamahala ng Datos (Data Management)',
      pullSuccessAlert: 'Nai-download ang mga produkto mula sa cloud database.',
      printerSection: 'Resibo at Printer Device',
      printerDesc: 'I-configure ang sukat ng papel ng thermal receipt printer (58mm o 80mm) at subukan ang pag-print.',
      printerPaperWidth: 'Lapad ng Papel (Paper Width)',
      printerTestBtn: 'Subukang Mag-Print (Test Print)',
      printerTestSuccess: 'Naipadala ang test receipt sa printer!',
      gcashFeeSection: 'Mga Bayad sa GCash',
      gcashFeeDesc: 'Itakda ang nakapirming singil ayon sa halaga ng transaksyon. Awtomatikong sine-save sa device na ito.',
      gcashFeeRange: 'Halaga ng Transaksyon',
      gcashFixedFee: 'Nakapirming Bayad'
    },
    receipt: {
      watermark: 'HINDI OPISYAL NA RESIBO\nPARA SA PAGKILALA LAMANG',
      receiptTitle: 'Resibo ng Benta (Sales Receipt)',
      dateLabel: 'Petsa:',
      txnLabel: 'Transaksyon:',
      totalLabel: 'KABUUAN (TOTAL):',
      paymentMethodLabel: 'Paraan ng Bayad:',
      tenderedLabel: 'Bayad:',
      changeLabel: 'Sukli:',
      customerLabel: 'Suki / Utang:',
      remainingDebtLabel: 'Natitirang Utang:',
      thankYou: 'Maraming salamat sa inyong pagbili! 🙏',
      shareTitle: 'Resibo',
      copyReceipt: 'Kopyahin ang Resibo',
      copied: 'Nakopya na!',
      printReceipt: 'I-print ang Resibo',
      printing: 'Nagpi-print...',
      printSuccess: 'Na-print na ang resibo!',
      bluetoothPrint: 'Bluetooth Thermal',
      bluetoothConnecting: 'Kumokonekta sa Bluetooth printer...',
      bluetoothError: 'Hindi makakonekta sa Bluetooth printer.',
      bluetoothNotSupported: 'Hindi suportado ang Web Bluetooth sa browser na ito.',
      paperWidthLabel: 'Sukat ng Papel:',
      paperWidth58: '58mm (Mini POS)',
      paperWidth80: '80mm (Standard POS)',
      printerDeviceLabel: 'Receipt Printer Device:'
    },
    banner: {
      offlineTitle: 'Naka-offline Ka Ngayon',
      offlineDesc: 'Lahat ng benta, utang, at GCash log ay ligtas na nakatago sa iyong device at kusang magsi-sync pag nagka-signal.'
    },
    privacy: {
      title: 'Paunawa sa Pagkapribado ng Datos (RA 10173)',
      description: 'Sumusunod ang Fluent Tindahan sa Philippine Data Privacy Act of 2012. Ang iyong mga talaan ng benta, suki, at GCash ay ligtas na nakatago sa iyong lokal na device.',
      acceptBtn: 'Sumasang-ayon Ako',
      declineBtn: 'Tanggihan',
      closeBtn: 'Isara',
      viewTermsLink: 'Tingnan ang Buong Tuntunin sa Paggamit (Terms of Use & AUP)'
    },
    disclaimer: {
      buttonLabel: 'Disclaimer',
      modalTitle: 'Mahalagang Paunawa at Paggamit',
      section1Title: 'Kagamitan sa Pagtala, Hindi BIR-Certified Cash Register.',
      section1Desc: 'Ang Fluent Tindahan ay isang offline-first na digital na talaan upang tulungan ang mga may-ari ng tindahan sa pagsubaybay ng imbentaryo, araw-araw na benta, at listahan ng utang. Hindi ito rehistradong Electronic Invoicing System o sertipikadong cash register machine (CRM) ng BIR. Ang mga kumpirmasyon sa checkout at printed slip ay pansariling gabay lamang ng tindahan at hindi katumbas ng opisyal na BIR Official Receipts (OR) o Sales Invoices (SI).',
      section2Title: 'Pananagutan sa Batas, Permit, at Buwis.',
      section2Desc: 'Ang may-ari ng tindahan ang may buong pananagutan sa pagsunod sa lahat ng batas pangnegosyo sa Pilipinas, kabilang ang mga permit sa barangay at munisipyo (LGU), patakaran ng DTI at FDA, at tamang pagdedeklara ng buwis sa Bureau of Internal Revenue (BIR). Tiyaking mag-isyu ng mga opisyal na resibo kung saan ito itinatakda ng batas.',
      section3Title: 'Sariling Talaan at Hindi Tagaproseso ng Pondo.',
      section3Desc: 'Lahat ng presyo, bilang ng paninda, listahan ng pautang, at GCash log ay sariling inilagay ng tindero at nakatago sa iyong lokal na device. Ang Fluent Tindahan ay hindi bangko, e-wallet, o remittance center, at hindi nagpoproseso o humahawak ng pera. Ang talaan ng GCash ay sariling reference lamang upang hindi malimutan ang mga reference number at bayarin.',
      section4Title: 'Independiyenteng Negosyo at Hangganan ng Pananagutan.',
      section4Desc: 'Ang bawat tindahan ay nagsasariling negosyo. Nagbibigay lamang ang Fluent Tindahan ng software upang mapadali ang pamamahala, at walang pananagutan ang platform sa kalidad ng paninda, presyo, relasyon sa suki, o kasunduan sa pautang.',
      termsLink: 'Tingnan ang buod ng kasunduan',
      termsSummaryTitle: 'Buod ng Kasunduan sa Serbisyo:',
      termsSummary1Title: 'Pansariling Pamamahala:',
      termsSummary1Desc: 'Ang Fluent Tindahan ay software na gabay sa operasyon ng tindahan. Ang may-ari ang buong may pananagutan sa tamang presyo, bilang ng imbentaryo, at singilan sa pautang.',
      termsSummary2Title: 'Walang Pananagutan sa Pondo:',
      termsSummary2Desc: 'Hindi humahawak o nagpapadala ng digital na pera ang app; anumang transaksyon sa GCash o cash ay direktang responsibilidad ng tindahan at ng mamimili.',
      termsSummary3Title: 'Pagsunod sa Regulasyon:',
      termsSummary3Desc: 'Ang paggamit ng app na ito ay nagpapatunay ng iyong pagtalima sa mga batas pangkomersyo at panuntunan sa pagbubuwis sa Pilipinas.',
      closeBtn: 'Naiintindihan Ko',
      legalCardTitle: 'Legal, Pagsunod, at Pagtanggi (Disclaimer)',
      legalCardDesc: 'Tingnan ang mga impormasyon ukol sa legal na pagsunod sa BIR, Republic Act 10173 (Data Privacy Act), at mga panuntunan sa paggamit ng app.',
      viewPrivacyBtn: 'Tingnan ang Privacy Notice (RA 10173)',
      viewFullTermsBtn: 'Tuntunin sa Paggamit at AUP',
      openFullTerms: 'Basahin ang Buong Tuntunin at Patakaran (Terms of Use & AUP)',
      termsModalTitle: 'Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit'
    },
    pwa: {
      installTitle: 'I-install ang Fluent Tindahan App',
      installDesc: 'Gamitin kahit walang internet! Magkakaroon ng sariling icon sa iyong home screen at mas mabilis magbukas.',
      installBtn: 'I-install ang App',
      installedBadge: 'Naka-install na (PWA)',
      installUnavailable: 'Nasa browser mode o naka-install na',
      dismissBtn: 'Mamaya na',
      iosInstructionsTitle: 'Paano I-install sa iPhone/iPad:',
      iosInstructionsDesc: 'Pindutin ang Share button (📤) sa Safari at piliin ang "Add to Home Screen" (➕).',
      updateTitle: 'May Bagong Bersyon ng App!',
      updateDesc: 'May bagong update ang Fluent Tindahan na may mga bagong feature at bilis.',
      updateBtn: 'I-reload para Mag-update',
      updateWaitMsg: 'Pakisara muna ang benta bago i-update.',
      updateOtherTabsWaitMsg: 'May bukas na benta sa isa pang tab. Pakitapos o pakisara muna bago mag-update.',
      pwaSection: 'PWA (Progressive Web App)',
      pwaDesc: 'I-install ang app sa iyong Android, iPhone, o computer para sa buong offline experience.',
      appStatus: 'Katayuan ng App:',
      statusInstalled: 'Naka-install bilang Standalone App',
      statusBrowser: 'Tumatakbo sa Web Browser',
      installHeaderTooltip: 'I-install ang Fluent Tindahan sa device',
      browserInstallTip: 'Para i-install: Pindutin ang install icon sa address bar ng iyong browser (itaas-kanan), o buksan ang browser menu (tatlong tuldok ⋮) at piliin ang "Install Fluent Tindahan" o "Add to Home screen".',
      browserInstallNote: 'Tandaan: Hindi puwedeng mag-install kung nasa Incognito / Private window.'
    },
    onboarding: {
      welcomeTitle: 'Maligayang Pagdating sa Fluent Tindahan! 🛒🇵🇭',
      welcomeSubtitle: 'I-setup ang impormasyon ng iyong tindahan para makapagsimula nang maayos.',
      editTitle: 'I-edit ang Profile ng Tindahan',
      editSubtitle: 'Baguhin ang pangalan ng tindahan, may-ari, o numero ng telepono.',
      storeNameLabel: 'Pangalan ng Tindahan',
      storeNamePlaceholder: 'Hal. Tindahan ni Aling Maria',
      storeNameRequired: 'Kailangan ang pangalan ng tindahan (hindi bababa sa 2 letra).',
      submitError: 'Hindi na-save ang setup ng tindahan. Tingnan ang storage ng device at subukan muli.',
      ownerNameLabel: 'Pangalan ng May-ari / Tindera (Opsyonal)',
      ownerNamePlaceholder: 'Hal. Maria Santos',
      userPhoneLabel: 'Numero ng Telepono / GCash (Opsyonal)',
      userPhonePlaceholder: 'Hal. 09171234567',
      phoneInvalid: 'Dapat ay wastong 11-digit Philippine mobile number (09XXXXXXXXX).',
      catalogSectionTitle: 'Panimulang Imbentaryo (Catalog)',
      catalogSectionDesc: 'Piliin kung nais mong i-load agad ang mga karaniwang paninda sa sari-sari store.',
      catalogStandardTitle: 'I-load ang 50 Karaniwang Paninda',
      catalogStandardDesc: 'Hanggang 50 panimulang produkto: Lucky Me, Kopiko, de-lata, kape, shampoo sachet, atbp.',
      catalogEmptyTitle: 'Magsimula sa Malinis na Tindahan',
      catalogEmptyDesc: 'Walang paunang paninda; manu-manong i-encode o i-import via CSV ang iyong mga produkto.',
      gcashToggleTitle: 'Nag-aalok ng GCash Cash-In / Cash-Out',
      gcashToggleDesc: 'I-enable upang ma-preconfigure ang karaniwang bayarin sa serbisyo ng GCash.',
      launchBtn: 'Simulan ang Aking Tindahan',
      saveProfileBtn: 'I-save ang Profile',
      cancelBtn: 'Kanselahin'
    },
    subscription: {
      planSection: 'Plano at Subscription',
      planDesc: 'Pamahalaan ang iyong SaaS subscription, tingnan ang mga limitasyon ng plano, at mag-upgrade.',
      currentPlan: 'Kasalukuyang Plano:',
      libreTier: 'Libre (₱0)',
      proTier: 'Tindahan Pro',
      plusTier: 'Negosyo Plus',
      managePlanBtn: 'Tingnan ang mga Plano / Mag-upgrade',
      upgradeBtn: 'Mag-upgrade Ngayon',
      statusActive: 'Aktibo',
      statusExpired: 'Nag-expire',
      statusFree: 'Libreng Plano',
      expiresOn: 'Magtatapos sa:',
      daysRemaining: 'Natitirang araw:',
      limitsTitle: 'Mga Limitasyon at Tampok ng Plano:',
      productLimit: 'Produkto sa Imbentaryo:',
      debtorLimit: 'Mga May Utang (Debtors):',
      gcashLimit: 'GCash Logs bawat Buwan:',
      csvImportStatus: 'CSV Bulk Import / Export:',
      unlimited: 'Walang Limitasyon (Unlimited)',
      lockedForLibre: 'Naka-lock (Kailangan ng Pro/Plus)',
      unlocked: 'Bukás (Unlocked)',
      pricingToggleWeekly: 'Sachet (Kada Linggo)',
      pricingToggleMonthly: 'Buwanan (Kada Buwan)',
      popularBadge: 'PINAKASIKAT'
    }
  },
  en: {
    common: {
      appTitle: 'Fluent Tindahan',
      storeSub: 'Aling Nena\'s Tindahan & GCash',
      online: 'Online',
      offline: 'Offline',
      syncing: 'Syncing...',
      queued: 'queued',
      allSynced: 'All data synced with cloud',
      dlqWarning: 'failed items in Dead Letter queue',
      differentAccountSyncBlocked: 'This device’s store is linked to a different account. Sign in to the matching account to sync. Pending changes remain on this device.',
      tenantProvisioningSyncBlocked: 'The server could not verify this store. Sign in again or contact support before syncing. Pending changes remain on this device.',
      forceSync: 'Force sync now',
      themeToggleDark: 'Switch to Dark theme',
      themeToggleLight: 'Switch to Light theme',
      themeToggleSystem: 'Switch to System Default',
      themeModeLight: 'Light Theme',
      themeModeDark: 'Dark Theme',
      themeModeSystem: 'System Default Theme',
      languageToggle: 'TL/EN toggle (Taglish)',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      confirm: 'Confirm',
      pesos: '₱'
    },
    nav: {
      dashboard: 'Dashboard',
      pos: 'Store (POS)',
      inventory: 'Inventory',
      utang: 'Credit Ledger',
      gcash: 'GCash Hub',
      import: 'Import CSV',
      settings: 'Settings'
    },
    pos: {
      title: 'Point of Sale',
      searchPlaceholder: 'Scan barcode or search product name...',
      noProductsFound: 'No products found. Try another search or category.',
      emptyInventory: 'No products in inventory yet.',
      emptyInventorySub: 'Add products in Inventory to start making sales.',
      goToInventoryBtn: 'Go to Inventory',
      allCategories: 'All',
      inStock: 'stock',
      outOfStock: 'Out of stock',
      cartTitle: 'Current Receipt',
      emptyCart: 'Cart is empty',
      emptyCartSub: 'Select items on the left to add them to the sale receipt.',
      totalAmount: 'Total Amount',
      cashReceived: 'Cash Received',
      change: 'Change',
      exactCash: 'Exact',
      completeCashSale: 'Complete Sale (Cash)',
      chargeToUtang: 'Charge to Credit (Utang)',
      clearCart: 'Clear Cart',
      saleSuccess: 'Sale successfully recorded!',
      insufficientCash: 'Cash received is less than total amount!',
      itemAdded: 'Added to cart',
      receiptTitle: 'Store Receipt',
      printReceipt: 'Print Receipt',
      newSale: 'New Transaction',
      qty: 'Qty',
      price: 'Price',
      subtotal: 'Subtotal',
      itemsInCart: 'in cart',
      pay: 'Checkout',
      itemsList: 'Items in Cart',
      each: 'each',
      checkoutConfirm: 'Confirm Payment (Checkout)',
      totalDue: 'Total Amount Due',
      cashTendered: 'Cash Tendered by Customer:',
      exactAmount: 'Exact Amount',
      changeLabel: 'Change:',
      gcashInstruction: 'Customer can scan store GCash QR or send to your registered number.',
      gcashRefOptional: 'GCash Reference No. (optional):',
      selectCustomer: 'Select Debtor (Customer):',
      selectCustomerPlaceholder: '-- Select Customer --',
      utangNote: 'This will be billed to the customer\'s account and added to their credit balance.',
      cashAmount: 'Cash Amount:',
      gcashAmount: 'GCash Amount:',
      splitRemaining: 'Shortage / Change:',
      checkoutBtn: 'Checkout',
      completeSaleBtn: 'Complete Sale',
      lowStockBadge: 'Low',
      stockLabel: 'Stock',
      customerSelectRequired: 'Please select a customer for credit (utang) purchase.',
      addNewDebtorBtn: 'Add New Debtor',
      newDebtorTitle: 'Register New Debtor',
      saveAndSelectDebtor: 'Save & Select',
      debtorNameRequired: 'Please enter customer name.'
    },
    utang: {
      title: 'Customer Credit & Utang Ledger',
      subtitle: 'Track customer credit lines and log payments or debts completely offline.',
      totalOutstanding: 'Total Outstanding Credit',
      customersCount: 'Active Debtors',
      searchCustomer: 'Search customer name...',
      addNewCustomer: 'Add New Customer',
      customerName: 'Customer Name',
      customerPhone: 'Phone Number',
      currentBalance: 'Outstanding Balance',
      noDebt: 'No Debt (Paid)',
      historyTitle: 'Credit & Payment History',
      noHistory: 'No transactions recorded for this customer yet.',
      logPayment: 'Log Payment',
      addCredit: 'Add Credit Charge',
      amount: 'Amount (₱)',
      notes: 'Notes / Details (optional)',
      paymentSuccess: 'Payment recorded successfully!',
      creditSuccess: 'Credit charge recorded successfully!',
      customerAdded: 'Customer successfully added!',
      customerNameLabel: 'Customer Name:*',
      customerNamePlaceholder: 'e.g. Maria Santos',
      customerNameRequired: 'Please enter customer name.',
      phoneLabel: 'Mobile Number:',
      initialDebtLabel: 'Initial Credit Balance (optional):',
      saveCustomer: 'Save Customer',
      noCustomerFound: 'No customer found. Add one using "Add New Customer".',
      noPhone: 'No phone number',
      hasUtang: 'Has Credit Balance',
      paid: 'Fully Paid',
      currentDebt: 'Current Credit Balance',
      payButton: 'Record Payment',
      addDebtButton: 'Add Credit Charge',
      timelineTitle: 'Transaction Timeline',
      noTransactions: 'No transaction records found.',
      recordPaymentTitle: 'Record Payment for',
      paymentAmountLabel: 'Payment Amount (₱):',
      paymentAmountInvalid: 'Enter a payment amount greater than ₱0.',
      payAll: 'Pay Full Balance',
      paymentNotesLabel: 'Notes (optional):',
      paymentNotesPlaceholder: 'e.g. Paid in cash or GCash',
      confirmPayment: 'Confirm Payment',
      addCreditTitle: 'Add Credit for',
      creditAmountLabel: 'Credit Amount (₱):',
      creditNotesLabel: 'Items Taken / Notes:',
      creditNotesPlaceholder: 'e.g. 2 sardines, 1 rice',
      saveCredit: 'Record Credit'
    },
    gcash: {
      title: 'GCash Remittance & Pera Hub',
      subtitle: 'Record Cash-In and Cash-Out even without internet connection. Automatically syncs when online.',
      cashIn: 'Cash In (Send to GCash)',
      cashOut: 'Cash Out (Disburse Cash)',
      refNo: 'Reference No. (Full or last 4 digits)',
      customerPhone: 'Customer Mobile Number',
      fee: 'Service Fee (₱)',
      amount: 'Transaction Amount (₱)',
      notes: 'Notes (optional)',
      recordTransaction: 'Record Transaction',
      todayCashIn: "Today's Total Cash-In",
      todayCashOut: "Today's Total Cash-Out",
      todayFees: 'Service Fees Earned',
      transactionSuccess: 'GCash transaction recorded successfully!',
      recentTransactions: 'Recent Transactions',
      freePlanLabel: 'Libre plan',
      noTransactions: 'No transactions recorded this month yet.',
      amountLabel: 'Amount (₱):*',
      feeLabel: 'Service Fee (₱):',
      feeAuto: 'Automatic',
      refNoLabel: 'Reference Number:*',
      refNoPlaceholder: 'e.g. 901238471201',
      phoneLabel: 'Customer Mobile Number:',
      notesLabel: 'Notes / Receiver Name:',
      notesPlaceholder: 'Optional notes',
      totalFromCustomer: 'Total to Collect from Customer:',
      totalToCustomer: 'Total to Disburse to Customer:',
      saveTransaction: 'Save Transaction',
      historyTitle: "This Month's GCash History",
      invalidAmountAlert: 'Please enter a valid amount.',
      duplicateRefWarning: 'This reference number has already been used. Duplicate entries are not allowed.',
      phoneInvalid: 'Must be a valid 11-digit Philippine mobile number (09XXXXXXXXX).'
    },
    dashboard: {
      title: 'Store Performance Dashboard',
      todaySales: "Today's Sales",
      txnCount: 'Transactions Count',
      totalUtang: 'Total Outstanding Credit',
      gcashVolume: 'GCash Volume',
      lowStockTitle: 'Low Stock Alerts (Below 5 units)',
      lowStockEmpty: 'All products currently have healthy inventory levels.',
      topProductsTitle: 'Top Selling Products',
      topProductsEmpty: 'No sales recorded yet.',
      unitsSold: 'units sold',
      remaining: 'left',
      greeting: 'Good Day! 👋',
      greetingSub: 'Your store is ready for today.',
      quickActions: 'Quick Actions',
      posActionTitle: 'New Sale (POS)',
      posActionSub: 'Scan or select a product',
      gcashActionTitle: 'GCash Transaction',
      gcashActionSub: 'Cash-In / Cash-Out',
      utangActionTitle: 'Credit Ledger',
      utangActionSub: 'View active debtors',
      importActionTitle: 'Import Inventory',
      importActionSub: 'Upload CSV file',
      todaySummary: "Today's Summary",
      debtorsWithBalance: 'debtors with balance',
      recentSales: 'Recent Sales',
      goToPos: 'Go to POS',
      noSalesToday: 'No sales recorded today yet. Start your first sale in POS!'
    },
    importPage: {
      title: 'Import Inventory (CSV)',
      subtitle: 'Bulk upload products, prices, and stock quantities from a spreadsheet.',
      downloadTemplate: 'Download Sample Template',
      selectFile: 'Select CSV File',
      importButton: 'Start CSV Import',
      successMessage: 'Products successfully imported!',
      uploadPrompt: 'Select or Drag your CSV Inventory File',
      formatHint: 'Format: name, price, cost, barcode, category, stockQty',
      trySample: 'Try with Sample Sari-Sari CSV',
      previewTitle: 'Preview and Validation',
      validBadge: 'Valid',
      errorBadge: 'Errors',
      importing: 'Importing...',
      importProductsBtn: 'Import Products',
      statusCol: 'Status',
      nameCol: 'Product Name',
      priceCol: 'Selling Price',
      costCol: 'Cost Price',
      barcodeCol: 'Barcode',
      categoryCol: 'Category',
      stockCol: 'Stock Qty',
      notesCol: 'Remarks / Errors',
      unnamed: '(Unnamed)'
    },
    inventory: {
      title: 'Inventory & Stock Management',
      subtitle: 'Monitor stock levels, edit prices, inspect profit margins, and restock supplies.',
      totalProducts: 'Total Products',
      fullCapacityBadge: 'Full',
      nearCapacityBadge: 'Almost full',
      lowStockAlerts: 'Low Stock Alerts (≤ 5)',
      filteringLowStockHint: 'Filtering low stock (click to show all)',
      lowStockRemainingHint: '≤ 5 units remaining',
      inventoryCost: 'Total Cost Value',
      retailValue: 'Total Retail Value',
      potentialProfit: 'Projected Gross Profit',
      avgMargin: 'Average Margin',
      searchPlaceholder: 'Search by product name or barcode...',
      allCategories: 'All Categories',
      filterAll: 'All Stock',
      filterLowStock: '⚠️ Low Stock (≤ 5)',
      filterOutOfStock: '❌ Out of Stock (0)',
      filterInStock: '✅ In Stock (> 5)',
      addProductBtn: 'Add Product',
      importCsvBtn: 'Import CSV',
      colProduct: 'Product',
      colBarcode: 'Barcode',
      colCategory: 'Category',
      colStock: 'Stock Level',
      colCost: 'Cost Price',
      colPrice: 'Retail Price (SRP)',
      colMargin: 'Margin %',
      colProfit: 'Profit / unit',
      colActions: 'Actions',
      editPrice: 'Edit Price',
      editProduct: 'Edit Product',
      deleteProduct: 'Delete Product',
      quickRestock: 'Quick Restock',
      restockSuccess: 'Stock successfully updated!',
      deleteConfirm: 'Are you sure you want to delete this product?',
      deleteSuccess: 'Product deleted successfully!',
      saveSuccess: 'Product saved successfully!',
      addModalTitle: 'Add New Product',
      editModalTitle: 'Edit Product Details',
      productNameLabel: 'Product Name:*',
      productNameRequired: 'Enter a product name.',
      categoryLabel: 'Category:*',
      barcodeLabel: 'Barcode (Optional):',
      costLabel: 'Cost Price (₱):*',
      costCannotBeNegative: 'Cost price cannot be negative.',
      priceLabel: 'Retail Price (SRP ₱):*',
      priceMustBePositive: 'Retail price must be greater than ₱0.',
      stockLabel: 'Current Stock Qty:*',
      profitPreview: 'Estimated Profit per unit:',
      marginPreview: 'Profit Margin:',
      noProductsFound: 'No products found matching the criteria.',
      lowStockBadge: 'Low Stock',
      outOfStockBadge: 'Out of Stock',
      inStockBadge: 'In Stock',
      customRestock: 'Add Stock'
    },
    barcode: {
      scannerTitle: 'Camera Barcode Scanner',
      scannerDesc: 'Point the product barcode inside the viewfinder box to scan automatically.',
      openCamera: 'Open Scanner',
      closeCamera: 'Close Scanner',
      cameraError: 'Unable to access camera. Please check browser camera permissions.',
      cameraPermissionDenied: 'Camera permission is required to scan barcodes.',
      flashlight: 'Flashlight',
      switchCamera: 'Switch Camera',
      scanPrompt: 'Align barcode inside viewfinder...',
      notFoundTitle: 'Barcode Not Found',
      notFoundPrompt: 'This barcode is not registered in your store yet. Would you like to register it as a new product?',
      registerPromptBtn: 'Yes, Register Product',
      registerModalTitle: 'Quick Product Registration',
      registeredSuccess: 'Product successfully registered!',
      barcodeLabel: 'Scanned Barcode:',
      productNameLabel: 'Product Name:*',
      productNameRequired: 'Enter a product name.',
      categoryLabel: 'Category:*',
      costLabel: 'Cost Price (₱):*',
      costCannotBeNegative: 'Cost price cannot be negative.',
      priceLabel: 'Retail Price (SRP ₱):*',
      priceMustBePositive: 'Retail price must be greater than ₱0.',
      stockLabel: 'Initial Stock:*',
      saveAndAddToCart: 'Save & Add to Cart',
      saveProduct: 'Save Product',
      addedToCart: 'Added to Cart!'
    },
    settings: {
      title: 'Sync & Offline Settings',
      subtitle: 'Manage background sync, system language, local database, and storage quotas.',
      themeSection: 'Interface Theme',
      themeDesc: 'Choose interface appearance: Light, Dark, or automatically follow system settings.',
      themeLight: '☀️ Light',
      themeDark: '🌙 Dark',
      themeSystem: '💻 System Default',
      languageSection: 'System Language',
      languageDesc: 'Choose between Taglish (Filipino) and English for the entire user interface.',
      taglish: '🇵🇭 Taglish (Filipino)',
      english: '🇺🇸 English',
      syncSection: 'Cloud Synchronization & Queue',
      forceSyncBtn: 'Force Cloud Sync Now',
      pullCatalogBtn: 'Pull Products from Cloud',
      resetSeedBtn: 'Reset Local Demo Inventory (Seeder)',
      storageSection: 'Local IndexedDB Storage',
      usedStorage: 'Local Storage Used',
      persistentStorage: 'Persistent Storage Status',
      persistentActive: 'Active (Protected from browser auto-eviction)',
      persistentInactive: 'Inactive',
      deviceInfoSection: 'Store & Device Details',
      deviceId: 'Device Hardware ID',
      tenantId: 'Store Tenant ID',
      userId: 'Owner User ID',
      dangerZone: 'Dangerous Actions (Data Wipe)',
      wipeDatabaseBtn: 'Wipe Local Data & Sign Out',
      resetSeedConfirm: 'Do you want to reset and re-seed the 50 sari-sari store inventory catalog?',
      wipeConfirm: 'WARNING: This will wipe all local data on this device and sign you out. Are you sure?',
      resetSuccess: 'Local store database reset and re-seeded!',
      storeNameLabel: 'Store Name:',
      ownerNameLabel: 'Owner / Cashier:',
      userPhoneLabel: 'Phone / GCash:',
      editProfileBtn: 'Edit Store Profile',
      pendingSync: 'Pending Sync Operations:',
      dlqTitle: 'Dead Letter Queue (Poison Pills):',
      dlqClearBtn: 'Clear DLQ',
      dlqDesc: 'Items that failed sync multiple times are isolated here to prevent blocking the queue.',
      retryBtn: 'Retry',
      dataManagement: 'Data Management',
      pullSuccessAlert: 'Products successfully downloaded from cloud database.',
      printerSection: 'Receipt & Printer Device',
      printerDesc: 'Configure thermal receipt printer paper width (58mm or 80mm) and test printer device.',
      printerPaperWidth: 'Paper Width',
      printerTestBtn: 'Print Test Receipt',
      printerTestSuccess: 'Test receipt sent to printer!',
      gcashFeeSection: 'GCash Transaction Fees',
      gcashFeeDesc: 'Set the fixed fee for each transaction amount bracket. Fees save automatically on this device.',
      gcashFeeRange: 'Transaction Amount',
      gcashFixedFee: 'Fixed Fee'
    },
    receipt: {
      watermark: 'NOT AN OFFICIAL RECEIPT\nFOR ACKNOWLEDGMENT ONLY',
      receiptTitle: 'Sales Receipt',
      dateLabel: 'Date:',
      txnLabel: 'Transaction:',
      totalLabel: 'TOTAL:',
      paymentMethodLabel: 'Payment Method:',
      tenderedLabel: 'Cash Tendered:',
      changeLabel: 'Change:',
      customerLabel: 'Customer / Credit:',
      remainingDebtLabel: 'Remaining Balance:',
      thankYou: 'Thank you for your purchase! 🙏',
      shareTitle: 'Receipt',
      copyReceipt: 'Copy Receipt',
      copied: 'Copied!',
      printReceipt: 'Print Receipt',
      printing: 'Printing...',
      printSuccess: 'Receipt printed successfully!',
      bluetoothPrint: 'Bluetooth Thermal',
      bluetoothConnecting: 'Connecting to Bluetooth printer...',
      bluetoothError: 'Failed to connect to Bluetooth printer.',
      bluetoothNotSupported: 'Web Bluetooth is not supported on this browser.',
      paperWidthLabel: 'Paper Width:',
      paperWidth58: '58mm (Mini POS)',
      paperWidth80: '80mm (Standard POS)',
      printerDeviceLabel: 'Receipt Printer Device:'
    },
    banner: {
      offlineTitle: 'You are Currently Offline',
      offlineDesc: 'All sales, utang, and GCash logs are stored securely on your device and will sync automatically once reconnected.'
    },
    privacy: {
      title: 'Data Privacy Notice (RA 10173)',
      description: 'Fluent Tindahan complies with the Philippine Data Privacy Act of 2012. Your sales, customer, and GCash records are kept securely on your local device.',
      acceptBtn: 'I Agree',
      declineBtn: 'Decline',
      closeBtn: 'Close',
      viewTermsLink: 'View Full Terms of Use & Acceptable Usage Policy (AUP)'
    },
    disclaimer: {
      buttonLabel: 'Disclaimer',
      modalTitle: 'Important Notice & Usage Terms',
      section1Title: 'Record-Keeping Tool, Not a BIR-Certified Register.',
      section1Desc: 'Fluent Tindahan functions as an offline-first digital ledger to assist store owners with managing daily stock, sales tallying, and customer utang records. It is not an accredited Electronic Invoicing System or certified cash register machine (CRM). System summaries and printed slips are for internal shop management only and do not constitute BIR-registered Official Receipts (OR) or Sales Invoices (SI).',
      section2Title: 'Merchant Legal & Tax Obligations.',
      section2Desc: 'Store operators are solely responsible for compliance with all applicable Philippine laws, including local government permits (barangay and municipal), DTI and FDA retail guidelines, and tax declarations with the Bureau of Internal Revenue (BIR). Retailers must issue official receipts and invoices in accordance with national regulations.',
      section3Title: 'Self-Reported Records & Non-Payment Processor.',
      section3Desc: 'All product catalog data, retail prices, customer debt balances, and GCash logs are inputted directly by the merchant and retained on local storage. Fluent Tindahan does not hold custody of financial funds, provide banking services, or execute money remittances. Digital payment entries serve exclusively as personal record-keeping references.',
      section4Title: 'Independent Retail Operations & Liability Limit.',
      section4Desc: 'Store merchants operate independently. Fluent Tindahan provides assistive productivity software and assumes no responsibility for merchant products, retail transactions, customer credit agreements, or commercial disputes.',
      termsLink: 'View terms summary',
      termsSummaryTitle: 'Terms of Use & Service Summary:',
      termsSummary1Title: 'Independent Merchant Utility:',
      termsSummary1Desc: 'Fluent Tindahan is an assistive management utility. Merchants retain full ownership and responsibility for their pricing, inventory accuracy, and customer credit ledger.',
      termsSummary2Title: 'No Fund Custody:',
      termsSummary2Desc: 'The software does not transmit, hold, or escrow funds. All cash and GCash transactions occur directly between the merchant and their customer.',
      termsSummary3Title: 'Regulatory Compliance:',
      termsSummary3Desc: 'Continued use acknowledges your duty to uphold applicable Philippine municipal ordinances, commerce standards, and BIR tax mandates.',
      closeBtn: 'Understood & Close',
      legalCardTitle: 'Legal, Compliance & Disclaimers',
      legalCardDesc: 'Review regulatory compliance information regarding BIR tax obligations, Philippine Data Privacy Act (RA 10173), and software operation boundaries.',
      viewPrivacyBtn: 'View Privacy Notice (RA 10173)',
      viewFullTermsBtn: 'Terms of Use & AUP',
      openFullTerms: 'Read Full Terms of Use & Acceptable Usage Policy (AUP)',
      termsModalTitle: 'Terms of Use & Acceptable Usage Policy'
    },
    pwa: {
      installTitle: 'Install Fluent Tindahan App',
      installDesc: 'Works 100% offline! Get a home screen icon, faster launch times, and full-screen POS experience.',
      installBtn: 'Install App',
      installedBadge: 'Installed (PWA)',
      installUnavailable: 'Running in browser or already installed',
      dismissBtn: 'Maybe later',
      iosInstructionsTitle: 'How to install on iOS / iPad:',
      iosInstructionsDesc: 'Tap the Share icon (📤) in Safari and choose "Add to Home Screen" (➕).',
      updateTitle: 'New App Version Available!',
      updateDesc: 'An updated version of Fluent Tindahan is ready with enhancements and performance fixes.',
      updateBtn: 'Reload & Update',
      updateWaitMsg: 'Please complete or clear the cart before updating.',
      updateOtherTabsWaitMsg: 'Another open till tab has an active transaction. Complete or clear it before updating.',
      pwaSection: 'Progressive Web App (PWA)',
      pwaDesc: 'Install the app on your Android phone, iPhone, or PC for a native, offline-ready experience.',
      appStatus: 'App Environment:',
      statusInstalled: 'Installed as Standalone PWA',
      statusBrowser: 'Running in Web Browser',
      installHeaderTooltip: 'Install Fluent Tindahan to device',
      browserInstallTip: 'To install: Click the install icon in your browser address bar (top right), or click the browser menu (three dots ⋮) and select "Install Fluent Tindahan" or "Add to Home screen".',
      browserInstallNote: 'Note: PWA installation is not available in Incognito / Private browsing windows.'
    },
    subscription: {
      planSection: 'Subscription & Plans',
      planDesc: 'Manage your SaaS subscription tier, inspect plan limits, and upgrade.',
      currentPlan: 'Current Plan:',
      libreTier: 'Libre (₱0 Free)',
      proTier: 'Tindahan Pro',
      plusTier: 'Negosyo Plus',
      managePlanBtn: 'View Plans / Upgrade',
      upgradeBtn: 'Upgrade Now',
      statusActive: 'Active',
      statusExpired: 'Expired',
      statusFree: 'Free Forever',
      expiresOn: 'Expires on:',
      daysRemaining: 'Days remaining:',
      limitsTitle: 'Plan Features & Allowances:',
      productLimit: 'Catalog Products:',
      debtorLimit: 'Tracked Debtors:',
      gcashLimit: 'Monthly GCash Logs:',
      csvImportStatus: 'CSV Bulk Import / Export:',
      unlimited: 'Unlimited',
      lockedForLibre: 'Locked (Requires Pro or Plus)',
      unlocked: 'Unlocked',
      pricingToggleWeekly: 'Sachet (Weekly)',
      pricingToggleMonthly: 'Monthly',
      popularBadge: 'MOST POPULAR'
    },
    onboarding: {
      welcomeTitle: 'Welcome to Fluent Tindahan! 🛒🇵🇭',
      welcomeSubtitle: 'Set up your store details to get started with zero friction.',
      editTitle: 'Edit Store Profile',
      editSubtitle: 'Update your store name, owner name, or contact number.',
      storeNameLabel: 'Store Name',
      storeNamePlaceholder: 'e.g. Maria\'s Sari-Sari Store',
      storeNameRequired: 'Store name is required (minimum 2 characters).',
      submitError: 'Store setup could not be saved. Check device storage and try again.',
      ownerNameLabel: 'Owner / Cashier Name (Optional)',
      ownerNamePlaceholder: 'e.g. Maria Santos',
      userPhoneLabel: 'Contact / GCash Mobile (Optional)',
      userPhonePlaceholder: 'e.g. 09171234567',
      phoneInvalid: 'Must be a valid 11-digit Philippine mobile number (09XXXXXXXXX).',
      catalogSectionTitle: 'Initial Inventory Setup',
      catalogSectionDesc: 'Choose whether to pre-load standard sari-sari store FMCG goods.',
      catalogStandardTitle: 'Pre-load 50 Standard Products',
      catalogStandardDesc: 'Up to 50 starter products, including instant noodles, coffee mixes, canned goods, sachets, etc.',
      catalogEmptyTitle: 'Start with Blank Store',
      catalogEmptyDesc: 'No pre-loaded items; enter your products manually or import via CSV.',
      gcashToggleTitle: 'Offers GCash Cash-In / Cash-Out',
      gcashToggleDesc: 'Pre-configures default transaction fee brackets for GCash remittance.',
      launchBtn: 'Launch My Store',
      saveProfileBtn: 'Save Profile',
      cancelBtn: 'Cancel'
    }
  }
};
