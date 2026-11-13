import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProductPhotoUrls } from './useProductPhotoUrls';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));

describe('useProductPhotoUrls', () => {
  beforeEach(() => {
    vi.mocked(useLiveQuery).mockReturnValue([
      { tenantId: 'tenant-1', productId: 'product-1', blob: new Blob(['photo']) }
    ]);
    let sequence = 0;
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:strict-${++sequence}`);
  });

  it('recreates blob URLs after the StrictMode effect cleanup', async () => {
    const Probe = () => {
      const urls = useProductPhotoUrls('tenant-1');
      return <output>{urls.get('product-1')}</output>;
    };

    const view = render(<StrictMode><Probe /></StrictMode>);

    await waitFor(() => expect(screen.getByText('blob:strict-2')).toBeInTheDocument());
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:strict-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:strict-2');

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:strict-2');
  });
});
