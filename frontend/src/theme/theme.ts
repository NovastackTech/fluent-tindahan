import { type BrandVariants, createDarkTheme, createLightTheme, type Theme } from '@fluentui/react-components';

export const sariSariBrand: BrandVariants = {
  10: '#021B11',
  20: '#05311F',
  30: '#08482E',
  40: '#0B603D',
  50: '#0E784D',
  60: '#11905C',
  70: '#16A66C',
  80: '#20BA7C',
  90: '#32CD8E',
  100: '#52D8A0',
  110: '#75E2B2',
  120: '#99EBC5',
  130: '#BDF3D8',
  140: '#DEF9EB',
  150: '#EEFCF5',
  160: '#F7FEFA',
};

export const sariSariLightTheme: Theme = createLightTheme(sariSariBrand);
export const sariSariDarkTheme: Theme = createDarkTheme(sariSariBrand);
