# Shift Report Form

A shift-report form for factory workers: name/shift, a required photo, four voice-or-typed
fields, and an optional "Clean up with AI" pass on the text before submitting.

## Local development
```
npm install
npm run dev
```

## The AI cleanup feature
"Clean up with AI" calls `/api/cleanup`, a Cloudflare Pages Function in
`functions/api/cleanup.js` that holds the Anthropic API key server-side. Until you set the
`ANTHROPIC_API_KEY` secret in your Cloudflare Pages project, this button will just fail
quietly — typed/dictated text still works fine everywhere else.

## Deploy
Push to GitHub, then connect the repo in the Cloudflare Pages dashboard. Build command
`npm run build`, output directory `dist`. See chat for the full walkthrough.
