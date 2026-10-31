// The app's shared state, provided by name: components read it with K.use('app').
// persisted() keeps a value across pages — and across artboards on the canvas — in sessionStorage. Prefix keys
// with the app's name, so two apps in one design/ don't share a user by accident.
(self.KOUJI = self.KOUJI || []).push(function (K) {
  K.provide('app', {
    user: K.persisted('app:user', { name: 'Ada' }),
    cart: K.persisted('app:cart', []),
  });
});
