import { db, type ProductRecord, type CustomerRecord, type UtangLedgerRecord, type GCashTxnRecord } from './db';

export const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const DEFAULT_USER_ID = '22222222-2222-2222-2222-222222222222';

export async function seedDexieDatabaseIfNeeded(force = false) {
  const productCount = await db.products.count();
  if (!force && productCount >= 138) return;

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
      id: 'a1000000-0000-0000-0000-000000000003',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Pancit Canton Extra Hot 80g',
      price: 16,
      cost: 13.25,
      barcode: '4800016644033',
      category: 'Instant Noodles',
      stockQty: 24,
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
      id: 'a1000000-0000-0000-0000-000000000005',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Pancit Canton Sweet & Spicy 80g',
      price: 16,
      cost: 13.25,
      barcode: '4800016644057',
      category: 'Instant Noodles',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000007',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lucky Me! Instant Mami Beef 55g',
      price: 13,
      cost: 10.5,
      barcode: '4800016601029',
      category: 'Instant Noodles',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000008',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Payless Instant Pancit Canton Extra Big Sweet & Spicy 130g',
      price: 19,
      cost: 16,
      barcode: '4800016645122',
      category: 'Instant Noodles',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000009',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Payless Instant Pancit Canton Extra Big Kalamansi 130g',
      price: 19,
      cost: 16,
      barcode: '4800016645115',
      category: 'Instant Noodles',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000010',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nissin Cup Noodles Seafood 40g',
      price: 26,
      cost: 21.5,
      barcode: '4800016681014',
      category: 'Instant Noodles',
      stockQty: 12,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000011',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nissin Cup Noodles Beef 40g',
      price: 26,
      cost: 21.5,
      barcode: '4800016681021',
      category: 'Instant Noodles',
      stockQty: 12,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000012',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Quickchow Instant Mami Beef 55g',
      price: 11,
      cost: 9,
      barcode: '4807770270034',
      category: 'Instant Noodles',
      stockQty: 24,
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
      id: 'a1000000-0000-0000-0000-000000000014',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Kopiko Black 3-in-1 Coffee 52g',
      price: 15,
      cost: 12.2,
      barcode: '8996001414019',
      category: 'Coffee & Beverages',
      stockQty: 40,
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
      id: 'a1000000-0000-0000-0000-000000000016',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Kopiko Cappuccino with Choco Granules 25g',
      price: 12,
      cost: 9.5,
      barcode: '8996001410141',
      category: 'Coffee & Beverages',
      stockQty: 24,
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
      id: 'a1000000-0000-0000-0000-000000000019',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Great Taste White 3-in-1 Coffee 50g',
      price: 14,
      cost: 11.8,
      barcode: '4800016024101',
      category: 'Coffee & Beverages',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000020',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Great Taste Choco 3-in-1 Coffee 50g',
      price: 14,
      cost: 11.8,
      barcode: '4800016024125',
      category: 'Coffee & Beverages',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000023',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Birch Tree Full Cream Milk Powder 33g',
      price: 12,
      cost: 9.5,
      barcode: '4800216411026',
      category: 'Milk & Dairy',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000024',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Alaska Fortified Powdered Milk Drink 30g',
      price: 12,
      cost: 9.75,
      barcode: '4800110023400',
      category: 'Milk & Dairy',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000025',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Energen Cereal Drink Vanilla 80g',
      price: 17,
      cost: 13.5,
      barcode: '8996001303108',
      category: 'Breakfast & Cereal',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000026',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Energen Cereal Drink Chocolate 80g',
      price: 17,
      cost: 13.5,
      barcode: '8996001303207',
      category: 'Breakfast & Cereal',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000028',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Tang Powdered Juice Pineapple 20g',
      price: 21,
      cost: 17.5,
      barcode: '4800024101207',
      category: 'Juices & Beverages',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000029',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nestea Iced Tea Lemon Powder 25g',
      price: 22,
      cost: 18,
      barcode: '4800361301017',
      category: 'Juices & Beverages',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000030',
      tenantId: DEFAULT_TENANT_ID,
      name: 'C2 Cool & Clean Green Tea Apple 230ml',
      price: 16,
      cost: 13,
      barcode: '4800016111016',
      category: 'Beverages',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000031',
      tenantId: DEFAULT_TENANT_ID,
      name: 'C2 Cool & Clean Green Tea Lemon 230ml',
      price: 16,
      cost: 13,
      barcode: '4800016111023',
      category: 'Beverages',
      stockQty: 24,
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
      id: 'a1000000-0000-0000-0000-000000000033',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Sprite Mismo 290ml',
      price: 20,
      cost: 16,
      barcode: '4801981100202',
      category: 'Beverages',
      stockQty: 24,
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
      id: 'a1000000-0000-0000-0000-000000000036',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Mega Sardines in Tomato Sauce Spicy Red 155g',
      price: 26,
      cost: 22.5,
      barcode: '4809011743022',
      category: 'Canned Goods',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000038',
      tenantId: DEFAULT_TENANT_ID,
      name: '555 Sardines in Tomato Sauce Spicy 155g',
      price: 25,
      cost: 21,
      barcode: '4800216111025',
      category: 'Canned Goods',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000039',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ligo Sardines in Tomato Sauce 155g',
      price: 27,
      cost: 23,
      barcode: '4800028111011',
      category: 'Canned Goods',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000040',
      tenantId: DEFAULT_TENANT_ID,
      name: '555 Fried Sardines Escabeche 155g',
      price: 31,
      cost: 26,
      barcode: '4800216112107',
      category: 'Canned Goods',
      stockQty: 15,
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
      id: 'a1000000-0000-0000-0000-000000000042',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Century Tuna Flakes with Calamansi 155g',
      price: 40,
      cost: 34,
      barcode: '4800216212036',
      category: 'Canned Goods',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000043',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Century Tuna Flakes Hot & Spicy 155g',
      price: 40,
      cost: 34,
      barcode: '4800216212029',
      category: 'Canned Goods',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000044',
      tenantId: DEFAULT_TENANT_ID,
      name: 'San Marino Corned Tuna 150g',
      price: 41,
      cost: 35,
      barcode: '4800216223018',
      category: 'Canned Goods',
      stockQty: 20,
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
      id: 'a1000000-0000-0000-0000-000000000046',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Purefoods Corned Beef 150g',
      price: 78,
      cost: 68,
      barcode: '4800088111014',
      category: 'Canned Goods',
      stockQty: 12,
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
      id: 'a1000000-0000-0000-0000-000000000048',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Argentina Beef Loaf 150g',
      price: 28,
      cost: 23.5,
      barcode: '4800216213019',
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
      id: 'a1000000-0000-0000-0000-000000000052',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Datu Puti White Vinegar 100ml',
      price: 6.5,
      cost: 5.25,
      barcode: '4801981120033',
      category: 'Condiments',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000053',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Mang Tomas All-Around Sarsa 325g',
      price: 40,
      cost: 34,
      barcode: '4801981130032',
      category: 'Condiments',
      stockQty: 15,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000054',
      tenantId: DEFAULT_TENANT_ID,
      name: 'UFC Tomato Sauce 115g',
      price: 16.5,
      cost: 13.5,
      barcode: '4801981140024',
      category: 'Condiments',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000055',
      tenantId: DEFAULT_TENANT_ID,
      name: 'UFC Tamis-Anghang Banana Catsup 100g',
      price: 12.5,
      cost: 10,
      barcode: '4801981140109',
      category: 'Condiments',
      stockQty: 25,
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
      id: 'a1000000-0000-0000-0000-000000000058',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Knorr Chicken Broth Cube 10g',
      price: 8,
      cost: 6,
      barcode: '4800888151021',
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
      id: 'a1000000-0000-0000-0000-000000000060',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ajinomoto Monosodium Glutamate Umami Seasoning 45g',
      price: 14,
      cost: 11,
      barcode: '4800055100101',
      category: 'Seasonings',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000061',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Crispy Fry Breading Mix Original 62g',
      price: 18,
      cost: 14.5,
      barcode: '4800055120109',
      category: 'Seasonings',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000062',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Crispy Fry Breading Mix Spicy 62g',
      price: 18,
      cost: 14.5,
      barcode: '4800055120208',
      category: 'Seasonings',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000063',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Rebisco Crackers Plain 32g',
      price: 8,
      cost: 6,
      barcode: '4800111000011',
      category: 'Biscuits & Bakery',
      stockQty: 40,
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
      id: 'a1000000-0000-0000-0000-000000000066',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Hansel Mocha Sandwich Biscuit 31g',
      price: 9,
      cost: 7,
      barcode: '4800111011017',
      category: 'Biscuits & Bakery',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000067',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Magic Creams Chocolate Sandwich 28g',
      price: 9,
      cost: 7,
      barcode: '4800016012016',
      category: 'Biscuits & Bakery',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000069',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Fudgee Barr Salted Caramel Cake Bar 38g',
      price: 11,
      cost: 8.5,
      barcode: '4800111022020',
      category: 'Biscuits & Bakery',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000070',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Lemon Square Cheese Cake 30g',
      price: 12,
      cost: 9,
      barcode: '4806505011018',
      category: 'Biscuits & Bakery',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000071',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Choco Mucho Milk Chocolate Bar 33g',
      price: 12.5,
      cost: 9.5,
      barcode: '4800111033019',
      category: 'Chocolates & Sweets',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000072',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Choco Mucho Dark Chocolate Bar 33g',
      price: 12.5,
      cost: 9.5,
      barcode: '4800111033026',
      category: 'Chocolates & Sweets',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000073',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Presto Creams Peanut Butter Sandwich 30g',
      price: 9,
      cost: 7,
      barcode: '4800016013013',
      category: 'Biscuits & Bakery',
      stockQty: 25,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000074',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Superstix Wafer Sticks Chocolate 55g',
      price: 15,
      cost: 12,
      barcode: '4800111044015',
      category: 'Biscuits & Bakery',
      stockQty: 20,
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
      id: 'a1000000-0000-0000-0000-000000000076',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Piattos Sour Cream & Onion 85g',
      price: 38,
      cost: 32,
      barcode: '4800016053347',
      category: 'Snacks & Chips',
      stockQty: 18,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000077',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Nova Country Cheddar Multigrain Chips 78g',
      price: 38,
      cost: 32,
      barcode: '4800016055105',
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
      id: 'a1000000-0000-0000-0000-000000000079',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Oishi Prawn Crackers Plain 60g',
      price: 20,
      cost: 16.5,
      barcode: '4800194160015',
      category: 'Snacks & Chips',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000080',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Oishi Prawn Crackers Spicy 60g',
      price: 20,
      cost: 16.5,
      barcode: '4800194160022',
      category: 'Snacks & Chips',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000081',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Oishi Pillows Chocolate Filled Cracker 38g',
      price: 13,
      cost: 10,
      barcode: '4800194160107',
      category: 'Snacks & Chips',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000082',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Oishi Marty\'s Cracklin\' Vegetarian Chicharon 90g',
      price: 26,
      cost: 21.5,
      barcode: '4800194160206',
      category: 'Snacks & Chips',
      stockQty: 18,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000083',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Boy Bawang Cornick Garlic 100g',
      price: 20,
      cost: 16,
      barcode: '4806502110011',
      category: 'Snacks & Chips',
      stockQty: 24,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000084',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Clover Chips Cheese 55g',
      price: 16,
      cost: 13,
      barcode: '4800042110014',
      category: 'Snacks & Chips',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000085',
      tenantId: DEFAULT_TENANT_ID,
      name: 'V-Cut Potato Chips Cheese 60g',
      price: 33,
      cost: 27,
      barcode: '4800016054108',
      category: 'Snacks & Chips',
      stockQty: 18,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000086',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Roller Coaster Cheddar Cheese 85g',
      price: 34,
      cost: 28,
      barcode: '4800016056102',
      category: 'Snacks & Chips',
      stockQty: 18,
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
      id: 'a1000000-0000-0000-0000-000000000088',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Mentos Mint Chewy Dragees 37.5g',
      price: 22,
      cost: 17,
      barcode: '8935001701016',
      category: 'Candies & Sweets',
      stockQty: 15,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000089',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Flat Tops Milk Chocolate 150g',
      price: 58,
      cost: 48,
      barcode: '4800144110015',
      category: 'Chocolates & Sweets',
      stockQty: 12,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000090',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Curly Tops Milk Chocolate 150g',
      price: 58,
      cost: 48,
      barcode: '4800144110022',
      category: 'Chocolates & Sweets',
      stockQty: 12,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000091',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Choc-Nut Peanut Milk Chocolate 16g',
      price: 23,
      cost: 18,
      barcode: '4806501100016',
      category: 'Chocolates & Sweets',
      stockQty: 20,
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
      id: 'a1000000-0000-0000-0000-000000000093',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Halls Mentho-Lyptus Extra Strong 1 pc',
      price: 2.5,
      cost: 1.8,
      barcode: '4800024081011',
      category: 'Candies & Sweets',
      stockQty: 100,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000094',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Fox\'s Crystal Clear Fruits Candy 90g',
      price: 40,
      cost: 32,
      barcode: '8992741911017',
      category: 'Candies & Sweets',
      stockQty: 10,
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
      id: 'a1000000-0000-0000-0000-000000000096',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Sunsilk Shampoo Strong & Long Green 13ml',
      price: 8,
      cost: 6.25,
      barcode: '4800888138770',
      category: 'Personal Care',
      stockQty: 50,
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
      id: 'a1000000-0000-0000-0000-000000000098',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Cream Silk Conditioner Hair Fall Defense Green 11ml',
      price: 8.5,
      cost: 6.5,
      barcode: '4800888139029',
      category: 'Personal Care',
      stockQty: 50,
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
      id: 'a1000000-0000-0000-0000-000000000100',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Palmolive Naturals Shampoo Intensive Moisture Pink 15ml',
      price: 8,
      cost: 6.25,
      barcode: '4800045110011',
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
      id: 'a1000000-0000-0000-0000-000000000102',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Safeguard Lemon Fresh Bar Soap 60g',
      price: 26,
      cost: 22,
      barcode: '4902430401838',
      category: 'Personal Care',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000103',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Palmolive Naturals White Bar Soap with Milk 55g',
      price: 22,
      cost: 18,
      barcode: '4800045120010',
      category: 'Personal Care',
      stockQty: 20,
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
      id: 'a1000000-0000-0000-0000-000000000105',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Close Up Deep Action Red Hot Toothpaste 20g',
      price: 11,
      cost: 8.5,
      barcode: '4800888131016',
      category: 'Personal Care',
      stockQty: 30,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000106',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Whisper Regular Flow Non-Wing Sanitary Pad 1 pc',
      price: 9,
      cost: 7,
      barcode: '4902430211017',
      category: 'Personal Care',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000107',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Modess Cottony Soft Maxi Regular Non-Wing Pad 1 pc',
      price: 8.5,
      cost: 6.5,
      barcode: '4800032110017',
      category: 'Personal Care',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000108',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Eskinol Spot-less White Facial Deep Cleanser 75ml',
      price: 46,
      cost: 39,
      barcode: '4800888140018',
      category: 'Personal Care',
      stockQty: 12,
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
      id: 'a1000000-0000-0000-0000-000000000110',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Surf Powder Cherry Blossom Detergent 60g',
      price: 9.5,
      cost: 7.5,
      barcode: '4800888147062',
      category: 'Laundry Care',
      stockQty: 50,
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
      id: 'a1000000-0000-0000-0000-000000000112',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Tide Perfect Clean Detergent Powder Garden Bloom 66g',
      price: 14.5,
      cost: 11.5,
      barcode: '4902430711012',
      category: 'Laundry Care',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000113',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Breeze Power Clean Detergent Powder 66g',
      price: 14.5,
      cost: 11.5,
      barcode: '4800888148014',
      category: 'Laundry Care',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000115',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Downy Fabric Conditioner Passion 25ml',
      price: 9,
      cost: 7.25,
      barcode: '4902430737098',
      category: 'Laundry Care',
      stockQty: 50,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000116',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Surf Fabric Conditioner Charcoal Fresh 25ml',
      price: 8,
      cost: 6.5,
      barcode: '4800888149011',
      category: 'Laundry Care',
      stockQty: 40,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000117',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Joy Dishwashing Liquid Lemon Refill 185ml',
      price: 42,
      cost: 36,
      barcode: '4902430741019',
      category: 'Household Care',
      stockQty: 15,
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
      id: 'a1000000-0000-0000-0000-000000000119',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Champion Detergent Bar Blue Regular 130g',
      price: 17,
      cost: 14,
      barcode: '4800021110011',
      category: 'Laundry Care',
      stockQty: 30,
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
      id: 'a1000000-0000-0000-0000-000000000123',
      tenantId: DEFAULT_TENANT_ID,
      name: 'San Mig Light Beer 330ml',
      price: 58,
      cost: 50,
      barcode: '4800088100216',
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
      id: 'a1000000-0000-0000-0000-000000000125',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Ginebra San Miguel Primera Light 750ml',
      price: 135,
      cost: 115,
      barcode: '4800088200114',
      category: 'Alcohol & Beverages',
      stockQty: 12,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000126',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Marlboro Red Flip-Top Pack 20s',
      price: 175,
      cost: 155,
      barcode: '4800008110010',
      category: 'Tobacco',
      stockQty: 10,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000127',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Marlboro Gold Flip-Top Pack 20s',
      price: 175,
      cost: 155,
      barcode: '4800008110027',
      category: 'Tobacco',
      stockQty: 10,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000128',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Winston Red Box Pack 20s',
      price: 155,
      cost: 135,
      barcode: '4800008210017',
      category: 'Tobacco',
      stockQty: 10,
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
      id: 'a1000000-0000-0000-0000-000000000131',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Brown Washed Sugar Repacked (Tingi) 1/4 kg',
      price: 21,
      cost: 16,
      barcode: '2000000000039',
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
      id: 'a1000000-0000-0000-0000-000000000133',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Garlic Bawang Repacked (Tingi) 100g',
      price: 18,
      cost: 14,
      barcode: '2000000000053',
      category: 'Fresh Produce & Tingi',
      stockQty: 20,
      updatedAt: now
    },
    {
      id: 'a1000000-0000-0000-0000-000000000134',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Red Onion Sibuyas Repacked (Tingi) 100g',
      price: 22,
      cost: 16,
      barcode: '2000000000060',
      category: 'Fresh Produce & Tingi',
      stockQty: 20,
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
      id: 'a1000000-0000-0000-0000-000000000138',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Winston Red Single Stick (Tingi) 1 stick',
      price: 9,
      cost: 7.5,
      barcode: '2000000000107',
      category: 'Tobacco',
      stockQty: 100,
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
