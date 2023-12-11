import { Message } from "./protocol";

interface TransitionOptions<S, P> {
  from?: S;
  to?: S;
  handler?: (msg: Message<P>) => void;
  guard?: (msg: Message<P>) => boolean;
}

export class Transition<I extends string, S, P> {
  topic: string;
  from?: S;
  to?: S;
  handler?: (msg: Message<P>) => void;
  guard?: (msg: Message<P>) => boolean;

  constructor(topic: I, options?: TransitionOptions<S, P>) {
    this.topic = topic;
    this.from = options?.from;
    this.to = options?.to;
    this.guard = options?.guard;
    this.handler = options?.handler;
  }

  accept(msg: Message<P>): boolean {
    return this.guard?.(msg) ?? msg.topic == this.topic;
  }

  handle(msg: Message<P>): void {
    this.handler?.(msg);
  }
}

export type AnyTransition<S> = Transition<string, S, any>;
