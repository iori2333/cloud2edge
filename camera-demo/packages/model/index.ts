import {
  Actor as BaseActor,
  Conn,
  Message,
  Output,
  Transition,
  WebsocketConn
} from "@actors/core";
import { capacity as modelCapacity } from "./model";

type ModelPreparePayload = {
  name: string;
  model: string;
};
type ModelPrepareTransition = Transition<
  "ModelPrepare",
  ActorState,
  ModelPreparePayload
>;

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

type StatusPayload = {
  name: string;
  pending: number;
  avg_time: number;
};
type Status = Output<"org.i2ec:camera-scheduler", "Status", StatusPayload>;

type ActorState = "Idle" | "Ready";
type ActorTransition = ModelPrepareTransition | InferenceTransition;
type ActorOutput = InferenceResult | Status;

const DEFAULT_STATE: ActorState = "Ready";
const model = modelCapacity.withMappers({
  payload: (input: InferencePayload) => ({
    img: input.img,
    format: input.format
  }),
  result: (result, input: InferencePayload) => ({
    name: input.name,
    img: input.img,
    ...result
  })
});

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  model_url: string | null = null;
  pending: number = 0;
  done: number = 0;
  time: number = 0;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);
    this.addTransitions(
      new Transition("ModelPrepare", {
        to: "Ready",
        handler: this.onModelPrepare.bind(this)
      }),
      new Transition("Inference", {
        from: "Ready",
        handler: this.onInference.bind(this)
      })
    );
  }

  private onModelPrepare(msg: Message<ModelPreparePayload>) {
    const { name, model } = msg.payload;
    console.log(`Preparing model ${name}, url: ${model}`);
    this.model_url = model;
  }

  private onInference(msg: Message<InferencePayload>) {
    const { name, img, format } = msg.payload;
    console.log(`[${name}] Inference image`);
    const tic = Date.now();
    this.pending++;

    this.sendStatus();
    this.call(model, { name, img, format })
      .then(data => {
        const toc = Date.now();
        this.time += toc - tic;
        this.done++;
        this.pending--;

        this.tell({
          to: "org.i2ec:camera-user",
          topic: "InferenceResult",
          payload: data
        });

        this.sendStatus();
      })
      .catch(err => console.log(`[${name}] Failed to inference: ${err}`));
  }

  private sendStatus() {
    if (this.done === 0) return;
    const avg_time = this.time / this.done;
    this.tell({
      to: "org.i2ec:camera-scheduler",
      topic: "Status",
      payload: {
        name: this.thingId,
        pending: this.pending,
        avg_time
      }
    });
  }
}

function main() {
  const ws = new WebsocketConn(
    "ws://localhost:8080/ws/org.i2ec/camera-model-1"
  );

  const actor = new Actor("org.i2ec:camera-model-1", ws);
  actor.start();
}

main();
