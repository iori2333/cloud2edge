export interface Output<D extends string, T extends string, P> {
  to: D;
  topic: T;
  payload: P;
}

export type AnyOutput = Output<string, string, any>;
