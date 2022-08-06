export type CloudflareBase = {
  readonly success: boolean;
  readonly errors: readonly {
    readonly code: number;
    readonly message: string;
  }[];
};

export type CloudflareError = CloudflareBase & {
  readonly success: false;
};

export type CloudflareSuccess<T> = CloudflareBase & {
  readonly success: true;
  readonly result: readonly T[];
};

export type CloudflareResponse<T> = CloudflareSuccess<T> | CloudflareError;

export type CloudflareResource<T extends Record<string, unknown> = {}> = {
  readonly id: string;
  readonly name: string;
} & T;

export type CloudflareTunnelIngress = {
  service: string;
  hostname?: string;
  path?: string;
  originRequest?: {
    /**
     * Timeout for establishing a new TCP connection to your origin server. This
     * excludes the time taken to establish TLS, which is controlled by tlsTimeout.
     *
     * @default 10s
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#connecttimeout
     */
    connectionTimeout?: string;

    /**
     * Timeout for completing a TLS handshake to your origin server, if you have
     * chosen to connect Tunnel to an HTTPS server.
     *
     * @default 10s
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#tlstimeout
     */
    tlsTimeout?: string;

    /**
     * The timeout after which a TCP keepalive packet is sent on a connection
     * between Tunnel and the origin server.
     *
     * @default 30s
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#tcpkeepalive
     */
    tcpKeepAlive?: string;

    /**
     * Disable the “happy eyeballs” algorithm for IPv4/IPv6 fallback if your
     * local network has misconfigured one of the protocols.
     *
     * @default false
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#nohappyeyeballs
     */
    noHappyEyeballs?: boolean;

    /**
     * Maximum number of idle keepalive connections between Tunnel and your
     * origin. This does not restrict the total number of concurrent
     * connections.
     *
     * @default 100
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#keepaliveconnectionsd
     */
    keepAliveConnections?: number;

    /**
     * Timeout after which an idle keepalive connection can be discarded.
     *
     * @default 1m30s
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#keepalivetimeout
     */
    keepAliveTimeout?: string;

    /**
     * Sets the HTTP Host header on requests sent to the local service.
     *
     * @default ""
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#httphostheader
     */
    httpHostHeader?: string;

    /**
     * Hostname that cloudflared should expect from your origin server
     * certificate.
     *
     * @default ""
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#originservername
     */
    originServerName?: string;

    /**
     * Path to the certificate authority (CA) for the certificate of your
     * origin. This option should be used only if your certificate is not
     * signed by Cloudflare.
     *
     * @default ""
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#capool
     */
    caPool?: string;

    /**
     * Disables TLS verification of the certificate presented by your origin.
     * Will allow any certificate from the origin to be accepted.
     *
     * @default false
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#notlsverify
     */
    noTLSVerify?: boolean;

    /**
     * Disables chunked transfer encoding. Useful if you are running a Web
     * Server Gateway Interface (WSGI) server.
     *
     * @default false
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#disablechunkedencoding
     */
    disableChunkedEncoding?: boolean;

    /**
     * cloudflared starts a proxy server to translate HTTP traffic into TCP when
     * proxying, for example, SSH or RDP. This configures the listen address for
     * that proxy.
     *
     * @default 127.0.0.1
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#proxyaddress
     */
    proxyAddress?: string;

    /**
     * cloudflared starts a proxy server to translate HTTP traffic into TCP when
     * proxying, for example, SSH or RDP. This configures the listen port for
     * that proxy. If set to zero, an unused port will randomly be chosen.
     *
     * @default 0
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#proxyport
     */
    proxyport?: number;

    /**
     * cloudflared starts a proxy server to translate HTTP traffic into TCP when
     * proxying, for example, SSH or RDP. This configures what export type of proxy
     * will be started.
     *
     * @default ""
     * @see https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/#proxyType
     */
    proxyType?: string | 'socks';
  };
};

export type CloudflareTunnelConfig = {
  tunnel: string;
  'credentials-file': string;
  metrics: string;
  'no-autoupdate': boolean;
  loglevel?: string;
  ingress: ReadonlyArray<CloudflareTunnelIngress>;
};
