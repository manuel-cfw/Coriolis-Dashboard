# Coriolis Dashboard – Owlbear-Rodeo-Erweiterung

Crew-Dashboard für **Coriolis – Der Dritte Horizont**. Die Erweiterung holt die Charaktere aus der
[Coriolis-App](https://github.com/manuel-cfw/Coriolis-DerDritteHorizont), zeigt sie in Owlbear Rodeo an
und setzt sie als Token auf die Karte – inklusive HP- und Willenskraft-Balken, die sich automatisch mit
der App abgleichen.

Design: Canva-Ordner **Coriolis** → „Coriolis Dashboard UI“ (Hauptansicht, GM-Einstellungen, Login),
umgesetzt mit den Tokens des Coriolis Design Systems (Void-Schwarz, Gold, Teal, Cinzel/Inter/IBM Plex Mono).

## Funktionen

| Bereich | Was es tut |
|---|---|
| **Login** | Anmeldung mit dem Konto der Coriolis-App (gleicher Login, JWT). |
| **Infoleiste oben** | Gruppe, Schiff (Rumpf/Energie), Dunkelheitspunkte, Sitzung, Ort, Spielzeit, Ikone, Lage. |
| **Aktive Crew links** | Charaktere, die gerade mitspielen: Portrait, HP/WK, Strahlung, kritische Verletzungen, Token-Status, ob der Spieler im Raum ist. |
| **Charakteransicht** | Attribute, Fertigkeiten, Waffen, Rüstung, Talente, Verletzungen, Ausrüstung. HP/WK/Strahlung per +/− ändern. |
| **In Owlbear übertragen** | Setzt den Charakter als Token (Portrait aus der App) in die Bildmitte, mit Name und HP-/WK-Balken. |
| **Alle Charaktere** | Jeder sieht alle Charaktere der verknüpften Gruppe. |
| **HUD über der Karte** | Infoleiste und Crew-Leiste schweben dauerhaft über der Karte (pro Spieler ein-/ausblendbar, Position einstellbar). |
| **Kontextmenü** | Rechtsklick auf einen Charakter-Token → „Coriolis-Charakter öffnen“. |
| **GM-Einstellungen** | Nur für den Owlbear-GM, siehe unten. |

### GM-Einstellungen (Owlbear-GM = Spielleiter)

- **Gruppe verknüpfen** – welche Gruppe aus der Coriolis-App zu diesem Owlbear-Raum gehört
- **Aktive Crew** auswählen, optional automatisch alle Charaktere mit Token in der Szene
- **Dunkelheitspunkte** +/− (schreibt direkt in die App) und ob Spieler sie sehen
- **Szene, Ort, Spielzeit, Ikone, Lage** für die Infoleiste
- **Infoleiste konfigurieren** – welche Felder sichtbar sind, HUD standardmäßig an/aus
- **Token-Einstellungen** – Größe, Ebene, Name, HP/WK-Balken, Balken nur für GM
- **Rechte der Spieler** – Tokens setzen, eigene Werte ändern
- **Synchronisation** – Auto-Abgleich (Intervall), jetzt synchronisieren, alle Tokens entfernen

Alle Raum-Einstellungen liegen in den Owlbear-Raum-Metadaten und gelten für alle Spieler.
Der automatische Abgleich läuft nur beim GM, damit nicht alle Clients gleichzeitig schreiben.

## Architektur

```
Owlbear Rodeo ──iframe──▶ Coriolis Dashboard (dieses Repo, Node/Express)
                            ├─ /index.html       Aktions-Popover (Dashboard)
                            ├─ /hud-top.html     Infoleiste über der Karte
                            ├─ /hud-crew.html    Crew-Leiste über der Karte
                            ├─ /background.html  HUD, Kontextmenü, Auto-Sync
                            └─ /api/*  ──Proxy──▶ Coriolis-App (CORIOLIS_API_URL)
```

Der Dashboard-Server leitet `/api/*` an die Coriolis-App weiter. Dadurch läuft alles same-origin –
**an der Coriolis-App muss nichts geändert werden** (kein CORS), und Owlbear kann die Portraits über
`/api/characters/:id/image` als Token-Bild laden. Weitergereicht wird nur der Bearer-Token, keine Cookies.

Voraussetzung: Spieler müssen in der Coriolis-App Mitglied der verknüpften Gruppe sein. Der GM braucht
dort die Rolle Spielleiter, um Dunkelheitspunkte und fremde Charaktere zu ändern.

## Deployment mit Coolify

1. Neue Ressource → Application → Dockerfile, Repository `manuel-cfw/Coriolis-Dashboard`.
2. Port **8080**.
3. Umgebungsvariable `CORIOLIS_API_URL=https://coriolis.seemeyer.com` (oder die Dev-Instanz).
4. Domain vergeben, z. B. `https://coriolis-dashboard.seemeyer.com`, deployen.

## In Owlbear Rodeo einbinden

1. Owlbear Rodeo → Profil → **Erweiterungen** → **Benutzerdefinierte Erweiterung hinzufügen**.
2. URL: `https://<deine-domain>/manifest.json`
3. Im Raum unter Erweiterungen „Coriolis Dashboard“ aktivieren.
4. Als GM das Dashboard öffnen (Fadenkreuz-Symbol oben), anmelden, unter **GM** die Gruppe verknüpfen.

## Lokale Entwicklung

```bash
npm install
CORIOLIS_API_URL=http://localhost:3001 npm run dev   # Vite auf http://localhost:5174
```

In Owlbear `http://localhost:5174/manifest.json` als Erweiterung hinzufügen. Außerhalb von Owlbear
öffnet sich das Dashboard im Vorschaumodus (GM-Ansicht ohne Token-Funktionen, Einstellungen im
localStorage).

```bash
npm run build                                         # Typecheck + Build nach dist/
CORIOLIS_API_URL=https://coriolis.seemeyer.com npm start   # Produktionsserver auf :8080
```
