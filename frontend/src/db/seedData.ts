import { db, type ProductRecord, type CustomerRecord, type UtangLedgerRecord, type GCashTxnRecord } from './db';

export const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const DEFAULT_USER_ID = '22222222-2222-2222-2222-222222222222';

export async function seedDexieDatabaseIfNeeded(force = false) {
  const productCount = await db.products.count();
  if (!force && productCount >= 50) return;

  const now = new Date().toISOString();

  const products: ProductRecord[] = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Pancit Canton Kalamansi 80g',
      price: 16,
      cost: 13.25,
      barcode: '4800016644026',
      category: 'Instant Noodles',
      stockQty: 36,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Pancit Canton Chili Mansi 80g',
      price: 16,
      cost: 13.25,
      barcode: '4800016644040',
      category: 'Instant Noodles',
      stockQty: 36,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000004',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Pancit Canton Original 80g',
      price: 16,
      cost: 13.25,
      barcode: '4800016644019',
      category: 'Instant Noodles',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000006',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Mami Chicken 55g',
      price: 13,
      cost: 10.5,
      barcode: '4800016601012',
      category: 'Instant Noodles',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000013',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Kopiko Blanca 3-in-1 Coffee 52g',
      price: 15,
      cost: 12.2,
      barcode: '8996001414002',
      category: 'Coffee & Beverages',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000015',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Kopiko Brown 3-in-1 Coffee 53g',
      price: 15,
      cost: 12.2,
      barcode: '8996001410264',
      category: 'Coffee & Beverages',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000017',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nescafe Classic Pure Soluble Coffee 1.9g',
      price: 4.5,
      cost: 3.25,
      barcode: '4800361287661',
      category: 'Coffee & Beverages',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000018',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nescafe 3-in-1 Original Coffee 56g',
      price: 15,
      cost: 12.5,
      barcode: '4800361384025',
      category: 'Coffee & Beverages',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000021',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Milo Activ-Go Chocolate Powder Drink 24g',
      price: 12,
      cost: 9.25,
      barcode: '4800361341103',
      category: 'Coffee & Beverages',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000022',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Bear Brand Fortified Powdered Milk Drink 33g',
      price: 14,
      cost: 11.5,
      barcode: '4800361376846',
      category: 'Milk & Dairy',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000027',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Tang Powdered Juice Orange 20g',
      price: 21,
      cost: 17.5,
      barcode: '4800024101108',
      category: 'Juices & Beverages',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000032',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Coca-Cola Regular Mismo 290ml',
      price: 20,
      cost: 16,
      barcode: '4801981100103',
      category: 'Beverages',
      stockQty: 36,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000034',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Royal Tru-Orange Mismo 290ml',
      price: 20,
      cost: 16,
      barcode: '4801981100301',
      category: 'Beverages',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000035',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Mega Sardines in Tomato Sauce Green 155g',
      price: 26,
      cost: 22.5,
      barcode: '4809011743015',
      category: 'Canned Goods',
      stockQty: 36,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000037',
      tenantId: DEFAULT_TENANT_ID,
      name: '555 Sardines in Tomato Sauce 155g',
      price: 25,
      cost: 21,
      barcode: '4800216111018',
      category: 'Canned Goods',
      stockQty: 36,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000041',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Century Tuna Flakes in Oil 155g',
      price: 40,
      cost: 34,
      barcode: '4800216212012',
      category: 'Canned Goods',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000045',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Argentina Corned Beef 150g',
      price: 43,
      cost: 37,
      barcode: '4800216211015',
      category: 'Canned Goods',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000047',
      tenantId: DEFAULT_TENANT_ID,
      name: 'CDO Karne Norte 150g',
      price: 31,
      cost: 26,
      barcode: '4800168111019',
      category: 'Canned Goods',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000049',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Silver Swan Soy Sauce 100ml',
      price: 7,
      cost: 5.5,
      barcode: '4800194110300',
      category: 'Condiments',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000050',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Silver Swan Cane Vinegar 100ml',
      price: 6.5,
      cost: 5,
      barcode: '4800194120309',
      category: 'Condiments',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000051',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Datu Puti Soy Sauce 100ml',
      price: 7,
      cost: 5.75,
      barcode: '4801981110034',
      category: 'Condiments',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000056',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Maggi Magic Sarap All-in-One Seasoning 8g',
      price: 6,
      cost: 4.25,
      barcode: '4800361361019',
      category: 'Seasonings',
      stockQty: 80,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000057',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Knorr Pork Broth Cube 10g',
      price: 8,
      cost: 6,
      barcode: '4800888151014',
      category: 'Seasonings',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000059',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Knorr Sinigang sa Sampalok Mix Original 20g',
      price: 18,
      cost: 14.5,
      barcode: '4800888152011',
      category: 'Seasonings',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000064',
      tenantId: DEFAULT_TENANT_ID,
      name: 'SkyFlakes Crackers Plain 25g',
      price: 8.5,
      cost: 6.5,
      barcode: '4800016010012',
      category: 'Biscuits & Bakery',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000065',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Fita Biscuits Plain 30g',
      price: 8.5,
      cost: 6.5,
      barcode: '4800016011019',
      category: 'Biscuits & Bakery',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000068',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Fudgee Barr Chocolate Cake Bar 38g',
      price: 11,
      cost: 8.5,
      barcode: '4800111022013',
      category: 'Biscuits & Bakery',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000075',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Piattos Cheese Potato Crisps 85g',
      price: 38,
      cost: 32,
      barcode: '4800016053330',
      category: 'Snacks & Chips',
      stockQty: 18,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000078',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Chippy Barbecue Corn Chips 110g',
      price: 33,
      cost: 27,
      barcode: '4800016051107',
      category: 'Snacks & Chips',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000087',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Maxx Menthol Candy Cherry 1 pc',
      price: 2,
      cost: 1.2,
      barcode: '4800016071013',
      category: 'Candies & Sweets',
      stockQty: 100,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000092',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Dynamite Choco Filled Mint Candy 1 pc',
      price: 2,
      cost: 1.2,
      barcode: '4800016072010',
      category: 'Candies & Sweets',
      stockQty: 100,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000095',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Sunsilk Shampoo Smooth & Manageable Pink 13ml',
      price: 8,
      cost: 6.25,
      barcode: '4800888138763',
      category: 'Personal Care',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000097',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Cream Silk Conditioner Standout Straight Pink 11ml',
      price: 8.5,
      cost: 6.5,
      barcode: '4800888139012',
      category: 'Personal Care',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000099',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Head & Shoulders Cool Menthol Anti-Dandruff 12ml',
      price: 9,
      cost: 7,
      barcode: '4902430588669',
      category: 'Personal Care',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000101',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Safeguard Pure White Bar Soap 60g',
      price: 26,
      cost: 22,
      barcode: '4902430401821',
      category: 'Personal Care',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000104',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Colgate Maximum Cavity Protection Great Regular Flavor 20g',
      price: 11,
      cost: 8.5,
      barcode: '4800045130019',
      category: 'Personal Care',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000109',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Surf Powder Blossom Fresh Detergent 60g',
      price: 9.5,
      cost: 7.5,
      barcode: '4800888147055',
      category: 'Laundry Care',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000111',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ariel Sunrise Fresh Detergent Powder 66g',
      price: 15,
      cost: 12,
      barcode: '4902430721011',
      category: 'Laundry Care',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000114',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Downy Fabric Conditioner Sunrise Fresh 25ml',
      price: 9,
      cost: 7.25,
      barcode: '4902430737081',
      category: 'Laundry Care',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000118',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Joy Dishwashing Liquid Kalamansi 20ml',
      price: 6.5,
      cost: 5,
      barcode: '4902430741026',
      category: 'Household Care',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000120',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Zonrox Bleach Original 250ml',
      price: 26,
      cost: 21.5,
      barcode: '4800194170014',
      category: 'Household Care',
      stockQty: 15,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000121',
      tenantId: DEFAULT_TENANT_ID,
      name: 'San Miguel Pale Pilsen Beer 320ml',
      price: 55,
      cost: 48,
      barcode: '4800088100018',
      category: 'Alcohol & Beverages',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000122',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Red Horse Beer Extra Strong 500ml',
      price: 68,
      cost: 58,
      barcode: '4800088100117',
      category: 'Alcohol & Beverages',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000124',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ginebra San Miguel Bilog 350ml',
      price: 65,
      cost: 55,
      barcode: '4800088200015',
      category: 'Alcohol & Beverages',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000137',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Marlboro Red Single Stick (Tingi) 1 stick',
      price: 10,
      cost: 8.5,
      barcode: '2000000000091',
      category: 'Tobacco',
      stockQty: 100,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000129',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Fresh Chicken Egg Medium (Tingi) 1 pc',
      price: 9,
      cost: 7,
      barcode: '2000000000015',
      category: 'Fresh Produce & Tingi',
      stockQty: 60,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000130',
      tenantId: DEFAULT_TENANT_ID,
      name: 'White Refined Sugar Repacked (Tingi) 1/4 kg',
      price: 23,
      cost: 18,
      barcode: '2000000000022',
      category: 'Staples & Tingi',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000132',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Cooking Oil Palm Repacked Supot (Tingi) 250ml',
      price: 25,
      cost: 19,
      barcode: '2000000000046',
      category: 'Staples & Tingi',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000135',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Tubig na Yelo / Mineral Ice Bag (Tingi) 1 bag',
      price: 3,
      cost: 1.5,
      barcode: '2000000000077',
      category: 'Staples & Tingi',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000136',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Dinorado / Sinandomeng Rice 1kg (Tingi) 1 kg',
      price: 56,
      cost: 48,
      barcode: '2000000000084',
      category: 'Staples & Tingi',
      stockQty: 50,
      updatedAt: now
    },
  ];

  const customer1Id = '33333333-3333-3333-3333-333333333331';
  const customer2Id = '33333333-3333-3333-3333-333333333332';
  const customer3Id = '33333333-3333-3333-3333-333333333333';

  const customers: CustomerRecord[] = [
    {
      id: customer1Id,
      tenantId: DEFAULT_TENANT_ID,
      name: 'Mang Juan Cruz',
      phone: '09181112233',
      totalUtangBalance: 240.00,
      updatedAt: now
    },
    {
      id: customer2Id,
      tenantId: DEFAULT_TENANT_ID,
      name: 'Aling Rosa Santos',
      phone: '09204445566',
      totalUtangBalance: 150.00,
      updatedAt: now
    },
    {
      id: customer3Id,
      tenantId: DEFAULT_TENANT_ID,
      name: 'Kagawad Benjie',
      phone: '09178889900',
      totalUtangBalance: 0.00,
      updatedAt: now
    }
  ];

  const utangLedger: UtangLedgerRecord[] = [
    {
      id: 'u1000000-0000-0000-0000-000000000001',
      tenantId: DEFAULT_TENANT_ID,
      customerId: customer1Id,
      amount: 240.00,
      type: 'Credit',
      date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      notes: '2x Pancit Canton, 1x Coke 1.5L, 2x Kopiko'
    },
    {
      id: 'u1000000-0000-0000-0000-000000000002',
      tenantId: DEFAULT_TENANT_ID,
      customerId: customer2Id,
      amount: 150.00,
      type: 'Credit',
      date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      notes: 'Marlboro pack & Skyflakes'
    }
  ];

  const gcashTxns: GCashTxnRecord[] = [
    {
      id: 'g1000000-0000-0000-0000-000000000001',
      tenantId: DEFAULT_TENANT_ID,
      type: 'CashIn',
      amount: 1000.00,
      fee: 15.00,
      refNo: '901238471201',
      customerPhone: '09175551234',
      date: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      notes: 'Express send cash in'
    },
    {
      id: 'g1000000-0000-0000-0000-000000000002',
      tenantId: DEFAULT_TENANT_ID,
      type: 'CashOut',
      amount: 500.00,
      fee: 10.00,
      refNo: '901238992341',
      customerPhone: '09287779911',
      date: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      notes: 'Cash out payout'
    }
  ];

  await db.transaction('rw', db.products, db.customers, db.utangLedger, db.gcashTxns, async () => {
    await db.products.bulkPut(products);
    await db.customers.bulkPut(customers);
    await db.utangLedger.bulkPut(utangLedger);
    await db.gcashTxns.bulkPut(gcashTxns);
  });
}
