import { LIVE_COMMAND } from "../utils";
import { Message } from "./messages";

export class Transition<S> {
  topic: string;
  from: S;
  to: S;
  handler?: (msg: Message) => void;
  guard?: (msg: Message) => boolean;

  constructor(
    message: string,
    from: S,
    to: S,
    handler?: (msg: Message) => void,
    guard?: (msg: Message) => boolean
  ) {
    this.topic = LIVE_COMMAND + message;
    this.from = from;
    this.to = to;
    this.guard = guard;
    this.handler = handler;
  }

  accept(topic: string, msg: Message): boolean {
    return this.guard?.(msg) ?? topic == this.topic;
  }

  handle(msg: Message): void {
    this.handler?.(msg);
  }
}
