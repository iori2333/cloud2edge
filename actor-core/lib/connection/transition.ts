import { LIVE_COMMAND } from "../utils";
import { Message } from "./messages";

export class Transition<S, P = any> {
  topic: string;
  from: S;
  to: S;
  handler?: (msg: Message<P>) => void;
  guard?: (msg: Message<P>) => boolean;

  constructor(
    message: string,
    from: S,
    to: S,
    handler?: (msg: Message<P>) => void,
    guard?: (msg: Message<P>) => boolean
  ) {
    this.topic = LIVE_COMMAND + message;
    this.from = from;
    this.to = to;
    this.guard = guard;
    this.handler = handler;
  }

  accept(topic: string, msg: Message<P>): boolean {
    return this.guard?.(msg) ?? topic == this.topic;
  }

  handle(msg: Message<P>): void {
    this.handler?.(msg);
  }
}
