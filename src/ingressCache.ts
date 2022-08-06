export type HostInformation = {
  readonly namespace: string;
  readonly hostname: string;
  readonly discoverableByCf: boolean;
  readonly ingressName: string;
};

const ingressMap = new Map<string, HostInformation>();

/**
 *
 * @param a Original List
 * @param b New List
 * @returns diff of lists
 */
const diffList = <T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>) => ({
  added: b.filter((value) => !a.includes(value)),
  removed: a.filter((value) => !b.includes(value)),
  same: a.filter((element) => b.indexOf(element) !== -1),
});

export const putIngressCache = (metadata: HostInformation) => {
  console.log(`Add [${metadata.hostname}] to cache`);
  ingressMap.set(metadata.hostname, metadata);
};

export const getIngressCache = (
  hostname: string
): HostInformation | undefined => ingressMap.get(hostname);

export const removeIngressCache = (hostname: string) => {
  console.log(`Remove [${hostname}] from cache`);
  ingressMap.delete(hostname);
};

export const getAllIngressCache = (): ReadonlyArray<HostInformation> =>
  // eslint-disable-next-line total-functions/no-unsafe-mutable-readonly-assignment
  Array.from(ingressMap.values()) as ReadonlyArray<HostInformation>;

export const getAllDiscoverableHosts = (): ReadonlyArray<HostInformation> =>
  // eslint-disable-next-line total-functions/no-unsafe-mutable-readonly-assignment
  getAllIngressCache().filter(({ discoverableByCf }) => discoverableByCf);

export const overrideIngresCacheList = (
  metadata: ReadonlyArray<HostInformation>,
  ingressName: string
) => {
  // eslint-disable-next-line total-functions/no-unsafe-mutable-readonly-assignment
  const ingresses = getAllIngressCache().filter(
    ({ ingressName: name }) => name === ingressName
  ) as ReadonlyArray<HostInformation>;

  const diff = diffList(ingresses, metadata);
  console.log(metadata);

  [...diff.added, ...diff.same].forEach(putIngressCache);
  diff.removed.map(({ hostname }) => hostname).forEach(removeIngressCache);
};
