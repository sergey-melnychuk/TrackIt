module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./src/test/setup.ts'],
  moduleNameMapper: {
    '^expo/src/winter/.*$': '<rootDir>/src/test/mocks/empty.js',
    '^@expo/vector-icons.*$': '<rootDir>/src/test/mocks/vectorIcons.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|date-fns)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/test/**',
    '!src/**/*.d.ts',
  ],
};
