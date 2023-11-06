import { WebSocket } from "ws";
import Express from "express";

import {
  Message,
  Actor as BaseActor,
  MessageBuilder,
  Output
} from "@actors/core";

type ActorState = "Default";
const DEFAULT_STATE: ActorState = "Default";

type PowerPayload = {
  power: string;
};
type Power = Output<"org.i2ec:air-purifier", "power", PowerPayload>;

type QueryStatePayload = {
  fields?: string[];
  replyTo: string;
};
type QueryState = Output<
  "org.i2ec:air-purifier",
  "query_state",
  QueryStatePayload
>;

type QueryDBPayload = {
  start?: number;
  end?: number;
  limit?: number;
  offset?: number;
};
type QueryDB = Output<"org.i2ec:purifier-db", "query", QueryDBPayload>;

type ActorOutput = Power | QueryState | QueryDB;

class Actor extends BaseActor<ActorState, never, ActorOutput> {
  app: Express.Application;

  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.app = Express();
  }

  protected override async onStart(): Promise<void> {
    this.app.get("/start", (req, res) => {
      this.tell({
        to: "org.i2ec:air-purifier",
        topic: "power",
        payload: { power: "on" }
      });
      res.send({ status: "OK" });
    });

    this.app.get("/stop", (req, res) => {
      this.tell({
        to: "org.i2ec:air-purifier",
        topic: "power",
        payload: { power: "off" }
      });
      res.send({ status: "OK" });
    });

    this.app.get("/query_state", (req, res) => {
      const fields = req.query.fields as string[] | undefined;

      this.ask<Message<any>>(
        {
          to: "org.i2ec:air-purifier",
          topic: "query_state",
          payload: { fields, replyTo: this.thingId }
        },
        1000
      ).then(
        v => res.json(v.value),
        e => res.json({ error: e.message })
      );
    });

    this.app.get("/query_db", (req, res) => {
      const msg = new MessageBuilder()
        .withDevice("org.i2ec:purifier-db")
        .withMessageName("query")
        .withPayload({})
        .build();
      this.ask<Message<any>>(
        {
          to: "org.i2ec:purifier-db",
          topic: "query",
          payload: {}
        },
        1000
      ).then(
        v => res.json(v.value),
        e => res.json({ error: e.message })
      );
    });

    this.app.listen(3000);
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

  const actor = new Actor("org.i2ec:user-actor", ws);
  actor.start();
}

main();
