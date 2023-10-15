import { WebSocket } from "ws";
import * as miio from "miio-api";

import { Message, Actor as BaseActor, Transition } from "@actors/core";

type ActorState = "Off" | "On";
const DEFAULT_STATE: ActorState = "Off";

type Info = {
  power: "on" | "off";
  led: "on" | "off";
  humidity: number;
  aqi: number;
};
type Prop = keyof Info;

class Actor extends BaseActor<ActorState> {
  device: miio.Device;

  constructor(device: miio.Device, thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.device = device;
    this.addTransition(
      new Transition("power", "On", "Off", this.powerOff.bind(this))
    );
    this.addTransition(new Transition("power", "Off", "On", this.powerOn.bind(this)));
    this.addTransition(
      new Transition("query_state", "On", "On", this.queryState.bind(this))
    );
  }

  protected override onStart(): void { }

  private async read_info(): Promise<Info> {
    const properties: Prop[] = ["power", "aqi", "humidity", "led"];
    const r = await this.device.call<Prop[], any>("get_prop", properties);
    return {
      power: r[0],
      aqi: r[1],
      humidity: r[2],
      led: r[3]
    };
  }

  private powerOn(): void {
    this.device.call("set_power", ["on"]);
  }

  private powerOff(): void {
    this.device.call("set_power", ["off"]);
  }

  private queryState(msg: Message): void {
    const payload: { fields: string[] } = msg.value;

    this.read_info().then(info => {
      const send: Record<string, any> = {};

      for (const field of payload.fields) {
        if (field in info) {
          send[field] = info[field as Prop];
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

  miio
    .device({
      address: "192.168.28.233",
      token: "57a6add53a0326b4cee51ed5aa5c7cb9"
    })
    .then(device => {
      const actor = new Actor(device, "org.i2ec:air-purifier", ws);
      actor.start();
    })
    .catch(err => console.log(err));
}

main();
