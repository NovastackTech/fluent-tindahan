import React, { useState } from 'react';
import {
  Card,
  Text,
  Input,
  tokens,
  shorthands,
  makeStyles
} from '@fluentui/react-components';
import { PhoneLaptopRegular } from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import {
  DEFAULT_GCASH_FEE_TIERS,
  GCASH_FEE_BRACKETS,
  useGCashFeeStore
} from '../state/gcashFeeStore';

const useStyles = makeStyles({
  card: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM
  }
});

export interface GCashFeeSettingsCardProps {
  className?: string;
  tenantId?: string;
  role?: string;
}

export const GCashFeeSettingsCard: React.FC<GCashFeeSettingsCardProps> = ({
  className,
  tenantId: propTenantId,
  role: propRole
}) => {
  const styles = useStyles();
  const authStoreTenantId = useAuthStore((state) => state.tenantId);
  const authStoreRole = useAuthStore((state) => state.role);
  const tenantId = propTenantId ?? authStoreTenantId;
  const role = propRole ?? authStoreRole;

  const { t } = useTranslation();
  const gcashFees = useGCashFeeStore(
    (state) => state.feesByTenant[tenantId] || DEFAULT_GCASH_FEE_TIERS
  );
  const setGcashFee = useGCashFeeStore((state) => state.setFeeForTenant);
  const [gcashFeeDrafts, setGcashFeeDrafts] = useState<Record<string, string>>({});

  if (role !== 'Owner') {
    return null;
  }

  return (
    <Card className={className ?? styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <PhoneLaptopRegular fontSize={20} />
        <Text as="h2" weight="bold" size={400}>{t.settings.gcashFeeSection}</Text>
      </div>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '12px', display: 'block' }}>
        {t.settings.gcashFeeDesc}
      </Text>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
              {t.settings.gcashFeeRange}
            </th>
            <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
              {t.settings.gcashFixedFee}
            </th>
          </tr>
        </thead>
        <tbody>
          {GCASH_FEE_BRACKETS.map((bracket, index) => {
            const draftKey = `${tenantId}:${index}`;
            return (
              <tr key={bracket.label}>
                <td style={{ padding: '6px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                  {bracket.label}
                </td>
                <td style={{ padding: '6px 4px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label={`${t.settings.gcashFixedFee} ${bracket.label}`}
                    contentBefore="₱"
                    value={gcashFeeDrafts[draftKey] ?? String(gcashFees[index])}
                    onChange={(_, data) => {
                      setGcashFeeDrafts((drafts) => ({ ...drafts, [draftKey]: data.value }));
                      const fee = Number(data.value);
                      if (data.value.trim() !== '' && Number.isFinite(fee) && fee >= 0 && fee <= 100000) {
                        setGcashFee(tenantId, index, fee);
                      }
                    }}
                    onBlur={() => {
                      const draft = gcashFeeDrafts[draftKey];
                      if (draft !== undefined) {
                        const fee = Number(draft);
                        if (draft.trim() !== '' && Number.isFinite(fee) && fee >= 0 && fee <= 100000) {
                          setGcashFee(tenantId, index, fee);
                        }
                        setGcashFeeDrafts((drafts) => {
                          const nextDrafts = { ...drafts };
                          delete nextDrafts[draftKey];
                          return nextDrafts;
                        });
                      }
                    }}
                    style={{ width: '120px' }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};
