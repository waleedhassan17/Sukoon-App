/** Test stub — cloud sync is a no-op in unit tests. */
export const DataSyncService = {
  async pushToCloud(_domain: string, _key: string, _data: any): Promise<void> {},
  async pullFromCloud<T>(_domain: string, _key: string): Promise<T | null> {
    return null;
  },
};
