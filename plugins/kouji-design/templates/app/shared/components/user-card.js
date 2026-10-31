// <app-user-card> — reads and writes shared state: it re-renders when the user changes, on any page or artboard.
(self.DS = self.DS || []).push(function (ds) {
  class UserCard extends ds.Base {
    static styles = [ds.css('shared/components/user-card.css')];

    render() {
      const app = ds.use('app');
      if (!app) return ds.html``;                    // the store hasn't loaded yet: render again when it does
      const { name } = app.user.value;
      return ds.html`
        <div class="avatar" aria-hidden="true">${name.slice(0, 1).toUpperCase()}</div>
        <label class="who"><small>Signed in as</small><input value="${name}" aria-label="Your name" spellcheck="false"></label>`;
    }

    // Wire DOM events after each render: the markup is rebuilt, so listeners go on the new nodes.
    rendered() {
      this.$('input')?.addEventListener('change', (e) => {
        const name = e.target.value.trim();
        const app = ds.use('app');
        if (name && app) app.user.value = { ...app.user.value, name };
      });
    }
  }
  ds.define('app-user-card', UserCard);
});
