interface CapacityOptions {
  preCheck?: () => boolean;
}

export abstract class Capacity<P, R> {
  name: string;

  constructor(name: string, options?: CapacityOptions) {
    this.name = name;

    if (!this.preCheck() || (options?.preCheck && !options.preCheck())) {
      throw new Error(`Capacity ${this.name} preCheck failed`);
    }
  }

  preCheck(): boolean {
    return true;
  }

  abstract handle(payload: P): Promise<R>;

  // i -> (p -> r) -> s
  withMappers<Q, S>(mappers: {
    payload: (input: Q) => P;
    result: (result: R, input: Q) => S;
  }): Capacity<Q, S> {
    const handler = this.handle.bind(this);
    class NewCapacity extends Capacity<Q, S> {
      async handle(payload: Q): Promise<S> {
        return mappers.result(await handler(mappers.payload(payload)), payload);
      }
    }

    return new NewCapacity(this.name);
  }

  withPayloadMapper<Q>(mapper: (input: Q) => P): Capacity<Q, R> {
    const handler = this.handle.bind(this);
    class NewCapacity extends Capacity<Q, R> {
      async handle(payload: Q): Promise<R> {
        return await handler(mapper(payload));
      }
    }

    return new NewCapacity(this.name);
  }

  withResultMapper<S>(mapper: (input: R) => S): Capacity<P, S> {
    const handler = this.handle.bind(this);
    class NewCapacity extends Capacity<P, S> {
      async handle(payload: P): Promise<S> {
        return mapper(await handler(payload));
      }
    }

    return new NewCapacity(this.name);
  }
}

export type AnyCapacity = Capacity<any, any>;
