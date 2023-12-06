import { WebSocket } from "ws";

import {
  AnyMessage,
  Actor as BaseActor,
  Conn,
  Message,
  Output,
  RandomRouting,
  Router,
  RoutingLogic,
  Transition,
  WebsocketConn
} from "@actors/core";

type InferencePayload = {
  name: string;
  img: string;
  format: string;
};
type InferenceTransition = Transition<
  "Inference",
  ActorState,
  InferencePayload
>;
type Inference = Output<"org.i2ec:camera-model", "Inference", InferencePayload>;

type StatusPayload = {
  name: string;
  pending: number;
  avg_time: number;
};
type StatusTransition = Transition<"Status", ActorState, StatusPayload>;

type InferenceResultPayload = {
  name: string;
  img: string;
  pred?: {
    bbox: number[];
    class: string;
    score: number;
  }[];
  err?: string;
};
type InferenceResult = Output<
  "org.i2ec:camera-user",
  "InferenceResult",
  InferenceResultPayload
>;

type ActorState = "Ready";
type ActorTransition = InferenceTransition | StatusTransition;
type ActorOutput = Inference | InferenceResult;

const DEFAULT_STATE: ActorState = "Ready";

class ModelScheduler implements RoutingLogic {
  pending: Map<string, number> = new Map();

  select(to: string, candidates: string[]): string {
    let min = Infinity;
    let res = "";
    for (const c of candidates) {
      const p = this.pending.get(c) || 0;
      if (p < min) {
        min = p;
        res = c;
      }
    }

    console.log(this.pending);
    console.log(`Select ${res} for ${to}`);
    return res;
  }

  update(name: string, pending: number): void {
    this.pending.set(name, pending);
  }
}

class Actor extends Router<
  ActorState,
  ActorTransition,
  ActorOutput,
  ModelScheduler
> {
  model_url: string | null = null;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE, new ModelScheduler());
    this.addTransitions(
      new Transition("Inference", {
        handler: this.onInference.bind(this)
      }),
      new Transition("Status", {
        handler: this.onStatus.bind(this)
      })
    );
  }

  protected async onStart(): Promise<void> {
    this.register("org.i2ec:camera-model", "org.i2ec:camera-model-1");
    this.register("org.i2ec:camera-model", "org.i2ec:camera-model-2");
  }

  private onStatus(msg: Message<StatusPayload>) {
    const { name, pending, avg_time } = msg.payload;
    const eta = pending * avg_time;
    this.logic.update(name, eta);
  }

  private onInference(msg: Message<InferencePayload>) {
    const { name, img, format } = msg.payload;
    console.log(name);
    this.tell({
      to: "org.i2ec:camera-model",
      topic: "Inference",
      payload: { name, img, format }
    });
  }
}

function main() {
  const ws = new WebsocketConn(
    "ws://localhost:8080/ws/org.i2ec/camera-scheduler"
  );

  const actor = new Actor("org.i2ec:camera-scheduler", ws);
  actor.start();
}

main();
