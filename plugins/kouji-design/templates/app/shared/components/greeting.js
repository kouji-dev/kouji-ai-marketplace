// <app-greeting> — a page's live text from shared state, so the page itself stays static markup.
(self.KOUJI = self.KOUJI || []).push(function (K) {
  class Greeting extends K.Base {
    render() {
      const app = K.use('app');
      return K.html`<p style="margin: 0">Hello, ${app ? app.user.value.name : '…'}.</p>`;
    }
  }
  K.define('app-greeting', Greeting);
});
