// <app-user-card> — reads and writes shared state from the store: it re-renders when user changes, on any page.
import { Base, html, define } from '../base.js';
import { user } from '../store.js';
import sheet from './user-card.css' with { type: 'css' };

class UserCard extends Base {
  static styles = [sheet];

  render() {
    const { name } = user.value;
    return html`
      <div class="avatar" aria-hidden="true">${name.slice(0, 1).toUpperCase()}</div>
      <label class="who"><small>Signed in as</small><input value="${name}" aria-label="Your name" spellcheck="false"></label>`;
  }

  // Wire DOM events after each render: the markup is rebuilt, so listeners go on the new nodes.
  rendered() {
    this.$('input').addEventListener('change', (e) => {
      const name = e.target.value.trim();
      if (name) user.value = { ...user.value, name };
    });
  }
}

define('app-user-card', UserCard);
