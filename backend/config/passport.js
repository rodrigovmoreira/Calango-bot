import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import SystemUser from '../models/SystemUser.js';
import BusinessConfig from '../models/BusinessConfig.js';
import crypto from 'crypto';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      proxy: true // Important for cloud deployments (https)
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Check if user exists by email
        const email = profile.emails[0].value;
        let user = await SystemUser.findOne({ email });

        if (user) {
          // If user exists but doesn't have googleId linked, we could link it here
          if (!user.googleId) {
            user.googleId = profile.id;
            // Also force verification if coming from Google
            if (!user.isVerified) user.isVerified = true;
            await user.save();
          }
          return done(null, user);
        }

        // 2. If user doesn't exist, create new one
        // Generate a random secure password since they use Google
        const randomPassword = crypto.randomBytes(16).toString('hex');

        user = await SystemUser.create({
          name: profile.displayName,
          email: email,
          password: randomPassword,
          googleId: profile.id,
          isVerified: true, // Auto-verify from Google
          company: 'Meu Negócio', // Default
          role: 'vendedor' 
        });

        // Initialize BusinessConfig
        await BusinessConfig.create({
          userId: user._id,
          businessName: 'Meu Negócio',
          prompts: {
            chatSystem: "Você é um assistente virtual útil.",
            visionSystem: "Descreva o que vê."
          }
        });

        return done(null, user);

      } catch (error) {
        console.error('Error in Google Strategy:', error);
        return done(error, null);
      }
    }
  )
);

// We don't really need serialize/deserialize if we are using stateless JWT
// but Passport might complain without it for session support.
// Since we disable session in the route, this might be skippable,
// but adding it just in case some middleware triggers it.
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await SystemUser.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
