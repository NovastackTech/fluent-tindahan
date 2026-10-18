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
    menuTitle: string;
    expandMenu: string;
    collapseMenu: string;
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
    insufficientStock: string;
    stockLimitReached: string;
    saleBlockedStock: string;
    stockOverrideBtn: string;
    stockOverrideDialogTitle: string;
    stockOverrideDialogDesc: string;
    stockOverrideConfirmBtn: string;
    stockWarnNotice: string;
    stockBlockedNotice: string;
    stockWarnBanner: string;
    stockOverriddenBanner: string;
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
    amountMustBePositive: string;
    amountExceedsMax: string;
    feeExceedsAmount: string;
    feeCannotBeNegative: string;
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
    costExceedsMax: string;
    priceLabel: string;
    priceMustBePositive: string;
    priceExceedsMax: string;
    stockLabel: string;
    stockExceedsMax: string;
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
    costExceedsMax: string;
    priceLabel: string;
    priceMustBePositive: string;
    priceExceedsMax: string;
    stockLabel: string;
    stockExceedsMax: string;
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
    dlqDismissBtn: string;
    dlqEditBtn: string;
    dlqEditDialogTitle: string;
    dlqEditDialogDesc: string;
    dlqSaveAndRetryBtn: string;
    dlqRequiresCorrectionAlert: string;
    dlqRetrySuccess: string;
    dlqDismissConfirmTitle: string;
    dlqDismissConfirmDesc: string;
    dlqDismissConfirmWarning: string;
    dlqDismissConfirmBtn: string;
    dlqClearConfirmTitle: string;
    dlqClearConfirmDesc: string;
    dlqClearConfirmBtn: string;
    stockPolicySection: string;
    stockPolicyDesc: string;
    stockPolicyWarn: string;
    stockPolicyWarnDesc: string;
    stockPolicyBlock: string;
    stockPolicyBlockDesc: string;
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
    emailLabel: string;
    pinStatusLabel: string;
    pinActive: string;
    pinInactive: string;
    setPinBtn: string;
    changePinBtn: string;
    clearPinBtn: string;
    lockSessionBtn: string;
    switchAccountBtn: string;
    logoutBtn: string;
    logoutConfirmTitle: string;
    logoutConfirmDesc: string;
    logoutUnsyncedWarning: string;
    forceLogoutBtn: string;
    syncFirstBtn: string;
    pinDialogTitle: string;
    pinDialogDesc: string;
    currentPasswordLabel: string;
    newPinLabel: string;
    pinUpdatedSuccess: string;
    sessionLockedTitle: string;
    sessionLockedDesc: string;
    unlockBtn: string;
    invalidPinOrPassword: string;
    pinLockedError: string;
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
    termsCheckboxPrefix: string;
    termsCheckboxLinkText: string;
    termsCheckboxSuffix: string;
    acceptedVersionNotice: string;
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
    closeBtn: string;
    legalCardTitle: string;
    legalCardDesc: string;
    viewPrivacyBtn: string;
    viewFullTermsBtn: string;
    openFullTerms: string;
  };
  terms: {
    philippinesBadge: string;
    langToggleTitle: string;
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
    emailLabel: string;
    emailPlaceholder: string;
    emailRequired: string;
    emailInvalid: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordRequired: string;
    passwordMinLength: string;
    passwordStrengthError: string;
    confirmPasswordRequired: string;
    passwordMismatch: string;
    pinLabel: string;
    pinPlaceholder: string;
    pinHint: string;
    pinInvalid: string;
    registerTab: string;
    loginTab: string;
    loginSubtitle: string;
    loginModePassword: string;
    loginModePin: string;
    loginBtn: string;
    loginSuccess: string;
    loginFailed: string;
    emailAlreadyExists: string;
    offlineRegisterNotice: string;
    hydratingCatalog: string;
    switchAccountPrompt: string;
    registerPrompt: string;
    loginUnsyncedTitle: string;
    loginUnsyncedWarning: string;
    loginUnsyncedNotice: string;
    forceLoginBtn: string;
    currentPasswordLabel: string;
    currentPasswordPlaceholder: string;
    currentPasswordRequired: string;
    currentPasswordHint: string;
    ownerOnlyBusinessName: string;
    savedLocallyNotice: string;
    pendingProfileSync: string;
  };
  landing: {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    tryDemoBtn: string;
    viewPricingBtn: string;
    loginCardTitle: string;
    loginCardDesc: string;
    tabLogin: string;
    tabRegister: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    passwordStrengthHint: string;
    passwordStrengthWeak: string;
    passwordStrengthMedium: string;
    passwordStrengthStrong: string;
    pinLabel: string;
    pinPlaceholder: string;
    usePinToggle: string;
    usePasswordToggle: string;
    loginSubmitBtn: string;
    registerSubmitBtn: string;
    storeNameLabel: string;
    storeNamePlaceholder: string;
    ownerNameLabel: string;
    ownerNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    offerGcashLabel: string;
    starterProductsLabel: string;
    starterProductsDesc: string;
    demoStorePrompt: string;
    exploreDemoBtn: string;
    loggedInStatus: string;
    openPosBtn: string;
    openDashboardBtn: string;
    switchStoreBtn: string;
    featuresTitle: string;
    featuresSubtitle: string;
    feat1Title: string;
    feat1Desc: string;
    feat2Title: string;
    feat2Desc: string;
    feat3Title: string;
    feat3Desc: string;
    feat4Title: string;
    feat4Desc: string;
    feat5Title: string;
    feat5Desc: string;
    feat6Title: string;
    feat6Desc: string;
    calcTitle: string;
    calcSubtitle: string;
    calcDailySales: string;
    calcGcashTxns: string;
    calcMargin: string;
    calcMonthlyProfit: string;
    calcGcashProfit: string;
    calcUtangRecovered: string;
    calcHoursSaved: string;
    compareTitle: string;
    compareSubtitle: string;
    compareOldTitle: string;
    compareOldItem1: string;
    compareOldItem2: string;
    compareOldItem3: string;
    compareOldItem4: string;
    compareNewTitle: string;
    compareNewItem1: string;
    compareNewItem2: string;
    compareNewItem3: string;
    compareNewItem4: string;
    pricingTitle: string;
    pricingSubtitle: string;
    planFreeTitle: string;
    planFreePrice: string;
    planFreeDesc: string;
    planProTitle: string;
    planProPrice: string;
    planProDesc: string;
    planPlusTitle: string;
    planPlusPrice: string;
    planPlusDesc: string;
    startNowBtn: string;
    testimonialsTitle: string;
    testimonialsSubtitle: string;
    faqTitle: string;
    faqSubtitle: string;
    faq1Q: string;
    faq1A: string;
    faq2Q: string;
    faq2A: string;
    faq3Q: string;
    faq3A: string;
    faq4Q: string;
    faq4A: string;
    ctaTitle: string;
    ctaDesc: string;
    ctaBtn: string;
    exploreNavBtn: string;
    exploreTooltip: string;
    exploreTitle: string;
  };
  login: {
    pageTitle: string;
    pageSubtitle: string;
    signUpPageTitle: string;
    signUpPageSubtitle: string;
    badgeText: string;
    backToLanding: string;
    demoNote: string;
    noAccountText: string;
    hasAccountText: string;
    switchModePassword: string;
    switchModePin: string;
  };
}

