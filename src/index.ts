import { getAllIngressCache } from './ingressCache';
/* eslint-disable total-functions/no-unsafe-mutable-readonly-assignment */
import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  V1ConfigMap,
  V1Ingress,
  Watch,
} from '@kubernetes/client-node';
import axios from 'axios';
import { cleanEnv, str } from 'envalid';
import { filter, map } from 'fp-ts/lib/ReadonlyArray';
import { pipe } from 'fp-ts/lib/function';
import { groupBy } from 'fp-ts/lib/ReadonlyNonEmptyArray';
import { fromEntries, toEntries } from 'fp-ts/lib/ReadonlyRecord';
import {
  CloudflareResponse,
  CloudflareResource,
  CloudflareTunnelConfig,
} from './cloudflareModel';

import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import {
  getAllDiscoverableHosts,
  overrideIngresCacheList,
  removeIngressCache,
} from './ingressCache';

const env = cleanEnv(process.env, {
  CLOUDFLARE_TOKEN: str({}),
  CLOUDFLARE_ACCOUNT_ID: str({}),
  CLOUDFLARED_CONFIG_CM: str({}),
  NAMESPACE: str({}),
  INGRESS_SERVICE: str({}),
  CLOUDFLARED_DAEMON_SET: str({}),
});

const tunnelBaseName = 'cfargotunnel.com';

const cloudflare = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { Authorization: `Bearer ${env.CLOUDFLARE_TOKEN}` },
});

const kc = new KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(CoreV1Api);
const appsApi = kc.makeApiClient(AppsV1Api);

const getConfigMap = async (cmName: string) =>
  coreApi.readNamespacedConfigMap(cmName, env.NAMESPACE);

const updateConfigMap = async (cm: V1ConfigMap) => {
  await coreApi.patchNamespacedConfigMap(
    cm.metadata!.name!,
    cm.metadata!.namespace!,
    cm,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      headers: {
        'content-type': 'application/strategic-merge-patch+json',
      },
    }
  );
};

const configToJson = (config: string): CloudflareTunnelConfig =>
  loadYaml(config, { json: true }) as CloudflareTunnelConfig;

const jsonToConfig = (config: CloudflareTunnelConfig) => dumpYaml(config);

const fetchTunnelInformation = async (tunnelName: string) =>
  cloudflare.get<CloudflareResponse<CloudflareResource>>(
    `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel?name=${tunnelName}`
  );

const cfIngressMapping =
  (service: string, hosts: Array<string>) =>
  (config: CloudflareTunnelConfig): CloudflareTunnelConfig => ({
    ...config,
    ingress: [
      ...hosts.map((hostname): CloudflareTunnelConfig['ingress'][0] => ({
        hostname,
        service,
        originRequest: {
          httpHostHeader: hostname,
          noTLSVerify: true,
        },
      })),
      { service: 'http_status:404' },
    ],
  });

const fetchZoneInformation = async (zoneName: string) =>
  cloudflare.get<CloudflareResponse<CloudflareResource>>(
    `zones?name=${zoneName}`
  );

const fetchDnsRecordInformation =
  (zoneId: string) => async (recordName: string) =>
    cloudflare.get<CloudflareResponse<CloudflareResource<{ type: string }>>>(
      `zones/${zoneId}/dns_records?name=${recordName}`
    );

const addRecord = (zoneId: string, recordName: string, cname: string) =>
  cloudflare.post(`/zones/${zoneId}/dns_records`, {
    type: 'CNAME',
    name: recordName,
    content: cname,
    ttl: 300,
    proxied: true,
  });

const updateRecord = (zoneId: string, recordId: string, cname: string) =>
  cloudflare.patch(`/zones/${zoneId}/dns_records/${recordId}`, {
    content: cname,
  });

const deleteRecord = (zoneId: string, recordId: string) =>
  cloudflare.delete(`/zones/${zoneId}/dns_records/${recordId}`);

const rootZoneGroups = (
  hosts: Required<Required<V1Ingress>['spec']>['rules']
) =>
  pipe(
    hosts,
    map(({ host }) => host),
    filter((host): host is string => host !== undefined),
    map((host) => [/[A-z0-9]+\.[A-z0-9]+$/u.exec(host)?.[0], host] as const),
    filter(
      (entry): entry is readonly [string, string] => entry[0] !== undefined
    ),
    groupBy(([rootZone]) => rootZone),
    toEntries,
    map(
      (groupOfHosts) =>
        [groupOfHosts[0], groupOfHosts[1].map(([, host]) => host)] as const
    ),
    fromEntries
  );

