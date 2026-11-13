import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export function useProductPhotoUrls(tenantId: string): ReadonlyMap<string, string> {
  const records = useLiveQuery(
    () => db.productPhotos.where('tenantId').equals(tenantId).toArray(),
    [tenantId],
    []
  );
  const urls = useMemo<ReadonlyMap<string, string>>(
    () => new Map(records.map((record) => [record.productId, URL.createObjectURL(record.blob)])),
    [records]
  );

  useEffect(() => {
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [urls]);

  return urls;
}
