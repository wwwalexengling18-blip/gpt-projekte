# Alex File Bridge – Veröffentlichung

## 1. Cloudflare

1. Cloudflare-Konto verwenden.
2. R2 aktivieren.
3. Bucket **alex-file-bridge** anlegen.
4. Wrangler installieren und anmelden:
   npm install -g wrangler
   wrangler login

## 2. Secret setzen

npx wrangler secret put ADMIN_TOKEN

Das Token wird verschlüsselt als Secret gespeichert und nicht im Repository abgelegt.

## 3. Deploy

Im Ordner alex-file-bridge:

npx wrangler deploy

## 4. URLs

Direkter ZIP-/Datei-Download:
https://DEINE-DOMAIN/f/DATEI.zip

Inline-Video:
https://DEINE-DOMAIN/v/VIDEO.mp4

Die Upload-API ist nicht öffentlich nutzbar ohne Authorization: Bearer <ADMIN_TOKEN>.

## 5. Realität beim "ohne Limit"

Der Code setzt kein kleines künstliches Dateilimit. Ein wirklich unbegrenzter Dienst existiert jedoch nicht; R2 und Cloudflare haben abhängig vom Tarif Nutzungs-, Speicher-, Request- und Kostenbedingungen.
