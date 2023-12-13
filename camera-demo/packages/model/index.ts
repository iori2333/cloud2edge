import {
  Actor as BaseActor,
  Capacities,
  Conn,
  Conns,
  Message,
  Output,
  Transition
} from "@actors/core";
import { inference as inferenceCapacity } from "./model";

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

const inference = Capacities.withMapper(inferenceCapacity, {
  payload: (input: InferencePayload) => ({
    img: input.img,
    format: input.format
  }),
  result: (result, input): InferenceResult => ({
    to: "org.i2ec:camera-user",
    topic: "InferenceResult",
    payload: {
      name: input.name,
      img: input.img,
      pred: result
    }
  }),
  error: (reason, input): InferenceResult => ({
    to: "org.i2ec:camera-user",
    topic: "InferenceResult",
    payload: {
      name: input.name,
      img: input.img,
      err: reason.toString()
    }
  })
});

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  model_url: string | null = null;
  pending: number = 0;
  done: number = 0;
  time: number = 0;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);
    this.addTransitions({
      topic: "ModelPrepare",
      handler: msg => this.onModelPrepare(msg)
    });
    this.addTransition({
      topic: "Inference",
      handler: msg => this.onInference(msg)
    });
  }

  private onModelPrepare(msg: Message<ModelPreparePayload>) {
    const { name, model } = msg.payload;
    console.log(`Preparing model ${name}, url: ${model}`);
    this.model_url = model;
  }

  private async onInference(msg: Message<InferencePayload>) {
    const { name, img, format } = msg.payload;
    console.log(`[${name}] Inference image`);
    const tic = Date.now();
    this.pending++;

    await this.sendStatus();
    const response = await this.call(inference, { name, img, format });
    const toc = Date.now();
    this.time += toc - tic;
    this.done++;
    this.pending--;

    await this.tell(response);
    await this.sendStatus();
  }

  private async sendStatus() {
    if (this.done === 0) return;
    const avg_time = this.time / this.done;
    await this.tell({
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
  const conn = Conns.ws("ws://localhost:8080/ws/org.i2ec/camera-model-1");
  const actor = new Actor("org.i2ec:camera-model-1", conn);
  actor.start();
}

main();
