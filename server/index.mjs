// Produktionsserver: liefert das gebaute Dashboard aus und leitet /api/* an die
// Coriolis-App weiter. Dadurch läuft alles same-origin (kein CORS in der App
// nötig) und Owlbear Rodeo kann Token-Bilder von hier laden.
import express from "express";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const API_URL = (process.env.CORIOLIS_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "cache-control", "etag", "last-modified"];

const app = express();
app.disable("x-powered-by");

// Owlbear Rodeo lädt manifest.json, Seiten und Token-Bilder von fremder Origin.
// Authentifiziert wird ausschließlich per Bearer-Token, Cookies werden nie
// weitergereicht – ein offenes CORS ist deshalb unkritisch.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", async (req, res) => {
  const target = `${API_URL}/api${req.url}`;
  const headers = {};
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers[name];
    if (typeof value === "string") headers[name] = value;
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
    });
    res.status(upstream.status);
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error(`Proxy-Fehler für ${req.method} ${req.url}:`, error);
    res.status(502).json({ error: "Coriolis-App nicht erreichbar" });
  }
});

app.use(
  express.static(dist, {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.listen(PORT, () => {
  console.log(`Coriolis Dashboard läuft auf http://localhost:${PORT} (API: ${API_URL})`);
});
