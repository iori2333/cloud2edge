import { ContentType, genCorrId } from "../utils";

export interface DittoProtocol<P> {
  topic: string;
  path: string;
  headers: Record<string, unknown>;
  value: P | null;
  status?: number;
}

export class Message<P = any> implements DittoProtocol<P> {
  topic: string;
  path: string;
  headers: Record<string, unknown>;
  value: P | null;

  constructor({ topic, path, headers, value }: DittoProtocol<P>) {
    this.topic = topic;
    this.path = path;
    this.headers = headers;
    this.value = value;
  }

  extractTopic(): [string, string] {
    const [ns, name, ...topic] = this.topic.split("/");
    return [ns + ":" + name, "/" + topic.join("/")];
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
}

export interface CommandResponse<P> extends DittoProtocol<P> {
  status: number;
}

export class MessageBuilder<P> {
  private payload: P | null = null;
  private devicePrefix: string | null = null;
  private message: string | null = null;
  private corrId?: string;
  private contentType: ContentType = "application/json";

  withDevice(deviceId: string): this {
    this.devicePrefix = deviceId.replace(":", "/");
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
    if (!this.devicePrefix) {
      throw Error("device not specified");
    }

    if (!this.message) {
      throw Error("topic not specified");
    }

    return new Message({
      topic: this.devicePrefix + "/things/live/messages/" + this.message,
      path: "/inbox/messages/" + this.message,
      headers: {
        "correlation-id": this.corrId ?? genCorrId(),
        "content-type": this.contentType
      },
      value: this.payload
    });
  }
}

export class ResponseBuilder<P> {
  private payload: P | null = null;
  private devicePrefix: string | null = null;
  private path: string = "/";
  private topic: string | null = null;
  private corrId?: string;
  private contentType: ContentType = "application/json";
  private status: number = 200;

  respondTo<R>(cmd: Message<R>): this {
    const corrId = cmd.headers["correlation-id"];
    if (typeof corrId != "string") {
      return this;
    }
    this.corrId = corrId;

    const [ns, name, ...topic] = cmd.topic.split("/");
    this.devicePrefix = ns + "/" + name;
    this.topic = "/" + topic.join("/");
    this.path = cmd.path.replace("inbox", "outbox");

    return this;
  }

  withDevice(deviceId: string): this {
    this.devicePrefix = deviceId.replace(":", "/");
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
    if (!this.devicePrefix) {
      throw Error("device not specified");
    }

    if (!this.topic) {
      throw Error("topic not specified");
    }

    return {
      topic: this.devicePrefix + this.topic,
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
