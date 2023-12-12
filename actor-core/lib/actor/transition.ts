import { Message } from "./protocol";

export interface Transition<I extends string, S, P> {
  topic: I;
  from?: S;
  to?: S;
  handler?: (msg: Message<P>) => Promise<void> | void;
  guard?: (msg: Message<P>) => boolean;
}

export class Transitions {
  static create<I extends string, S, P>(
    opts: Transition<I, S, P>
  ): WrappedTransition<I, S, P> {
    return {
      topic: opts.topic,
      from: opts.from,
      to: opts.to,
      accept(msg) {
        return opts.guard?.(msg) ?? msg.topic == this.topic;
      },
      async handle(msg) {
        const obj = opts.handler?.(msg);
        if (obj instanceof Promise) {
          await obj;
        }
      }
    };
  }
}

interface WrappedTransition<I extends string, S, P> {
  topic: I;
  from?: S;
  to?: S;
  accept(msg: Message<P>): boolean;
  handle(msg: Message<P>): Promise<void>;
}

export type AnyTransition<S> = Transition<string, S, any>;
export type AnyWrappedTransition<S> = WrappedTransition<string, S, any>;
