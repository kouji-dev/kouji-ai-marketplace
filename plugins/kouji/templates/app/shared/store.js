// The app's shared state, provided by name: components read it with ds.use('app').
// persisted() keeps a value across pages — and across artboards on the canvas — in sessionStorage. Prefix keys
// with the app's name, so two apps in one design/ don't share a user by accident.
(self.DS = self.DS || []).push(function (ds) {
  ds.provide('app', {
    user: ds.persisted('app:user', { name: 'Ada' }),
    cart: ds.persisted('app:cart', []),
  });
});