const handler = async (
  phase: 'ADDED' | 'MODIFIED' | 'DELETED',
  ingress: V1Ingress
  // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
  console.log(`${ingress.metadata?.name} - Kubernetes: ${phase}`);

  const tunnelName =
    ingress.metadata?.annotations?.['cloudflare.com/tunnel-name'];

  console.log(`${ingress.metadata?.name} set to use tunnel ${tunnelName}`);

  const zones = rootZoneGroups(ingress.spec?.rules ?? []);
  // eslint-disable-next-line total-functions/no-unsafe-mutable-readonly-assignment
  const rootZoneNames: readonly string[] = Object.keys(zones);

  if (phase === 'DELETED') {
    rootZoneNames.map(removeIngressCache);
  } else {
    overrideIngresCacheList(
      Object.entries(zones).flatMap(([_, hosts]) =>
        hosts.map((hostname) => ({
          hostname,
          namespace: ingress.metadata!.namespace!,
          ingressName: ingress.metadata!.name!,
          discoverableByCf: tunnelName !== undefined,
        }))
      ),
      ingress.metadata!.name!
    );
  }

  if (tunnelName !== undefined && ingress.spec?.rules !== undefined) {
    // eslint-disable-next-line total-functions/no-unsafe-mutable-readonly-assignment
    const validZones: readonly CloudflareResource[] = (
      await Promise.all(
        rootZoneNames.map(
          async (rootZoneName): Promise<CloudflareResource | undefined> => {
            const zoneInfo = await fetchZoneInformation(rootZoneName);

            return zoneInfo.data.success ? zoneInfo.data.result[0] : undefined;
          }
        )
      )
    ).filter(
      (resource): resource is CloudflareResource => resource !== undefined
    );

    const hosts = Object.entries(zones).reduce<
      Record<string, readonly string[]>
    >((acc, curr) => {
      const zone = validZones.find((value) => value.name === curr[0]);

      return zone !== undefined ? { ...acc, [zone.id]: curr[1] } : acc;
    }, {});

    console.log(
      `Determined lists of hosts that match valid zones ${JSON.stringify(
        hosts
      )}`
    );

    const tunnelInfo = await fetchTunnelInformation(tunnelName);

    if (
      tunnelInfo.data.success &&
      tunnelInfo.data.result[0]?.id !== undefined
    ) {
      const tunnelId = tunnelInfo.data.result[0].id;
      const tunnelHostName = `${tunnelId}.${tunnelBaseName}`;

      console.log(`Found tunnel hostname ${tunnelHostName}`);

      const dnsRecordInformation = await Promise.all(
        Object.entries(hosts).map(
          async ([zoneId, domains]) =>
            [
              zoneId,
              await Promise.all(
                domains.map(
                  async (host: string) =>
                    [
                      host,
                      await fetchDnsRecordInformation(zoneId)(host),
                    ] as const
                )
              ),
            ] as const
        )
      );

      if (phase === 'DELETED') {
        await Promise.all(
          dnsRecordInformation.map(async ([zoneId, hosts]) =>
            Promise.all(
              hosts.map(async ([, response]) => {
                if (response.data.success) {
                  await Promise.all(
                    response.data.result
                      .filter((value) => value.type === 'CNAME')
                      .map(async ({ id }) => deleteRecord(zoneId, id))
                  );
                }
              })
            )
          )
        );
      } else {
        await Promise.all(
          dnsRecordInformation.map(async ([zoneId, hosts]) =>
            Promise.all(
              hosts.map(async ([hostname, response]) => {
                if (response.data.success) {
                  await Promise.all(
                    response.data.result
                      .filter((value) => value.type === 'CNAME')
                      .map(async ({ id }) => {
                        {
                          await updateRecord(zoneId, id, tunnelHostName);
                          console.log(
                            `Updated record for [${hostname}] to point at [${tunnelHostName}]`
                          );
                        }
                      })
                  );

                  if (
                    !response.data.result.some(
                      (value) => value.type === 'CNAME'
                    )
                  ) {
                    await addRecord(zoneId, hostname, tunnelHostName);
                    console.log(
                      `Created record for [${hostname}] to point at [${tunnelHostName}]`
                    );
                  }
                }
              })
            )
          )
        );
      }
    }

    const configMap = await getConfigMap(env.CLOUDFLARED_CONFIG_CM);

    await updateConfigMap({
      ...configMap.body,
      data: {
        ['config.yaml']: pipe(
          configToJson(configMap.body.data!['config.yaml']!),
          cfIngressMapping(
            env.INGRESS_SERVICE,
            getAllDiscoverableHosts().map(({ hostname }) => hostname)
          ),
          jsonToConfig
        ),
      },
    });

    await appsApi.patchNamespacedDaemonSet(
      env.CLOUDFLARED_DAEMON_SET,
      env.NAMESPACE,
      {
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
              },
            },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: {
          'content-type': 'application/strategic-merge-patch+json',
        },
      }
    );
  }
};

const errorFn = (err: unknown): void => {
  if (err !== null && err !== undefined) {
    console.error(`Watcher Error:`, err);
  }

  // watcher(kc);
};

const watcher = async (kc: KubeConfig) => {
  const watch = new Watch(kc);
  await watch
    .watch(
      '/apis/networking.k8s.io/v1/ingresses',
      { allowWatchBookmarks: true },
      // @ts-ignore
      handler,
      errorFn
    )
    .catch((e) => console.log(e));

  console.info('Watcher completed');
};

process.on('SIGTERM', () => {
  console.info(`Received shutdown command`);
});

watcher(kc);
