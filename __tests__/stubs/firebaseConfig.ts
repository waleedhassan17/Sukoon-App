/** Test stub — no Firebase in unit tests. */
export function isFirebaseConfigured(): boolean {
  return false;
}
export async function getFirestore(): Promise<any | null> {
  return null;
}
export function getAuth(): any {
  return null;
}
