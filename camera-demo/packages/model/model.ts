import { readFileSync } from "fs";
import { Capacities, CapacityOptions } from "@actors/core";
import * as tf from "@tensorflow/tfjs-node";
import * as cocoSsd from "./coco-ssd";

type InferencePayload = {
  img: string;
  format: string;
};

type InferenceResult = {
  bbox: number[];
  class: string;
  score: number;
}[];

class Inference implements CapacityOptions<InferencePayload, InferenceResult> {
  async handle(payload: InferencePayload): Promise<InferenceResult> {
    const { img, format } = payload;
    const imageBuffer = Buffer.from(img, "base64");
    let imageTensor;
    if (format == "jpeg") {
      imageTensor = tf.node.decodeJpeg(imageBuffer);
    } else if (format == "png") {
      imageTensor = tf.node.decodePng(imageBuffer);
    } else {
      throw new Error(
        "Unsupported image format. Only JPEG and PNG are supported."
      );
    }

    // Load the COCO-SSD model
    const model = await cocoSsd.load();
    // Perform object detection
    const predictions = await model.detect(imageTensor);

    // Dispose the tensor to release memory
    tf.dispose(imageTensor);

    return predictions;
  }

  preCheck(): boolean {
    const avx = readFileSync("/proc/cpuinfo", "utf8").includes("avx");
    if (!avx) {
      console.warn("AVX not found. Model is not able to run");
      return false;
    }
    return true;
  }
}

export const inference = Capacities.create("Inference", new Inference());
