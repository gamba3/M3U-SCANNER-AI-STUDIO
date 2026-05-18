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
  // Additional fields for card display
  serverIP?: string;
  vpn?: string;
  isAdult?: boolean;
  ping?: number;
  hostPort?: string;
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
}

export interface CheckRequest {
  portal: string;
  combo: string[]; // Format "user:pass"
  threads: number;
  proxies: string[];
  proxyType: 'http' | 'socks4' | 'socks5' | 'none';
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
  fetchCategories: boolean;
}
