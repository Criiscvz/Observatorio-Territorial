// Rehearsal database only; the HTTP application never receives the root account.
db.getSiblingDB('observatorio_portable_test').createUser({
  user: 'portable_app',
  pwd: process.env.PORTABLE_MONGO_APP_PASSWORD,
  roles: [{role: 'readWrite', db: 'observatorio_portable_test'}],
});
