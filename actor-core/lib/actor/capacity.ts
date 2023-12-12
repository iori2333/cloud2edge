export interface CapacityOptions<P, R> {
  preCheck?(): boolean;
  handle(payload: P): Promise<R>;
}

export interface Capacity<P, R> {
  name: string;
  preCheck(): boolean;
  handle(payload: P): Promise<R>;
}

export class Capacities {
  static create<P, R>(
    name: string,
    options: CapacityOptions<P, R>
  ): Capacity<P, R> {
    return {
      name,
      preCheck: options.preCheck ?? (() => true),
      handle: options.handle
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

// export abstract class CapacityImpl<P, R> {
//   name: string;

//   constructor(name: string, options?: CapacityOptions) {
//     this.name = name;

//     if (!this.preCheck() || (options?.preCheck && !options.preCheck())) {
//       throw new Error(`Capacity ${this.name} preCheck failed`);
//     }
//   }

//   preCheck(): boolean {
//     return true;
//   }

//   abstract handle(payload: P): Promise<R>;

//   // i -> (p -> r) -> s
//   withMappers<Q, S>(mappers: {
//     payload: (input: Q) => P;
//     result: (result: R, input: Q) => S;
//   }): Capacity<Q, S> {
//     const handler = this.handle.bind(this);
//     class NewCapacity extends Capacity<Q, S> {
//       async handle(payload: Q): Promise<S> {
//         return mappers.result(await handler(mappers.payload(payload)), payload);
//       }
//     }

//     return new NewCapacity(this.name);
//   }

//   withPayloadMapper<Q>(mapper: (input: Q) => P): Capacity<Q, R> {
//     const handler = this.handle.bind(this);
//     class NewCapacity extends Capacity<Q, R> {
//       async handle(payload: Q): Promise<R> {
//         return await handler(mapper(payload));
//       }
//     }

//     return new NewCapacity(this.name);
//   }

//   withResultMapper<S>(mapper: (input: R) => S): Capacity<P, S> {
//     const handler = this.handle.bind(this);
//     class NewCapacity extends Capacity<P, S> {
//       async handle(payload: P): Promise<S> {
//         return mapper(await handler(payload));
//       }
//     }

//     return new NewCapacity(this.name);
//   }
// }

export type AnyCapacity = Capacity<any, any>;
