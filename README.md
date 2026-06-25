# Tomorrow Desk

Tomorrow Desk is a small Windows Electron app for writing tomorrow's handoff note before shutdown and showing it again as a floating desktop window after login.

## Commands

- `npm install`
- `npm test`
- `npm start`

## v1 Behavior

- Notes are stored locally in Electron's user data directory.
- The app autosaves while typing.
- The main window is black-and-gold, always-on-top by default, draggable, and resizable.
- Closing the window hides it to the system tray.
- Launch-at-login is enabled by default through Electron when the app starts.
