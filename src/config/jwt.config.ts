export default () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '7d'
});
