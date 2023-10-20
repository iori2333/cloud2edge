import { WebSocket } from "ws";
import * as miio from "miio-api";

import { Message, Actor as BaseActor, Transition, MessageBuilder } from "@actors/core";

type ActorState = "Off" | "On";
const DEFAULT_STATE: ActorState = "Off";

type Info = {
  power: "on" | "off";
  led: "on" | "off";
  humidity: number;
  aqi: number;
};

type PowerPayload = {
  power: string;
};

type QueryStatePayload = {
  fields?: string[];
}

class Actor extends BaseActor<ActorState> {
  _device?: miio.Device;

  get device(): miio.Device {
    if (!this._device) {
      throw Error("device not initialized");
    }
    return this._device;
  }

  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.addTransitions(
      new Transition("power", "On", "Off", msg => this.power(msg)),
      new Transition("power", "Off", "On", msg => this.power(msg)),
      new Transition("query_state", "On", "On", msg => this.queryState(msg))
    );
  }

  protected override async onStart(): Promise<void> {
    setInterval(() => {
      this.read_info().then(info => {
        const msg = new MessageBuilder()
          .withDevice("org.i2ec:purifier-db")
          .withMessageName("update")
          .withPayload({ ...info, timestamp: Date.now() })
          .build();
        this.tell(msg);
      });
    }, 5000);

    this._device = await miio.device({
      address: "192.168.28.233",
      token: "57a6add53a0326b4cee51ed5aa5c7cb9"
    });
    const state: string[] = await this.device.call("get_prop", ["power"]);
    this.state = state[0] === "on" ? "On" : "Off";
  }

  private async read_info(): Promise<Info> {
    const properties = ["power", "aqi", "humidity", "led"];
    const r = await this.device.call<typeof properties, any>("get_prop", properties);
    return {
      power: r[0],
      aqi: r[1],
      humidity: r[2],
      led: r[3]
    };
  }

  private power(msg: Message<PowerPayload>): void {
    const payload = msg.value;
    this.device.call("set_power", [payload.power]);
  }

  private queryState(msg: Message<QueryStatePayload>): void {
    const payload = msg.value;

    this.read_info().then(info => {
      const send: Record<string, any> = {};

      for (const field of payload.fields ?? Object.keys(info)) {
        if (field in info) {
          send[field] = info[field as keyof Info];
        }
      }
      const resp = msg.respond(send, 200);
      this.tell(resp);
    });
  }
}

function main() {
  const ws = new WebSocket("ws://ditto:ditto@localhost:32728/ws/2");

  ws.on("error", err => {
    console.log(`Failed to connect: ${err}`);
  });

  ws.on("open", () => {
    console.log(`Successfully connected to ${ws.url}`);
    ws.send("START-SEND-MESSAGES");
    ws.send("START-SEND-LIVE-COMMANDS");
  });

  ws.on("close", (code, reason) => {
    console.log(`Connection closed: ${code}, ${reason.toString()}`);
  });

  const actor = new Actor("org.i2ec:air-purifier", ws);
  actor.start();
}

main();
