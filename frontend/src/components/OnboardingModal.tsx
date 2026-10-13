import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Field,
  Input,
  RadioGroup,
  Radio,
  Checkbox,
  Button,
  Text,
  Badge,
  makeStyles,
  tokens,
  shorthands,
  Spinner
} from '@fluentui/react-components';
import {
  BuildingShopRegular,
  PersonRegular,
  PhoneRegular,
  BoxRegular,
  CheckmarkRegular,
  DismissRegular,
  SparkleRegular,
  PhoneLaptopRegular
} from '@fluentui/react-icons';
import { useAuthStore } from '../state/authStore';
import { useTranslation } from '../state/languageStore';
import { seedDexieDatabaseIfNeeded } from '../db/seedData';
import { db } from '../db/db';
import { normalizePhilippineMobile } from '../utils/philippineMobile';
import { DEFAULT_GCASH_FEE_TIERS, useGCashFeeStore } from '../state/gcashFeeStore';
import { useSubscriptionStore } from '../state/subscriptionStore';

const useStyles = makeStyles({
  surface: {
    maxWidth: '560px',
    width: '95vw',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  headerIcon: {
    width: '42px',
    height: '42px',
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column'
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalL
  },
  catalogCard: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalXS
  },
  radioLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM
  }
});

export const OnboardingModal: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();

  const {
    tenantId,
    businessName,
    ownerName,
    userPhone,
    consentAccepted,
    isOnboarded,
    isOnboardingOpen,
    onboardingMode,
    closeOnboarding,
    completeOnboarding,
    updateStoreProfile
  } = useAuthStore();

  const isOpen = isOnboardingOpen || (consentAccepted && !isOnboarded);
  const isEditMode = onboardingMode === 'edit' && isOnboarded;

  const [formBusinessName, setFormBusinessName] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formUserPhone, setFormUserPhone] = useState('');
  const [catalogChoice, setCatalogChoice] = useState<'standard' | 'empty'>('standard');
  const [offersGcash, setOffersGcash] = useState(true);

  const [businessNameError, setBusinessNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setFormBusinessName(businessName || '');
        setFormOwnerName(ownerName || '');
        setFormUserPhone(userPhone || '');
      } else {
        setFormBusinessName(businessName === "Aling Nena's Tindahan & GCash" ? '' : businessName);
        setFormOwnerName(ownerName === 'Aling Nena' ? '' : ownerName);
        setFormUserPhone(userPhone === '09171234567' ? '' : userPhone);
      }
      setBusinessNameError('');
      setPhoneError('');
      setIsSubmitting(false);
    }
  }, [isOpen, isEditMode, businessName, ownerName, userPhone]);

  if (!isOpen) {
    return null;
  }

  const validate = (): boolean => {
    let isValid = true;

    if (!formBusinessName.trim() || formBusinessName.trim().length < 2) {
      setBusinessNameError(t.onboarding.storeNameRequired);
      isValid = false;
    } else {
      setBusinessNameError('');
    }

    if (formUserPhone.trim()) {
      const normalized = normalizePhilippineMobile(formUserPhone);
      if (!normalized) {
        setPhoneError(t.onboarding.phoneInvalid);
        isValid = false;
      } else {
        setPhoneError('');
      }
    } else {
      setPhoneError('');
    }

    return isValid;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const trimmedBusinessName = formBusinessName.trim();
      const trimmedOwnerName = formOwnerName.trim();
      const normalizedPhone = formUserPhone.trim()
        ? normalizePhilippineMobile(formUserPhone) || formUserPhone.trim()
        : '';

      if (isEditMode) {
        updateStoreProfile({
          businessName: trimmedBusinessName,
          ownerName: trimmedOwnerName,
          userPhone: normalizedPhone
        });

        // Sync with local Dexie tenants table
        await db.tenants.update(tenantId, {
          businessName: trimmedBusinessName,
          updatedAt: new Date().toISOString()
        }).catch(console.warn);
      } else {
        // Generate new unique client UUIDs for the new tenant and user
        const newTenantId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `t_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const newUserId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `u_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        completeOnboarding({
          businessName: trimmedBusinessName,
          ownerName: trimmedOwnerName,
          userPhone: normalizedPhone,
          tenantId: newTenantId,
          userId: newUserId
        });
        useSubscriptionStore.setState({
          tier: 'Libre',
          subscriptionEndDate: null,
          isActive: false,
          daysRemaining: null
        });

        // Seed or initialize catalog for the new tenant
        await seedDexieDatabaseIfNeeded(
          true,
          newTenantId,
          catalogChoice === 'empty',
          trimmedBusinessName
        );

        if (offersGcash) {
          DEFAULT_GCASH_FEE_TIERS.forEach((fee, tierIndex) => {
            useGCashFeeStore.getState().setFeeForTenant(newTenantId, tierIndex, fee);
          });
        }
      }
    } catch (err) {
      console.error('[OnboardingModal] Failed to submit store profile:', err);
    } finally {
      setIsSubmitting(false);
      closeOnboarding();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && isEditMode && closeOnboarding()}>
      <DialogSurface className={styles.surface} aria-label={isEditMode ? t.onboarding.editTitle : t.onboarding.welcomeTitle}>
        <DialogBody>
          <div className={styles.headerRow}>
            <div className={styles.headerIcon}>
              <BuildingShopRegular />
            </div>
            <div className={styles.titleArea}>
              <DialogTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{isEditMode ? t.onboarding.editTitle : t.onboarding.welcomeTitle}</span>
                  {!isEditMode && <Badge appearance="filled" color="brand">Bago</Badge>}
                </div>
              </DialogTitle>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {isEditMode ? t.onboarding.editSubtitle : t.onboarding.welcomeSubtitle}
              </Text>
            </div>
          </div>

          <DialogContent>
            <form onSubmit={handleSubmit} id="onboarding-form">
              <div className={styles.formSection}>
                {/* Store Name */}
                <Field
                  label={t.onboarding.storeNameLabel}
                  required
                  validationState={businessNameError ? 'error' : 'none'}
                  validationMessage={businessNameError}
                >
                  <Input
                    value={formBusinessName}
                    onChange={(_, data) => {
                      setFormBusinessName(data.value);
                      if (businessNameError) setBusinessNameError('');
                    }}
                    placeholder={t.onboarding.storeNamePlaceholder}
                    contentBefore={<BuildingShopRegular />}
                    autoFocus
                  />
                </Field>

                {/* Owner Name */}
                <Field label={t.onboarding.ownerNameLabel}>
                  <Input
                    value={formOwnerName}
                    onChange={(_, data) => setFormOwnerName(data.value)}
                    placeholder={t.onboarding.ownerNamePlaceholder}
                    contentBefore={<PersonRegular />}
                  />
                </Field>

                {/* Mobile Phone */}
                <Field
                  label={t.onboarding.userPhoneLabel}
                  validationState={phoneError ? 'error' : 'none'}
                  validationMessage={phoneError}
                >
                  <Input
                    type="tel"
                    value={formUserPhone}
                    onChange={(_, data) => {
                      setFormUserPhone(data.value);
                      if (phoneError) setPhoneError('');
                    }}
                    placeholder={t.onboarding.userPhonePlaceholder}
                    contentBefore={<PhoneRegular />}
                  />
                </Field>

                {/* Catalog Choice (Only during initial onboarding) */}
                {!isEditMode && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <BoxRegular fontSize={18} />
                      <Text weight="semibold" size={300}>
                        {t.onboarding.catalogSectionTitle}
                      </Text>
                    </div>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px', display: 'block' }}>
                      {t.onboarding.catalogSectionDesc}
                    </Text>

                    <RadioGroup
                      value={catalogChoice}
                      onChange={(_, data) => setCatalogChoice(data.value as 'standard' | 'empty')}
                    >
                      <div className={styles.catalogCard}>
                        <Radio
                          value="standard"
                          label={
                            <div className={styles.radioLabel}>
                              <Text weight="semibold" size={200}>
                                {t.onboarding.catalogStandardTitle}
                              </Text>
                              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                                {t.onboarding.catalogStandardDesc}
                              </Text>
                            </div>
                          }
                        />
                      </div>
                      <div className={styles.catalogCard}>
                        <Radio
                          value="empty"
                          label={
                            <div className={styles.radioLabel}>
                              <Text weight="semibold" size={200}>
                                {t.onboarding.catalogEmptyTitle}
                              </Text>
                              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                                {t.onboarding.catalogEmptyDesc}
                              </Text>
                            </div>
                          }
                        />
                      </div>
                    </RadioGroup>

                    {/* GCash Checkbox */}
                    <div style={{ marginTop: '12px' }}>
                      <Checkbox
                        checked={offersGcash}
                        onChange={(_, data) => setOffersGcash(!!data.checked)}
                        label={
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <PhoneLaptopRegular />
                              <Text weight="semibold" size={200}>{t.onboarding.gcashToggleTitle}</Text>
                            </div>
                            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                              {t.onboarding.gcashToggleDesc}
                            </Text>
                          </div>
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          </DialogContent>

          <DialogActions className={styles.actions}>
            {isEditMode && (
              <Button
                appearance="secondary"
                icon={<DismissRegular />}
                onClick={closeOnboarding}
                disabled={isSubmitting}
              >
                {t.onboarding.cancelBtn}
              </Button>
            )}
            <Button
              appearance="primary"
              icon={isSubmitting ? <Spinner size="extra-tiny" /> : isEditMode ? <CheckmarkRegular /> : <SparkleRegular />}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isEditMode ? t.onboarding.saveProfileBtn : t.onboarding.launchBtn}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
