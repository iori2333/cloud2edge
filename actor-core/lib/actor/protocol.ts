import { ContentType, LIVE_COMMAND, genCorrId } from "../utils";

export interface DittoHeaders {
  topic: string;
  path: string;
  headers: Record<string, unknown>;
}

export interface DittoProtocol<P> extends DittoHeaders {
  value: P;
  status?: number;
}

export interface Protocol {
  to: string;
  topic: string;
}

export type Message<P> = Protocol & { payload: P };

export type TellMessage<P> = Message<P>;
export type AskMessage<P> = TellMessage<P> & { replyTo: string };
export type ReplyMessage<P> = AskMessage<P> & { status: number };

export type AnyMessage<P> = TellMessage<P> | AskMessage<P> | ReplyMessage<P>;

export class Messages {
  static validate(rawMsg: string): AnyMessage<any> {
    const msg = JSON.parse(rawMsg);
    if (!msg.to || typeof msg.to !== "string") {
      throw Error("to not specified");
    }

    if (!msg.topic || typeof msg.topic !== "string") {
      throw Error("topic not specified");
    }

    if (msg.payload === undefined) {
      throw Error("payload not specified");
    }

    const protocol: Protocol & { replyTo?: string; status?: string } = {
      to: msg.to,
      topic: msg.topic
    };

    if (msg.replyTo) {
      if (typeof msg.replyTo !== "string") {
        throw Error("replyTo must be a string");
      }
      protocol.replyTo = msg.replyTo;
    }

    if (msg.status) {
      if (typeof msg.status !== "number") {
        throw Error("status must be a number");
      }
      protocol.status = msg.status;
    }

    return {
      ...protocol,
      payload: msg.payload
    };
  }

  static isTell<P>(msg: unknown): msg is TellMessage<P> {
    return (
      typeof msg === "object" &&
      msg !== null &&
      "to" in msg &&
      "topic" in msg &&
      "payload" in msg &&
      !("replyTo" in msg)
    );
  }

  static isAsk<P>(msg: unknown): msg is AskMessage<P> {
    return (
      typeof msg === "object" &&
      msg !== null &&
      "to" in msg &&
      "topic" in msg &&
      "payload" in msg &&
      "replyTo" in msg
    );
  }

  static isReply<P>(msg: unknown): msg is ReplyMessage<P> {
    return (
      typeof msg === "object" &&
      msg !== null &&
      "to" in msg &&
      "topic" in msg &&
      "payload" in msg &&
      "replyTo" in msg &&
      "status" in msg
    );
  }

  static ask<P>(msg: TellMessage<P>, corrId?: string): AskMessage<P> {
    return {
      ...msg,
      replyTo: corrId ?? genCorrId()
    };
  }

  static reply<P, R>(
    msg: AskMessage<P>,
    payload: R,
    status?: number
  ): ReplyMessage<R> {
    return {
      ...msg,
      payload,
      status: status ?? 200
    };
  }
}