type SharedProductFormTranslations = Pick<
  Translations['inventory'],
  | 'productNameLabel'
  | 'productNameRequired'
  | 'categoryLabel'
  | 'costLabel'
  | 'costCannotBeNegative'
  | 'costExceedsMax'
  | 'priceLabel'
  | 'priceMustBePositive'
  | 'priceExceedsMax'
  | 'stockExceedsMax'
>;

const sharedProductFormTranslations: Record<Language, SharedProductFormTranslations> = {
  tl: {
    productNameLabel: 'Pangalan ng Produkto:*',
    productNameRequired: 'Ilagay ang pangalan ng produkto.',
    categoryLabel: 'Kategorya:*',
    costLabel: 'Puhunan (Cost Price ₱):*',
    costCannotBeNegative: 'Hindi maaaring negatibo ang puhunan.',
    costExceedsMax: 'Hindi maaaring lumampas sa ₱999,999.99 ang puhunan.',
    priceLabel: 'Presyo ng Tinda (SRP ₱):*',
    priceMustBePositive: 'Dapat mas mataas sa ₱0 ang presyo ng tinda.',
    priceExceedsMax: 'Hindi maaaring lumampas sa ₱999,999.99 ang presyo.',
    stockExceedsMax: 'Hindi maaaring lumampas sa 999,999 ang dami ng stock.'
  },
  en: {
    productNameLabel: 'Product Name:*',
    productNameRequired: 'Enter a product name.',
    categoryLabel: 'Category:*',
    costLabel: 'Cost Price (₱):*',
    costCannotBeNegative: 'Cost price cannot be negative.',
    costExceedsMax: 'Cost price cannot exceed ₱999,999.99.',
    priceLabel: 'Retail Price (SRP ₱):*',
    priceMustBePositive: 'Retail price must be greater than ₱0.',
    priceExceedsMax: 'Retail price cannot exceed ₱999,999.99.',
    stockExceedsMax: 'Stock quantity cannot exceed 999,999.'
  }
};

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
      settings: 'Sync',
      menuTitle: 'Menu ng Tindahan',
      expandMenu: 'Buksan ang menu',
      collapseMenu: 'Itago ang menu'
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
      debtorNameRequired: 'Pakiusap ilagay ang pangalan ng suki.',
      insufficientStock: 'Kulang ang Stock',
      stockLimitReached: 'Naabot na ang limitasyon ng stock',
      saleBlockedStock: 'Hindi maaaring ituloy ang benta dahil kulang ang stock.',
      stockOverrideBtn: 'I-override ang Stock',
      stockOverrideDialogTitle: 'Kumpirmahin ang Pag-override sa Stock',
      stockOverrideDialogDesc: 'Kulang ang nakatalang stock sa system para sa ilang paninda. Sa offline tindahan, posibleng may pisikal na paninda na hindi pa nai-encode ang delivery o hindi pa naka-sync. Nais mo bang ituloy pa rin ang benta?',
      stockOverrideConfirmBtn: 'I-override at Ituloy ang Benta',
      stockWarnNotice: 'Pansin: May mga panindang kulang ang nakatalang stock sa system (Pinapayagan dahil naka-set sa Babala Lamang).',
      stockBlockedNotice: 'Kulang ang stock sa system. Pindutin ang "I-override ang Stock" upang payagan ang benta.',
      stockWarnBanner: 'Pansin: Kulang ang nakatalang stock (Babala lamang).',
      stockOverriddenBanner: 'Na-override ang stock para sa bentang ito.'
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
      amountMustBePositive: 'Ang halaga ay dapat mas mataas sa ₱0.',
      amountExceedsMax: 'Ang halaga ng transaksyon ay hindi maaaring lumagpas sa ₱100,000.00 (limitasyon ng GCash wallet/agent).',
      feeExceedsAmount: 'Ang service fee ay hindi maaaring mas mataas sa halaga ng transaksyon.',
      feeCannotBeNegative: 'Ang service fee ay hindi maaaring negatibo.',
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
      ...sharedProductFormTranslations.tl,
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
      barcodeLabel: 'Barcode (Opsyonal):',
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
      ...sharedProductFormTranslations.tl,
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
      dlqDismissBtn: 'I-dismiss',
      dlqEditBtn: 'Ayusin',
      dlqEditDialogTitle: 'Ayusin ang Paninda (Dead Letter Queue)',
      dlqEditDialogDesc: 'Bumagsak ang pag-sync ng panindang ito dahil sa maling halaga o datos. Pakitama ang mga detalye at kumpirmahin bago muling i-sync.',
      dlqSaveAndRetryBtn: 'I-save at Subukan Muli',
      dlqRequiresCorrectionAlert: 'May mga maling halaga sa paninda. Pakiusap itama ang presyo o puhunan bago muling i-sync.',
      dlqRetrySuccess: 'Matagumpay na naitama ang paninda at naibalik sa sync queue!',
      dlqDismissConfirmTitle: 'Kumpirmahin ang Pag-dismiss ng Datos',
      dlqDismissConfirmDesc: 'Permanente itong aalisin sa queue at hindi na mai-sync sa cloud database:',
      dlqDismissConfirmWarning: 'BABALA: Ang hindi naka-sync na transaksyong ito ay mabubura sa aktibong queue at hindi na maipapadala sa server.',
      dlqDismissConfirmBtn: 'I-dismiss Nang Tuluyan',
      dlqClearConfirmTitle: 'Linisin ang Lahat sa Dead Letter Queue?',
      dlqClearConfirmDesc: 'Lahat ng bagsak na sync items sa queue ay permanente nang aalisin at hindi na maipapadala sa cloud database. Sigurado ka ba?',
      dlqClearConfirmBtn: 'Linisin ang Lahat',
      stockPolicySection: 'Patakaran sa Stock ng POS (Stock Policy)',
      stockPolicyDesc: 'Piliin kung haharangin ang benta kapag 0 o kulang ang nakatalang stock sa system.',
      stockPolicyWarn: 'Babala Lamang (Warn Only - Rekomendado sa Offline)',
      stockPolicyWarnDesc: 'Magbibigay ng babala pero papayagan ang benta kapag may pisikal na paninda kahit 0 o kulang sa system.',
      stockPolicyBlock: 'Mahigpit na I-block (Strict Block)',
      stockPolicyBlockDesc: 'Bawal mag-checkout kapag 0 o kulang ang stock sa system maliban kung i-override ng may-ari.',
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
      gcashFixedFee: 'Nakapirming Bayad',
      emailLabel: 'Email Address:',
      pinStatusLabel: 'Quick POS PIN:',
      pinActive: 'Naka-set (Aktibo)',
      pinInactive: 'Wala pang PIN',
      setPinBtn: 'Mag-set ng PIN',
      changePinBtn: 'Palitan ang PIN',
      clearPinBtn: 'Alisin ang PIN',
      lockSessionBtn: 'I-lock ang Kaha',
      switchAccountBtn: 'Magpalit ng Tindahan (Switch Account)',
      logoutBtn: 'Mag-log Out',
      logoutConfirmTitle: 'Sigurado ka bang magla-log out?',
      logoutConfirmDesc: 'Mabubura ang lokal na data sa device na ito bago magpalit ng account. Tiyaking naka-sync ang lahat ng benta.',
      logoutUnsyncedWarning: 'May {count} transaksyon na hindi pa nai-sync sa cloud! Kung magla-log out ka ngayon, maaaring mawala ang mga ito.',
      forceLogoutBtn: 'I-log Out Pa Rin',
      syncFirstBtn: 'I-sync Muna Bago Mag-logout',
      pinDialogTitle: 'Quick POS PIN Settings',
      pinDialogDesc: 'I-update o i-set ang 4-6 digit PIN gamit ang iyong password.',
      currentPasswordLabel: 'Kasalukuyang Password',
      newPinLabel: 'Bagong PIN (4-6 digits, iwanang blangko kung nais alisin)',
      pinUpdatedSuccess: 'Matagumpay na na-update ang PIN.',
      sessionLockedTitle: 'Naka-lock ang Kaha',
      sessionLockedDesc: 'Ipasok ang iyong PIN o Password para buksan muli ang tindahan.',
      unlockBtn: 'I-unlock ang Kaha',
      invalidPinOrPassword: 'Maling PIN o Password.',
      pinLockedError: 'Masyadong maraming maling pagsubok. Naka-lockout ang PIN nang {minutes} minuto. Gamitin ang password.'
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
      viewTermsLink: 'Tingnan ang Buong Tuntunin sa Paggamit (Terms of Use & AUP)',
      termsCheckboxPrefix: 'Nabasa at sinasang-ayunan ko ang ',
      termsCheckboxLinkText: 'Mga Tuntunin sa Paggamit (Terms of Use & AUP)',
      termsCheckboxSuffix: ' at Patakaran sa Data Privacy.',
      acceptedVersionNotice: 'Tinanggap ang Bersyon ng Tuntunin:'
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
      closeBtn: 'Naiintindihan Ko',
      legalCardTitle: 'Legal, Pagsunod, at Pagtanggi (Disclaimer)',
      legalCardDesc: 'Tingnan ang mga impormasyon ukol sa legal na pagsunod sa BIR, Republic Act 10173 (Data Privacy Act), at mga panuntunan sa paggamit ng app.',
      viewPrivacyBtn: 'Tingnan ang Privacy Notice (RA 10173)',
      viewFullTermsBtn: 'Tuntunin sa Paggamit at AUP',
      openFullTerms: 'Basahin ang Buong Tuntunin at Patakaran (Terms of Use & AUP)'
    },
    terms: {
      philippinesBadge: 'Pilipinas',
      langToggleTitle: 'Switch to English'
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
      catalogStandardTitle: 'I-load ang 10 Karaniwang Paninda',
      catalogStandardDesc: '10 panimulang produkto na handa nang gamitin sa POS: Lucky Me, Kopiko, de-lata, kape, shampoo sachet, atbp.',
      catalogEmptyTitle: 'Magsimula sa Malinis na Tindahan',
      catalogEmptyDesc: 'Walang paunang paninda; manu-manong i-encode o i-import via CSV ang iyong mga produkto.',
      gcashToggleTitle: 'Nag-aalok ng GCash Cash-In / Cash-Out',
      gcashToggleDesc: 'I-enable upang ma-preconfigure ang karaniwang bayarin sa serbisyo ng GCash.',
      launchBtn: 'Simulan ang Aking Tindahan',
      saveProfileBtn: 'I-save ang Profile',
      cancelBtn: 'Kanselahin',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Hal. nena.store@gmail.com',
      emailRequired: 'Kailangan ang wastong email address.',
      emailInvalid: 'Maling format ng email address.',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Minimum 6 characters',
      passwordRequired: 'Kailangan ang password (minimum 6 characters).',
      passwordMinLength: 'Dapat mayroong 6 o higit pang characters ang password.',
      passwordStrengthError: 'Dapat mayroong 8 o higit pang characters at may pinaghalong letra at numero ang password.',
      confirmPasswordRequired: 'Kailangan kumpirmahin ang password.',
      passwordMismatch: 'Hindi magkatugma ang password.',
      pinLabel: 'Quick POS PIN (Opsyonal)',
      pinPlaceholder: '4 hanggang 6 na numero',
      pinHint: 'Gamitin para sa mabilisang pag-unlock ng kaha / POS nang hindi paulit-ulit na nagta-type ng buong password.',
      pinInvalid: 'Ang PIN ay dapat 4 hanggang 6 na digit (mga numero lamang).',
      registerTab: 'Bagong Tindahan',
      loginTab: 'Mag-login',
      loginSubtitle: 'Ipasok ang iyong email at password o PIN para buksan ang tindahan.',
      loginModePassword: 'Gamit ang Password',
      loginModePin: 'Gamit ang Quick PIN',
      loginBtn: 'Pumasok sa Tindahan',
      loginSuccess: 'Maligayang pagbabalik! Nabuksan na ang iyong tindahan.',
      loginFailed: 'Maling email, password, o PIN.',
      emailAlreadyExists: 'May tindahan nang nakarehistro gamit ang email na ito. Pakipili ang Mag-login.',
      offlineRegisterNotice: 'Offline ang device: Nai-save ang tindahan sa lokal. Magpapatuloy ang cloud registration pagbalik ng internet.',
      hydratingCatalog: 'Kinukuha ang data ng tindahan mula sa cloud...',
      switchAccountPrompt: 'Mayroon ka na bang rehistradong tindahan? Mag-login dito.',
      registerPrompt: 'Wala ka pang tindahan? Magrehistro rito.',
      loginUnsyncedTitle: 'May Hindi Pa Nai-sync na Datos',
      loginUnsyncedWarning: 'May {count} transaksyon na hindi pa nai-sync sa cloud mula sa kasalukuyang tindahan! Kung magla-log in ka sa ibang account, mabubura ang mga ito.',
      loginUnsyncedNotice: 'Paalala: May {count} transaksyon na hindi pa nai-sync sa cloud sa device na ito.',
      forceLoginBtn: 'I-wipe at Mag-login Pa Rin',
      currentPasswordLabel: 'Kasalukuyang Password',
      currentPasswordPlaceholder: 'Ipasok ang kasalukuyang password',
      currentPasswordRequired: 'Kailangan ang kasalukuyang password o PIN upang palitan ang email address.',
      currentPasswordHint: 'Kinakailangan upang kumpirmahin ang pagpapalit ng email address ng tindahan.',
      ownerOnlyBusinessName: 'Ang may-ari lamang ang maaaring magpalit ng pangalan ng tindahan.',
      savedLocallyNotice: 'Nai-save sa device. Isa-synchronize sa server pagbalik ng koneksyon.',
      pendingProfileSync: 'May nakabinbing profile update na isa-synchronize sa server.'
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
    },
    landing: {
      heroBadge: '🇵🇭 Binuo Para sa Tindahang Pilipino • 100% Offline-Ready',
      heroTitle: 'Ang Makabagong Kaha at POS ng Sari-Sari Store — Gumagana Kahit Walang Internet!',
      heroSubtitle: 'I-record ang benta sa 1 segundo, wakasan ang nawawalang listahan ng pautang sa kuwaderno, at i-compute ang GCash fees nang awtomatiko. Zero network block, garantisadong mabilis.',
      tryDemoBtn: 'Subukan ang Live Demo',
      viewPricingBtn: 'Tingnan ang Plano at Presyo',
      loginCardTitle: 'Pumasok sa Iyong Tindahan',
      loginCardDesc: 'Mag-sign in o magrehistro upang simulan ang iyong digital na kaha.',
      tabLogin: 'Mag-login',
      tabRegister: 'Bagong Tindahan',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Hal. nena.store@gmail.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Minimum 6 characters',
      confirmPasswordLabel: 'Kumpirmahin ang Password',
      confirmPasswordPlaceholder: 'Ulitin ang password',
      passwordStrengthHint: 'Minimum 8 characters na may pinaghalong letra at numero',
      passwordStrengthWeak: 'Mahina',
      passwordStrengthMedium: 'Katamtaman',
      passwordStrengthStrong: 'Malakas',
      pinLabel: 'Quick POS PIN',
      pinPlaceholder: '4 hanggang 6 na numero',
      usePinToggle: 'Gamit ang Quick PIN',
      usePasswordToggle: 'Gamit ang Password',
      loginSubmitBtn: 'Buksan ang Tindahan',
      registerSubmitBtn: 'Simulan ang Aking Tindahan',
      storeNameLabel: 'Pangalan ng Tindahan',
      storeNamePlaceholder: 'Hal. Tindahan ni Aling Maria',
      ownerNameLabel: 'Pangalan ng May-ari',
      ownerNamePlaceholder: 'Hal. Maria Santos',
      phoneLabel: 'Mobile Number (GCash)',
      phonePlaceholder: '09171234567',
      offerGcashLabel: 'Nag-aalok ng GCash Cash-In / Cash-Out services',
      starterProductsLabel: 'I-load ang 10 karaniwang paninda (starter products)',
      starterProductsDesc: 'Maglagay ng 10 panimulang FMCG catalog (Pancit Canton, Kopiko, de-lata, shampoo sachet, atbp.) na handa sa POS.',
      demoStorePrompt: 'Nais mo bang subukan muna nang walang account?',
      exploreDemoBtn: 'Subukan gamit ang Demo Data',
      loggedInStatus: 'Kasalukuyang naka-log in bilang',
      openPosBtn: 'Pumunta sa Kaha (POS)',
      openDashboardBtn: 'Buksan ang Dashboard',
      switchStoreBtn: 'Magpalit ng Account',
      featuresTitle: 'Kumpletong Negosyo Suite sa Iyong Bulsa',
      featuresSubtitle: 'Lahat ng kailangan ng modernong sari-sari store upang kumita at maging organisado.',
      feat1Title: '100% Offline POS & Kaha',
      feat1Desc: 'Mabilisang pag-scan ng barcode at pagkalkula ng sukli gamit ang integer centavo math nang walang rounding error.',
      feat2Title: 'Talaan ng Utang (Digital Credit)',
      feat2Desc: 'Wakas sa napupunit na kuwaderno. Subaybayan ang pautang at bayad ng mga suki nang may malinaw na resibo.',
      feat3Title: 'GCash Cash-In & Cash-Out Hub',
      feat3Desc: 'Awtomatikong pagkwenta ng convenience fees bawat bracket at pag-audit ng digital laban sa pisikal na kaha.',
      feat4Title: 'Imbentaryo at Tubo Analytics',
      feat4Desc: 'Subaybayan ang cost price vs. SRP, makatanggap ng babala sa paubos na paninda, at alamin ang tunay na gross margin.',
      feat5Title: 'Bluetooth Thermal Resibo',
      feat5Desc: 'Direktang mag-print ng resibo sa 58mm at 80mm Bluetooth ESC/POS printers para sa propesyonal na serbisyo sa suki.',
      feat6Title: 'PWA at Cloud Synchronization',
      feat6Desc: 'I-install sa Android o computer. Naka-save nang ligtas sa IndexedDB at kusa nagba-backup sa cloud pag may internet.',
      calcTitle: 'Kalkulahin ang Tubo at Matitipid',
      calcSubtitle: 'Alamin kung magkano ang maiuuwing kita at oras na matitipid ng iyong tindahan bawat buwan.',
      calcDailySales: 'Tinatayang Araw-araw na Benta',
      calcGcashTxns: 'Buwanang GCash Transaksyon',
      calcMargin: 'Average Tubo (Retail Margin %)',
      calcMonthlyProfit: 'Tinatayang Buwanang Tubo sa Paninda',
      calcGcashProfit: 'Karagdagang Kita sa GCash Fees',
      calcUtangRecovered: 'Nailigtas na Pautang (Loss Prevention)',
      calcHoursSaved: 'Oras na Natipid sa Paglilista',
      compareTitle: 'Lumang Kuwaderno vs. Fluent Tindahan',
      compareSubtitle: 'Bakit lumilipat ang mga modernong tindera sa digital na sistema.',
      compareOldTitle: 'Lumang Kuwaderno / Mano-mano',
      compareOldItem1: 'Nababasa, napupunit, at nawawala ang listahan ng pautang',
      compareOldItem2: 'Mano-manong kalkulasyon na may centavo rounding errors',
      compareOldItem3: 'Nalilito sa computation ng GCash fee at short sa kaha',
      compareOldItem4: 'Walang backup kapag nawala ang notebook o nasira ang talaan',
      compareNewTitle: 'Fluent Tindahan PWA',
      compareNewItem1: 'Ligtas na digital utang ledger na may buong kasaysayan ng bayad',
      compareNewItem2: 'Mabilis na barcode scanning at tamang-tamang sukli agad',
      compareNewItem3: 'Awtomatikong GCash fee matrix at hiwalay na cash tracking',
      compareNewItem4: '100% offline-first sa telepono na may cloud backup pag online',
      pricingTitle: 'Abot-Kayang Plano Para sa Bawat Negosyo',
      pricingSubtitle: 'Magsimula nang libre habang buhay. Mag-upgrade lang kapag lumalaki na ang iyong tindahan.',
      planFreeTitle: 'Libre',
      planFreePrice: '₱0 / habang buhay',
      planFreeDesc: 'Perpekto para sa bagong bukas o maliit na sari-sari store. Hanggang 30 produkto at 30 suki debtors.',
      planProTitle: 'Tindahan Pro',
      planProPrice: '₱149 / buwan (o ₱49 / linggo)',
      planProDesc: 'Para sa lumalaking tindahan. Walang limitasyong produkto at utang, CSV import, at detalyadong profit analytics.',
      planPlusTitle: 'Negosyo Plus',
      planPlusPrice: '₱349 / buwan',
      planPlusDesc: 'Para sa malalaking tindahan at mini-marts. Multi-device sync, 5 staff cashier PINs, at audit logs.',
      startNowBtn: 'Simulan Ngayon',
      testimonialsTitle: 'Pinagkakatiwalaan ng mga Tindera sa Buong Bansa',
      testimonialsSubtitle: 'Basahin ang kwento ng tagumpay mula sa kapwa mo sari-sari store owners.',
      faqTitle: 'Mga Madalas Itanong (FAQ)',
      faqSubtitle: 'Lahat ng nais mong malaman tungkol sa Fluent Tindahan.',
      faq1Q: 'Kailangan ba ng internet para magamit ang app?',
      faq1A: 'Hindi! Ang Fluent Tindahan ay 100% offline-first. Lahat ng benta, imbentaryo, at utang ay naka-save sa iyong phone at gagana kahit walang Wi-Fi o cellular load.',
      faq2Q: 'Paano kung mawalan ako ng baterya o masira ang aking phone?',
      faq2A: 'Kapag may internet ang phone mo, awtomatikong naka-sync ang iyong records sa cloud. Mag-login lang gamit ang iyong email sa bagong device para maibalik ang lahat ng datos.',
      faq3Q: 'Gagana ba ito sa ordinaryong Android smartphone?',
      faq3A: 'Oo! Binuo ang app gamit ang ultra-lightweight Progressive Web App (PWA) technology na gumagana nang mabilis kahit sa mga budget Android phone.',
      faq4Q: 'Puwede ba akong mag-print ng resibo para sa aking suki?',
      faq4A: 'Oo, suportado ang mga karaniwang 58mm at 80mm Bluetooth wireless thermal receipt printers na mabibili online (Shopee/Lazada).',
      ctaTitle: 'Gawing Moderno at Mas Kumikita ang Iyong Tindahan Ngayon!',
      ctaDesc: 'Sumali sa libu-libong Pinoy store owners na nag-level up sa kanilang negosyo. Libre magsimula at walang credit card na kailangan.',
      ctaBtn: 'Subukan ang Fluent Tindahan Ngayon',
      exploreNavBtn: 'Tuklasin',
      exploreTooltip: 'Tuklasin (Landing Page)',
      exploreTitle: 'Tuklasin ang Fluent Tindahan'
    },
    login: {
      pageTitle: 'Pumasok sa Iyong Tindahan',
      pageSubtitle: 'Ilagay ang iyong email at password o Quick PIN upang buksan ang kaha.',
      signUpPageTitle: 'Magrehistro ng Iyong Tindahan',
      signUpPageSubtitle: 'Ilagay ang impormasyon ng iyong tindahan upang makapagsimula nang libre.',
      badgeText: '🇵🇭 Kaha ng Sari-Sari Store • 100% Offline-First',
      backToLanding: 'Tingnan ang Lahat ng Features at Presyo (Landing Page)',
      demoNote: 'Subukan ang kaha nang walang account gamit ang Pinoy sari-sari items',
      noAccountText: 'Wala ka pang rehistradong tindahan?',
      hasAccountText: 'May account ka na ba?',
      switchModePassword: 'Mag-login gamit ang Password',
      switchModePin: 'Mag-login gamit ang 4-digit PIN'
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
      settings: 'Settings',
      menuTitle: 'Store Menu',
      expandMenu: 'Open menu',
      collapseMenu: 'Close menu'
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
      debtorNameRequired: 'Please enter customer name.',
      insufficientStock: 'Insufficient Stock',
      stockLimitReached: 'Stock limit reached',
      saleBlockedStock: 'Sale blocked due to insufficient stock.',
      stockOverrideBtn: 'Override Stock',
      stockOverrideDialogTitle: 'Confirm Stock Override',
      stockOverrideDialogDesc: 'Recorded system stock is insufficient for some items in the cart. In offline neighborhood stores, restocks may not be entered yet or another device has not synced. Do you want to proceed with this sale?',
      stockOverrideConfirmBtn: 'Override & Proceed to Checkout',
      stockWarnNotice: 'Notice: Some items have insufficient system stock (Allowed under Warn Only policy).',
      stockBlockedNotice: 'Insufficient system stock. Click "Override Stock" to allow this sale.',
      stockWarnBanner: 'Notice: Recorded stock is insufficient (Warn only).',
      stockOverriddenBanner: 'Stock check overridden for this sale.'
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
      amountMustBePositive: 'Transaction amount must be greater than ₱0.',
      amountExceedsMax: 'Transaction amount cannot exceed ₱100,000.00 (GCash wallet/agent limit).',
      feeExceedsAmount: 'Service fee cannot exceed transaction amount.',
      feeCannotBeNegative: 'Service fee cannot be negative.',
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
      ...sharedProductFormTranslations.en,
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
      barcodeLabel: 'Barcode (Optional):',
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
      ...sharedProductFormTranslations.en,
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
      dlqDismissBtn: 'Dismiss',
      dlqEditBtn: 'Edit / Fix',
      dlqEditDialogTitle: 'Fix Product (Dead Letter Queue)',
      dlqEditDialogDesc: 'This product failed to sync due to invalid values or data. Please review, correct the details, and confirm before retrying sync.',
      dlqSaveAndRetryBtn: 'Save & Retry',
      dlqRequiresCorrectionAlert: 'Product values are out of bounds. Please correct the price or cost before retrying.',
      dlqRetrySuccess: 'Product corrected and re-queued for sync!',
      dlqDismissConfirmTitle: 'Confirm Dismiss Unsynced Data',
      dlqDismissConfirmDesc: 'This will permanently remove this item from the active queue and it will not be synced to the cloud database:',
      dlqDismissConfirmWarning: 'WARNING: This unsynced record will be permanently dismissed from the active queue and will not be pushed to the server.',
      dlqDismissConfirmBtn: 'Permanently Dismiss',
      dlqClearConfirmTitle: 'Clear All Items in Dead Letter Queue?',
      dlqClearConfirmDesc: 'All failed sync items in the queue will be permanently removed and will not be pushed to the cloud database. Are you sure?',
      dlqClearConfirmBtn: 'Clear All Items',
      stockPolicySection: 'POS Stock Validation Policy',
      stockPolicyDesc: 'Choose whether sales are blocked when system stock is 0 or insufficient.',
      stockPolicyWarn: 'Warn Only (Recommended for Offline)',
      stockPolicyWarnDesc: 'Warn when stock is low or zero but allow sales if physical items exist.',
      stockPolicyBlock: 'Strict Block',
      stockPolicyBlockDesc: 'Block checkout when stock is 0 or insufficient unless overridden by store owner.',
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
      gcashFixedFee: 'Fixed Fee',
      emailLabel: 'Email Address:',
      pinStatusLabel: 'Quick POS PIN:',
      pinActive: 'Active (Set)',
      pinInactive: 'Not Set',
      setPinBtn: 'Set PIN',
      changePinBtn: 'Change PIN',
      clearPinBtn: 'Clear PIN',
      lockSessionBtn: 'Lock Till Screen',
      switchAccountBtn: 'Switch Account',
      logoutBtn: 'Log Out',
      logoutConfirmTitle: 'Are you sure you want to log out?',
      logoutConfirmDesc: 'Local data on this device will be cleared before switching accounts. Make sure all sales are synced.',
      logoutUnsyncedWarning: 'You have {count} unsynced transactions! Logging out now may cause data loss.',
      forceLogoutBtn: 'Force Log Out',
      syncFirstBtn: 'Sync First',
      pinDialogTitle: 'Quick POS PIN Settings',
      pinDialogDesc: 'Update or set your 4-6 digit PIN using your password.',
      currentPasswordLabel: 'Current Password',
      newPinLabel: 'New PIN (4-6 digits, leave blank to remove)',
      pinUpdatedSuccess: 'PIN updated successfully.',
      sessionLockedTitle: 'Till Screen Locked',
      sessionLockedDesc: 'Enter your PIN or Password to unlock your store.',
      unlockBtn: 'Unlock Till',
      invalidPinOrPassword: 'Invalid PIN or Password.',
      pinLockedError: 'Too many failed attempts. PIN locked for {minutes} minutes. Please use your password.'
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
      viewTermsLink: 'View Full Terms of Use & Acceptable Usage Policy (AUP)',
      termsCheckboxPrefix: 'I have read and agree to the ',
      termsCheckboxLinkText: 'Terms of Use & Acceptable Usage Policy (AUP)',
      termsCheckboxSuffix: ' and Data Privacy Policy.',
      acceptedVersionNotice: 'Accepted Terms Version:'
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
      closeBtn: 'Understood & Close',
      legalCardTitle: 'Legal, Compliance & Disclaimers',
      legalCardDesc: 'Review regulatory compliance information regarding BIR tax obligations, Philippine Data Privacy Act (RA 10173), and software operation boundaries.',
      viewPrivacyBtn: 'View Privacy Notice (RA 10173)',
      viewFullTermsBtn: 'Terms of Use & AUP',
      openFullTerms: 'Read Full Terms of Use & Acceptable Usage Policy (AUP)'
    },
    terms: {
      philippinesBadge: 'Philippines',
      langToggleTitle: 'Lumipat sa Tagalog'
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
      catalogStandardTitle: 'Pre-load 10 Standard Products',
      catalogStandardDesc: '10 starter products ready to use in POS, including instant noodles, coffee mixes, canned goods, sachets, etc.',
      catalogEmptyTitle: 'Start with Blank Store',
      catalogEmptyDesc: 'No pre-loaded items; enter your products manually or import via CSV.',
      gcashToggleTitle: 'Offers GCash Cash-In / Cash-Out',
      gcashToggleDesc: 'Pre-configures default transaction fee brackets for GCash remittance.',
      launchBtn: 'Launch My Store',
      saveProfileBtn: 'Save Profile',
      cancelBtn: 'Cancel',
      emailLabel: 'Email Address',
      emailPlaceholder: 'e.g. nena.store@gmail.com',
      emailRequired: 'Valid email address is required.',
      emailInvalid: 'Invalid email address format.',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Minimum 6 characters',
      passwordRequired: 'Password is required (minimum 6 characters).',
      passwordMinLength: 'Password must be at least 6 characters.',
      passwordStrengthError: 'Password must be at least 8 characters and contain both letters and numbers.',
      confirmPasswordRequired: 'Please confirm your password.',
      passwordMismatch: 'Passwords do not match.',
      pinLabel: 'Quick POS PIN (Optional)',
      pinPlaceholder: '4 to 6 digits',
      pinHint: 'Used for quick till unlock without repeatedly typing your full password.',
      pinInvalid: 'PIN must be between 4 and 6 numeric digits.',
      registerTab: 'New Store (Register)',
      loginTab: 'Log In',
      loginSubtitle: 'Enter your email and password or PIN to access your store.',
      loginModePassword: 'Use Password',
      loginModePin: 'Use Quick PIN',
      loginBtn: 'Log In to Store',
      loginSuccess: 'Welcome back! Store opened successfully.',
      loginFailed: 'Invalid email, password, or PIN.',
      emailAlreadyExists: 'A store is already registered with this email. Please select Log In.',
      offlineRegisterNotice: 'Offline mode: Store saved locally. Cloud registration will sync when online.',
      hydratingCatalog: 'Hydrating store data from cloud...',
      switchAccountPrompt: 'Already have a registered store? Log in here.',
      registerPrompt: 'Don\'t have a store yet? Register here.',
      loginUnsyncedTitle: 'Unsynced Data Detected',
      loginUnsyncedWarning: 'You have {count} unsynced transactions from the current store! Logging into another account will wipe this local data.',
      loginUnsyncedNotice: 'Notice: You have {count} unsynced transactions on this device.',
      forceLoginBtn: 'Wipe & Log In Anyway',
      currentPasswordLabel: 'Current Password',
      currentPasswordPlaceholder: 'Enter current password',
      currentPasswordRequired: 'Current password or PIN is required to change email address.',
      currentPasswordHint: 'Required to authorize changing the store email address.',
      ownerOnlyBusinessName: 'Only the store owner can change the store name.',
      savedLocallyNotice: 'Saved locally. Will sync to server when connection is restored.',
      pendingProfileSync: 'Pending profile update will sync to server when connected.'
    },
    landing: {
      heroBadge: '🇵🇭 Built for Philippine Retail • 100% Offline-Ready',
      heroTitle: 'The Modern Sari-Sari Store POS & Retail Hub — Works Even Without Internet!',
      heroSubtitle: 'Scan and ring up sales in 1 second, eliminate lost utang credit in notebooks, and auto-calculate GCash fees. Zero network blocks, ultra-fast and reliable.',
      tryDemoBtn: 'Try Live Demo',
      viewPricingBtn: 'View Pricing & Plans',
      loginCardTitle: 'Access Your Store',
      loginCardDesc: 'Sign in or register to launch your digital store till.',
      tabLogin: 'Log In',
      tabRegister: 'New Store',
      emailLabel: 'Email Address',
      emailPlaceholder: 'e.g. nena.store@gmail.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Minimum 6 characters',
      confirmPasswordLabel: 'Confirm Password',
      confirmPasswordPlaceholder: 'Re-enter password',
      passwordStrengthHint: 'Minimum 8 characters with letters & numbers',
      passwordStrengthWeak: 'Weak',
      passwordStrengthMedium: 'Medium',
      passwordStrengthStrong: 'Strong',
      pinLabel: 'Quick POS PIN',
      pinPlaceholder: '4 to 6 digits',
      usePinToggle: 'Use Quick PIN',
      usePasswordToggle: 'Use Password',
      loginSubmitBtn: 'Open My Store',
      registerSubmitBtn: 'Launch My Store',
      storeNameLabel: 'Store Name',
      storeNamePlaceholder: 'e.g. Maria\'s Sari-Sari Store',
      ownerNameLabel: 'Owner Name',
      ownerNamePlaceholder: 'e.g. Maria Santos',
      phoneLabel: 'Mobile Number (GCash)',
      phonePlaceholder: '09171234567',
      offerGcashLabel: 'Offers GCash Cash-In / Cash-Out services',
      starterProductsLabel: 'Pre-load 10 popular starter products',
      starterProductsDesc: 'Seed 10 initial catalog items (Pancit Canton, Kopiko, canned goods, shampoo sachets, etc.) ready for POS.',
      demoStorePrompt: 'Want to test drive first without an account?',
      exploreDemoBtn: 'Explore with Sample Demo Data',
      loggedInStatus: 'Currently logged in as',
      openPosBtn: 'Open POS Till',
      openDashboardBtn: 'Open Dashboard',
      switchStoreBtn: 'Switch Account',
      featuresTitle: 'Complete Retail Suite in Your Pocket',
      featuresSubtitle: 'Everything a modern neighborhood retailer needs to stay organized and maximize profit.',
      feat1Title: '100% Offline POS & Till',
      feat1Desc: 'Rapid camera barcode scanning and exact change computation using integer centavo math with zero rounding drift.',
      feat2Title: 'Digital Utang Credit Ledger',
      feat2Desc: 'Never lose track of customer credit from torn notebook pages. Track credit, payments, and print customer receipts.',
      feat3Title: 'GCash Cash-In & Cash-Out Hub',
      feat3Desc: 'Automatic fee bracket calculation, reference number logging, and digital vs. physical cash drawer auditing.',
      feat4Title: 'Inventory & Margin Analytics',
      feat4Desc: 'Track cost vs SRP prices, receive low-stock restocking alerts, and measure your store\'s true gross profit margins.',
      feat5Title: 'Bluetooth Thermal Receipts',
      feat5Desc: 'Print clean customer receipts directly to 58mm and 80mm Bluetooth ESC/POS printers for professional service.',
      feat6Title: 'PWA & Cloud Synchronization',
      feat6Desc: 'Install directly to Android or desktop. Stores data safely in IndexedDB and automatically backs up when online.',
      calcTitle: 'Calculate Your Store Profits & Savings',
      calcSubtitle: 'See how much monthly take-home profit and hours your tindahan can gain with digital tracking.',
      calcDailySales: 'Estimated Daily Sales',
      calcGcashTxns: 'Monthly GCash Transactions',
      calcMargin: 'Average Retail Margin %',
      calcMonthlyProfit: 'Estimated Monthly Retail Profit',
      calcGcashProfit: 'Additional GCash Convenience Fees',
      calcUtangRecovered: 'Uncollected Debt Recovered',
      calcHoursSaved: 'Hours Saved per Month',
      compareTitle: 'Paper Notebook vs. Fluent Tindahan',
      compareSubtitle: 'Why modern neighborhood stores are upgrading to digital till management.',
      compareOldTitle: 'Paper Notebook / Manual',
      compareOldItem1: 'Water-damaged, torn, or misplaced utang credit pages',
      compareOldItem2: 'Manual calculator errors causing centavo rounding discrepancies',
      compareOldItem3: 'Confusion over GCash fee deductions resulting in drawer shortages',
      compareOldItem4: 'Zero recovery backup if the physical notebook is lost',
      compareNewTitle: 'Fluent Tindahan PWA',
      compareNewItem1: 'Secure digital ledger with permanent payment audit trails',
      compareNewItem2: 'Fast camera barcode scanning with guaranteed change accuracy',
      compareNewItem3: 'Automated GCash fee tiers with separate cash drawer tracking',
      compareNewItem4: '100% offline-first on phone with automatic cloud backup',
      pricingTitle: 'Affordable Plans for Every Store Size',
      pricingSubtitle: 'Start free forever. Upgrade only when your store outgrows entry limits.',
      planFreeTitle: 'Libre (Free)',
      planFreePrice: '₱0 / forever',
      planFreeDesc: 'Perfect for new or small neighborhood sari-sari stores. Up to 30 products and 30 debtor profiles.',
      planProTitle: 'Tindahan Pro',
      planProPrice: '₱149 / month (or ₱49 / week)',
      planProDesc: 'For growing retailers. Unlimited products & utang, bulk CSV import, and in-depth profit analytics.',
      planPlusTitle: 'Negosyo Plus',
      planPlusPrice: '₱349 / month',
      planPlusDesc: 'For large high-volume stores and mini-marts. Multi-device sync, 5 staff cashier PINs, and audit logs.',
      startNowBtn: 'Get Started',
      testimonialsTitle: 'Trusted by Store Owners Across the Philippines',
      testimonialsSubtitle: 'Read real stories from fellow sari-sari store entrepreneurs.',
      faqTitle: 'Frequently Asked Questions (FAQ)',
      faqSubtitle: 'Everything you need to know about Fluent Tindahan.',
      faq1Q: 'Do I need an active internet connection to use the app?',
      faq1A: 'No! Fluent Tindahan is 100% offline-first. All sales, inventory, and utang records save locally in your device and work without Wi-Fi or mobile data.',
      faq2Q: 'What happens if my phone battery dies or the device is damaged?',
      faq2A: 'Whenever your device connects to the internet, your records automatically back up to our cloud backend. Simply log in with your email on another device to restore everything.',
      faq3Q: 'Does it run on ordinary Android smartphones?',
      faq3A: 'Yes! The app is built with lightweight Progressive Web App (PWA) technology optimized to run smoothly even on entry-level Android phones.',
      faq4Q: 'Can I print receipts for my customers?',
      faq4A: 'Yes, standard 58mm and 80mm wireless Bluetooth thermal printers commonly available on Shopee and Lazada are fully supported.',
      ctaTitle: 'Transform Your Sari-Sari Store into a Modern Negosyo Today!',
      ctaDesc: 'Join thousands of Filipino store owners who have streamlined their counter. Free to start with no credit card required.',
      ctaBtn: 'Try Fluent Tindahan Now',
      exploreNavBtn: 'Explore',
      exploreTooltip: 'Explore (Landing Page)',
      exploreTitle: 'Explore Fluent Tindahan'
    },
    login: {
      pageTitle: 'Sign In to Your Store',
      pageSubtitle: 'Enter your email and password or Quick PIN to unlock your POS counter.',
      signUpPageTitle: 'Sign Up for Your Store',
      signUpPageSubtitle: 'Enter your store details to create an account and unlock your POS counter.',
      badgeText: '🇵🇭 Sari-Sari Store POS • 100% Offline-First',
      backToLanding: 'Explore All Features and Pricing (Landing Page)',
      demoNote: 'Test-drive the register without an account using Pinoy sari-sari items',
      noAccountText: "Don't have a registered store yet?",
      hasAccountText: 'Already have an account?',
      switchModePassword: 'Log in with Password',
      switchModePin: 'Log in with 4-digit PIN'
    }
  }
};
