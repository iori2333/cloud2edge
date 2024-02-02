export interface CapacityOptions<P, R> {
  preCheck?(): boolean;
  handle(payload: P): Promise<R>;
}

export type CapacityHandler<P, R> = (payload: P) => Promise<R>;

export interface Capacity<P, R> {
  name: string;
  preCheck(): boolean;
  handle(payload: P): Promise<R>;
}

export class Capacities {
  static create<P, R>(
    name: string,
    options: CapacityOptions<P, R> | CapacityHandler<P, R>
  ): Capacity<P, R> {
    if (typeof options === "function") {
      return {
        name,
        preCheck: () => true,
        handle: options
      };
    }

    return {
      name,
      preCheck: options.preCheck?.bind(options) ?? (() => true),
      handle: options.handle.bind(options)
    };
  }

  static withMapper<P, R, Q, S>(
    self: Capacity<P, R>,
    mappers: {
      payload: (input: Q) => P;
      result: (result: R, input: Q) => S;
      error?: (reason: any, input: Q) => S;
    }
  ): Capacity<Q, S> {
    return {
      ...self,
      handle: async (payload: Q) => {
        try {
          const result = await self.handle(mappers.payload(payload));
          return mappers.result(result, payload);
        } catch (e) {
          if (mappers.error) {
            return mappers.error(e, payload);
          }
          throw e;
        }
      }
    };
  }

  static withPayloadMapper<P, R, Q>(
    self: Capacity<P, R>,
    mapper: (input: Q) => P
  ): Capacity<Q, R> {
    return {
      ...self,
      handle: async (payload: Q) => await self.handle(mapper(payload))
    };
  }

  static withResultMapper<P, R, S>(
    self: Capacity<P, R>,
    mapper: (result: R) => S,
    errorMapper?: (reason: any) => S
  ): Capacity<P, S> {
    return {
      ...self,
      handle: async (payload: P) => {
        try {
          return mapper(await self.handle(payload));
        } catch (e) {
          if (errorMapper) {
            return errorMapper(e);
          }
          throw e;
        }
      }
    };
  }

  static withPreCheck<P, R>(
    self: Capacity<P, R>,
    preCheck: () => boolean
  ): Capacity<P, R> {
    return {
      ...self,
      preCheck: () => self.preCheck() && preCheck()
    };
  }
}

export type AnyCapacity = Capacity<any, any>;
