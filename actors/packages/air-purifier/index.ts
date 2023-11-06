import { WebSocket } from "ws";
import * as miio from "miio-api";

import { Message, Actor as BaseActor, Output, Transition } from "@actors/core";

type PowerPayload = {
  power: string;
};
type PowerTransition = Transition<"power", ActorState, PowerPayload>;

type QueryStatePayload = {
  fields?: string[];
  replyTo: string;
};
type QueryStateTransition = Transition<
  "query_state",
  ActorState,
  QueryStatePayload
>;

type UpdateDBPayload = {
  power: "on" | "off";
  led: "on" | "off";
  humidity: number;
  aqi: number;
  timestamp: number;
};
type UpdateDB = Output<"org.i2ec:purifier-db", "update", UpdateDBPayload>;

type RespondQueryPayload = {
  power?: "on" | "off";
  led?: "on" | "off";
  humidity?: number;
  aqi?: number;
};
type RespondQuery = Output<string, "query_state_respond", RespondQueryPayload>;

type Info = Omit<UpdateDBPayload, "timestamp">;

type ActorState = "Off" | "On";
type ActorOutput = UpdateDB | RespondQuery;
type ActorTransition = PowerTransition | QueryStateTransition;

const DEFAULT_STATE: ActorState = "Off";

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
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
      new Transition("power", {
        from: "Off",
        to: "On",
        handler: this.power.bind(this)
      }),
      new Transition("power", {
        from: "Off",
        to: "On",
        handler: this.power.bind(this)
      }),
      new Transition("query_state", {
        from: "On",
        handler: this.queryState.bind(this)
      })
    );
  }

  protected override async onStart(): Promise<void> {
    setInterval(() => {
      this.read_info().then(info => {
        this.tell({
          to: "org.i2ec:purifier-db",
          topic: "update",
          payload: { ...info, timestamp: Date.now() }
        });
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
    const r = await this.device.call<typeof properties, any>(
      "get_prop",
      properties
    );
    return {
      power: r[0],
      aqi: r[1],
      humidity: r[2],
      led: r[3]
    };
  }

  private power(msg: Message<PowerPayload>): void {
    const { power } = msg.value;
    this.device.call("set_power", [power]);
  }

  private queryState(msg: Message<QueryStatePayload>): void {
    const { fields, replyTo } = msg.value;

    this.read_info().then(info => {
      const send: Record<string, any> = {};
      for (const field of fields ?? Object.keys(info)) {
        if (field in info) {
          send[field] = info[field as keyof Info];
        }
      }
      this.tell({
        to: replyTo,
        topic: "query_state_respond",
        payload: send
      });
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
