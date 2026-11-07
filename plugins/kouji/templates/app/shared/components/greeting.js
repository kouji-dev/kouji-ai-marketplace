// <app-greeting> — a page's live text from shared state, so the page itself stays static markup.
(self.DS = self.DS || []).push(function (ds) {
  class Greeting extends ds.Base {
    render() {
      const app = ds.use('app');
      return ds.html`<p style="margin: 0">Hello, ${app ? app.user.value.name : '…'}.</p>`;
    }
  }
  ds.define('app-greeting', Greeting);
});
