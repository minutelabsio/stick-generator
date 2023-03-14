declare namespace App {
  // interface Locals { }

  interface Platform {
    env: {
      STICK_FIGURES: R2Bucket
    }
    context: {
      waitUntil(promise: Promise<any>): void
    }
    caches: CacheStorage & { default: Cache }
  }

  // interface Session { }

  // interface Stuff { }
}