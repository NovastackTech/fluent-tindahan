import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Badge,
  makeStyles,
  tokens,
  shorthands
} from '@fluentui/react-components';
import {
  DismissRegular,
  LocalLanguageRegular,
  DocumentCheckmarkRegular,
  WarningRegular,
  ShieldCheckmarkRegular
} from '@fluentui/react-icons';
import { useTermsStore } from '../state/termsStore';
import { useTranslation, useLanguageStore } from '../state/languageStore';
import { termsEN, termsTL, type TermsDocument } from '../legal/termsData';

const useStyles = makeStyles({
  surface: {
    maxWidth: '800px',
    width: '92vw',
    height: '82vh',
    maxHeight: '82vh',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.borderRadius('16px'),
    ...shorthands.padding('20px', '24px', '16px', '24px'),
    boxShadow: tokens.shadow28,
    boxSizing: 'border-box',
    overflow: 'hidden',
    zIndex: 1000
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
    ...shorthands.padding(0),
    ...shorthands.margin(0),
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalS,
    ...shorthands.gap(tokens.spacingHorizontalM),
    width: '100%'
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
    flexGrow: 1
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS),
    flexWrap: 'wrap'
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: tokens.colorNeutralForeground1,
    lineHeight: '26px'
  },
  metaText: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    lineHeight: '16px'
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS)
  },
  scrollContent: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalL),
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalS,
    boxSizing: 'border-box'
  },
  summaryCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS)
  },
  summaryTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: tokens.colorBrandForeground1
  },
  summaryNotice: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground1,
    fontStyle: 'italic'
  },
  summaryList: {
    ...shorthands.padding('0', '0', '0', tokens.spacingHorizontalL),
    ...shorthands.margin('0'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS)
  },
  summaryItem: {
    fontSize: '13px',
    lineHeight: '19px',
    color: tokens.colorNeutralForeground1
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS)
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: tokens.colorNeutralForeground1,
    marginTop: tokens.spacingVerticalXS
  },
  subSection: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS),
    marginTop: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS
  },
  subSectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground1
  },
  paragraph: {
    fontSize: '13px',
    lineHeight: '20px',
    color: tokens.colorNeutralForeground1,
    ...shorthands.margin('0')
  },
  list: {
    ...shorthands.padding('0', '0', '0', tokens.spacingHorizontalL),
    ...shorthands.margin('4px', '0'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalXS)
  },
  listItem: {
    fontSize: '13px',
    lineHeight: '19px',
    color: tokens.colorNeutralForeground1
  },
  warningCallout: {
    backgroundColor: tokens.colorStatusWarningBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorStatusWarningBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    display: 'flex',
    alignItems: 'flex-start',
    ...shorthands.gap(tokens.spacingHorizontalS),
    color: tokens.colorStatusWarningForeground1,
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS
  },
  calloutTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: tokens.colorStatusWarningForeground1
  },
  calloutText: {
    fontSize: '12px',
    lineHeight: '17px',
    fontWeight: 600
  },
  acknowledgmentBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderLeft('4px', 'solid', tokens.colorBrandStroke1),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius('0', tokens.borderRadiusMedium, tokens.borderRadiusMedium, '0'),
    fontStyle: 'italic',
    fontSize: '13px',
    lineHeight: '20px',
    color: tokens.colorNeutralForeground1,
    display: 'flex',
    ...shorthands.gap(tokens.spacingHorizontalS),
    alignItems: 'flex-start'
  },
  actions: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: '0',
    paddingLeft: '0',
    paddingRight: '0',
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
    boxSizing: 'border-box'
  }
});

