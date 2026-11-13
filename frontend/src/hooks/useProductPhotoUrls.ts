import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ProductPhotoRecord } from '../db/db';

const EMPTY_PRODUCT_PHOTOS: ProductPhotoRecord[] = [];

export function useProductPhotoUrls(tenantId: string): ReadonlyMap<string, string> {
  const records = useLiveQuery(
    () => db.productPhotos.where('tenantId').equals(tenantId).toArray(),
    [tenantId],
    EMPTY_PRODUCT_PHOTOS
  );
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    const next = new Map(records.map((record) => [record.productId, URL.createObjectURL(record.blob)]));
    // Blob URLs must be created and published by the same effect that revokes them.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [records]);

  return urls;
}
