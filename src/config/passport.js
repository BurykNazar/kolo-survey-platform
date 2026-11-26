import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User } from '../db/models.js';
import { env } from './env.js';

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    institution: user.institution,
    phone: user.phone,
    created_at: user.created_at
  };
}

passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
    try {
      const user = await User.findOne({
        where: { email: String(email || '').toLowerCase().trim(), is_active: true }
      });
      if (!user) return done(null, false, { message: 'Невірна пошта або пароль.' });

      const matches = await bcrypt.compare(String(password || ''), user.password_hash);
      if (!matches) return done(null, false, { message: 'Невірна пошта або пароль.' });

      return done(null, publicUser(user));
    } catch (error) {
      return done(error);
    }
  })
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.jwtSecret
    },
    async (payload, done) => {
      try {
        const user = await User.findOne({ where: { id: payload.id, is_active: true } });
        if (!user) return done(null, false);
        return done(null, publicUser(user));
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ where: { id, is_active: true } });
    return done(null, user ? publicUser(user) : false);
  } catch (error) {
    return done(error, false);
  }
});

export { publicUser };
export default passport;
