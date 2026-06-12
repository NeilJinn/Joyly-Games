# Joyly Games Prototype

This is a local first-version prototype for Joyly Games, a web-based party game platform.

The prototype supports:

- Host sign-in mockup
- Payment before room creation
- Pop-up game picker
- Room code and QR join link
- Homepage room-code entry
- Phone player join with nickname and emoji avatar
- Live lobby updates
- Steam-style game store
- Simulated time-pass checkout
- Payment card with time pass, remaining points, and point-pack options
- Active time pass reuse, so hosts can create another room without paying again before the timer ends
- Host room recovery by account email
- Close room action
- Icon-led controls for primary actions and account menu items
- Playable Cosmic Trivia game for 2-8 players
- Test game button that adds virtual ready players for quick game testing
- Light sci-fi character selection for players
- Manual host launch after every joined player is ready
- Big-screen trivia questions, answer reveals, and live scores
- Phone-based multiple-choice answering

## How To Test Locally

1. Start the prototype:

```bash
node server.js
```

2. Open the big-screen host page on the computer:

```text
http://localhost:4173
```

3. Make sure the phone is on the same Wi-Fi as the computer.

4. On the phone, scan the QR code shown in the lobby.

If the QR image does not load, manually open the phone URL shown under the QR code.

If the page updates but the game library still does not show `Cosmic Trivia`, an older `node server.js` process is still running. Stop the old terminal process with `Ctrl+C`, then start `node server.js` again. The `/api/config` response should list `cosmic-trivia` as `playable`.

## Prototype Flow

1. Host opens the website on a TV or computer.
2. Host signs in with the mock account form.
3. Host chooses a game from the pop-up game picker.
4. Host opens the payment card.
5. Host chooses a time pass, uses remaining points, or buys points.
6. If the host already has an active time pass, the site skips the payment card and creates the room immediately.
7. The site creates a room and binds it to the host email.
8. The room displays a room code, QR code, and join link.
9. Players join from phones using the QR code or the homepage room-code input.
10. Players choose a nickname and character.
11. Player phones can return home, exit the room, or enter another room code.
12. The big screen updates as players join and become ready.
13. Host can sign in with the same email on a phone to recover the active room.
14. When 2-8 players are ready, the host clicks `Launch now`.
15. Joyly loads the selected game package, and Cosmic Trivia starts selecting its question deck.
16. Players answer questions on their phones while the big screen shows the stage and scores.
17. Host can close the room from the room controls or account menu.

For quick testing, create a room and click `Test game` in the lobby. The room adds virtual ready players until the selected game's minimum player count is met. Then click `Launch now`.

## Project Structure

The prototype now separates platform files from individual games.

Platform:

- `public/platform/`: website/platform screens before a game starts, including home, game library, room setup, payment, lobby, shared host controls, shared phone room states, platform styles, and browser-side helpers.
- `public/players/`: shared player profile UI, including avatar choices and avatar tokens.
- `server.js`: generic room, host, player, payment, event, and static file API shell.
- `server/platform/game-catalog.js`: platform-side game registry. Add future games here when they are ready to appear in the store.
- `server/players/`: shared player profile data and normalization.

Games:

- `public/games/cosmic-trivia/`: Cosmic Trivia client UI, character choices, phone answer UI, and game-specific visual direction.
- `server/games/cosmic-trivia.js`: Cosmic Trivia runtime facade, scoring, public state, and Game Director integration.
- `server/games/cosmic-trivia/content-loader.js`: Loads question-pack manifests and only the selected question JSON files.
- `server/games/cosmic-trivia/question-selector.js`: Builds a weighted round from player category and tag preferences.
- `content/games/cosmic-trivia/question-packs/`: Trivia content files. Add new question packs, topics, question JSON files, and future audio references here without editing platform logic.

Shared concepts between website and games:

- Room code and room status
- Host account information
- Player identity and selected character/avatar key
- Payment entitlement and points/time-pass information

Game-specific concepts stay inside each game folder:

- Art direction and in-game layout
- Question/rule logic
- In-game phone controls
- Score reveal and round progression

## Trivia Content Model

Each Trivia question is a standalone JSON file with:

- `id`
- `category`
- `tags`
- `difficulty`
- `question`
- `answers`
- `correctAnswer`
- `questionAudio`

Question-pack manifests index metadata only. The game uses the manifest to select a weighted round, then loads only the chosen question files. Audio paths are included in the selected game state so the client can load the current question audio and preload the next question's audio.

The Cosmic Trivia Game Director starts only after the host launches the game package. It currently runs these phases automatically:

`deck-selecting` -> `question-intro` -> `question-audio` -> `answering` -> `scoring` -> `next-question` -> `complete`

## Product Direction

The platform is designed for international users first, so the first interface is in English.

Current prototype payment options:

- 1 hr: 29 kr
- 2 hrs: 39 kr
- 4 hrs: 59 kr

Future payment model:

- Time pass: buy a fixed amount of play time.
- Credits: buy a credit pack and spend credits per game round.

Account model:

- Host needs an account because purchases and order history belong to the host.
- Players do not need accounts. They join with a nickname.

## Next Build Phases

1. Replace mock sign-in with real host accounts.
2. Replace simulated payment with Stripe or another payment provider.
3. Add room expiration, reconnect behavior, and host controls.
4. Add admin tools for managing games, prices, and availability.
5. Build the first real playable game module.
6. Add multilingual support, starting with Chinese.
