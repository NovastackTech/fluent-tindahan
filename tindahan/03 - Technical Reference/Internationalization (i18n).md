---
title: Internationalization (i18n) & Localization
tags: [frontend, i18n, localization, tagalog, filipino, currency]
updated: 2026-10-10
---

# 🇵🇭 Internationalization (i18n) & Localization

Fluent Tindahan supports full dual-language operation: **English** and **Filipino / Tagalog**.

Because many neighborhood store cashiers and owners are more comfortable with authentic colloquial store terms, translations prioritize natural sari-sari store terminology rather than dry or literal translations.

---

## 1. Colloquial Retail Vocabulary

| English Term | Filipino / Tagalog Translation | Context in Store |
| :--- | :--- | :--- |
| **Point of Sale** | **Benta / POS** | Main sales screen |
| **Cash Received** | **Halagang Binayad** | Cash given by customer |
| **Change** | **Sukli** | Money returned to customer |
| **Credit / Debt** | **Utang** | Customer credit line |
| **Repayment / Pay**| **Bayad** | Settlement of debt |
| **List on Credit** | **Palista** | Charging to utang ledger |
| **Customer / Loyal**| **Suki** | Regular neighborhood buyer |
| **Inventory / Goods**| **Paninda** | Store merchandise |
| **Repackaged / Unit**| **Tingi** | Micro-portioned items |
| **Low Stock** | **Kulang sa Stock** | Below reorder threshold |
| **Out of Stock** | **Ubos na** | Zero quantity on hand |
| **Receipt** | **Resibo** | Printed thermal slip |

---

## 2. Currency & Number Formatting

- **Currency Symbol**: Philippine Peso sign `₱` (Unicode `U+20B1`).
- **Formatting Standard**: `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`.
- **Display Example**: `₱1,250.50` (comma thousands separator, two-decimal centavos).

---

## 3. Implementation (`src/i18n/translations.ts`)

The translation dictionary is loaded synchronously without external network requests:
```typescript
export const translations = {
  en: {
    pos: {
      title: 'Point of Sale',
      searchPlaceholder: 'Search product or scan barcode...',
      addToCart: 'Add to Cart',
      total: 'Total',
      checkout: 'Checkout',
      cash: 'Cash',
      change: 'Change'
    },
    // ...
  },
  fil: {
    pos: {
      title: 'Benta (POS)',
      searchPlaceholder: 'Maghanap ng paninda o mag-scan ng barcode...',
      addToCart: 'Ilagay sa Cart',
      total: 'Kabuuan',
      checkout: 'Magbayad',
      cash: 'Pera',
      change: 'Sukli'
    },
    // ...
  }
};
```

---

## Related Notes
- [[Frontend Architecture & State]] — `languageStore.ts` integration.
- [[Philippine Retail Culture]] — Cultural importance of colloquial terms like *Suki* and *Tingi*.
