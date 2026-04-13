export default {
  testEnvironment: 'node',
  verbose: true,
  moduleDirectories: ['node_modules'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
};
