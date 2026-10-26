import { colors } from './colors';

export const theme = {
  colors,
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  typography: {
    header: {
      fontSize: 24,
      fontWeight: '800' as const,
      color: colors.textPrimary,
    },
    subHeader: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.textPrimary,
    },
    title: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.textPrimary,
    },
    body: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.textSecondary,
    },
    caption: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
  },
};

export { colors };
