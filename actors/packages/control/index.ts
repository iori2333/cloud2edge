import { WebSocket } from "ws";
import Express from "express";

import { Message, Actor as BaseActor, MessageBuilder } from "@actors/core";

type ActorState = "Default";
const DEFAULT_STATE: ActorState = "Default";

class Actor extends BaseActor<ActorState> {
  app: Express.Application;

  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.app = Express();
  }

  protected override onStart(): void {
    this.app.get("/start", (req, res) => {
      const msg = new MessageBuilder()
        .withDevice("org.i2ec:air-purifier")
        .withMessageName("power")
        .withPayload({ power: "on" })
        .build();

      this.tell(msg);
      res.send({ status: "OK" });
    });

    this.app.get("/query", (req, res) => {
      const fields = (req.query.fields as string).split(",");
      const msg = new MessageBuilder()
        .withDevice("org.i2ec:air-purifier")
        .withMessageName("query_state")
        .withPayload({ fields })
        .build();

      this.ask<Message>(msg, 1000).then(
        v => res.json(v.value),
        e => res.json({ error: e.message })
      );
    });

    this.app.listen(3000);
  }
}

function main() {
  const ws = new WebSocket("ws://ditto:ditto@localhost:31181/ws/2");

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

  const actor = new Actor("<control>", ws);
  actor.start();
}

main();
