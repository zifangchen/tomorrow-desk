# Tomorrow Desk

Tomorrow Desk is a small Windows Electron app for writing tomorrow's handoff note before shutdown and showing it again as a floating desktop window after login.

## Commands

- `npm install`
- `npm test`
- `npm start`

## v1 Behavior

- Notes are stored locally in Electron's user data directory as `tomorrow.md`.
- Archives are stored under `archives/YYYY-MM-DD-HHmm.md`.
- The app autosaves while typing.
- The main window is black-and-gold, always-on-top by default, draggable, and resizable.
- Closing the window hides it to the system tray.
- Launch-at-login is enabled by default through Electron when the app starts.

## Manual Verification

1. Run `npm test` and confirm all tests pass.
2. Run `npm start` and confirm the black-and-gold floating editor opens.
3. Type a note, wait for the status to show `Saved`, quit from the tray, then run `npm start` again and confirm the note returns.
4. Click `Archive and clear`, confirm the editor clears, and confirm no active note content is lost if an archive error occurs in unit tests.
5. Confirm `Top` toggles always-on-top styling and `Login` toggles launch-at-login preference.
