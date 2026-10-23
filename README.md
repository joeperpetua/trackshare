# TrackShare

Turn a music link into a square image worth posting.

Paste a link to a song, an album or a playlist, and TrackShare gives you a 1080 × 1080 image with the cover art, the title and the artists, coloured to match the artwork. Download it, copy it, or send it straight to the app you want to share in.

## How to use it

1. **Paste a link.** Anything you copied from a music app. The Paste button fills the field for you.
2. **Press Create image.** The card appears on the right, usually in a second or two.
3. **Change anything you like.** Edit the title and the artist names, and pick the colours.
4. **Take it with you.** Download the PNG, copy the image to your clipboard, or use Share to send it to another app.

There are no accounts and nothing to sign up for. Your link goes to the server so it can fetch the details and draw the image, which is kept briefly so that asking again is fast. TrackShare also keeps a count of which songs, albums and playlists get made into cards, so it can show what is popular. The same song counts as one whichever service you shared it from. No account, device details or IP address are stored with it.

## Supported Services

| Service | Songs | Albums | Playlists |
|---|---|---|---|
| Spotify | yes | yes | yes |
| YouTube and YouTube Music | yes | yes | yes |
| Apple Music | yes | yes | yes |
| Deezer | yes | yes | yes |
| SoundCloud | yes | no | yes |
| TIDAL, Amazon Music, Bandcamp | yes | yes | usually |

Short links work, so a `spotify.link` or `on.soundcloud.com` address is fine. You can also paste a whole message such as "Listen on Spotify: https://..." and TrackShare will find the link inside it.

The link has to be public. If a playlist is private, the app cannot see it either.

## Customization

**The words.** The title and the artist names are yours to change. Fix a messy title, shorten a long list of features, or write something else entirely. Reset puts the original values back.

**The colours.** Auto reads the artwork and builds the card around its strongest colour, going light or dark depending on the cover. Light and Dark override that if you want something plainer. The page itself changes colour along with the card, so you can see how it will look.

**The badge.** A small tick appears on the card when the title and names are exactly what the music service returned. Edit either of them and the tick goes away,this is to be authentic with the artist and track while allowing extra tweaking.

## On your phone

On Android, install TrackShare from Chrome and it joins your share sheet. From then on you can hit Share in Spotify or any other music app, pick TrackShare, and the card is waiting for you when it opens. On iPhone it works as a normal web page: copy the link and paste it in.

## Good to know

- Works on most languages, if you find an a problem, create an issue [here](https://github.com/joeperpetua/trackshare/issues/new).
- Covers and names come from the music service, so if something is wrong there, it will be wrong here too. That is what the editing is for.

## Running it locally

You need Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

No accounts or keys are needed. Three optional settings go in a `.env` file, copied from `.env.example`: `SITE_DOMAIN` sets the address printed on the card, `YOUTUBE_API_KEY` adds song counts to YouTube playlists and gives YouTube albums a square cover instead of a cropped video thumbnail, and `DATABASE_URL` points at a Postgres database where every card made, downloaded, copied or shared is recorded. Without it nothing is recorded. The tables are created the first time something is recorded.

## API 
The app also answers at `/api/resolve?url=...` with the details it found, and `/api/card?url=...` with the image itself, if you would rather drive it from somewhere else.
