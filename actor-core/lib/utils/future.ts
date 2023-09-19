export class Future<T> {
  resolveFn: (value: T | PromiseLike<T>) => void;
  rejectFn: (reason?: any) => void;
  timeout?: NodeJS.Timeout;

  constructor(
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    timeout?: number
  ) {
    this.resolveFn = resolve;
    this.rejectFn = reject;
    if (timeout != undefined) {
      this.timeout = setTimeout(() => {
        this.reject(new Error("Request timed out"));
      }, timeout);
    }
  }

  resolve(value: T | PromiseLike<T>): void {
    clearTimeout(this.timeout);
    this.resolveFn(value);
  }

  reject(reason?: any): void {
    clearTimeout(this.timeout);
    this.rejectFn(reason);
  }
}

export function genCorrId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
