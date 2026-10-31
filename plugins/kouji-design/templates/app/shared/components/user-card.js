// <app-user-card> — reads and writes shared state: it re-renders when the user changes, on any page or artboard.
(self.KOUJI = self.KOUJI || []).push(function (K) {
  class UserCard extends K.Base {
    static styles = [K.css('shared/components/user-card.css')];

    render() {
      const app = K.use('app');
      if (!app) return K.html``;                    // the store hasn't loaded yet: render again when it does
      const { name } = app.user.value;
      return K.html`
        <div class="avatar" aria-hidden="true">${name.slice(0, 1).toUpperCase()}</div>
        <label class="who"><small>Signed in as</small><input value="${name}" aria-label="Your name" spellcheck="false"></label>`;
    }

    // Wire DOM events after each render: the markup is rebuilt, so listeners go on the new nodes.
    rendered() {
      this.$('input')?.addEventListener('change', (e) => {
        const name = e.target.value.trim();
        const app = K.use('app');
        if (name && app) app.user.value = { ...app.user.value, name };
      });
    }
  }
  K.define('app-user-card', UserCard);
});