export const TermsModal: React.FC = () => {
  const styles = useStyles();
  const { isTermsOpen, closeTerms } = useTermsStore();
  const { t } = useTranslation();
  const globalLanguage = useLanguageStore((s) => s.language);
  const [modalLanguage, setModalLanguage] = useState<'tl' | 'en'>(
    globalLanguage === 'tl' ? 'tl' : 'en'
  );

  // Sync with global language changes when reopened
  useEffect(() => {
    if (isTermsOpen) {
      setModalLanguage(globalLanguage === 'tl' ? 'tl' : 'en');
    }
  }, [isTermsOpen, globalLanguage]);

  const doc: TermsDocument = modalLanguage === 'tl' ? termsTL : termsEN;

  const toggleLanguage = () => {
    setModalLanguage((prev) => (prev === 'tl' ? 'en' : 'tl'));
  };

  return (
    <Dialog open={isTermsOpen} onOpenChange={(_, data) => !data.open && closeTerms()}>
      <DialogSurface className={styles.surface} data-testid="terms-modal">
        <DialogBody className={styles.body}>
          <div className={styles.header}>
            <div className={styles.titleGroup}>
              <div className={styles.headerTopRow}>
                <DocumentCheckmarkRegular fontSize={22} color={tokens.colorBrandForeground1} />
                <Text className={styles.title}>{doc.title}</Text>
                <Badge appearance="tint" color="brand">
                  {modalLanguage === 'tl' ? 'Pilipinas' : 'Philippines'}
                </Badge>
              </div>
              <Text className={styles.metaText}>
                {doc.application} &bull; {doc.effectiveDate} &bull; {doc.jurisdiction}
              </Text>
            </div>

            <div className={styles.headerControls}>
              <Button
                appearance="subtle"
                size="small"
                icon={<LocalLanguageRegular />}
                onClick={toggleLanguage}
                data-testid="terms-lang-toggle-btn"
                title={modalLanguage === 'tl' ? 'Switch to English' : 'Lumipat sa Tagalog'}
              >
                {modalLanguage === 'tl' ? 'English' : 'Tagalog'}
              </Button>
              <Button
                appearance="subtle"
                size="small"
                icon={<DismissRegular />}
                onClick={closeTerms}
                aria-label={t.common.close}
                data-testid="terms-x-btn"
              />
            </div>
          </div>

          <DialogContent className={styles.scrollContent} data-testid="terms-document-content">
            {/* Quick Summary Banner */}
            <div className={styles.summaryCard}>
              <Text className={styles.summaryTitle}>{doc.quickSummary.title}</Text>
              <Text className={styles.summaryNotice}>{doc.quickSummary.notice}</Text>
              <ol className={styles.summaryList}>
                {doc.quickSummary.points.map((pt, idx) => (
                  <li key={idx} className={styles.summaryItem}>
                    <strong>{pt.title}:</strong> {pt.desc}
                  </li>
                ))}
              </ol>
            </div>

            {/* Document Sections */}
            {doc.sections.map((sec) => (
              <div key={sec.id} className={styles.section} id={sec.id}>
                <Text className={styles.sectionTitle}>{sec.title}</Text>

                {sec.callout && (
                  <div className={styles.warningCallout}>
                    <WarningRegular fontSize={20} />
                    <div>
                      <div className={styles.calloutTitle}>{sec.callout.title}</div>
                      <div className={styles.calloutText}>{sec.callout.text}</div>
                    </div>
                  </div>
                )}

                {sec.paragraphs?.map((p, idx) => (
                  <p key={idx} className={styles.paragraph}>
                    {p}
                  </p>
                ))}

                {sec.bullets && (
                  <ul className={styles.list}>
                    {sec.bullets.map((b, idx) => (
                      <li key={idx} className={styles.listItem}>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                {sec.numbered && (
                  <ol className={styles.list}>
                    {sec.numbered.map((n, idx) => (
                      <li key={idx} className={styles.listItem}>
                        {n}
                      </li>
                    ))}
                  </ol>
                )}

                {/* Subsections */}
                {sec.subsections?.map((sub) => (
                  <div key={sub.id} className={styles.subSection} id={sub.id}>
                    <Text className={styles.subSectionTitle}>{sub.title}</Text>

                    {sub.callout && (
                      <div className={styles.warningCallout}>
                        <WarningRegular fontSize={18} />
                        <div>
                          <div className={styles.calloutTitle}>{sub.callout.title}</div>
                          <div className={styles.calloutText}>{sub.callout.text}</div>
                        </div>
                      </div>
                    )}

                    {sub.paragraphs?.map((p, pIdx) => (
                      <p key={pIdx} className={styles.paragraph}>
                        {p}
                      </p>
                    ))}

                    {sub.bullets && (
                      <ul className={styles.list}>
                        {sub.bullets.map((b, bIdx) => (
                          <li key={bIdx} className={styles.listItem}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}

                    {sub.numbered && (
                      <ol className={styles.list}>
                        {sub.numbered.map((n, nIdx) => (
                          <li key={nIdx} className={styles.listItem}>
                            {n}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}

                {sec.acknowledgmentBox && (
                  <div className={styles.acknowledgmentBox}>
                    <ShieldCheckmarkRegular fontSize={24} color={tokens.colorBrandForeground1} />
                    <div>{sec.acknowledgmentBox}</div>
                  </div>
                )}
              </div>
            ))}
          </DialogContent>

          <DialogActions fluid className={styles.actions}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {doc.application}
            </Text>
            <Button
              appearance="primary"
              onClick={closeTerms}
              data-testid="terms-close-btn"
            >
              {t.common.close}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
