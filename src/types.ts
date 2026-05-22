export interface HitResult {
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
  // File paths for backend storage
  miniHitsFile?: string;
  fullHitsFile?: string;
  // Display fields
  serverIP?: string;
  vpn?: string;
  isAdult?: boolean;
  ping?: number;
  hostPort?: string;
  // SILENTGHOST2025 fields
  country?: string;
  isp?: string;
  panelType?: string;
  epgUrl?: string;
  serverProtocol?: string;
  rtmpPort?: string;
  serverLoad?: string;
  timeNow?: string;
  httpsPort?: string;
  allowedFormats?: string[];
  isTrial?: boolean;
  maxConnections?: number;
}

export interface ProgressState {
  processed: number;
  total: number;
  hits: number;
  bad: number;
  cpm: number;
  percent: number;
  proxyErrors: number;
  statusCode?: number;
  currentUser?: string;
  currentPass?: string;
  // SILENTGHOST2025 progress fields
  eta?: number;
  proxyPoolSize?: number;
  deadProxies?: number;
}

export interface CheckRequest {
  portal: string;
  combo: string[]; // Format "user:pass"
  threads: number;
  proxies: string[];
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
  fetchCategories: boolean;
}
