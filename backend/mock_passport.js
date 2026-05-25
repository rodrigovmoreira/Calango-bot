// Mocking passport strategy for testing
const passport = require('passport');
passport.use(new (require('passport-mocked').Strategy)());
