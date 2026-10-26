export const colors = {
  // Backgrounds & Surfaces
  background: '#0F0621', // Deep cosmic purple
  surface: '#201149', // Dark container
  card: '#361757', // Card purple
  cardSecondary: '#3C1D5D',
  cardElevated: '#483573',
  cardBorder: '#4F257B',

  // Accents
  primary: '#7241F8', // Vibrant purple (floating buttons, primary actions)
  primaryElectric: '#4756F9',
  primaryNeon: '#6247F9',

  // Highlights & Badges
  accentGold: '#FFB845', // Gold accent (active tabs, star rating, highlights)
  accentAmber: '#FCAA24',
  accentWarm: '#FDB94B',
  accentPeach: '#FDC872',
  accentMint: '#7DFFAF', // Neon mint (AOS/LOS pass, live indicator)

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#E3E3E3',
  textMuted: '#BCBCBC',
  textDim: '#9F9F9F',
  textDark: '#B2B2B2',

  // Alpha Overlays & Glows
  overlay25: 'rgba(0, 0, 0, 0.25)',
  white10: 'rgba(255, 255, 255, 0.10)',
  white20: 'rgba(255, 255, 255, 0.20)',
  white30: 'rgba(255, 255, 255, 0.30)',
  white70: 'rgba(255, 255, 255, 0.70)',
  white80: 'rgba(255, 255, 255, 0.80)',
  glowPurple: 'rgba(114, 65, 248, 0.35)',
  glowGold: 'rgba(255, 184, 69, 0.35)',
  glowMint: 'rgba(125, 255, 175, 0.35)',
};

export type ThemeColors = typeof colors;
