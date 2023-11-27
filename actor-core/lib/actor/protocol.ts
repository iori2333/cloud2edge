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

export class Message<P> implements DittoProtocol<P> {
  to: string;
  topic: string;
  path: string;
  headers: Record<string, unknown>;
  value: P;

  constructor({ topic, path, headers, value }: DittoProtocol<P>) {
    [this.to, this.topic] = this.extractTopic(topic);
    this.path = path;
    this.headers = headers;
    this.value = value;
  }

  private extractTopic(topic: string): [string, string] {
    const [ns, name] = topic.split("/");
    const shortTopic = topic.replace(ns + "/" + name + LIVE_COMMAND, "");
    return [ns + ":" + name, shortTopic];
  }

  respond<R>(payload: R, status?: number): CommandResponse<R> {
    return new ResponseBuilder<R>()
      .respondTo(this)
      .withPayload(payload)
      .withStatus(status ?? 200)
      .build();
  }

  get corrId(): string | undefined {
    return this.headers["correlation-id"] as string | undefined;
  }

  json(): DittoProtocol<P> {
    return {
      topic: this.to.replace(":", "/") + this.topic,
      path: this.path,
      headers: this.headers,
      value: this.value
    };
  }
}

export type AnyMessage = Message<any>;

export interface CommandResponse<P> extends DittoProtocol<P> {
  status: number;
}

export class MessageBuilder<P> {
  private payload?: P;
  private deviceId?: string;
  private message?: string;
  private corrId?: string;
  private contentType: ContentType = "application/json";

  withDevice(deviceId: string): this {
    this.deviceId = deviceId;
    return this;
  }

  withPayload(payload: P): this {
    this.payload = payload;
    return this;
  }

  withMessageName(message: string): this {
    this.message = message;
    return this;
  }

  withCorrId(corrId: string): this {
    this.corrId = corrId;
    return this;
  }

  withContentType(type: ContentType): this {
    this.contentType = type;
    return this;
  }

  build(): Message<P> {
    return new Message(this.json());
  }

  json() {
    if (!this.deviceId) {
      throw Error("device not specified");
    }

    if (!this.message) {
      throw Error("topic not specified");
    }

    if (this.payload === undefined) {
      throw Error("payload not specified");
    }

    return {
      topic: this.deviceId.replace(":", "/") + LIVE_COMMAND + this.message,
      path: "/inbox/messages/" + this.message,
      headers: {
        "correlation-id": this.corrId ?? genCorrId(),
        "content-type": this.contentType
      },
      value: this.payload
    };
  }
}

export class ResponseBuilder<P> {
  private payload?: P;
  private deviceId?: string;
  private path: string = "/";
  private topic?: string;
  private corrId?: string;
  private contentType: ContentType = "application/json";
  private status: number = 200;

  respondTo<R>(cmd: Message<R>): this {
    this.corrId = cmd.corrId;
    this.deviceId = cmd.to;
    this.topic = cmd.topic;
    this.path = cmd.path.replace("inbox", "outbox");

    return this;
  }

  withDevice(deviceId: string): this {
    this.deviceId = deviceId;
    return this;
  }

  withPayload(payload: P): this {
    this.payload = payload;
    return this;
  }

  withPath(path: string): this {
    this.path = path;
    return this;
  }

  withTopic(topic: string): this {
    this.topic = topic;
    return this;
  }

  withCorrId(corrId: string): this {
    this.corrId = corrId;
    return this;
  }

  withStatus(status: number): this {
    this.status = status;
    return this;
  }

  withContentType(type: ContentType): this {
    this.contentType = type;
    return this;
  }

  build(): CommandResponse<P> {
    if (!this.deviceId) {
      throw Error("device not specified");
    }

    if (!this.topic) {
      throw Error("topic not specified");
    }

    if (this.payload == undefined) {
      throw Error("payload not specified");
    }

    return {
      topic: this.deviceId.replace(":", "/") + this.topic,
      path: this.path,
      headers: {
        "correlation-id": this.corrId,
        "content-type": this.contentType
      },
      value: this.payload,
      status: this.status
    };
  }
}
